import React, { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { User } from './types';
import api from './lib/api';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import StudentHome from './pages/StudentHome';
import LibrarianBooks from './pages/LibrarianBooks';
import AdminManagement from './pages/AdminManagement';
import BorrowHistory from './pages/BorrowHistory';
import Profile from './pages/Profile';
import Navbar from './components/Navbar';

/**
 * Shape of the global Authentication context.
 */
interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

/**
 * Custom hook to consume the AuthContext safely.
 */
export const useAuth = () => useContext(AuthContext);

/**
 * Main Application Component.
 * Wraps the app in AuthProvider and handles global routing logic.
 */
export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Authenticate user on initial load by checking the token
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('library_token');
      if (token) {
        try {
          const res = await api.get('/auth/me');
          setUser(res.data);
        } catch (e) {
          localStorage.removeItem('library_token');
        }
      }
      setLoading(false);
    };
    checkAuth();
  }, []);

  /**
   * Persists the JWT in local storage and updates the global user state.
   */
  const login = (token: string, user: User) => {
    localStorage.setItem('library_token', token);
    setUser(user);
  };

  /**
   * Clears session storage and resets the user context.
   */
  const logout = () => {
    localStorage.removeItem('library_token');
    setUser(null);
  };

  // Show a loading indicator until the auth check is complete
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#F5F5F0]">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-12 h-12 border-4 border-lms-blue border-t-transparent rounded-full"
        />
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      <Router>
        <div className="min-h-screen bg-[#F5F5F0] text-[#141414] font-sans">
          {user && <Navbar />}
          <main className="container mx-auto px-4 py-8">
            <AnimatePresence mode="wait">
              <Routes>
                <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
                
                {/* General authenticated routes */}
                <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
                <Route path="/books" element={<PrivateRoute><StudentHome /></PrivateRoute>} />
                <Route path="/history" element={<PrivateRoute><BorrowHistory /></PrivateRoute>} />
                <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />
                
                {/* Role-specific protected routes */}
                <Route 
                  path="/manage-books" 
                  element={<PrivateRoute roles={['librarian', 'admin']}><LibrarianBooks /></PrivateRoute>} 
                />
                <Route 
                  path="/admin" 
                  element={<PrivateRoute roles={['admin']}><AdminManagement /></PrivateRoute>} 
                />

                <Route path="*" element={<Navigate to="/" />} />
              </Routes>
            </AnimatePresence>
          </main>
        </div>
      </Router>
    </AuthContext.Provider>
  );
}

/**
 * Route guard component that restricts access based on authentication status and user roles.
 * Supports smooth mounting animations for layout transition.
 */
function PrivateRoute({ children, roles }: { children: React.ReactNode, roles?: string[] }) {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) return <Navigate to="/login" state={{ from: location }} />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" />;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
    >
      {children}
    </motion.div>
  );
}
