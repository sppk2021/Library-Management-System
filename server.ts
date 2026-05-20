import express from 'express';
import path from 'path';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import helmet from 'helmet'; // Added for HTTP header security
import rateLimit from 'express-rate-limit'; // Added to prevent brute force attacks
import { createServer as createViteServer } from 'vite';
import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';

import { eq, and, or, like, sql, desc, asc, inArray } from 'drizzle-orm';
import * as schema from './src/db/librarydb.ts';

// On Vercel, the file system is read-only except for /tmp

const poolConnection = mysql.createPool(process.env.DATABASE_URL || 'mysql://root:password@localhost:3306/library');
const db = drizzle(poolConnection, { schema, mode: 'default' });


async function startServer() {
// Initialize database (run migrations or create tables)
// In a real app we'd use drizzle-kit push or migrations
// For this prototype, we'll ensure tables exist
/* sqlite.exec disabled */

// Alter tables to add columns if they don't exist (SQLite legacy handling)
const tablesToAlter = [
  { table: 'users', column: 'communication_preferences', type: 'TEXT' },
  { table: 'books', column: 'format', type: "TEXT NOT NULL DEFAULT 'Physical'" },
  { table: 'books', column: 'metadata_schema', type: "TEXT DEFAULT 'Standard'" },
  { table: 'books', column: 'metadata_record', type: 'TEXT' },
  { table: 'books', column: 'is_acquisition', type: 'INTEGER DEFAULT 0' },
  { table: 'books', column: 'acquisition_source', type: 'TEXT' },
  { table: 'books', column: 'budget_code', type: 'TEXT' },
  { table: 'books', column: 'cover_url', type: 'TEXT' },
];

for (const { table, column, type } of tablesToAlter) {
  try {
    /* sqlite.exec disabled */
  } catch (e) {
    // Column likely already exists
  }
}

// Simple Seeding
  try {
    if (!process.env.DATABASE_URL) {
      console.warn("DATABASE_URL is not set. Skipping DB seeding and operations.");
    } else {
const seedStatus = (await poolConnection.query('SELECT COUNT(*) as count FROM users'))[0][0] as any as any;
if (seedStatus.count === 0) {
  const adminPass = bcrypt.hashSync('admin123', 10);
  const commonPass = bcrypt.hashSync('password123', 10);

  // Admin
  const adminResult = await poolConnection.query(`
    INSERT INTO users (full_name, email, password, role, created_at) 
    VALUES ('System Admin', 'admin@library.edu', ?, 'admin', ?)
  `, [adminPass, Date.now()]);

  // Categories (30)
  const categories = [
    'Computer Science', 'Mathematics', 'Physics', 'Chemistry', 'Biology', 
    'Literature', 'History', 'Geography', 'Philosophy', 'Psychology', 
    'Sociology', 'Economics', 'Political Science', 'Law', 'Medicine', 
    'Engineering', 'Architecture', 'Art', 'Music', 'Sports', 
    'Business', 'Finance', 'Marketing', 'Management', 'Programming', 
    'Artificial Intelligence', 'Cybersecurity', 'Networking', 'Data Science', 'Ethics'
  ];
  for (const cat of categories) {
    await poolConnection.query('INSERT INTO categories (category_name) VALUES (?)', [cat]);
  }

  // System Config Seed
  const configs = [
    { key: 'LOAN_DURATION_DAYS', value: '14', description: 'Standard loan period for members' },
    { key: 'DAILY_FINE_RATE', value: '0.50', description: 'Fine amount per day overdue ($)' },
    { key: 'MAX_LOANS_PER_USER', value: '5', description: 'Maximum books a student can hold' },
    { key: 'LIBRARY_NAME', value: 'University Library System', description: 'Display name at top of UI' },
    { key: 'CURRENCY_SYMBOL', value: '$', description: 'Local currency for fines' }
  ];
  for (const cfg of configs) {
    await poolConnection.query('INSERT INTO system_config (key, value, description, updated_at) VALUES (?, ?, ?, ?)', [cfg.key, cfg.value, cfg.description, Date.now()]);
  }

  // Students (Realistic names based on document)
  const studentData = [
    { name: 'Saw Pyae Phyo Kyaw', email: 'saw@student.edu', code: '200309', dept: 'Cyber Security', year: 3 },
    { name: 'Aung Kyaw Thu', email: 'aung@student.edu', code: 'ST002', dept: 'IT', year: 2 },
    { name: 'Ei Phyu Khin', email: 'ei@student.edu', code: 'ST003', dept: 'Business', year: 1 },
    { name: 'Min Htet Oo', email: 'min@student.edu', code: 'ST004', dept: 'Mathematics', year: 4 },
    { name: 'Thandar Win', email: 'thandar@student.edu', code: 'ST005', dept: 'Physics', year: 2 }
  ];

  for (const s of studentData) {
    const res = await poolConnection.query(`
      INSERT INTO users (full_name, email, password, role, created_at) 
      VALUES (?, ?, ?, 'student', ?)
    `, [s.name, s.email, commonPass, Date.now()]);
    
    await poolConnection.query(`
      INSERT INTO students (user_id, student_code, department, year) 
      VALUES (?, ?, ?, ?)
    `, [(res[0] as any).insertId, s.code, s.dept, s.year]);
  }

  // Librarians
  const librarianData = [
    { name: 'Sarah Librarian', email: 'sarah@library.edu', code: 'EMP001' },
    { name: 'Kevin Staff', email: 'kevin@library.edu', code: 'EMP002' }
  ];

  for (const l of librarianData) {
    const res = await poolConnection.query(`
      INSERT INTO users (full_name, email, password, role, created_at) 
      VALUES (?, ?, ?, 'librarian', ?)
    `, [l.name, l.email, commonPass, Date.now()]);
    
    await poolConnection.query(`
      INSERT INTO librarians (user_id, employee_code) 
      VALUES (?, ?)
    `, [(res[0] as any).insertId, l.code]);
  }

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
    'https://images.unsplash.com/photo-1513001900722-370f803f498d?w=400&q=80'
  ];

  // Books (Generating 150+ books)
  const bookTitles = [
    { title: 'Clean Code: A Handbook of Agile Software Craftsmanship', author: 'Robert C. Martin', cat: 1 },
    { title: 'Introduction to Algorithms', author: 'Thomas H. Cormen', cat: 1 },
    { title: 'Design Patterns', author: 'Erich Gamma', cat: 1 },
    { title: 'The Pragmatic Programmer', author: 'Andrew Hunt', cat: 25 },
    { title: 'Modern Operating Systems', author: 'Andrew S. Tanenbaum', cat: 1 },
    { title: 'Computer Networking: A Top-Down Approach', author: 'James Kurose', cat: 28 },
    { title: 'Artificial Intelligence: A Modern Approach', author: 'Stuart Russell', cat: 26 },
    { title: 'Cybersecurity for Beginners', author: 'Raef Meeuwisse', cat: 27 },
    { title: 'Data Science from Scratch', author: 'Joel Grus', cat: 29 },
    { title: 'The Art of Computer Programming', author: 'Donald Knuth', cat: 25 },
    { title: 'Discrete Mathematics and Its Applications', author: 'Kenneth Rosen', cat: 2 },
    { title: 'Calculus', author: 'James Stewart', cat: 2 },
    { title: 'The Great Gatsby', author: 'F. Scott Fitzgerald', cat: 6 },
    { title: 'To Kill a Mockingbird', author: 'Harper Lee', cat: 6 },
    { title: 'A Brief History of Time', author: 'Stephen Hawking', cat: 3 },
    { title: 'Thinking, Fast and Slow', author: 'Daniel Kahneman', cat: 10 },
    { title: 'The Wealth of Nations', author: 'Adam Smith', cat: 12 },
    { title: 'Sapiens: A Brief History of Humankind', author: 'Yuval Noah Harari', cat: 7 },
    { title: 'The Republic', author: 'Plato', cat: 9 },
    { title: 'Meditations', author: 'Marcus Aurelius', cat: 9 }
  ];

  // Fill up to 150 books by repeating or variation
  for (let i = 0; i < 150; i++) {
    const template = bookTitles[i % bookTitles.length];
    const suffix = i > 19 ? ` (Vol. ${Math.floor(i / 20) + 1})` : '';
    const catId = ((i + (i % 30)) % 30) + 1; // Distribute across 30 categories
    
    await poolConnection.query(`
      INSERT INTO books (title, author, isbn, category_id, quantity, available_quantity, shelf_location, cover_url, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      template.title + suffix, 
      template.author, 
      `ISBN-${1000 + i}-${Math.floor(Math.random() * 9000) + 1000}`,
      catId,
      1, // Each book is 1 per user request
      1,
      `SEC-${Math.floor(i/10)}-${String.fromCharCode(65 + (i%5))}`,
      bookCovers[i % bookCovers.length],
      Date.now()
    ]);
  }
}
    }
  } catch(e) {
    console.error("Failed to seed database:", e);
  }

// Provide a warning indicating how to set the JWT_SECRET properly for stronger security
if (!process.env.JWT_SECRET) {
  console.warn('WARNING: JWT_SECRET environment variable is missing. Falling back to a default secret. This is not secure for production! Please define a strong JWT_SECRET in your .env or platform deployment settings.');
}
// JWT_SECRET is used for verifying and signing tokens for User Authentication
const JWT_SECRET = process.env.JWT_SECRET || 'FKMr:QC1NUyvrf||bFE{L[[H?wS^%iWDr:6)qy=?yc0';
const FINE_RATE_PER_DAY = 1.50; // Configurable fine rate

  const app = express();
  app.set('trust proxy', 1); // Trust first proxy (like Cloud Run/Nginx) for correct client IP
  const PORT = process.env.PORT || 3000;

  // Add security headers using Helmet middleware
  app.use(helmet({ contentSecurityPolicy: false })); // Disabled CSP for this instance as it can block Vite HMR
  app.use(cors());
  app.use(express.json());

  // Setup Rate Limiting for the API to prevent brute-force and DDoS
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Limit each IP to 1000 requests per windowMs. Increased for dev setup.
    message: { error: 'Too many requests from this IP, please try again after 15 minutes' },
    validate: { xForwardedForHeader: false, trustProxy: false },
    standardHeaders: true, 
    legacyHeaders: false, 
  });

  // Apply rate limiter specifically to API routes
  app.use('/api/', apiLimiter);

  // Set tighter limit for login endpoints to prevent credential stuffing and brute-forcing
  // We use skipSuccessfulRequests so that successful logins don't penalize the user.
  // This effectively blocks an IP for 5 minutes if they fail to login 3 times.
  const loginLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes block window
    max: 3, // Limit each IP to 3 failed requests per windowMs
    skipSuccessfulRequests: true, // Only count failed logins towards the limit
    validate: { xForwardedForHeader: false, trustProxy: false },
    message: { error: 'Too many failed login attempts from this IP, please try again after 5 minutes' },
  });
  app.use('/api/auth/login', loginLimiter);

  // Helper: Calculate Fines
  const updateFines = async () => {
    try {
      const now = new Date();
      // Find all borrowed/overdue records
      const activeRecords = await db.query.borrowRecords.findMany({
        where: or(eq(schema.borrowRecords.status, 'borrowed'), eq(schema.borrowRecords.status, 'overdue'))
      });

      for (const record of activeRecords) {
        const dueDate = new Date(record.dueDate);
        if (now > dueDate) {
          const diffTime = Math.abs(now.getTime() - dueDate.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          const fineAmount = diffDays * FINE_RATE_PER_DAY;
          
          await db.update(schema.borrowRecords)
            .set({ 
              status: 'overdue',
              fineAmount: fineAmount
            })
            .where(eq(schema.borrowRecords.id, record.id));
        }
      }
    } catch (e) {
      console.error('Fine calculation failed', e);
    }
  };

  // Helper: Log actions
  const logAction = async (userId: number | null, action: string, details: string) => {
    try {
      await db.insert(schema.logs).values({
        userId,
        action,
        details,
        timestamp: Date.now()
      });
    } catch (e) {
      console.error('Log failed', e);
    }
  };

  // Middleware: Auth
  const authenticateToken = (req: any, res: any, next: any) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Auth token missing' });

    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
      if (err) return res.status(403).json({ error: 'Invalid token' });
      req.user = user;
      next();
    });
  };

  const authorize = (roles: string[]) => (req: any, res: any, next: any) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    next();
  };

  // Auth Routes
  app.post('/api/auth/register', async (req, res) => {
    const { fullName, email, password, role, studentCode, department, year, employeeCode, phone } = req.body;
    try {
      // Check if email exists
      const existingUser = await db.query.users.findFirst({ where: eq(schema.users.email, email) });
      if (existingUser) return res.status(400).json({ error: 'Email already registered' });

      // Check if codes exist
      if ((role || 'student') === 'student' && studentCode) {
        const existingStudent = await db.query.students.findFirst({ where: eq(schema.students.studentCode, studentCode) });
        if (existingStudent) return res.status(400).json({ error: 'Student code already in use' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const insertRes = await db.insert(schema.users).values({
        fullName,
        email,
        password: hashedPassword,
        role: role || 'student',
        phone,
        createdAt: Date.now() as any
      });
      const userId = insertRes[0].insertId;
      const user = { id: userId, role: role || 'student', email } as any;

      if (user.role === 'student' && studentCode) {
        await db.insert(schema.students).values({
          userId: user.id,
          studentCode,
          department: department || 'General',
          year: year || 1
        });
      } else if (user.role === 'librarian' && employeeCode) {
        await db.insert(schema.librarians).values({
          userId: user.id,
          employeeCode
        });
      }

      await logAction(user.id, 'REGISTER', `User ${email} registered as ${user.role}`);
      res.json({ message: 'User registered successfully' });
    } catch (error: any) {
      console.error('Registration failed:', error);
      res.status(400).json({ error: error.message });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    try {
      const user = await db.query.users.findFirst({ where: eq(schema.users.email, email) });
      if (!user) return res.status(400).json({ error: 'User not found' });

      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) return res.status(400).json({ error: 'Invalid password' });

      const token = jwt.sign({ id: user.id, role: user.role, email: user.email }, JWT_SECRET, { expiresIn: '8h' });
      
      await logAction(user.id, 'LOGIN', `User ${email} logged in`);
      res.json({ token, user: { id: user.id, fullName: user.fullName, email: user.email, role: user.role } });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/auth/me', authenticateToken, async (req: any, res) => {
    const user = await db.query.users.findFirst({ where: eq(schema.users.id, req.user.id) });
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    let extra = {};
    if (user.role === 'student') {
      extra = await db.query.students.findFirst({ where: eq(schema.students.userId, user.id) }) || {};
    } else if (user.role === 'librarian') {
      extra = await db.query.librarians.findFirst({ where: eq(schema.librarians.userId, user.id) }) || {};
    }
    
    res.json({ ...user, ...extra, id: user.id });
  });

  app.put('/api/auth/profile', authenticateToken, async (req: any, res) => {
    try {
      const { fullName, phone, studentCode, department, year, employeeCode } = req.body;
      
      await db.update(schema.users)
        .set({ fullName, phone })
        .where(eq(schema.users.id, req.user.id));
      const user = await db.query.users.findFirst({ where: eq(schema.users.id, req.user.id) }) as any;

      if (user.role === 'student' && studentCode) {
        await db.update(schema.students)
          .set({ studentCode, department, year })
          .where(eq(schema.students.userId, user.id));
      } else if (user.role === 'librarian' && employeeCode) {
        await db.update(schema.librarians)
          .set({ employeeCode })
          .where(eq(schema.librarians.userId, user.id));
      }

      await logAction(user.id, 'PROFILE_UPDATE', `Updated profile for ${user.email}`);
      res.json(user);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Book Routes
  app.get('/api/books', async (req, res) => {
    const { search, categoryId } = req.query;
    try {
      let query: any = db.select().from(schema.books);
      const conditions = [];
      if (search) {
        conditions.push(or(
          like(schema.books.title, `%${search}%`),
          like(schema.books.author, `%${search}%`),
          like(schema.books.isbn, `%${search}%`)
        ));
      }
      if (categoryId && categoryId !== '') {
        conditions.push(eq(schema.books.categoryId, Number(categoryId)));
      }
      
      const result = await (conditions.length > 0 ? query.where(and(...conditions)) : query);
      
      // Enrich with expected availability if out of stock
      const enrichedBooks = await Promise.all(result.map(async (book: any) => {
        if (book.availableQuantity > 0) return { ...book, nextAvailableDate: null };
        
        const nextDueDate = await db.query.borrowRecords.findFirst({
          where: and(eq(schema.borrowRecords.bookId, book.id), inArray(schema.borrowRecords.status, ['borrowed', 'overdue', 'return_requested'])),
          orderBy: [asc(schema.borrowRecords.dueDate)]
        });
        
        return { ...book, nextAvailableDate: nextDueDate?.dueDate || null };
      }));

      res.json(enrichedBooks);
    } catch (error: any) {
      console.error('Fetch books failed:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/books', authenticateToken, authorize(['librarian', 'admin']), async (req: any, res) => {
    try {
      const { id, ...data } = req.body;
      await db.insert(schema.books).values({
        ...data,
        categoryId: data.categoryId ? Number(data.categoryId) : null,
        availableQuantity: data.quantity,
        format: data.format || 'Physical',
        metadataSchema: data.metadataSchema || 'Standard',
        metadataRecord: data.metadataRecord,
        isAcquisition: data.isAcquisition || false,
        acquisitionSource: data.acquisitionSource,
        budgetCode: data.budgetCode,
        createdAt: Date.now()
      });
      const book = req.body as any;
      await logAction(req.user.id, 'BOOK_ADD', `Added item: ${book.title} (${book.format})`);
      res.json(book);
    } catch (error: any) {
      console.error('Add book failed:', error);
      res.status(400).json({ error: error.message });
    }
  });

  // Serials Management Endpoints
  app.get('/api/serials/issues', authenticateToken, async (req, res) => {
    try {
      const issues = await db.select().from(schema.serialIssues);
      res.json(issues);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/serials/issues', authenticateToken, authorize(['librarian', 'admin']), async (req: any, res) => {
    try {
      const [issue] = await db.insert(schema.serialIssues).values({
        ...req.body,
        status: req.body.status || 'Expected'
      });
      await logAction(req.user.id, 'SERIAL_ISSUE_ADD', `Added serial issue: ${req.body.issueNumber}`);
      res.status(201).json(issue);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Configuration Dashboard Endpoints
  app.get('/api/config', authenticateToken, async (req, res) => {
    try {
      const configs = await db.select().from(schema.systemConfig);
      res.json(configs);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/config/:key', authenticateToken, authorize(['admin']), async (req: any, res) => {
    try {
      const [config] = await db.update(schema.systemConfig)
        .set({ value: req.body.value, updatedAt: Date.now() })
        .where(eq(schema.systemConfig.key, req.params.key))
        ;
      await logAction(req.user.id, 'CONFIG_UPDATE', `Updated config key: ${req.params.key}`);
      res.json(config);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.put('/api/books/:id', authenticateToken, authorize(['librarian', 'admin']), async (req: any, res) => {
    try {
      const { id, createdAt, availableQuantity: _ignore, ...data } = req.body;
      const oldBook = await db.query.books.findFirst({ where: eq(schema.books.id, Number(req.params.id)) });
      if (!oldBook) return res.status(404).json({ error: 'Book not found' });

      const diff = (data.quantity || oldBook.quantity) - oldBook.quantity;
      const newAvailable = Math.max(0, oldBook.availableQuantity + diff);

      await db.update(schema.books)
        .set({
          ...data,
          categoryId: data.categoryId ? Number(data.categoryId) : null,
          availableQuantity: newAvailable
        })
        .where(eq(schema.books.id, Number(req.params.id)));
      const book = await db.query.books.findFirst({ where: eq(schema.books.id, Number(req.params.id)) }) as any;
      await logAction(req.user.id, 'BOOK_UPDATE', `Updated book: ${book.title}. Qty change: ${diff}`);
      res.json(book);
    } catch (error: any) {
      console.error('Update book failed:', error);
      res.status(400).json({ error: error.message });
    }
  });

  app.delete('/api/books/:id', authenticateToken, authorize(['librarian', 'admin']), async (req: any, res) => {
    try {
      await db.delete(schema.books).where(eq(schema.books.id, Number(req.params.id)));
      await logAction(req.user.id, 'BOOK_DELETE', `Deleted book ID: ${req.params.id}`);
      res.json({ message: 'Book deleted' });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get('/api/categories', async (req, res) => {
    const cats = await db.select().from(schema.categories);
    res.json(cats);
  });

  app.post('/api/categories', authenticateToken, authorize(['librarian', 'admin']), async (req, res) => {
    await db.insert(schema.categories).values(req.body);
    res.json(req.body);
  });

  // Borrowing Routes
  app.post('/api/borrow/request', authenticateToken, authorize(['student']), async (req: any, res) => {
    const { bookId } = req.body;
    try {
      const book = await db.query.books.findFirst({ where: eq(schema.books.id, bookId) });
      if (!book || book.availableQuantity <= 0) {
        return res.status(400).json({ error: 'Book not available' });
      }

      // Check if already requested/borrowed same book
      const existing = await db.query.borrowRecords.findFirst({
        where: and(
          eq(schema.borrowRecords.userId, req.user.id),
          eq(schema.borrowRecords.bookId, bookId),
          or(eq(schema.borrowRecords.status, 'requested'), eq(schema.borrowRecords.status, 'borrowed'))
        )
      });
      if (existing) return res.status(400).json({ error: 'Already has a request or borrowed copy' });

      const dueDateStr = Date.now() + 14 * 24 * 60 * 60 * 1000;

      const recordRes = await db.insert(schema.borrowRecords).values({
        userId: req.user.id as any,
        bookId,
        borrowDate: Date.now() as any,
        dueDate: dueDateStr as any,
        status: 'requested'
      });
      const record = { id: (recordRes[0] as any).insertId };
      await logAction(req.user.id, 'BORROW_REQUEST', `Requested book ID: ${bookId}`);
      res.json(record);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/borrow/history', authenticateToken, async (req: any, res) => {
    try {
      await updateFines(); // Refresh fines before fetching
      const query = db.select({
        record: schema.borrowRecords,
        book: schema.books,
        user: schema.users
      }).from(schema.borrowRecords)
        .leftJoin(schema.books, eq(schema.borrowRecords.bookId, schema.books.id))
        .leftJoin(schema.users, eq(schema.borrowRecords.userId, schema.users.id));

      if (req.user.role === 'student') {
        const result = await query.where(eq(schema.borrowRecords.userId, req.user.id)).orderBy(desc(schema.borrowRecords.id));
        res.json(result);
      } else {
        const result = await query.orderBy(desc(schema.borrowRecords.id));
        res.json(result);
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/borrow/approve/:id', authenticateToken, authorize(['librarian', 'admin']), async (req: any, res) => {
    try {
      const record = await db.query.borrowRecords.findFirst({ where: eq(schema.borrowRecords.id, Number(req.params.id)) });
      if (!record || record.status !== 'requested') return res.status(400).json({ error: 'Invalid record status' });

      const book = await db.query.books.findFirst({ where: eq(schema.books.id, record.bookId) });
      if (!book || book.availableQuantity <= 0) return res.status(400).json({ error: 'Book no longer available' });

      await db.update(schema.books)
        .set({ availableQuantity: book.availableQuantity - 1 })
        .where(eq(schema.books.id, book.id));

      await db.update(schema.borrowRecords)
        .set({ status: 'borrowed', borrowDate: Date.now() as any })
        .where(eq(schema.borrowRecords.id, record.id));

      await logAction(req.user.id, 'BORROW_APPROVE', `Approved request ID: ${req.params.id}`);
      res.json({ message: 'Request approved' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/borrow/reject/:id', authenticateToken, authorize(['librarian', 'admin']), async (req: any, res) => {
    try {
      const record = await db.query.borrowRecords.findFirst({ where: eq(schema.borrowRecords.id, Number(req.params.id)) });
      if (!record || record.status !== 'requested') return res.status(400).json({ error: 'Invalid record status' });

      await db.update(schema.borrowRecords)
        .set({ status: 'cancelled' })
        .where(eq(schema.borrowRecords.id, record.id));

      await logAction(req.user.id, 'BORROW_REJECT', `Rejected request ID: ${req.params.id}`);
      res.json({ message: 'Request rejected' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/borrow/return-request/:id', authenticateToken, authorize(['student']), async (req: any, res) => {
    try {
      const record = await db.query.borrowRecords.findFirst({ 
        where: and(eq(schema.borrowRecords.id, Number(req.params.id)), eq(schema.borrowRecords.userId, req.user.id)) 
      });
      if (!record || (record.status !== 'borrowed' && record.status !== 'overdue')) {
        return res.status(400).json({ error: 'Invalid record status' });
      }

      await db.update(schema.borrowRecords)
        .set({ status: 'return_requested' })
        .where(eq(schema.borrowRecords.id, record.id));

      await logAction(req.user.id, 'RETURN_REQUEST', `Requested return for ID: ${req.params.id}`);
      res.json({ message: 'Return request sent' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/borrow/return-approve/:id', authenticateToken, authorize(['librarian', 'admin']), async (req: any, res) => {
    try {
      const record = await db.query.borrowRecords.findFirst({ where: eq(schema.borrowRecords.id, Number(req.params.id)) });
      if (!record || record.status !== 'return_requested') return res.status(400).json({ error: 'Invalid record status' });

      const book = await db.query.books.findFirst({ where: eq(schema.books.id, record.bookId) });
      if (book) {
        await db.update(schema.books)
          .set({ availableQuantity: Math.min(book.quantity, book.availableQuantity + 1) })
          .where(eq(schema.books.id, book.id));
      }

      await db.update(schema.borrowRecords)
        .set({ status: 'returned', returnDate: Date.now() as any })
        .where(eq(schema.borrowRecords.id, record.id));

      await logAction(req.user.id, 'RETURN_APPROVE', `Approved return for ID: ${req.params.id}`);
      res.json({ message: 'Return approved' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/borrow/pay-fine/:id', authenticateToken, authorize(['librarian', 'admin']), async (req: any, res) => {
    try {
      await db.update(schema.borrowRecords)
        .set({ fineAmount: 0 })
        .where(eq(schema.borrowRecords.id, Number(req.params.id)));
      
      await logAction(req.user.id, 'PAY_FINE', `Cleared fine for ID: ${req.params.id}`);
      res.json({ message: 'Fine paid successfully' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: User Management
  app.get('/api/admin/users', authenticateToken, authorize(['admin', 'librarian']), async (req, res) => {
    try {
      const allUsers = await db.query.users.findMany({
        with: {
          studentProfile: true,
          librarianProfile: true
        }
      });
      // Flatten for easier frontend use
      const flattened = allUsers.map(u => ({
        ...u,
        ...(u.studentProfile || {}),
        ...(u.librarianProfile || {}),
        id: u.id, // Preserve the original user ID. Profile IDs will otherwise overwrite it.
        studentProfile: undefined,
        librarianProfile: undefined
      }));
      res.json(flattened);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/admin/users/:id', authenticateToken, authorize(['admin']), async (req: any, res) => {
    try {
      const { fullName, phone, role, studentCode, department, year, employeeCode } = req.body;
      const userId = Number(req.params.id);

      const updateData: any = { fullName, phone, role };
      if (req.body.password) {
        updateData.password = await bcrypt.hash(req.body.password, 10);
      }

      await db.update(schema.users)
        .set(updateData)
        .where(eq(schema.users.id, userId));
      const user = await db.query.users.findFirst({ where: eq(schema.users.id, userId) }) as any;

      if (user.role === 'student') {
        const existing = await db.query.students.findFirst({ where: eq(schema.students.userId, userId) });
        if (existing) {
          await db.update(schema.students).set({ studentCode, department, year }).where(eq(schema.students.userId, userId));
        } else {
          await db.insert(schema.students).values({ userId, studentCode, department, year });
        }
        await db.delete(schema.librarians).where(eq(schema.librarians.userId, userId));
      } else if (user.role === 'librarian') {
        const existing = await db.query.librarians.findFirst({ where: eq(schema.librarians.userId, userId) });
        if (existing) {
          await db.update(schema.librarians).set({ employeeCode }).where(eq(schema.librarians.userId, userId));
        } else {
          await db.insert(schema.librarians).values({ userId, employeeCode });
        }
        await db.delete(schema.students).where(eq(schema.students.userId, userId));
      }

      await logAction(req.user.id, 'USER_ADMIN_UPDATE', `Admin updated profile for ${user.email}`);
      res.json(user);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.put('/api/admin/users/:id/role', authenticateToken, authorize(['admin']), async (req: any, res) => {
    try {
      const { role } = req.body;
      await db.update(schema.users)
        .set({ role })
        .where(eq(schema.users.id, Number(req.params.id)));
      const user = await db.query.users.findFirst({ where: eq(schema.users.id, Number(req.params.id)) }) as any;
      
      await logAction(req.user.id, 'USER_ROLE_CHANGE', `Changed role of ${user.email} to ${role}`);
      res.json(user);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete('/api/admin/users/:id', authenticateToken, authorize(['admin']), async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      if (id === req.user.id) return res.status(400).json({ error: 'Cannot delete yourself' });

      // Clean up related records
      await db.delete(schema.students).where(eq(schema.students.userId, id));
      await db.delete(schema.librarians).where(eq(schema.librarians.userId, id));
      
      const user = await db.query.users.findFirst({ where: eq(schema.users.id, id) }) as any; await db.delete(schema.users).where(eq(schema.users.id, id));
      
      await logAction(req.user.id, 'USER_DELETE', `Deleted user: ${user.email}`);
      res.json({ message: 'User deleted' });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Reports / Dashboard
  app.get('/api/dashboard/stats', authenticateToken, authorize(['librarian', 'admin']), async (req, res) => {
    const totalBooks = (await poolConnection.query('SELECT SUM(quantity) as total FROM books'))[0][0] as any as any;
    const totalUsers = (await poolConnection.query('SELECT COUNT(*) as total FROM users'))[0][0] as any as any;
    const activeBorrows = (await poolConnection.query("SELECT COUNT(*) as total FROM borrow_records WHERE status IN ('borrowed', 'overdue')"))[0][0] as any as any;
    const pendingRequests = (await poolConnection.query("SELECT COUNT(*) as total FROM borrow_records WHERE status = 'requested'"))[0][0] as any as any;
    
    // Status breakdown for charts
    const statusStats = (await poolConnection.query("SELECT status, COUNT(*) as count FROM borrow_records GROUP BY status"))[0] as any;
    
    const overdueCount = (await poolConnection.query("SELECT COUNT(*) as total FROM borrow_records WHERE status = 'overdue'"))[0][0] as any as any;
    
    res.json({
      summary: {
        totalBooks: totalBooks.total || 0,
        totalUsers: totalUsers.total || 0,
        activeBorrows: activeBorrows.total || 0,
        pendingRequests: pendingRequests.total || 0,
        overdueCount: overdueCount.total || 0
      },
      statusStats
    });
  });

  app.get('/api/reports/detailed', authenticateToken, authorize(['librarian', 'admin']), async (req, res) => {
    try {
      // 1. Most Borrowed Books
      const topBooks = (await poolConnection.query(`
        SELECT b.title, b.author, COUNT(br.record_id) as borrow_count 
        FROM borrow_records br
        JOIN books b ON br.book_id = b.book_id
        GROUP BY b.book_id
        ORDER BY borrow_count DESC
        LIMIT 10
      `))[0] as any;

      // 2. Most Borrowing Students
      const topBorrowers = (await poolConnection.query(`
        SELECT u.full_name, u.email, COUNT(br.record_id) as borrow_count 
        FROM borrow_records br
        JOIN users u ON br.user_id = u.user_id
        WHERE u.role = 'student'
        GROUP BY u.user_id
        ORDER BY borrow_count DESC
        LIMIT 10
      `))[0] as any;

      // 3. Category Distribution (Books per category)
      const categoryDistribution = (await poolConnection.query(`
        SELECT c.category_name as name, COUNT(b.book_id) as value
        FROM categories c
        JOIN books b ON c.category_id = b.category_id
        GROUP BY c.category_id
        ORDER BY value DESC
      `))[0] as any;

      // 4. Overdue Hotspots (Users with most overdue items)
      const overdueHotspots = (await poolConnection.query(`
        SELECT u.full_name, COUNT(br.record_id) as overdue_count, SUM(br.fine_amount) as total_fines
        FROM borrow_records br
        JOIN users u ON br.user_id = u.user_id
        WHERE br.status = 'overdue'
        GROUP BY u.user_id
        ORDER BY overdue_count DESC
        LIMIT 5
      `))[0] as any;

      // 5. Recent Borrowing Activity (Detailed Log)
      const recentActivity = await db.select({
        id: schema.borrowRecords.id,
        user: schema.users.fullName,
        book: schema.books.title,
        status: schema.borrowRecords.status,
        date: schema.borrowRecords.borrowDate,
      }).from(schema.borrowRecords)
        .leftJoin(schema.users, eq(schema.borrowRecords.userId, schema.users.id))
        .leftJoin(schema.books, eq(schema.borrowRecords.bookId, schema.books.id))
        .orderBy(desc(schema.borrowRecords.id))
        .limit(20);

      // 6. Monthly Trends (Last 6 Months)
      const monthlyTrends = (await poolConnection.query(`
        WITH RECURSIVE months(m) AS (
          SELECT DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-01'), INTERVAL 5 MONTH)
          UNION ALL
          SELECT DATE_ADD(m, INTERVAL 1 MONTH) FROM months WHERE m < DATE_FORMAT(NOW(), '%Y-%m-01')
        )
        SELECT 
          strftime('%Y-%m', m) as month,
          (SELECT COUNT(*) FROM borrow_records WHERE DATE_FORMAT(FROM_UNIXTIME(borrow_date/1000), '%Y-%m') = strftime('%Y-%m', m)) as borrow_count
        FROM months
      `))[0] as any;

      // 7. Low Stock / Out of Stock Books
      const stockStatus = (await poolConnection.query(`
        SELECT 
          b.book_id,
          b.title,
          b.quantity,
          b.available_quantity,
          (SELECT MAX(borrow_date) FROM borrow_records WHERE book_id = b.book_id) as last_borrowed
        FROM books b
        WHERE b.available_quantity <= 1
        ORDER BY b.available_quantity ASC, last_borrowed DESC
        LIMIT 20
      `))[0] as any;

      res.json({
        topBooks,
        topBorrowers,
        categoryDistribution,
        overdueHotspots,
        recentActivity,
        monthlyTrends,
        stockStatus
      });
    } catch (error: any) {
      console.error('Detailed report failed:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite preview setup
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  if (!process.env.VERCEL) {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }
  return app;
}

// We can export the app promise for Vercel
export default startServer();
