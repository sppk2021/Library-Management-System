import React, { useState, useEffect, useMemo } from 'react';
import { Search, Filter, BookIcon, AlertCircle, CheckCircle2, ShoppingCart, ChevronLeft, ChevronRight, Grid, List as ListIcon, Loader2, ArrowUpDown, ArrowUp, ArrowDown, Clock } from 'lucide-react';
import api from '../lib/api';
import { Book, Category } from '../types';
import { motion, AnimatePresence } from 'motion/react';

type SortOption = 'title' | 'author' | 'available' | 'newest';

export default function StudentHome() {
  const [books, setBooks] = useState<Book[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  
  // Layout & Sorting State
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(12);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);

  useEffect(() => {
    fetchData();
  }, []); // Only fetch once, handle filtering/sorting client-side for smooth interaction with 100+ items

  const fetchData = async () => {
    setLoading(true);
    try {
      const [booksRes, catsRes] = await Promise.all([
        api.get('/books'),
        api.get('/categories')
      ]);
      setBooks(booksRes.data);
      setCategories(catsRes.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const requestBorrow = async (bookId: number) => {
    try {
      await api.post('/borrow/request', { bookId });
      setMessage({ type: 'success', text: 'Borrow request sent successfully!' });
      // Partially update local state to reflect request if needed, or just let librarian handle it
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to request book' });
    }
    setTimeout(() => setMessage(null), 3000);
  };

  // Processing logic
  const filteredBooks = useMemo(() => {
    return books.filter(b => {
      const matchesSearch = b.title.toLowerCase().includes(search.toLowerCase()) || 
                           b.author.toLowerCase().includes(search.toLowerCase()) ||
                           (b.isbn?.toLowerCase() || '').includes(search.toLowerCase());
      const matchesCat = selectedCat === '' || b.categoryId?.toString() === selectedCat;
      return matchesSearch && matchesCat;
    });
  }, [books, search, selectedCat]);

  const sortedBooks = useMemo(() => {
    const data = [...filteredBooks];
    return data.sort((a, b) => {
      let valA: any, valB: any;
      switch(sortBy) {
        case 'title': valA = a.title; valB = b.title; break;
        case 'author': valA = a.author; valB = b.author; break;
        case 'available': valA = a.availableQuantity; valB = b.availableQuantity; break;
        case 'newest': valA = a.id; valB = b.id; break;
        default: valA = a.id; valB = b.id;
      }
      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredBooks, sortBy, sortOrder]);

  const paginatedBooks = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return sortedBooks.slice(start, start + itemsPerPage);
  }, [sortedBooks, currentPage, itemsPerPage]);

  const getCategoryTheme = (catId: number | undefined) => {
    if (!catId) return { bg: 'bg-gray-100', text: 'text-gray-500', hex: '#6b7280' };
    const index = catId % 5;
    const themes = [
      { bg: 'bg-lms-blue/10', border: 'border-lms-blue/20', text: 'text-lms-blue', hex: '#0066FF' },
      { bg: 'bg-lms-orange/10', border: 'border-lms-orange/20', text: 'text-lms-orange', hex: '#FF6321' },
      { bg: 'bg-lms-green/10', border: 'border-lms-green/20', text: 'text-lms-green', hex: '#00D166' },
      { bg: 'bg-lms-magenta/10', border: 'border-lms-magenta/20', text: 'text-lms-magenta', hex: '#FF00FF' },
      { bg: 'bg-lms-yellow/10', border: 'border-lms-yellow/20', text: 'text-lms-ink', hex: '#FFE600' }
    ];
    return themes[index];
  };

  const totalPages = Math.ceil(sortedBooks.length / itemsPerPage);

  useEffect(() => {
    setCurrentPage(1); // Reset to first page on filter/sort change
  }, [search, selectedCat, sortBy, sortOrder]);

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-4xl font-serif italic text-[#141414]">Academic Catalog</h1>
          <p className="text-gray-500 font-medium">Explore and reserve from our curated collection of resources.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-lms-blue transition-colors" size={18} />
            <input 
              type="text" 
              placeholder="Search title, author..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 pr-4 py-2.5 bg-white border border-[#14141408] rounded-2xl shadow-sm outline-none focus:ring-2 focus:ring-blue-100 w-full sm:w-64 text-sm transition-all"
            />
          </div>
          
          <div className="flex items-center bg-white border border-[#14141408] rounded-2xl shadow-sm p-1">
            <button 
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-lms-blue text-white shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <Grid size={18} />
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-xl transition-all ${viewMode === 'list' ? 'bg-lms-blue text-white shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <ListIcon size={18} />
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 py-4 border-y border-[#14141408]">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gray-400">
           <Filter size={14} /> Filter & Sort
        </div>
        
        <select 
          value={selectedCat}
          onChange={(e) => setSelectedCat(e.target.value)}
          className="px-4 py-2 bg-white border border-[#14141408] rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-100 shadow-sm appearance-none cursor-pointer"
        >
          <option value="">All Categories</option>
          {categories.map(c => (
            <option key={`cat-${c.id}`} value={c.id}>{c.categoryName}</option>
          ))}
        </select>

        <div className="flex items-center gap-2">
          <select 
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="px-4 py-2 bg-white border border-[#14141408] rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-100 shadow-sm cursor-pointer"
          >
            <option value="newest">Sort: Newest</option>
            <option value="title">Sort: Title</option>
            <option value="author">Sort: Author</option>
            <option value="available">Sort: Availability</option>
          </select>
          <button 
            onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
            className="p-2 bg-white border border-[#14141408] rounded-xl text-lms-blue shadow-sm hover:scale-105 transition-all"
          >
            {sortOrder === 'asc' ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
          </button>
        </div>
      </div>

      {/* Modal / OPAC View */}
      <AnimatePresence>
        {selectedBook && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedBook(null)}
              className="absolute inset-0 bg-[#14141440] backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl relative overflow-hidden"
            >
              <div className="p-8 md:p-12">
                <div className="flex flex-col md:flex-row gap-8">
                  <div className={`w-full md:w-48 aspect-[3/4] ${getCategoryTheme(selectedBook.categoryId).bg} rounded-3xl flex items-center justify-center ${getCategoryTheme(selectedBook.categoryId).text} shrink-0 border border-black/5 overflow-hidden shadow-2xl`}>
                    {selectedBook.coverUrl ? (
                      <img 
                        src={selectedBook.coverUrl} 
                        alt={selectedBook.title} 
                        className="w-full h-full object-cover" 
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1543004218-ee141d0ef1bd?w=400&q=80';
                        }}
                      />
                    ) : (
                      <BookIcon size={64} />
                    )}
                  </div>
                  <div className="space-y-6 flex-1">
                    <div>
                      <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${getCategoryTheme(selectedBook.categoryId).text} mb-2 block`}>
                        {categories.find(c => c.id === selectedBook.categoryId)?.categoryName || 'General Collection'}
                      </span>
                      <h2 className="text-3xl font-bold leading-tight">{selectedBook.title}</h2>
                      <p className="text-gray-400 font-serif italic mt-1">by {selectedBook.author}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-gray-50 rounded-2xl">
                         <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">ISBN</p>
                         <p className="text-sm font-bold">{selectedBook.isbn || 'N/A'}</p>
                      </div>
                      <div className="p-4 bg-gray-50 rounded-2xl">
                         <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Shelf Location</p>
                         <p className="text-sm font-bold">{selectedBook.shelfLocation || 'Main Hall'}</p>
                      </div>
                      <div className="p-4 bg-gray-50 rounded-2xl">
                         <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Availability</p>
                         <p className="text-sm font-bold">{selectedBook.availableQuantity} / {selectedBook.quantity}</p>
                      </div>
                      <div className="p-4 bg-gray-50 rounded-2xl">
                         <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Publisher</p>
                         <p className="text-sm font-bold">{selectedBook.publisher || 'N/A'}</p>
                      </div>
                    </div>

                    <div className="pt-6 flex items-center gap-4">
                      <button 
                        onClick={() => { requestBorrow(selectedBook.id); setSelectedBook(null); }}
                        disabled={selectedBook.availableQuantity <= 0}
                        className={`flex-1 flex items-center justify-center gap-2 h-14 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${
                          selectedBook.availableQuantity > 0 
                            ? 'bg-[#141414] text-white hover:bg-lms-blue shadow-xl shadow-blue-100' 
                            : 'bg-gray-100 text-gray-300 cursor-not-allowed'
                        }`}
                      >
                        <ShoppingCart size={18} />
                        {selectedBook.availableQuantity > 0 ? 'Reserve Book' : 'Out of Stock'}
                      </button>
                      <button 
                        onClick={() => setSelectedBook(null)}
                        className="h-14 px-6 border border-[#1414141a] rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-gray-50 transition-all"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {message && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className={`fixed bottom-8 right-8 z-50 p-4 rounded-3xl shadow-2xl backdrop-blur-xl border flex items-center gap-3 transition-all ${
              message.type === 'success' ? 'bg-white/90 text-green-700 border-green-100' : 'bg-white/90 text-red-700 border-red-100'
            }`}
          >
            {message.type === 'success' ? <CheckCircle2 size={24} /> : <AlertCircle size={24} />}
            <div className="pr-4">
              <p className="font-bold text-sm">{message.type === 'success' ? 'Success' : 'Attention'}</p>
              <p className="text-xs opacity-70 tracking-tight">{message.text}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className={viewMode === 'grid' 
        ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
        : "space-y-4"
      }>
        {loading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div key={`loading-${i}`} className="card-modern h-64 animate-pulse" />
          ))
        ) : paginatedBooks.length > 0 ? (
          paginatedBooks.map((book) => (
            <motion.div 
              key={`book-${book.id}`}
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ y: -8 }}
              className={`card-modern group relative ${
                viewMode === 'list' ? 'flex flex-row items-center p-4 gap-6' : 'p-6 flex flex-col justify-between h-full'
              }`}
            >
              {/* Highlight accent bar */}
              <div className={`absolute top-0 left-0 right-0 h-1.5 ${getCategoryTheme(book.categoryId).bg} opacity-50 group-hover:opacity-100 transition-opacity`} />
              
              <div className={viewMode === 'list' ? 'w-24 h-24 shrink-0' : 'mb-6'}>
                <div className={`w-full aspect-[4/3] h-full ${getCategoryTheme(book.categoryId).bg} rounded-2xl flex items-center justify-center ${getCategoryTheme(book.categoryId).text} shrink-0 group-hover:scale-105 transition-all duration-500 overflow-hidden relative border border-black/5`}>
                  {book.coverUrl ? (
                    <img 
                      src={book.coverUrl} 
                      alt={book.title} 
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1543004218-ee141d0ef1bd?w=400&q=80';
                      }}
                    />
                  ) : (
                    <BookIcon size={viewMode === 'list' ? 32 : 64} className="group-hover:scale-110 transition-transform duration-700" />
                  )}
                  <div className="absolute top-3 right-3">
                    <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${
                      book.availableQuantity > 0 
                        ? 'bg-green-50 text-green-600 border-green-100' 
                        : 'bg-red-50 text-red-600 border-red-100'
                    }`}>
                      {book.availableQuantity > 0 ? 'Available' : 'Out'}
                    </span>
                  </div>
                </div>
              </div>

              <div className={viewMode === 'list' ? 'flex-1' : ''}>
                <div className="mb-4">
                  <p className={`text-[10px] font-black ${getCategoryTheme(book.categoryId).text} uppercase tracking-[0.2em] mb-1`}>
                    {categories.find(c => c.id === book.categoryId)?.categoryName || 'General'}
                  </p>
                  <h3 
                    onClick={() => setSelectedBook(book)}
                    className={`font-bold text-lg leading-tight text-[#141414] group-hover:text-white line-clamp-2 cursor-pointer transition-colors duration-300`}
                  >
                    {book.title}
                  </h3>
                  <p className="text-gray-400 text-xs mt-1 italic">by {book.author}</p>
                </div>

                {viewMode === 'list' && (
                   <div className="flex items-center gap-4 text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                     <span>ISBN: {book.isbn || 'N/A'}</span>
                     <span>Shelf: {book.shelfLocation || 'Main'}</span>
                   </div>
                )}
              </div>
              
              <div className={viewMode === 'list' ? 'shrink-0 flex flex-col items-end gap-2' : 'mt-4 pt-4 border-t border-[#14141405]'}>
                <div className={viewMode === 'list' ? '' : 'flex items-center justify-between mb-4'}>
                  {viewMode === 'grid' && (
                    <div className="flex flex-col">
                       <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">Availability</span>
                       {book.availableQuantity > 0 ? (
                         <span className="text-sm font-black text-lms-blue tracking-tight">{book.availableQuantity} Copies Available</span>
                       ) : (
                         <div className="flex flex-col mt-0.5">
                           <span className="text-[10px] font-black text-red-500 uppercase tracking-widest leading-none">All Borrowed Out</span>
                           {(book as any).nextAvailableDate && (
                             <div className="flex items-center gap-1.5 mt-1">
                               <Clock size={10} className="text-amber-500" />
                               <span className="text-[9px] font-bold text-amber-600 uppercase tracking-tighter">Expected: {new Date((book as any).nextAvailableDate).toLocaleDateString()}</span>
                             </div>
                           )}
                           {!(book as any).nextAvailableDate && (
                             <span className="text-[9px] text-gray-400 italic mt-0.5 font-medium">No return date estimated</span>
                           )}
                         </div>
                       )}
                    </div>
                  )}
                  <button 
                    onClick={() => requestBorrow(book.id)}
                    disabled={book.availableQuantity <= 0}
                    className={`flex items-center gap-2 h-10 px-6 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                      book.availableQuantity > 0 
                        ? 'bg-[#141414] text-white hover:bg-lms-blue shadow-lg shadow-blue-100 active:scale-95' 
                        : 'bg-gray-100 text-gray-300 cursor-not-allowed opacity-50'
                    }`}
                  >
                    <ShoppingCart size={16} />
                    {book.availableQuantity > 0 ? 'Reserve' : 'Check Back'}
                  </button>
                </div>
              </div>
            </motion.div>
          ))
        ) : (
          <div className="col-span-full py-32 flex flex-col items-center justify-center text-center">
            <div className="w-20 h-20 bg-gray-50 border border-[#14141408] rounded-full flex items-center justify-center text-[#5A5A4020] mb-6">
               <Search size={32} />
            </div>
            <h2 className="text-2xl font-serif italic text-gray-400">Empty Archives</h2>
            <p className="text-gray-400 text-sm max-w-xs mx-auto mt-2">No volumes found matching your specific inquiry. Try broadening your criteria.</p>
            <button 
              onClick={() => { setSearch(''); setSelectedCat(''); }}
              className="mt-8 text-[10px] font-black text-[#5A5A40] uppercase tracking-[0.3em] hover:underline"
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* Modern Pagination Navigation */}
      {totalPages > 1 && (
        <div className="mt-12 flex items-center justify-center gap-2">
          <button 
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(prev => prev - 1)}
            className="w-12 h-12 flex items-center justify-center bg-white border border-[#14141408] rounded-2xl shadow-sm text-gray-400 hover:text-[#5A5A40] transition-all disabled:opacity-20"
          >
            <ChevronLeft size={20} />
          </button>
          
          <div className="flex items-center gap-2 px-6 py-2 bg-white border border-[#14141408] rounded-2xl shadow-sm">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
              <button 
                key={`page-${page}`}
                onClick={() => setCurrentPage(page)}
                className={`w-8 h-8 rounded-xl text-[10px] font-black transition-all ${
                  currentPage === page 
                    ? 'bg-lms-blue text-white' 
                    : 'text-gray-400 hover:bg-[#F8F8F5] hover:text-lms-blue'
                }`}
              >
                {page}
              </button>
            )).slice(Math.max(0, currentPage - 3), Math.min(totalPages, currentPage + 2))}
          </div>

          <button 
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(prev => prev + 1)}
            className="w-12 h-12 flex items-center justify-center bg-white border border-[#14141408] rounded-2xl shadow-sm text-gray-400 hover:text-[#5A5A40] transition-all disabled:opacity-20"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      )}
    </div>
  );
}
