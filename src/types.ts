/**
 * Role-based access types for the library system users.
 */
export type UserRole = 'student' | 'librarian' | 'admin';

/**
 * Represents a system user. Includes properties for specific roles like students or librarians.
 */
export interface User {
  id: number;
  fullName: string;
  email: string;
  role: UserRole;
  phone?: string;
  createdAt?: string;
  // Student specific properties
  studentCode?: string;
  department?: string;
  year?: number;
  // Librarian specific properties
  employeeCode?: string;
}

/**
 * Subject category used to group books.
 */
export interface Category {
  id: number;
  categoryName: string;
}

/**
 * Represents a library asset. Contains core metadata and current inventory status.
 */
export interface Book {
  id: number;
  title: string;
  author: string;
  isbn: string;
  publisher?: string;
  categoryId?: number;
  quantity: number;
  availableQuantity: number;
  shelfLocation?: string;
  coverUrl?: string;
  format?: 'Physical' | 'Digital' | 'Serial';
  isAcquisition?: boolean;
}

/**
 * Tracks a book's borrowing lifecycle from a specific user.
 */
export interface BorrowRecord {
  id: number;
  userId: number;
  bookId: number;
  borrowDate?: string;
  dueDate: string;
  returnDate?: string;
  status: 'requested' | 'borrowed' | 'return_requested' | 'returned' | 'overdue' | 'cancelled';
  fineAmount?: number;
}

/**
 * Aggregated view of a borrow action including the resolved book and user entities.
 */
export interface BorrowHistoryItem {
  record: BorrowRecord;
  book: Book;
  user?: User;
}

/**
 * Represents high-level analytical stats for the admin/librarian dashboards.
 */
export interface DashboardStats {
  summary: {
    totalBooks: number;
    totalUsers: number;
    activeBorrows: number;
    pendingRequests: number;
  };
  statusStats: { status: string; count: number }[];
}
