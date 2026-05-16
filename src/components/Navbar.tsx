import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { Book, History, LayoutDashboard, LogOut, Settings, Users, Library } from 'lucide-react';
import { motion } from 'motion/react';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/', roles: ['student', 'librarian', 'admin'], color: 'text-lms-blue' },
    { label: 'Catalog', icon: Library, path: '/books', roles: ['student', 'librarian', 'admin'], color: 'text-lms-orange' },
    { label: 'My History', icon: History, path: '/history', roles: ['student', 'librarian', 'admin'], color: 'text-lms-green' },
    { label: 'Inventory', icon: Book, path: '/manage-books', roles: ['librarian', 'admin'], color: 'text-lms-magenta' },
    { label: 'Admin', icon: Settings, path: '/admin', roles: ['admin'], color: 'text-lms-cyan' },
    { label: 'Profile', icon: Users, path: '/profile', roles: ['student', 'librarian', 'admin'], color: 'text-lms-blue' },
  ];

  const filteredItems = navItems.filter(item => item.roles.includes(user?.role || ''));

  return (
    <nav className="glass sticky top-4 left-0 right-0 z-50 mx-4 mt-6 rounded-[2.5rem] overflow-hidden px-8 py-4 shadow-2xl shadow-blue-900/5 border border-white/50">
      <div className="flex items-center justify-between">
        <Link to="/" className="flex items-center gap-4 group">
          <div className="w-12 h-12 bg-lms-blue rounded-2xl flex items-center justify-center text-white shadow-xl shadow-blue-200 group-hover:scale-110 transition-all duration-500 overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-tr from-white/0 to-white/20" />
            <Library size={26} className="relative z-10" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tighter text-lms-ink leading-none">LMS</h1>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-lms-blue mt-1">Research Hub</p>
          </div>
        </Link>

        <div className="hidden md:flex items-center bg-gray-50/50 p-1.5 rounded-[1.5rem] gap-1 border border-[#14141405]">
          {filteredItems.map((item) => {
            const isActive = window.location.pathname === item.path;
            return (
              <Link 
                key={`nav-${item.path}`} 
                to={item.path}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.15em] transition-all duration-300 ${
                  isActive 
                  ? `bg-white ${item.color} shadow-lg shadow-black/5 ring-1 ring-black/5 scale-105` 
                  : 'text-gray-400 hover:text-lms-ink hover:bg-white/50'
                }`}
              >
                <item.icon size={14} strokeWidth={2.5} />
                <span className="hidden xl:inline">{item.label}</span>
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-black text-gray-900 leading-none">{user?.fullName}</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-lms-blue opacity-80 mt-1">{user?.role}</p>
          </div>
          
          <button 
            onClick={handleLogout}
            className="w-10 h-10 flex items-center justify-center bg-white border border-red-50 text-red-500 rounded-2xl shadow-sm hover:bg-red-50 hover:scale-105 active:scale-95 transition-all"
            title="Logout"
          >
            <LogOut size={16} strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </nav>
  );
}
