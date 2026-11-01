/**
 * ============================================================================
 * DATABASE CONNECTION, TABLE CREATION AND DEMO DATA (MySQL)
 * ============================================================================
 *
 * What this file does, in order:
 *   1. Reads the DATABASE_URL setting to find the MySQL server.
 *        - On your own PC (XAMPP): mysql://root:@localhost:3306/library_db
 *        - In the cloud (Aiven):   mysql://avnadmin:<password>@<host>:<port>/defaultdb?ssl-mode=REQUIRED
 *   2. Creates the database if it does not exist yet (handy for XAMPP).
 *   3. Opens a "connection pool": a small set of reusable connections, so
 *      each web request does not have to open a brand-new connection.
 *   4. Creates all the tables (only if they don't exist yet).
 *   5. If the database is empty, fills it with demo data
 *      (admin, librarians, students, 30 categories, 150 books, settings).
 *
 * The rest of the app gets the database by calling `getDatabase()`.
 * ============================================================================
 */
import mysql, { Pool, PoolOptions } from 'mysql2/promise';
import { drizzle, MySql2Database } from 'drizzle-orm/mysql2';
import bcrypt from 'bcryptjs';
import * as schema from '../src/db/librarydb.js';

/** The Drizzle database object, typed with our schema so `db.query.books...` etc. work. */
export type LibraryDb = MySql2Database<typeof schema>;

/** Default connection used when DATABASE_URL is not set: XAMPP's default user `root` with no password. */
const DEFAULT_DATABASE_URL = 'mysql://root:@localhost:3306/library_db';

// ----------------------------------------------------------------------------
// 1. TABLE DEFINITIONS (the real SQL that MySQL runs)
// ----------------------------------------------------------------------------
// These statements work on both MySQL 8 (Aiven) and MariaDB 10.4+ (XAMPP).
//   - ENGINE=InnoDB  → supports transactions, row locking and foreign keys.
//   - utf8mb4        → stores any character, including Myanmar script and emoji.
//   - FOREIGN KEY    → MySQL refuses data that points to a row that doesn't exist
//                      (referential integrity). ON DELETE CASCADE removes child
//                      rows automatically; ON DELETE SET NULL keeps them but clears the link.
// The order matters: a table must be created before another table can point to it.
const TABLE_OPTIONS = 'ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';

export const TABLE_DEFINITIONS: { name: string; sql: string }[] = [
  {
    name: 'users',
    sql: `CREATE TABLE IF NOT EXISTS users (
  user_id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(150) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role ENUM('student','librarian','admin') NOT NULL,
  phone VARCHAR(30) NULL,
  communication_preferences TEXT NULL,
  created_at DATETIME NULL
) ${TABLE_OPTIONS}`,
  },
  {
    name: 'students',
    sql: `CREATE TABLE IF NOT EXISTS students (
  student_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  student_code VARCHAR(50) NOT NULL UNIQUE,
  department VARCHAR(100) NOT NULL,
  year INT NOT NULL,
  CONSTRAINT fk_students_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ${TABLE_OPTIONS}`,
  },
  {
    name: 'librarians',
    sql: `CREATE TABLE IF NOT EXISTS librarians (
  librarian_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  employee_code VARCHAR(50) NOT NULL UNIQUE,
  CONSTRAINT fk_librarians_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ${TABLE_OPTIONS}`,
  },
  {
    name: 'categories',
    sql: `CREATE TABLE IF NOT EXISTS categories (
  category_id INT AUTO_INCREMENT PRIMARY KEY,
  category_name VARCHAR(100) NOT NULL UNIQUE
) ${TABLE_OPTIONS}`,
  },
  {
    name: 'books',
    sql: `CREATE TABLE IF NOT EXISTS books (
  book_id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  author VARCHAR(255) NOT NULL,
  isbn VARCHAR(50) NOT NULL UNIQUE,
  publisher VARCHAR(255) NULL,
  category_id INT NULL,
  quantity INT NOT NULL DEFAULT 1,
  available_quantity INT NOT NULL DEFAULT 1,
  shelf_location VARCHAR(50) NULL,
  format ENUM('Physical','Digital','Serial') NOT NULL DEFAULT 'Physical',
  metadata_schema ENUM('MARC21','RDA','Standard') NULL DEFAULT 'Standard',
  metadata_record TEXT NULL,
  is_acquisition TINYINT(1) NULL DEFAULT 0,
  acquisition_source VARCHAR(255) NULL,
  budget_code VARCHAR(50) NULL,
  cover_url VARCHAR(500) NULL,
  created_at DATETIME NULL,
  CONSTRAINT fk_books_category FOREIGN KEY (category_id) REFERENCES categories(category_id) ON DELETE SET NULL
) ${TABLE_OPTIONS}`,
  },
  {
    name: 'borrow_records',
    sql: `CREATE TABLE IF NOT EXISTS borrow_records (
  record_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  book_id INT NOT NULL,
  borrow_date DATETIME NULL,
  due_date DATETIME NOT NULL,
  return_date DATETIME NULL,
  status ENUM('requested','borrowed','return_requested','returned','overdue','cancelled') NOT NULL DEFAULT 'requested',
  fine_amount DECIMAL(10,2) NULL DEFAULT 0,
  INDEX idx_borrow_status (status),
  CONSTRAINT fk_borrow_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  CONSTRAINT fk_borrow_book FOREIGN KEY (book_id) REFERENCES books(book_id) ON DELETE CASCADE
) ${TABLE_OPTIONS}`,
  },
  {
    name: 'logs',
    sql: `CREATE TABLE IF NOT EXISTS logs (
  log_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  action VARCHAR(50) NOT NULL,
  details TEXT NULL,
  timestamp DATETIME NULL,
  CONSTRAINT fk_logs_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL
) ${TABLE_OPTIONS}`,
  },
  {
    name: 'system_config',
    sql: `CREATE TABLE IF NOT EXISTS system_config (
  \`key\` VARCHAR(100) NOT NULL PRIMARY KEY,
  value VARCHAR(255) NOT NULL,
  description VARCHAR(255) NULL,
  updated_at DATETIME NULL
) ${TABLE_OPTIONS}`,
  },
  {
    name: 'serial_issues',
    sql: `CREATE TABLE IF NOT EXISTS serial_issues (
  issue_id INT AUTO_INCREMENT PRIMARY KEY,
  book_id INT NOT NULL,
  issue_number VARCHAR(50) NOT NULL,
  volume_number VARCHAR(50) NULL,
  publication_date DATETIME NULL,
  received_date DATETIME NULL,
  status ENUM('Expected','Received','Claimed','Late') NULL DEFAULT 'Expected',
  CONSTRAINT fk_serial_book FOREIGN KEY (book_id) REFERENCES books(book_id) ON DELETE CASCADE
) ${TABLE_OPTIONS}`,
  },
];

// ----------------------------------------------------------------------------
// 2. READING THE CONNECTION SETTINGS
// ----------------------------------------------------------------------------

/**
 * Turns the DATABASE_URL text into the options object that the mysql2 library expects.
 *
 * Cloud databases such as Aiven require an encrypted (SSL/TLS) connection.
 *   - If DB_SSL_CA contains Aiven's CA certificate, the server's identity is fully verified (best).
 *   - If the URL only says ?ssl-mode=REQUIRED, the connection is still encrypted,
 *     but the certificate is not checked, so we print a warning.
 */
function buildPoolOptions(): PoolOptions {
  const url = new URL(process.env.DATABASE_URL || DEFAULT_DATABASE_URL);
  const sslMode = (url.searchParams.get('ssl-mode') || url.searchParams.get('sslmode') || '').toUpperCase();
  // Vercel stores multi-line values fine, but allow "\n" written literally as well.
  const caCertificate = process.env.DB_SSL_CA?.replace(/\\n/g, '\n');

  const options: PoolOptions = {
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.replace(/^\//, '')) || 'library_db',
    waitForConnections: true,
    // Serverless functions (Vercel) run many small copies of the app, so each copy keeps few connections.
    connectionLimit: process.env.VERCEL ? 3 : 10,
    // Store and read all dates in UTC so local PC and cloud server agree on times.
    timezone: 'Z',
    // Return DECIMAL values (e.g. SUM(), fines) as normal numbers instead of text.
    decimalNumbers: true,
  };

  if (caCertificate) {
    options.ssl = { ca: caCertificate, rejectUnauthorized: true };
  } else if (sslMode && sslMode !== 'DISABLED') {
    console.warn('DATABASE: SSL is on but DB_SSL_CA is not set, so the server certificate is not verified.');
    options.ssl = { rejectUnauthorized: false };
  }
  return options;
}

/**
 * XAMPP convenience: if the database (e.g. `library_db`) does not exist yet, create it.
 * On cloud hosts the database already exists, so this does nothing there.
 */
async function ensureDatabaseExists(options: PoolOptions): Promise<void> {
  try {
    const connection = await mysql.createConnection(options);
    await connection.end();
  } catch (error: any) {
    if (error.code !== 'ER_BAD_DB_ERROR') throw error; // a different problem, e.g. MySQL is not running
    const { database, ...withoutDatabase } = options;
    const connection = await mysql.createConnection(withoutDatabase);
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    await connection.end();
    console.log(`DATABASE: created new database "${database}".`);
  }
}

// ----------------------------------------------------------------------------
// 3. DEMO DATA
// ----------------------------------------------------------------------------

/**
 * Fills an empty database with demo data so the app can be tried straight away.
 * Everything is inserted inside ONE transaction: either all of it is saved, or none of it.
 * Demo logins:  admin@library.edu / admin123,  sarah@library.edu / password123,
 *               saw@student.edu / password123
 */
async function seedDemoData(db: LibraryDb): Promise<void> {
  const existingUsers = await db.select({ id: schema.users.id }).from(schema.users).limit(1);
  if (existingUsers.length > 0) return; // already has data → don't seed again

  console.log('DATABASE: empty database detected, adding demo data...');
  const now = new Date();
  const adminPassword = bcrypt.hashSync('admin123', 10);
  const commonPassword = bcrypt.hashSync('password123', 10);

  try {
    await db.transaction(async (tx) => {
      // Administrator account
      await tx.insert(schema.users).values({
        fullName: 'System Admin', email: 'admin@library.edu', password: adminPassword, role: 'admin', createdAt: now,
      });

      // 30 subject categories (ids 1–30, in this order)
      const categoryNames = [
        'Computer Science', 'Mathematics', 'Physics', 'Chemistry', 'Biology',
        'Literature', 'History', 'Geography', 'Philosophy', 'Psychology',
        'Sociology', 'Economics', 'Political Science', 'Law', 'Medicine',
        'Engineering', 'Architecture', 'Art', 'Music', 'Sports',
        'Business', 'Finance', 'Marketing', 'Management', 'Programming',
        'Artificial Intelligence', 'Cybersecurity', 'Networking', 'Data Science', 'Ethics',
      ];
      await tx.insert(schema.categories).values(categoryNames.map((categoryName) => ({ categoryName })));

      // Library rules that an admin can change later (PUT /api/config/:key)
      await tx.insert(schema.systemConfig).values([
        { key: 'LOAN_DURATION_DAYS', value: '14', description: 'Standard loan period for members', updatedAt: now },
        { key: 'DAILY_FINE_RATE', value: '0.50', description: 'Fine amount per day overdue ($)', updatedAt: now },
        { key: 'MAX_LOANS_PER_USER', value: '5', description: 'Maximum books a student can hold', updatedAt: now },
        { key: 'LIBRARY_NAME', value: 'University Library System', description: 'Display name at top of UI', updatedAt: now },
        { key: 'CURRENCY_SYMBOL', value: '$', description: 'Local currency for fines', updatedAt: now },
      ]);

      // Demo students: a `users` row first, then the linked `students` profile row
      const demoStudents = [
        { name: 'Saw Pyae Phyo Kyaw', email: 'saw@student.edu', code: '200309', dept: 'Cyber Security', year: 3 },
        { name: 'Aung Kyaw Thu', email: 'aung@student.edu', code: 'ST002', dept: 'IT', year: 2 },
        { name: 'Ei Phyu Khin', email: 'ei@student.edu', code: 'ST003', dept: 'Business', year: 1 },
        { name: 'Min Htet Oo', email: 'min@student.edu', code: 'ST004', dept: 'Mathematics', year: 4 },
        { name: 'Thandar Win', email: 'thandar@student.edu', code: 'ST005', dept: 'Physics', year: 2 },
      ];
      for (const s of demoStudents) {
        const [{ id }] = await tx.insert(schema.users)
          .values({ fullName: s.name, email: s.email, password: commonPassword, role: 'student', createdAt: now })
          .$returningId(); // MySQL gives back the new AUTO_INCREMENT id
        await tx.insert(schema.students).values({ userId: id, studentCode: s.code, department: s.dept, year: s.year });
      }

      // Demo librarians
      const demoLibrarians = [
        { name: 'Sarah Librarian', email: 'sarah@library.edu', code: 'EMP001' },
        { name: 'Kevin Staff', email: 'kevin@library.edu', code: 'EMP002' },
      ];
      for (const l of demoLibrarians) {
        const [{ id }] = await tx.insert(schema.users)
          .values({ fullName: l.name, email: l.email, password: commonPassword, role: 'librarian', createdAt: now })
          .$returningId();
        await tx.insert(schema.librarians).values({ userId: id, employeeCode: l.code });
      }

      // 150 demo books built from 20 well-known titles (later copies are labelled "Vol. 2", "Vol. 3"...)
      const bookCovers = [
        'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400&q=80',
        'https://images.unsplash.com/photo-1589998059171-988d887df646?w=400&q=80',
        'https://images.unsplash.com/photo-1543004218-ee141d0ef1bd?w=400&q=80',
        'https://images.unsplash.com/photo-1532012197267-da84d127e765?w=400&q=80',
        'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=400&q=80',
        'https://images.unsplash.com/photo-1531988042231-d39a9cc12a9a?w=400&q=80',
        'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=400&q=80',
        'https://images.unsplash.com/photo-1495446815901-a7297e633e8d?w=400&q=80',
        'https://images.unsplash.com/photo-1516979187457-637abb4f9353?w=400&q=80',
        'https://images.unsplash.com/photo-1550399105-c4db5fb85c18?w=400&q=80',
        'https://images.unsplash.com/photo-1519682337058-a94d519337bc?w=400&q=80',
        'https://images.unsplash.com/photo-1476275466078-4007374efbbe?w=400&q=80',
        'https://images.unsplash.com/photo-1513001900722-370f803f498d?w=400&q=80',
      ];
      const bookTitles = [
        { title: 'Clean Code: A Handbook of Agile Software Craftsmanship', author: 'Robert C. Martin' },
        { title: 'Introduction to Algorithms', author: 'Thomas H. Cormen' },
        { title: 'Design Patterns', author: 'Erich Gamma' },
        { title: 'The Pragmatic Programmer', author: 'Andrew Hunt' },
        { title: 'Modern Operating Systems', author: 'Andrew S. Tanenbaum' },
        { title: 'Computer Networking: A Top-Down Approach', author: 'James Kurose' },
        { title: 'Artificial Intelligence: A Modern Approach', author: 'Stuart Russell' },
        { title: 'Cybersecurity for Beginners', author: 'Raef Meeuwisse' },
        { title: 'Data Science from Scratch', author: 'Joel Grus' },
        { title: 'The Art of Computer Programming', author: 'Donald Knuth' },
        { title: 'Discrete Mathematics and Its Applications', author: 'Kenneth Rosen' },
        { title: 'Calculus', author: 'James Stewart' },
        { title: 'The Great Gatsby', author: 'F. Scott Fitzgerald' },
        { title: 'To Kill a Mockingbird', author: 'Harper Lee' },
        { title: 'A Brief History of Time', author: 'Stephen Hawking' },
        { title: 'Thinking, Fast and Slow', author: 'Daniel Kahneman' },
        { title: 'The Wealth of Nations', author: 'Adam Smith' },
        { title: 'Sapiens: A Brief History of Humankind', author: 'Yuval Noah Harari' },
        { title: 'The Republic', author: 'Plato' },
        { title: 'Meditations', author: 'Marcus Aurelius' },
      ];
      const demoBooks = Array.from({ length: 150 }, (_, i) => {
        const template = bookTitles[i % bookTitles.length];
        const volumeSuffix = i > 19 ? ` (Vol. ${Math.floor(i / 20) + 1})` : '';
        return {
          title: template.title + volumeSuffix,
          author: template.author,
          isbn: `ISBN-${1000 + i}-${Math.floor(Math.random() * 9000) + 1000}`,
          categoryId: ((i + (i % 30)) % 30) + 1,
          quantity: 1,
          availableQuantity: 1,
          shelfLocation: `SEC-${Math.floor(i / 10)}-${String.fromCharCode(65 + (i % 5))}`,
          coverUrl: bookCovers[i % bookCovers.length],
          createdAt: now,
        };
      });
      // One multi-row INSERT is much faster than 150 separate ones, especially to a cloud database.
      await tx.insert(schema.books).values(demoBooks);
    });
    console.log('DATABASE: demo data added.');
  } catch (error: any) {
    // On Vercel two copies of the app can start at the same moment and both try to seed.
    // The second one hits the UNIQUE email rule, its transaction is rolled back, and that's fine.
    if (error.code === 'ER_DUP_ENTRY' || error.cause?.code === 'ER_DUP_ENTRY') {
      console.log('DATABASE: demo data was already added by another server instance.');
      return;
    }
    throw error;
  }
}

// ----------------------------------------------------------------------------
// 4. PUBLIC ENTRY POINT
// ----------------------------------------------------------------------------

let databasePromise: Promise<{ db: LibraryDb; pool: Pool }> | null = null;

/**
 * Returns the ready-to-use database. The setup steps run only once per server process;
 * later calls reuse the same connection pool.
 */
export function getDatabase(): Promise<{ db: LibraryDb; pool: Pool }> {
  if (!databasePromise) {
    databasePromise = (async () => {
      const options = buildPoolOptions();
      console.log(`DATABASE: connecting to MySQL at ${options.host}:${options.port}/${options.database} ...`);
      await ensureDatabaseExists(options);

      const pool = mysql.createPool(options);
      // mode 'default' = a normal MySQL server (as opposed to PlanetScale's special mode)
      const db = drizzle(pool, { schema, mode: 'default' });

      for (const table of TABLE_DEFINITIONS) {
        await pool.query(table.sql);
      }
      await seedDemoData(db);
      console.log('DATABASE: ready.');
      return { db, pool };
    })().catch((error) => {
      databasePromise = null; // allow a retry on the next request instead of staying broken
      throw error;
    });
  }
  return databasePromise;
}
