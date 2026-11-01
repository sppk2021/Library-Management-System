/**
 * ============================================================================
 * BACK-END SERVER (Node.js + Express REST API)
 * ============================================================================
 *
 * This is the "application tier" of the three-tier architecture:
 *
 *   Browser (React)  ──HTTP/JSON──>  THIS FILE (Express)  ──SQL──>  MySQL
 *
 * Every request from the React app arrives here at a URL starting with /api/...
 * and passes through these layers, in order:
 *
 *   1. helmet         → adds security-related HTTP headers
 *   2. rate limiting  → blocks a computer that sends too many requests / wrong passwords
 *   3. express.json   → turns the JSON body of the request into a JavaScript object
 *   4. authenticateToken → checks the JWT "login ticket" (only on protected routes)
 *   5. authorize([...])  → checks the user's role is allowed (only on protected routes)
 *   6. the route handler → reads/writes MySQL and sends back JSON
 *
 * Route groups in this file:
 *   - Authentication & profile      /api/auth/...
 *   - Catalogue (books, categories) /api/books, /api/categories, /api/serials/...
 *   - Settings                      /api/config/...
 *   - Borrowing workflow            /api/borrow/...
 *   - User administration           /api/admin/users/...
 *   - Backup                        /api/admin/database-dump
 *   - Dashboard & reports           /api/dashboard/stats, /api/reports/detailed
 *
 * Local development:  `npm run dev` runs this file and also serves the React app.
 * On Vercel:          `api/index.ts` imports this file and runs it as a serverless function.
 * ============================================================================
 */
import 'dotenv/config'; // loads settings from a local .env file (DATABASE_URL, JWT_SECRET)
import express from 'express';
import path from 'path';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { eq, and, or, like, sql, desc, asc, inArray, gte } from 'drizzle-orm';
// Note: local files are imported with a ".js" ending even though they are ".ts" files.
// On Vercel every .ts file is compiled to .js separately, and Node.js (ES modules)
// needs the exact file name. TypeScript, tsx and esbuild all map ".js" to the ".ts" source.
import * as schema from './src/db/librarydb.js';
import { getDatabase, LibraryDb } from './server/database.js';
import { buildSqlBackup } from './server/backup.js';

// ----------------------------------------------------------------------------
// SECURITY SETTING: the secret key used to sign login tokens (JWT)
// ----------------------------------------------------------------------------
// Anyone who knows this secret could create fake login tokens, so in production it
// MUST be set as an environment variable (e.g. in Vercel → Settings → Environment Variables).
if (!process.env.JWT_SECRET) {
  console.warn('WARNING: JWT_SECRET is not set. Using a development-only secret. Set JWT_SECRET before deploying!');
}
const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-secret-change-me';

/** Loan statuses that mean "the student still has (or is waiting for) this book". */
const ACTIVE_LOAN_STATUSES = ['requested', 'borrowed', 'overdue', 'return_requested'] as const;

/** The three roles in the system. */
const VALID_ROLES = ['student', 'librarian', 'admin'] as const;
type Role = (typeof VALID_ROLES)[number];

/**
 * A small error type that carries an HTTP status code.
 * Thrown inside a database transaction, it makes the transaction roll back
 * AND tells the route which status code to send to the browser.
 */
class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Removes the password hash before a user object is sent to the browser. */
function withoutPassword<T extends { password?: string }>(user: T): Omit<T, 'password'> {
  const { password: _hidden, ...safeUser } = user;
  return safeUser;
}

/**
 * Bootstraps and starts the Express application.
 */
async function startServer() {
  // Connect to MySQL, create tables and demo data if needed (see server/database.ts).
  const { db, pool } = await getDatabase();

  const app = express();
  app.set('trust proxy', 1); // behind Vercel's proxy: trust it, so we see the real visitor IP for rate limiting
  const PORT = Number(process.env.PORT) || 3000;

  // ==========================================================================
  // GLOBAL MIDDLEWARE (runs for every request)
  // ==========================================================================
  // CSP is turned off because it blocks the Vite development server's live reloading.
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors());
  app.use(express.json());

  // General limit: at most 1000 API requests per 15 minutes from one IP address.
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    message: { error: 'Too many requests from this IP, please try again after 15 minutes' },
    validate: { xForwardedForHeader: false, trustProxy: false },
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api/', apiLimiter);

  // Login limit: 3 WRONG passwords from one IP → blocked for 5 minutes (stops password guessing).
  // Successful logins are not counted.
  const loginLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 3,
    skipSuccessfulRequests: true,
    validate: { xForwardedForHeader: false, trustProxy: false },
    message: { error: 'Too many failed login attempts from this IP, please try again after 5 minutes' },
  });
  app.use('/api/auth/login', loginLimiter);

  // ==========================================================================
  // HELPER FUNCTIONS
  // ==========================================================================

  /**
   * Reads a numeric library rule (e.g. DAILY_FINE_RATE) from the system_config table,
   * so changes an admin makes (PUT /api/config/:key) take effect immediately.
   * Falls back to a default if the setting is missing or not a number.
   */
  const getConfigNumber = async (key: string, fallback: number): Promise<number> => {
    const [row] = await db.select().from(schema.systemConfig).where(eq(schema.systemConfig.key, key));
    const value = row ? Number(row.value) : NaN;
    return Number.isFinite(value) ? value : fallback;
  };

  /**
   * Marks late loans as 'overdue' and recalculates their fine:
   *     fine = (number of days late, rounded up) × DAILY_FINE_RATE
   * Done with ONE SQL UPDATE for all loans at once (fast, even with many records).
   * Only loans still out ('borrowed' or 'overdue') are updated; once a student
   * requests a return, the fine stops growing.
   */
  const updateFines = async () => {
    try {
      const dailyRate = await getConfigNumber('DAILY_FINE_RATE', 0.5);
      const now = new Date();
      await db.execute(sql`
        UPDATE borrow_records
        SET status = 'overdue',
            fine_amount = CEIL(TIMESTAMPDIFF(SECOND, due_date, ${now}) / 86400) * ${dailyRate}
        WHERE status IN ('borrowed', 'overdue') AND due_date < ${now}
      `);
    } catch (e) {
      console.error('Fine calculation failed', e);
    }
  };

  /**
   * Writes an entry in the audit log (who did what, and when).
   * `executor` lets us write the log INSIDE a transaction, so the log entry
   * is only kept if the whole operation succeeds.
   */
  const logAction = async (userId: number | null, action: string, details: string, executor: LibraryDb | any = db) => {
    try {
      await executor.insert(schema.logs).values({ userId, action, details, timestamp: new Date() });
    } catch (e) {
      console.error('Log failed', e);
    }
  };

  /**
   * Creates a user plus their student or librarian profile, in one transaction
   * (so we never end up with a user that has half a profile).
   * Used by public sign-up (always 'student') and by the admin "Add Member" screen.
   */
  const createUserAccount = async (input: any, role: Role) => {
    const { fullName, email, password, studentCode, department, year, employeeCode, phone } = input;
    if (!fullName || !email || !password) throw new HttpError(400, 'Full name, email and password are required');

    const existingUser = await db.query.users.findFirst({ where: eq(schema.users.email, email) });
    if (existingUser) throw new HttpError(400, 'Email already registered');

    if (role === 'student' && studentCode) {
      const existingStudent = await db.query.students.findFirst({ where: eq(schema.students.studentCode, studentCode) });
      if (existingStudent) throw new HttpError(400, 'Student code already in use');
    }

    // bcrypt turns the password into a one-way hash; 10 = "cost factor" (how slow it is to guess)
    const hashedPassword = await bcrypt.hash(password, 10);

    return db.transaction(async (tx) => {
      const [{ id }] = await tx.insert(schema.users)
        .values({ fullName, email, password: hashedPassword, role, phone, createdAt: new Date() })
        .$returningId();

      if (role === 'student' && studentCode) {
        await tx.insert(schema.students).values({
          userId: id, studentCode, department: department || 'General', year: Number(year) || 1,
        });
      } else if (role === 'librarian' && employeeCode) {
        await tx.insert(schema.librarians).values({ userId: id, employeeCode });
      }
      await logAction(id, 'REGISTER', `User ${email} registered as ${role}`, tx);
      return id;
    });
  };

  /** Sends an error to the browser: HttpErrors keep their status, anything else uses `fallbackStatus`. */
  const sendError = (res: any, error: any, fallbackStatus = 500) => {
    const status = error instanceof HttpError ? error.status : fallbackStatus;
    res.status(status).json({ error: error.message });
  };

  // ==========================================================================
  // SECURITY MIDDLEWARE
  // ==========================================================================

  /**
   * Checks the login token. The React app sends it in the header:
   *     Authorization: Bearer <token>
   * If the token is valid, the user's id/role/email are put on `req.user`.
   */
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

  /**
   * Role-based access control: only lets the request continue if the user's role is in `roles`.
   * Example: authorize(['librarian', 'admin']) blocks students.
   */
  const authorize = (roles: string[]) => (req: any, res: any, next: any) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    next();
  };

  // ==========================================================================
  // AUTHENTICATION & PROFILE ROUTES
  // ==========================================================================

  /**
   * POST /api/auth/register: public sign-up form.
   * SECURITY: every public sign-up becomes a STUDENT, whatever the browser sends.
   * (Before this fix, sending role: "admin" created an administrator account.)
   * Librarians and admins are created by an admin via POST /api/admin/users.
   */
  app.post('/api/auth/register', async (req, res) => {
    try {
      await createUserAccount(req.body, 'student');
      res.json({ message: 'User registered successfully' });
    } catch (error: any) {
      console.error('Registration failed:', error);
      sendError(res, error, 400);
    }
  });

  /**
   * POST /api/auth/login: checks email + password and returns a login token (JWT).
   * The token is valid for 8 hours and contains the user's id, role and email.
   */
  app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    try {
      const user = await db.query.users.findFirst({ where: eq(schema.users.email, email) });
      if (!user) return res.status(400).json({ error: 'User not found' });

      // bcrypt.compare hashes the typed password and compares it with the stored hash
      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) return res.status(400).json({ error: 'Invalid password' });

      const token = jwt.sign({ id: user.id, role: user.role, email: user.email }, JWT_SECRET, { expiresIn: '8h' });

      await logAction(user.id, 'LOGIN', `User ${email} logged in`);
      res.json({ token, user: { id: user.id, fullName: user.fullName, email: user.email, role: user.role } });
    } catch (error: any) {
      sendError(res, error);
    }
  });

  /** GET /api/auth/me: returns the logged-in user's details (+ student/librarian profile). */
  app.get('/api/auth/me', authenticateToken, async (req: any, res) => {
    try {
      const user = await db.query.users.findFirst({ where: eq(schema.users.id, req.user.id) });
      if (!user) return res.status(404).json({ error: 'User not found' });

      let extra = {};
      if (user.role === 'student') {
        extra = (await db.query.students.findFirst({ where: eq(schema.students.userId, user.id) })) || {};
      } else if (user.role === 'librarian') {
        extra = (await db.query.librarians.findFirst({ where: eq(schema.librarians.userId, user.id) })) || {};
      }
      res.json({ ...withoutPassword(user), ...extra, id: user.id });
    } catch (error: any) {
      sendError(res, error);
    }
  });

  /** PUT /api/auth/profile: users edit their own name, phone and profile details. */
  app.put('/api/auth/profile', authenticateToken, async (req: any, res) => {
    try {
      const { fullName, phone, studentCode, department, year, employeeCode } = req.body;

      await db.update(schema.users).set({ fullName, phone }).where(eq(schema.users.id, req.user.id));
      // MySQL's UPDATE doesn't return the changed row, so we read it back.
      const user = await db.query.users.findFirst({ where: eq(schema.users.id, req.user.id) });
      if (!user) return res.status(404).json({ error: 'User not found' });

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
      res.json(withoutPassword(user));
    } catch (error: any) {
      sendError(res, error, 400);
    }
  });

  // ==========================================================================
  // CATALOGUE ROUTES (books, serials, categories)
  // ==========================================================================

  /**
   * GET /api/books?search=...&categoryId=...: public book search.
   * Searches title, author and ISBN. For books with no copies left, it also
   * returns `nextAvailableDate`: the earliest due date of the copies on loan.
   */
  app.get('/api/books', async (req, res) => {
    const { search, categoryId } = req.query;
    try {
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

      const result = await db.select().from(schema.books)
        .where(conditions.length > 0 ? and(...conditions) : undefined);

      const enrichedBooks = await Promise.all(result.map(async (book) => {
        if (book.availableQuantity > 0) return { ...book, nextAvailableDate: null };

        const nextDue = await db.query.borrowRecords.findFirst({
          where: and(
            eq(schema.borrowRecords.bookId, book.id),
            inArray(schema.borrowRecords.status, ['borrowed', 'overdue', 'return_requested'])
          ),
          orderBy: [asc(schema.borrowRecords.dueDate)],
        });
        return { ...book, nextAvailableDate: nextDue?.dueDate || null };
      }));

      res.json(enrichedBooks);
    } catch (error: any) {
      console.error('Fetch books failed:', error);
      sendError(res, error);
    }
  });

  /** POST /api/books: librarian/admin adds a book. All copies start as available. */
  app.post('/api/books', authenticateToken, authorize(['librarian', 'admin']), async (req: any, res) => {
    try {
      const { id: _ignoredId, createdAt: _ignoredDate, ...data } = req.body;
      const quantity = Number(data.quantity) || 1;
      const [{ id }] = await db.insert(schema.books).values({
        ...data,
        quantity,
        availableQuantity: quantity,
        categoryId: data.categoryId ? Number(data.categoryId) : null,
        format: data.format || 'Physical',
        metadataSchema: data.metadataSchema || 'Standard',
        isAcquisition: data.isAcquisition || false,
        createdAt: new Date(),
      }).$returningId();

      const book = await db.query.books.findFirst({ where: eq(schema.books.id, id) });
      await logAction(req.user.id, 'BOOK_ADD', `Added item: ${book?.title} (${book?.format})`);
      res.json(book);
    } catch (error: any) {
      console.error('Add book failed:', error);
      sendError(res, error, 400);
    }
  });

  /** GET /api/serials/issues: lists issues of magazines/journals. */
  app.get('/api/serials/issues', authenticateToken, async (req, res) => {
    try {
      res.json(await db.select().from(schema.serialIssues));
    } catch (error: any) {
      sendError(res, error);
    }
  });

  /** POST /api/serials/issues: librarian/admin records a new magazine/journal issue. */
  app.post('/api/serials/issues', authenticateToken, authorize(['librarian', 'admin']), async (req: any, res) => {
    try {
      const { id: _ignoredId, ...data } = req.body;
      const toDate = (value: any) => (value ? new Date(value) : null);
      const [{ id }] = await db.insert(schema.serialIssues).values({
        ...data,
        publicationDate: toDate(data.publicationDate),
        receivedDate: toDate(data.receivedDate),
        status: data.status || 'Expected',
      }).$returningId();

      const issue = await db.query.serialIssues.findFirst({ where: eq(schema.serialIssues.id, id) });
      await logAction(req.user.id, 'SERIAL_ISSUE_ADD', `Added serial issue: ${data.issueNumber}`);
      res.status(201).json(issue);
    } catch (error: any) {
      sendError(res, error, 400);
    }
  });

  /**
   * PUT /api/books/:id: librarian/admin edits a book.
   * If the total quantity changes, the available quantity changes by the same amount
   * (e.g. buying 2 more copies adds 2 to the shelf).
   */
  app.put('/api/books/:id', authenticateToken, authorize(['librarian', 'admin']), async (req: any, res) => {
    try {
      const bookId = Number(req.params.id);
      const { id: _id, createdAt: _createdAt, availableQuantity: _ignore, nextAvailableDate: _next, ...data } = req.body;
      const oldBook = await db.query.books.findFirst({ where: eq(schema.books.id, bookId) });
      if (!oldBook) return res.status(404).json({ error: 'Book not found' });

      const newQuantity = data.quantity !== undefined ? Number(data.quantity) : oldBook.quantity;
      const diff = newQuantity - oldBook.quantity;
      const newAvailable = Math.max(0, oldBook.availableQuantity + diff);

      await db.update(schema.books)
        .set({
          ...data,
          quantity: newQuantity,
          categoryId: data.categoryId ? Number(data.categoryId) : null,
          availableQuantity: newAvailable,
        })
        .where(eq(schema.books.id, bookId));

      const book = await db.query.books.findFirst({ where: eq(schema.books.id, bookId) });
      await logAction(req.user.id, 'BOOK_UPDATE', `Updated book: ${book?.title}. Qty change: ${diff}`);
      res.json(book);
    } catch (error: any) {
      console.error('Update book failed:', error);
      sendError(res, error, 400);
    }
  });

  /**
   * DELETE /api/books/:id: librarian/admin removes a book.
   * Blocked while a copy is still out on loan (or requested); otherwise the
   * book's past loan history is removed with it (ON DELETE CASCADE).
   */
  app.delete('/api/books/:id', authenticateToken, authorize(['librarian', 'admin']), async (req: any, res) => {
    try {
      const bookId = Number(req.params.id);
      const activeLoan = await db.query.borrowRecords.findFirst({
        where: and(eq(schema.borrowRecords.bookId, bookId), inArray(schema.borrowRecords.status, [...ACTIVE_LOAN_STATUSES])),
      });
      if (activeLoan) {
        return res.status(400).json({ error: 'This book has active loans or requests. Resolve them before deleting.' });
      }

      await db.delete(schema.books).where(eq(schema.books.id, bookId));
      await logAction(req.user.id, 'BOOK_DELETE', `Deleted book ID: ${bookId}`);
      res.json({ message: 'Book deleted' });
    } catch (error: any) {
      sendError(res, error, 400);
    }
  });

  /** GET /api/categories: public list of subject categories. */
  app.get('/api/categories', async (req, res) => {
    try {
      res.json(await db.select().from(schema.categories));
    } catch (error: any) {
      sendError(res, error);
    }
  });

  /** POST /api/categories: librarian/admin adds a category. */
  app.post('/api/categories', authenticateToken, authorize(['librarian', 'admin']), async (req, res) => {
    try {
      const [{ id }] = await db.insert(schema.categories)
        .values({ categoryName: req.body.categoryName })
        .$returningId();
      res.json(await db.query.categories.findFirst({ where: eq(schema.categories.id, id) }));
    } catch (error: any) {
      sendError(res, error, 400);
    }
  });

  // ==========================================================================
  // SETTINGS ROUTES (library rules)
  // ==========================================================================

  /** GET /api/config: lists all library settings. */
  app.get('/api/config', authenticateToken, async (req, res) => {
    try {
      res.json(await db.select().from(schema.systemConfig));
    } catch (error: any) {
      sendError(res, error);
    }
  });

  /**
   * Allowed ranges for the numeric library rules. The server checks these itself,
   * so a bad value (e.g. a negative fine or 0 loan days) can't be saved, even by
   * calling the API directly without the Settings screen.
   */
  const CONFIG_RULES: Record<string, { min: number; max: number; integer: boolean; label: string }> = {
    LOAN_DURATION_DAYS: { min: 1, max: 365, integer: true, label: 'Loan duration' },
    DAILY_FINE_RATE: { min: 0, max: 1000, integer: false, label: 'Daily fine rate' },
    MAX_LOANS_PER_USER: { min: 1, max: 100, integer: true, label: 'Maximum loans per student' },
  };

  /**
   * PUT /api/config/:key: admin changes a setting (used by the Admin → Settings tab).
   * The new value is used immediately by the fine and loan logic.
   */
  app.put('/api/config/:key', authenticateToken, authorize(['admin']), async (req: any, res) => {
    try {
      const key = req.params.key;
      const value = String(req.body.value ?? '').trim();

      const [existing] = await db.select().from(schema.systemConfig).where(eq(schema.systemConfig.key, key));
      if (!existing) return res.status(404).json({ error: `Unknown setting: ${key}` });

      // Validate numeric rules
      const rule = CONFIG_RULES[key];
      if (rule) {
        const number = Number(value);
        const valid = value !== '' && Number.isFinite(number) && number >= rule.min && number <= rule.max
          && (!rule.integer || Number.isInteger(number));
        if (!valid) {
          return res.status(400).json({
            error: `${rule.label} must be ${rule.integer ? 'a whole number' : 'a number'} between ${rule.min} and ${rule.max}`,
          });
        }
      } else if (value === '') {
        return res.status(400).json({ error: 'Value cannot be empty' });
      }

      await db.update(schema.systemConfig)
        .set({ value, updatedAt: new Date() })
        .where(eq(schema.systemConfig.key, key));

      const [config] = await db.select().from(schema.systemConfig).where(eq(schema.systemConfig.key, key));
      await logAction(req.user.id, 'CONFIG_UPDATE', `Changed ${key} from "${existing.value}" to "${value}"`);
      res.json(config);
    } catch (error: any) {
      sendError(res, error, 400);
    }
  });

  // ==========================================================================
  // BORROWING WORKFLOW
  //   student requests → librarian approves/rejects → student requests return
  //   → librarian confirms return → (fine paid, if any)
  // ==========================================================================

  /**
   * POST /api/borrow/request: a student asks to borrow a book.
   * Checks: the book has a free copy, the student doesn't already have it,
   * and the student is under the MAX_LOANS_PER_USER limit (from system_config).
   */
  app.post('/api/borrow/request', authenticateToken, authorize(['student']), async (req: any, res) => {
    const bookId = Number(req.body.bookId);
    try {
      const book = await db.query.books.findFirst({ where: eq(schema.books.id, bookId) });
      if (!book || book.availableQuantity <= 0) {
        return res.status(400).json({ error: 'Book not available' });
      }

      const existing = await db.query.borrowRecords.findFirst({
        where: and(
          eq(schema.borrowRecords.userId, req.user.id),
          eq(schema.borrowRecords.bookId, bookId),
          inArray(schema.borrowRecords.status, [...ACTIVE_LOAN_STATUSES])
        ),
      });
      if (existing) return res.status(400).json({ error: 'Already has a request or borrowed copy' });

      // Enforce the loan limit set by the admin
      const maxLoans = await getConfigNumber('MAX_LOANS_PER_USER', 5);
      const activeLoans = await db.select({ id: schema.borrowRecords.id }).from(schema.borrowRecords).where(and(
        eq(schema.borrowRecords.userId, req.user.id),
        inArray(schema.borrowRecords.status, [...ACTIVE_LOAN_STATUSES])
      ));
      if (activeLoans.length >= maxLoans) {
        return res.status(400).json({ error: `Loan limit reached: you can hold at most ${maxLoans} books at a time` });
      }

      // Provisional due date; it is set again from the approval date when the librarian approves.
      const loanDays = await getConfigNumber('LOAN_DURATION_DAYS', 14);
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + loanDays);

      const [{ id }] = await db.insert(schema.borrowRecords)
        .values({ userId: req.user.id, bookId, dueDate, status: 'requested' })
        .$returningId();

      const record = await db.query.borrowRecords.findFirst({ where: eq(schema.borrowRecords.id, id) });
      await logAction(req.user.id, 'BORROW_REQUEST', `Requested book ID: ${bookId}`);
      res.json(record);
    } catch (error: any) {
      sendError(res, error);
    }
  });

  /**
   * GET /api/borrow/history: loan list.
   * Students see only their own loans; librarians/admins see everyone's.
   * Fines are refreshed first so the amounts shown are up to date.
   */
  app.get('/api/borrow/history', authenticateToken, async (req: any, res) => {
    try {
      await updateFines();
      const query = db.select({
        record: schema.borrowRecords,
        book: schema.books,
        // only safe user fields (never send password hashes to the browser)
        user: {
          id: schema.users.id,
          fullName: schema.users.fullName,
          email: schema.users.email,
          role: schema.users.role,
        },
      }).from(schema.borrowRecords)
        .leftJoin(schema.books, eq(schema.borrowRecords.bookId, schema.books.id))
        .leftJoin(schema.users, eq(schema.borrowRecords.userId, schema.users.id));

      const result = req.user.role === 'student'
        ? await query.where(eq(schema.borrowRecords.userId, req.user.id)).orderBy(desc(schema.borrowRecords.id))
        : await query.orderBy(desc(schema.borrowRecords.id));
      res.json(result);
    } catch (error: any) {
      sendError(res, error);
    }
  });

  /**
   * POST /api/borrow/approve/:id: librarian approves a loan request.
   *
   * CONCURRENCY PROTECTION (the main technical challenge of the project):
   * Everything runs in ONE MySQL transaction, and `.for('update')` (SELECT ... FOR UPDATE)
   * LOCKS the loan row and the book row. If two librarians approve requests for the
   * last copy at the same moment, the second one has to wait until the first finishes.
   * It then sees available_quantity = 0 and is refused. A book can never be lent twice.
   * If any step fails, MySQL rolls back every change in the transaction.
   */
  app.post('/api/borrow/approve/:id', authenticateToken, authorize(['librarian', 'admin']), async (req: any, res) => {
    try {
      const recordId = Number(req.params.id);
      const loanDays = await getConfigNumber('LOAN_DURATION_DAYS', 14);

      await db.transaction(async (tx) => {
        // 1. Lock and check the loan request
        const [record] = await tx.select().from(schema.borrowRecords)
          .where(eq(schema.borrowRecords.id, recordId)).for('update');
        if (!record || record.status !== 'requested') throw new HttpError(400, 'Invalid record status');

        // 2. Lock and check the book's stock
        const [book] = await tx.select().from(schema.books)
          .where(eq(schema.books.id, record.bookId)).for('update');
        if (!book || book.availableQuantity <= 0) throw new HttpError(400, 'Book is no longer available');

        // 3. Take one copy off the shelf
        await tx.update(schema.books)
          .set({ availableQuantity: sql`${schema.books.availableQuantity} - 1` })
          .where(eq(schema.books.id, book.id));

        // 4. Mark the loan as borrowed; the loan period starts today
        const borrowDate = new Date();
        const dueDate = new Date(borrowDate);
        dueDate.setDate(dueDate.getDate() + loanDays);
        await tx.update(schema.borrowRecords)
          .set({ status: 'borrowed', borrowDate, dueDate })
          .where(eq(schema.borrowRecords.id, record.id));

        // 5. Audit log (inside the transaction, so it is only saved if everything succeeded)
        await logAction(req.user.id, 'BORROW_APPROVE', `Approved request ID: ${recordId}`, tx);
      });

      res.json({ message: 'Request approved' });
    } catch (error: any) {
      console.error('Borrow approval failed (transaction rolled back):', error.message);
      sendError(res, error, 400);
    }
  });

  /** POST /api/borrow/reject/:id: librarian rejects a loan request (status → cancelled). */
  app.post('/api/borrow/reject/:id', authenticateToken, authorize(['librarian', 'admin']), async (req: any, res) => {
    try {
      const record = await db.query.borrowRecords.findFirst({ where: eq(schema.borrowRecords.id, Number(req.params.id)) });
      if (!record || record.status !== 'requested') return res.status(400).json({ error: 'Invalid record status' });

      await db.update(schema.borrowRecords).set({ status: 'cancelled' }).where(eq(schema.borrowRecords.id, record.id));
      await logAction(req.user.id, 'BORROW_REJECT', `Rejected request ID: ${req.params.id}`);
      res.json({ message: 'Request rejected' });
    } catch (error: any) {
      sendError(res, error);
    }
  });

  /**
   * POST /api/borrow/return-request/:id: a student says "I am returning this book".
   * Fines are brought up to date first; after this the fine stops growing.
   */
  app.post('/api/borrow/return-request/:id', authenticateToken, authorize(['student']), async (req: any, res) => {
    try {
      await updateFines();
      const record = await db.query.borrowRecords.findFirst({
        where: and(eq(schema.borrowRecords.id, Number(req.params.id)), eq(schema.borrowRecords.userId, req.user.id)),
      });
      if (!record || (record.status !== 'borrowed' && record.status !== 'overdue')) {
        return res.status(400).json({ error: 'Invalid record status' });
      }

      await db.update(schema.borrowRecords).set({ status: 'return_requested' }).where(eq(schema.borrowRecords.id, record.id));
      await logAction(req.user.id, 'RETURN_REQUEST', `Requested return for ID: ${req.params.id}`);
      res.json({ message: 'Return request sent' });
    } catch (error: any) {
      sendError(res, error);
    }
  });

  /**
   * POST /api/borrow/return-approve/:id: librarian confirms the book is back on the shelf.
   * Same transaction + row-lock protection as approval: stock goes up by exactly one,
   * and a return can't be counted twice.
   */
  app.post('/api/borrow/return-approve/:id', authenticateToken, authorize(['librarian', 'admin']), async (req: any, res) => {
    try {
      const recordId = Number(req.params.id);
      await db.transaction(async (tx) => {
        const [record] = await tx.select().from(schema.borrowRecords)
          .where(eq(schema.borrowRecords.id, recordId)).for('update');
        if (!record || record.status !== 'return_requested') throw new HttpError(400, 'Invalid record status');

        const [book] = await tx.select().from(schema.books)
          .where(eq(schema.books.id, record.bookId)).for('update');
        if (book) {
          // Put the copy back, but never above the total number of copies owned
          await tx.update(schema.books)
            .set({ availableQuantity: Math.min(book.quantity, book.availableQuantity + 1) })
            .where(eq(schema.books.id, book.id));
        }

        await tx.update(schema.borrowRecords)
          .set({ status: 'returned', returnDate: new Date() })
          .where(eq(schema.borrowRecords.id, record.id));

        await logAction(req.user.id, 'RETURN_APPROVE', `Approved return for ID: ${recordId}`, tx);
      });

      res.json({ message: 'Return approved' });
    } catch (error: any) {
      console.error('Return approval failed (transaction rolled back):', error.message);
      sendError(res, error, 400);
    }
  });

  /**
   * POST /api/borrow/pay-fine/:id: librarian records that a fine was paid.
   * Only allowed once the book is RETURNED. (Before this fix, a fine paid while the book
   * was still overdue came back on the next page load, because it was recalculated.)
   */
  app.post('/api/borrow/pay-fine/:id', authenticateToken, authorize(['librarian', 'admin']), async (req: any, res) => {
    try {
      const record = await db.query.borrowRecords.findFirst({ where: eq(schema.borrowRecords.id, Number(req.params.id)) });
      if (!record) return res.status(404).json({ error: 'Record not found' });
      if (record.status !== 'returned') {
        return res.status(400).json({ error: 'The book must be returned before the fine can be settled' });
      }

      await db.update(schema.borrowRecords).set({ fineAmount: 0 }).where(eq(schema.borrowRecords.id, record.id));
      await logAction(req.user.id, 'PAY_FINE', `Cleared fine of ${record.fineAmount} for ID: ${req.params.id}`);
      res.json({ message: 'Fine paid successfully' });
    } catch (error: any) {
      sendError(res, error);
    }
  });

  // ==========================================================================
  // USER ADMINISTRATION
  // ==========================================================================

  /**
   * GET /api/admin/users: member directory (profiles merged in, passwords removed).
   * Uses plain LEFT JOINs: users ⟕ students ⟕ librarians. (Drizzle's `with:` shortcut
   * generates LATERAL joins, which MariaDB/XAMPP does not support.)
   */
  app.get('/api/admin/users', authenticateToken, authorize(['admin', 'librarian']), async (req, res) => {
    try {
      const rows = await db.select({
        user: schema.users,
        studentProfile: schema.students,
        librarianProfile: schema.librarians,
      }).from(schema.users)
        .leftJoin(schema.students, eq(schema.students.userId, schema.users.id))
        .leftJoin(schema.librarians, eq(schema.librarians.userId, schema.users.id));

      const flattened = rows.map(({ user, studentProfile, librarianProfile }) => ({
        ...withoutPassword(user),
        ...(studentProfile || {}),
        ...(librarianProfile || {}),
        id: user.id, // keep the user id (the profile tables have their own ids)
      }));
      res.json(flattened);
    } catch (error: any) {
      sendError(res, error);
    }
  });

  /** POST /api/admin/users: admin creates a member of ANY role (student, librarian or admin). */
  app.post('/api/admin/users', authenticateToken, authorize(['admin']), async (req: any, res) => {
    try {
      const role: Role = VALID_ROLES.includes(req.body.role) ? req.body.role : 'student';
      const id = await createUserAccount(req.body, role);
      await logAction(req.user.id, 'USER_ADMIN_CREATE', `Admin created ${role} account ${req.body.email}`);
      res.json({ message: 'User registered successfully', id });
    } catch (error: any) {
      sendError(res, error, 400);
    }
  });

  /** PUT /api/admin/users/:id: admin edits a member, including role and (optionally) password. */
  app.put('/api/admin/users/:id', authenticateToken, authorize(['admin']), async (req: any, res) => {
    try {
      const { fullName, phone, role, studentCode, department, year, employeeCode } = req.body;
      const userId = Number(req.params.id);
      if (role && !VALID_ROLES.includes(role)) return res.status(400).json({ error: 'Invalid role' });

      const updateData: any = { fullName, phone, role };
      if (req.body.password) {
        updateData.password = await bcrypt.hash(req.body.password, 10);
      }

      await db.update(schema.users).set(updateData).where(eq(schema.users.id, userId));
      const user = await db.query.users.findFirst({ where: eq(schema.users.id, userId) });
      if (!user) return res.status(404).json({ error: 'User not found' });

      // Keep the profile tables in line with the (possibly changed) role
      if (user.role === 'student') {
        const existing = await db.query.students.findFirst({ where: eq(schema.students.userId, userId) });
        if (existing) {
          await db.update(schema.students).set({ studentCode, department, year }).where(eq(schema.students.userId, userId));
        } else if (studentCode) {
          await db.insert(schema.students).values({ userId, studentCode, department: department || 'General', year: Number(year) || 1 });
        }
        await db.delete(schema.librarians).where(eq(schema.librarians.userId, userId));
      } else if (user.role === 'librarian') {
        const existing = await db.query.librarians.findFirst({ where: eq(schema.librarians.userId, userId) });
        if (existing) {
          await db.update(schema.librarians).set({ employeeCode }).where(eq(schema.librarians.userId, userId));
        } else if (employeeCode) {
          await db.insert(schema.librarians).values({ userId, employeeCode });
        }
        await db.delete(schema.students).where(eq(schema.students.userId, userId));
      }

      await logAction(req.user.id, 'USER_ADMIN_UPDATE', `Admin updated profile for ${user.email}`);
      res.json(withoutPassword(user));
    } catch (error: any) {
      sendError(res, error, 400);
    }
  });

  /** PUT /api/admin/users/:id/role: admin changes only a member's role. */
  app.put('/api/admin/users/:id/role', authenticateToken, authorize(['admin']), async (req: any, res) => {
    try {
      const { role } = req.body;
      if (!VALID_ROLES.includes(role)) return res.status(400).json({ error: 'Invalid role' });
      const userId = Number(req.params.id);

      await db.update(schema.users).set({ role }).where(eq(schema.users.id, userId));
      const user = await db.query.users.findFirst({ where: eq(schema.users.id, userId) });
      if (!user) return res.status(404).json({ error: 'User not found' });

      await logAction(req.user.id, 'USER_ROLE_CHANGE', `Changed role of ${user.email} to ${role}`);
      res.json(withoutPassword(user));
    } catch (error: any) {
      sendError(res, error, 400);
    }
  });

  /**
   * DELETE /api/admin/users/:id: admin removes a member.
   * Blocked if the member still has books, open requests or unpaid fines.
   * Otherwise MySQL removes their profile and loan history automatically (ON DELETE CASCADE),
   * and their audit-log entries are kept but no longer linked (ON DELETE SET NULL).
   */
  app.delete('/api/admin/users/:id', authenticateToken, authorize(['admin']), async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      if (id === req.user.id) return res.status(400).json({ error: 'Cannot delete yourself' });

      const user = await db.query.users.findFirst({ where: eq(schema.users.id, id) });
      if (!user) return res.status(404).json({ error: 'User not found' });

      const outstanding = await db.query.borrowRecords.findFirst({
        where: and(
          eq(schema.borrowRecords.userId, id),
          or(inArray(schema.borrowRecords.status, [...ACTIVE_LOAN_STATUSES]), sql`${schema.borrowRecords.fineAmount} > 0`)
        ),
      });
      if (outstanding) {
        return res.status(400).json({ error: 'This member still has active loans or unpaid fines' });
      }

      await db.delete(schema.users).where(eq(schema.users.id, id));
      await logAction(req.user.id, 'USER_DELETE', `Deleted user: ${user.email}`);
      res.json({ message: 'User deleted' });
    } catch (error: any) {
      sendError(res, error, 400);
    }
  });

  // ==========================================================================
  // BACKUP
  // ==========================================================================

  /**
   * GET /api/admin/database-dump: admin downloads a full .sql backup of the database.
   * The file can be imported in phpMyAdmin (XAMPP) or any MySQL server to restore everything.
   */
  app.get('/api/admin/database-dump', authenticateToken, authorize(['admin']), async (req: any, res) => {
    try {
      const sqlContent = await buildSqlBackup(pool);
      const fileName = `library_backup_${new Date().toISOString().slice(0, 10)}.sql`;
      await logAction(req.user.id, 'DATABASE_BACKUP', `Downloaded database backup ${fileName}`);
      res.setHeader('Content-Type', 'application/sql; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
      res.send(sqlContent);
    } catch (error: any) {
      sendError(res, error);
    }
  });

  // ==========================================================================
  // DASHBOARD & REPORTS
  // ==========================================================================

  /** Runs a raw SQL query and returns the rows (used for reports with GROUP BY / JOIN). */
  const rawAll = async (query: string, params: any[] = []): Promise<any[]> => {
    const [rows] = await pool.query(query, params);
    return rows as any[];
  };

  /** GET /api/dashboard/stats: headline numbers + loan status breakdown for the dashboard. */
  app.get('/api/dashboard/stats', authenticateToken, authorize(['librarian', 'admin']), async (req, res) => {
    try {
      await updateFines();
      const [[totalBooks], [totalUsers], [activeBorrows], [pendingRequests], [overdueCount], statusStats] = await Promise.all([
        rawAll('SELECT COALESCE(SUM(quantity), 0) AS total FROM books'),
        rawAll('SELECT COUNT(*) AS total FROM users'),
        rawAll("SELECT COUNT(*) AS total FROM borrow_records WHERE status IN ('borrowed', 'overdue')"),
        rawAll("SELECT COUNT(*) AS total FROM borrow_records WHERE status = 'requested'"),
        rawAll("SELECT COUNT(*) AS total FROM borrow_records WHERE status = 'overdue'"),
        rawAll('SELECT status, COUNT(*) AS count FROM borrow_records GROUP BY status'),
      ]);

      res.json({
        summary: {
          totalBooks: Number(totalBooks?.total) || 0,
          totalUsers: Number(totalUsers?.total) || 0,
          activeBorrows: Number(activeBorrows?.total) || 0,
          pendingRequests: Number(pendingRequests?.total) || 0,
          overdueCount: Number(overdueCount?.total) || 0,
        },
        statusStats,
      });
    } catch (error: any) {
      sendError(res, error);
    }
  });

  /**
   * GET /api/reports/detailed: all the data behind the Analytics screen.
   * Each report is a SQL query using JOIN + GROUP BY (relational reporting).
   */
  app.get('/api/reports/detailed', authenticateToken, authorize(['librarian', 'admin']), async (req, res) => {
    try {
      await updateFines();

      // 1. Most borrowed books
      const topBooks = await rawAll(`
        SELECT b.title, b.author, COUNT(br.record_id) AS borrow_count
        FROM borrow_records br
        JOIN books b ON br.book_id = b.book_id
        GROUP BY b.book_id, b.title, b.author
        ORDER BY borrow_count DESC
        LIMIT 10`);

      // 2. Students who borrow the most
      const topBorrowers = await rawAll(`
        SELECT u.full_name, u.email, COUNT(br.record_id) AS borrow_count
        FROM borrow_records br
        JOIN users u ON br.user_id = u.user_id
        WHERE u.role = 'student'
        GROUP BY u.user_id, u.full_name, u.email
        ORDER BY borrow_count DESC
        LIMIT 10`);

      // 3. Number of books in each category
      const categoryDistribution = await rawAll(`
        SELECT c.category_name AS name, COUNT(b.book_id) AS value
        FROM categories c
        JOIN books b ON c.category_id = b.category_id
        GROUP BY c.category_id, c.category_name
        ORDER BY value DESC`);

      // 4. Members with the most overdue books and their total fines
      const overdueHotspots = await rawAll(`
        SELECT u.full_name, COUNT(br.record_id) AS overdue_count, SUM(br.fine_amount) AS total_fines
        FROM borrow_records br
        JOIN users u ON br.user_id = u.user_id
        WHERE br.status = 'overdue'
        GROUP BY u.user_id, u.full_name
        ORDER BY overdue_count DESC
        LIMIT 5`);

      // 5. The 20 most recent loan records
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

      // 6. Loans per month for the last 6 months.
      //    MySQL counts loans per month; JavaScript fills in months with 0 loans,
      //    so the chart always shows 6 bars.
      const now = new Date();
      const months: string[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
        months.push(d.toISOString().slice(0, 7)); // "YYYY-MM"
      }
      const firstMonthStart = new Date(`${months[0]}-01T00:00:00Z`);
      const monthlyCounts = await db.select({
        month: sql<string>`DATE_FORMAT(${schema.borrowRecords.borrowDate}, '%Y-%m')`.as('month'),
        count: sql<number>`COUNT(*)`.as('count'),
      }).from(schema.borrowRecords)
        .where(gte(schema.borrowRecords.borrowDate, firstMonthStart))
        .groupBy(sql`month`);
      const monthlyTrends = months.map((month) => ({
        month,
        borrow_count: Number(monthlyCounts.find((m) => m.month === month)?.count) || 0,
      }));

      // 7. Books with 1 or 0 copies left
      const stockStatus = await rawAll(`
        SELECT b.book_id, b.title, b.quantity, b.available_quantity,
               (SELECT MAX(borrow_date) FROM borrow_records WHERE book_id = b.book_id) AS last_borrowed
        FROM books b
        WHERE b.available_quantity <= 1
        ORDER BY b.available_quantity ASC, last_borrowed DESC
        LIMIT 20`);

      res.json({ topBooks, topBorrowers, categoryDistribution, overdueHotspots, recentActivity, monthlyTrends, stockStatus });
    } catch (error: any) {
      console.error('Detailed report failed:', error);
      sendError(res, error);
    }
  });

  // ==========================================================================
  // SERVING THE REACT APP
  // ==========================================================================
  // Vercel:      the React files are served by Vercel's CDN, so Express only handles /api.
  // Development: Vite compiles the React code on the fly (with live reload).
  // Production:  the pre-built files in /dist are served as static files.
  // Any other URL returns index.html so React Router can show the right page.
  if (process.env.VERCEL) {
    // nothing to serve here
  } else if (process.env.NODE_ENV !== 'production') {
    // Vite is loaded only in development. The module name is kept in a variable so that
    // Vercel does not bundle the (large) Vite package into the serverless function.
    const viteModuleName = 'vite';
    const { createServer: createViteServer } = await import(viteModuleName);
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  // On Vercel the platform handles incoming connections itself, so we only listen locally.
  if (!process.env.VERCEL) {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }
  return app;
}

// ----------------------------------------------------------------------------
// STARTING THE APP
// ----------------------------------------------------------------------------
let appPromise: Promise<express.Express> | null = null;

/**
 * Returns the Express app, starting it the first time it is called.
 * If start-up fails (e.g. the database can't be reached), the next call tries again
 * instead of staying broken. Used by api/index.ts on Vercel.
 */
export function getApp(): Promise<express.Express> {
  if (!appPromise) {
    appPromise = startServer().catch((error) => {
      appPromise = null;
      throw error;
    });
  }
  return appPromise;
}

// On your own PC (npm run dev / npm start) start straight away and stop with a clear
// message if something is wrong, e.g. XAMPP's MySQL is not running.
if (!process.env.VERCEL) {
  getApp().catch((error) => {
    console.error('Server failed to start:', error.message);
    process.exit(1);
  });
}
