import { mysqlTable, varchar, int, bigint, real, boolean, json, text } from 'drizzle-orm/mysql-core';
import { relations } from 'drizzle-orm';

export const users = mysqlTable('users', {
  id: int('user_id').primaryKey().autoincrement(),
  fullName: varchar('full_name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  password: varchar('password', { length: 255 }).notNull(),
  role: varchar('role', { enum: ['student', 'librarian', 'admin'], length: 50 }).notNull(),
  phone: varchar('phone', { length: 50 }),
  communicationPreferences: text('communication_preferences'), // JSON: { email: boolean, sms: boolean }
  createdAt: bigint('created_at', { mode: 'number' }),
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

export const students = mysqlTable('students', {
  id: int('student_id').primaryKey().autoincrement(),
  userId: int('user_id').notNull().references(() => users.id),
  studentCode: varchar('student_code', { length: 100 }).notNull().unique(),
  department: varchar('department', { length: 255 }).notNull(),
  year: int('year').notNull(),
});

export const studentsRelations = relations(students, ({ one }) => ({
  user: one(users, {
    fields: [students.userId],
    references: [users.id],
  }),
}));

export const librarians = mysqlTable('librarians', {
  id: int('librarian_id').primaryKey().autoincrement(),
  userId: int('user_id').notNull().references(() => users.id),
  employeeCode: varchar('employee_code', { length: 100 }).notNull().unique(),
});

export const librariansRelations = relations(librarians, ({ one }) => ({
  user: one(users, {
    fields: [librarians.userId],
    references: [users.id],
  }),
}));

export const categories = mysqlTable('categories', {
  id: int('category_id').primaryKey().autoincrement(),
  categoryName: varchar('category_name', { length: 255 }).notNull().unique(),
});

export const books = mysqlTable('books', {
  id: int('book_id').primaryKey().autoincrement(),
  title: varchar('title', { length: 500 }).notNull(),
  author: varchar('author', { length: 500 }).notNull(),
  isbn: varchar('isbn', { length: 255 }).notNull().unique(),
  publisher: varchar('publisher', { length: 255 }),
  categoryId: int('category_id').references(() => categories.id),
  quantity: int('quantity').notNull().default(1),
  availableQuantity: int('available_quantity').notNull().default(1),
  shelfLocation: varchar('shelf_location', { length: 255 }),
  format: varchar('format', { enum: ['Physical', 'Digital', 'Serial'], length: 50 }).notNull().default('Physical'),
  metadataSchema: varchar('metadata_schema', { enum: ['MARC21', 'RDA', 'Standard'], length: 50 }).default('Standard'),
  metadataRecord: text('metadata_record'), // JSON: holds MARC21/RDA fields
  isAcquisition: boolean('is_acquisition').default(false),
  acquisitionSource: varchar('acquisition_source', { length: 255 }),
  budgetCode: varchar('budget_code', { length: 100 }),
  coverUrl: varchar('cover_url', { length: 1000 }),
  createdAt: bigint('created_at', { mode: 'number' }),
});

export const borrowRecords = mysqlTable('borrow_records', {
  id: int('record_id').primaryKey().autoincrement(),
  userId: int('user_id').notNull().references(() => users.id),
  bookId: int('book_id').notNull().references(() => books.id),
  borrowDate: bigint('borrow_date', { mode: 'number' }),
  dueDate: bigint('due_date', { mode: 'number' }).notNull(),
  returnDate: bigint('return_date', { mode: 'number' }),
  status: varchar('status', { enum: ['requested', 'borrowed', 'return_requested', 'returned', 'overdue', 'cancelled'], length: 50 }).notNull().default('requested'),
  fineAmount: real('fine_amount').default(0),
});

export const logs = mysqlTable('logs', {
  id: int('log_id').primaryKey().autoincrement(),
  userId: int('user_id').references(() => users.id),
  action: varchar('action', { length: 255 }).notNull(),
  details: text('details'),
  timestamp: bigint('timestamp', { mode: 'number' }),
});

export const systemConfig = mysqlTable('system_config', {
  key: varchar('key', { length: 255 }).primaryKey(),
  value: text('value').notNull(),
  description: text('description'),
  updatedAt: bigint('updated_at', { mode: 'number' }),
});

export const serialIssues = mysqlTable('serial_issues', {
  id: int('issue_id').primaryKey().autoincrement(),
  bookId: int('book_id').notNull().references(() => books.id),
  issueNumber: varchar('issue_number', { length: 100 }).notNull(),
  volumeNumber: varchar('volume_number', { length: 100 }),
  publicationDate: bigint('publication_date', { mode: 'number' }),
  receivedDate: bigint('received_date', { mode: 'number' }),
  status: varchar('status', { enum: ['Expected', 'Received', 'Claimed', 'Late'], length: 50 }).default('Expected'),
});
