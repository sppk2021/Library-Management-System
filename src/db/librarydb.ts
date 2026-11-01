/**
 * ============================================================================
 * DATABASE SCHEMA (Drizzle ORM definitions for MySQL)
 * ============================================================================
 *
 * This file describes every table in the MySQL database in TypeScript.
 * Drizzle ORM uses these definitions to:
 *   1. Build SQL queries for us (so we write `db.select().from(books)`
 *      instead of hand-writing SQL strings), and
 *   2. Give us type checking: if we misspell a column name, TypeScript
 *      reports an error before the app even runs.
 *
 * The real CREATE TABLE statements live in `server/database.ts`.
 * The two files must describe the same tables. This file is the "map"
 * that the code uses, and that file is the "blueprint" MySQL uses.
 *
 * Relationships (these match the ERD):
 *   users 1 ── 0..1 students         (a student user has one student profile)
 *   users 1 ── 0..1 librarians       (a librarian user has one staff profile)
 *   categories 1 ── * books          (a category groups many books)
 *   users 1 ── * borrow_records * ── 1 books   (the loan "ledger")
 *   users 1 ── * logs                (audit trail of actions)
 *   books 1 ── * serial_issues       (issues of a magazine / journal)
 * ============================================================================
 */
import {
  mysqlTable,
  int,
  varchar,
  text,
  datetime,
  decimal,
  boolean,
  mysqlEnum,
} from 'drizzle-orm/mysql-core';
import { relations } from 'drizzle-orm';

/**
 * USERS: one row for every person who can log in.
 * The `role` column decides what they are allowed to do (role-based access control):
 *   - student   → browse books, request loans, request returns
 *   - librarian → manage books, approve loans/returns, view reports
 *   - admin     → everything a librarian can do + manage users and settings
 */
export const users = mysqlTable('users', {
  id: int('user_id').primaryKey().autoincrement(),
  fullName: varchar('full_name', { length: 150 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  password: varchar('password', { length: 255 }).notNull(), // bcrypt hash, never the real password
  role: mysqlEnum('role', ['student', 'librarian', 'admin']).notNull(),
  phone: varchar('phone', { length: 30 }),
  communicationPreferences: text('communication_preferences'), // JSON text, e.g. { "email": true, "sms": false }
  createdAt: datetime('created_at'),
});

/**
 * Tells Drizzle how a user links to its profile, loans and log entries.
 * Note: the app joins these tables with plain LEFT JOINs instead of Drizzle's
 * `with:` shortcut, because that shortcut needs LATERAL joins, which MariaDB (XAMPP) lacks.
 */
export const usersRelations = relations(users, ({ one, many }) => ({
  studentProfile: one(students, {
    fields: [users.id],
    references: [students.userId],
  }),
  librarianProfile: one(librarians, {
    fields: [users.id],
    references: [librarians.userId],
  }),
  borrowings: many(borrowRecords),
  logs: many(logs),
}));

/**
 * STUDENTS: extra details that only students have.
 * `user_id` points to the matching row in `users` (a 1-to-1 relationship).
 */
export const students = mysqlTable('students', {
  id: int('student_id').primaryKey().autoincrement(),
  userId: int('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  studentCode: varchar('student_code', { length: 50 }).notNull().unique(),
  department: varchar('department', { length: 100 }).notNull(),
  year: int('year').notNull(),
});

export const studentsRelations = relations(students, ({ one }) => ({
  user: one(users, {
    fields: [students.userId],
    references: [users.id],
  }),
}));

/**
 * LIBRARIANS: extra details that only library staff have (their employee code).
 */
export const librarians = mysqlTable('librarians', {
  id: int('librarian_id').primaryKey().autoincrement(),
  userId: int('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  employeeCode: varchar('employee_code', { length: 50 }).notNull().unique(),
});

export const librariansRelations = relations(librarians, ({ one }) => ({
  user: one(users, {
    fields: [librarians.userId],
    references: [users.id],
  }),
}));

/**
 * CATEGORIES: subject areas used to group books (e.g. "Computer Science").
 */
export const categories = mysqlTable('categories', {
  id: int('category_id').primaryKey().autoincrement(),
  categoryName: varchar('category_name', { length: 100 }).notNull().unique(),
});

/**
 * BOOKS: the library catalogue.
 *   - `quantity`           = how many copies the library owns in total
 *   - `availableQuantity`  = how many copies are on the shelf right now
 * When a loan is approved, availableQuantity goes down by 1.
 * When a return is approved, it goes back up by 1.
 */
export const books = mysqlTable('books', {
  id: int('book_id').primaryKey().autoincrement(),
  title: varchar('title', { length: 255 }).notNull(),
  author: varchar('author', { length: 255 }).notNull(),
  isbn: varchar('isbn', { length: 50 }).notNull().unique(),
  publisher: varchar('publisher', { length: 255 }),
  categoryId: int('category_id').references(() => categories.id, { onDelete: 'set null' }),
  quantity: int('quantity').notNull().default(1),
  availableQuantity: int('available_quantity').notNull().default(1),
  shelfLocation: varchar('shelf_location', { length: 50 }),
  format: mysqlEnum('format', ['Physical', 'Digital', 'Serial']).notNull().default('Physical'),
  metadataSchema: mysqlEnum('metadata_schema', ['MARC21', 'RDA', 'Standard']).default('Standard'),
  metadataRecord: text('metadata_record'), // JSON text holding extra catalogue fields
  isAcquisition: boolean('is_acquisition').default(false),
  acquisitionSource: varchar('acquisition_source', { length: 255 }),
  budgetCode: varchar('budget_code', { length: 50 }),
  coverUrl: varchar('cover_url', { length: 500 }),
  createdAt: datetime('created_at'),
});

/**
 * BORROW_RECORDS: one row per loan. It moves through these statuses:
 *
 *   requested ──(librarian approves)──> borrowed ──(due date passes)──> overdue
 *       │                                  │                              │
 *       └──(librarian rejects)──> cancelled └──(student returns)──> return_requested
 *                                                                         │
 *                                                (librarian confirms)──> returned
 *
 * `fineAmount` is the unpaid fine. It is calculated automatically while a
 * book is overdue, and set back to 0 when the fine is paid.
 */
export const borrowRecords = mysqlTable('borrow_records', {
  id: int('record_id').primaryKey().autoincrement(),
  userId: int('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  bookId: int('book_id').references(() => books.id, { onDelete: 'cascade' }).notNull(),
  borrowDate: datetime('borrow_date'),
  dueDate: datetime('due_date').notNull(),
  returnDate: datetime('return_date'),
  status: mysqlEnum('status', ['requested', 'borrowed', 'return_requested', 'returned', 'overdue', 'cancelled'])
    .notNull()
    .default('requested'),
  // DECIMAL is exact (no rounding errors), which is what you want for money.
  // mode: 'number' makes Drizzle give us a normal JavaScript number.
  fineAmount: decimal('fine_amount', { precision: 10, scale: 2, mode: 'number' }).default(0),
});

/**
 * LOGS: the audit trail. Every important action (login, loan approval,
 * book deletion, etc.) is written here with who did it and when.
 */
export const logs = mysqlTable('logs', {
  id: int('log_id').primaryKey().autoincrement(),
  userId: int('user_id').references(() => users.id, { onDelete: 'set null' }),
  action: varchar('action', { length: 50 }).notNull(),
  details: text('details'),
  timestamp: datetime('timestamp'),
});

/**
 * SYSTEM_CONFIG: library rules that an admin can change through the API (PUT /api/config/:key)
 * without touching the code, e.g. LOAN_DURATION_DAYS, DAILY_FINE_RATE, MAX_LOANS_PER_USER.
 * Note: `key` is a reserved word in MySQL; Drizzle automatically wraps it in `backticks`.
 */
export const systemConfig = mysqlTable('system_config', {
  key: varchar('key', { length: 100 }).primaryKey(),
  value: varchar('value', { length: 255 }).notNull(),
  description: varchar('description', { length: 255 }),
  updatedAt: datetime('updated_at'),
});

/**
 * SERIAL_ISSUES: individual issues of a magazine or journal
 * (the parent magazine itself is a row in `books` with format = 'Serial').
 */
export const serialIssues = mysqlTable('serial_issues', {
  id: int('issue_id').primaryKey().autoincrement(),
  bookId: int('book_id').references(() => books.id, { onDelete: 'cascade' }).notNull(),
  issueNumber: varchar('issue_number', { length: 50 }).notNull(),
  volumeNumber: varchar('volume_number', { length: 50 }),
  publicationDate: datetime('publication_date'),
  receivedDate: datetime('received_date'),
  status: mysqlEnum('status', ['Expected', 'Received', 'Claimed', 'Late']).default('Expected'),
});
