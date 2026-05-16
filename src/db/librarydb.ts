import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

export const users = sqliteTable('users', {
  id: integer('user_id').primaryKey({ autoIncrement: true }),
  fullName: text('full_name').notNull(),
  email: text('email').notNull().unique(),
  password: text('password').notNull(),
  role: text('role', { enum: ['student', 'librarian', 'admin'] }).notNull(),
  phone: text('phone'),
  communicationPreferences: text('communication_preferences'), // JSON: { email: boolean, sms: boolean }
  createdAt: integer('created_at', { mode: 'timestamp' }).default(new Date()),
});

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

export const students = sqliteTable('students', {
  id: integer('student_id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').references(() => users.id).notNull(),
  studentCode: text('student_code').notNull().unique(),
  department: text('department').notNull(),
  year: integer('year').notNull(),
});

export const studentsRelations = relations(students, ({ one }) => ({
  user: one(users, {
    fields: [students.userId],
    references: [users.id],
  }),
}));

export const librarians = sqliteTable('librarians', {
  id: integer('librarian_id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').references(() => users.id).notNull(),
  employeeCode: text('employee_code').notNull().unique(),
});

export const librariansRelations = relations(librarians, ({ one }) => ({
  user: one(users, {
    fields: [librarians.userId],
    references: [users.id],
  }),
}));

export const categories = sqliteTable('categories', {
  id: integer('category_id').primaryKey({ autoIncrement: true }),
  categoryName: text('category_name').notNull().unique(),
});

export const books = sqliteTable('books', {
  id: integer('book_id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  author: text('author').notNull(),
  isbn: text('isbn').notNull().unique(),
  publisher: text('publisher'),
  categoryId: integer('category_id').references(() => categories.id),
  quantity: integer('quantity').notNull().default(1),
  availableQuantity: integer('available_quantity').notNull().default(1),
  shelfLocation: text('shelf_location'),
  format: text('format', { enum: ['Physical', 'Digital', 'Serial'] }).notNull().default('Physical'),
  metadataSchema: text('metadata_schema', { enum: ['MARC21', 'RDA', 'Standard'] }).default('Standard'),
  metadataRecord: text('metadata_record'), // JSON: holds MARC21/RDA fields
  isAcquisition: integer('is_acquisition', { mode: 'boolean' }).default(false),
  acquisitionSource: text('acquisition_source'),
  budgetCode: text('budget_code'),
  coverUrl: text('cover_url'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(new Date()),
});

export const borrowRecords = sqliteTable('borrow_records', {
  id: integer('record_id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').references(() => users.id).notNull(),
  bookId: integer('book_id').references(() => books.id).notNull(),
  borrowDate: integer('borrow_date', { mode: 'timestamp' }),
  dueDate: integer('due_date', { mode: 'timestamp' }).notNull(),
  returnDate: integer('return_date', { mode: 'timestamp' }),
  status: text('status', { enum: ['requested', 'borrowed', 'return_requested', 'returned', 'overdue', 'cancelled'] }).notNull().default('requested'),
  fineAmount: real('fine_amount').default(0),
});

export const logs = sqliteTable('logs', {
  id: integer('log_id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').references(() => users.id),
  action: text('action').notNull(),
  details: text('details'),
  timestamp: integer('timestamp', { mode: 'timestamp' }).default(new Date()),
});

export const systemConfig = sqliteTable('system_config', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  description: text('description'),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(new Date()),
});

export const serialIssues = sqliteTable('serial_issues', {
  id: integer('issue_id').primaryKey({ autoIncrement: true }),
  bookId: integer('book_id').references(() => books.id).notNull(), // Links to the "Serial" parent book
  issueNumber: text('issue_number').notNull(),
  volumeNumber: text('volume_number'),
  publicationDate: integer('publication_date', { mode: 'timestamp' }),
  receivedDate: integer('received_date', { mode: 'timestamp' }),
  status: text('status', { enum: ['Expected', 'Received', 'Claimed', 'Late'] }).default('Expected'),
});
