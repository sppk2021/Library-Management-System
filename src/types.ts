export type UserRole = 'student' | 'librarian' | 'admin';

export interface User {
  id: number;
  fullName: string;
  email: string;
  role: UserRole;
  phone?: string;
  createdAt?: string;
  // Student specific
  studentCode?: string;
  department?: string;
  year?: number;
  // Librarian specific
  employeeCode?: string;
}

export interface Category {
  id: number;
  categoryName: string;
}

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

export interface BorrowHistoryItem {
  record: BorrowRecord;
  book: Book;
  user?: User;
}

export interface DashboardStats {
  summary: {
    totalBooks: number;
    totalUsers: number;
    activeBorrows: number;
    pendingRequests: number;
  };
  statusStats: { status: string; count: number }[];
}
