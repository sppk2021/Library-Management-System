import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Edit2, Trash2, Library, Tag, Search, X, Check, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown, Filter, AlertCircle, Loader2, Code2, Copy } from 'lucide-react';
import api from '../lib/api';
import { Book, Category } from '../types';
import { motion, AnimatePresence } from 'motion/react';

type SortField = 'title' | 'category' | 'quantity' | 'available' | 'location';
type SortOrder = 'asc' | 'desc';

export default function LibrarianBooks() {
  const [books, setBooks] = useState<Book[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [currentBook, setCurrentBook] = useState<Partial<Book & { 
    format: string; 
    metadataSchema: string; 
    metadataRecord: string;
    isAcquisition: boolean;
    acquisitionSource: string;
    budgetCode: string;
  }>>({
    title: '', author: '', isbn: '', publisher: '', categoryId: undefined, quantity: 1, shelfLocation: '',
    format: 'Physical', metadataSchema: 'Standard', isAcquisition: false
  });
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [search, setSearch] = useState('');
  const [metadataBook, setMetadataBook] = useState<Book | null>(null);
  const [metadataFormat, setMetadataFormat] = useState<'MARC21' | 'UNIMARC'>('MARC21');

  const marc21Tags = (book: Book) => [
    { tag: '001', indicator: ' ', value: `LMS-${book.id?.toString().padStart(6, '0')}` },
    { tag: '020', indicator: ' ', value: `$a ${book.isbn}` },
    { tag: '100', indicator: '1 ', value: `$a ${book.author}, $e author` },
    { tag: '245', indicator: '10', value: `$a ${book.title} / $c ${book.author}` },
    { tag: '260', indicator: ' ', value: `$b ${book.publisher || 'Unknown Publisher'}` },
    { tag: '650', indicator: ' 7', value: `$a ${categories.find(c => c.id === book.categoryId)?.categoryName || 'General'} $2 fast` },
    { tag: '852', indicator: ' ', value: `$c ${book.shelfLocation || 'Main Stack'}` }
  ];

  const unimarcTags = (book: Book) => [
    { tag: '001', indicator: ' ', value: `UNIMARC-${book.id?.toString().padStart(6, '0')}` },
    { tag: '010', indicator: ' ', value: `$a ${book.isbn}` },
    { tag: '200', indicator: '1 ', value: `$a ${book.title} $f ${book.author}` },
    { tag: '210', indicator: ' ', value: `$c ${book.publisher || 'Unknown Publisher'}` },
    { tag: '606', indicator: ' ', value: `$a ${categories.find(c => c.id === book.categoryId)?.categoryName || 'General'}` },
    { tag: '700', indicator: ' 1', value: `$a ${book.author}` }
  ];

  // Sorting & Pagination
  const [sortField, setSortField] = useState<SortField>('title');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  useEffect(() => {
    fetchData();
  }, []);

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

  const handleSaveBook = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (currentBook.id) {
        await api.put(`/books/${currentBook.id}`, currentBook);
      } else {
        await api.post('/books', currentBook);
      }
      setIsEditing(false);
      setCurrentBook({ 
        title: '', author: '', isbn: '', publisher: '', quantity: 1, 
        format: 'Physical', metadataSchema: 'Standard', isAcquisition: false 
      });
      fetchData();
    } catch (err: any) { 
      alert(err.response?.data?.error || 'Failed to save book');
      console.error(err); 
    }
  };

  const handleDeleteBook = async (id: number) => {
    if (confirm('Are you sure you want to delete this book?')) {
      try {
        await api.delete(`/books/${id}`);
        fetchData();
      } catch (err: any) {
        alert(err.response?.data?.error || 'Failed to delete book');
      }
    }
  };

  const handleAddCategory = async () => {
    if (!newCategory) return;
    try {
      await api.post('/categories', { categoryName: newCategory });
      setNewCategory('');
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to add category');
    }
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const filteredBooks = useMemo(() => {
    return books.filter(b => 
      b.title.toLowerCase().includes(search.toLowerCase()) ||
      b.author.toLowerCase().includes(search.toLowerCase()) ||
      (b.isbn?.toLowerCase() || '').includes(search.toLowerCase())
    );
  }, [books, search]);

  const sortedBooks = useMemo(() => {
    const data = [...filteredBooks];
    return data.sort((a, b) => {
      let valA: any, valB: any;
      switch(sortField) {
        case 'title': valA = a.title; valB = b.title; break;
        case 'category': 
          valA = categories.find(c => c.id === a.categoryId)?.categoryName || '';
          valB = categories.find(c => c.id === b.categoryId)?.categoryName || '';
          break;
        case 'quantity': valA = a.quantity; valB = b.quantity; break;
        case 'available': valA = a.availableQuantity; valB = b.availableQuantity; break;
        case 'location': valA = a.shelfLocation || ''; valB = b.shelfLocation || ''; break;
      }
      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredBooks, sortField, sortOrder, categories]);

  const paginatedBooks = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return sortedBooks.slice(start, start + itemsPerPage);
  }, [sortedBooks, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(sortedBooks.length / itemsPerPage);

  const getCategoryTheme = (catId: number | undefined) => {
    if (!catId) return { bg: 'bg-gray-100', text: 'text-[#14141466]', border: 'border-gray-200' };
    const index = catId % 5;
    const themes = [
      { bg: 'bg-lms-blue/10', text: 'text-lms-blue', border: 'border-lms-blue/20' },
      { bg: 'bg-lms-orange/10', text: 'text-lms-orange', border: 'border-lms-orange/20' },
      { bg: 'bg-lms-green/10', text: 'text-lms-green', border: 'border-lms-green/20' },
      { bg: 'bg-lms-magenta/10', text: 'text-lms-magenta', border: 'border-lms-magenta/20' },
      { bg: 'bg-lms-yellow/10', text: 'text-lms-ink', border: 'border-lms-yellow/20' }
    ];
    return themes[index];
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown size={12} className="ml-1 opacity-20" />;
    return sortOrder === 'asc' ? <ArrowUp size={12} className="ml-1 text-lms-blue" /> : <ArrowDown size={12} className="ml-1 text-lms-blue" />;
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl font-serif italic text-[#141414]">Inventory Control</h1>
          <p className="text-gray-500 font-medium mt-1">Archive management and catalog maintenance.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-lms-blue transition-colors" size={18} />
              <input 
                type="text" 
                placeholder="Find in inventory..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                className="pl-10 pr-4 py-2.5 bg-white border border-[#14141408] rounded-2xl shadow-sm outline-none focus:ring-2 focus:ring-blue-100 text-sm w-48 sm:w-64 transition-all"
              />
            </div>
            
            <div className="relative group">
              <button 
                onClick={() => setShowCategoryModal(!showCategoryModal)}
                className="flex items-center gap-2 px-4 py-2.5 bg-white border border-[#14141408] rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-gray-50 transition-all shadow-sm active:scale-95"
              >
                <Tag size={16} className="text-lms-blue" /> Categories
              </button>
            </div>

            <select 
              value={sortField}
              onChange={(e) => setSortField(e.target.value as SortField)}
              className="px-4 py-2.5 bg-white border border-[#14141408] rounded-2xl text-[10px] font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-blue-100 shadow-sm appearance-none cursor-pointer"
            >
              <option value="title">Sort: Title</option>
              <option value="category">Sort: Category</option>
              <option value="available">Sort: Availability</option>
              <option value="quantity">Sort: Total Units</option>
              <option value="location">Sort: Shelf Location</option>
            </select>

            <button 
              onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
              className="w-10 h-10 flex items-center justify-center bg-white border border-[#14141408] rounded-2xl text-lms-blue shadow-sm hover:scale-105 active:scale-95 transition-all"
            >
              {sortOrder === 'asc' ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
            </button>

            <button 
              onClick={() => {
                setIsEditing(true);
                setCurrentBook({ title: '', author: '', isbn: '', publisher: '', quantity: 1, coverUrl: '' });
              }}
              className="flex items-center gap-2 px-5 py-2.5 bg-lms-blue text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 active:scale-95"
            >
              <Plus size={16} /> New Asset
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-8 items-start">
        <div className="xl:col-span-3 space-y-6">
          <div className="card-modern overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-100/50 bg-gray-50/50">
                    <th 
                      className="px-6 py-5 cursor-pointer group hover:bg-gray-100/50 transition-colors"
                      onClick={() => toggleSort('title')}
                    >
                      <div className="flex items-center text-[10px] uppercase tracking-[0.2em] text-gray-400 font-black">
                        Asset Profile <SortIcon field="title" />
                      </div>
                    </th>
                    <th 
                      className="px-6 py-5 cursor-pointer group hover:bg-gray-100/50 transition-colors"
                      onClick={() => toggleSort('category')}
                    >
                      <div className="flex items-center text-[10px] uppercase tracking-[0.2em] text-gray-400 font-black">
                        Classification <SortIcon field="category" />
                      </div>
                    </th>
                    <th 
                      className="px-6 py-5 cursor-pointer group hover:bg-gray-100/50 transition-colors text-center"
                      onClick={() => toggleSort('available')}
                    >
                      <div className="flex items-center justify-center text-[10px] uppercase tracking-[0.2em] text-gray-400 font-black">
                        Availability <SortIcon field="available" />
                      </div>
                    </th>
                    <th 
                      className="px-6 py-5 cursor-pointer group hover:bg-gray-100/50 transition-colors"
                      onClick={() => toggleSort('location')}
                    >
                      <div className="flex items-center text-[10px] uppercase tracking-[0.2em] text-gray-400 font-black">
                        Placement <SortIcon field="location" />
                      </div>
                    </th>
                    <th className="px-6 py-5 text-right italic font-serif text-gray-300">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  <AnimatePresence mode="popLayout">
                    {paginatedBooks.map((book) => (
                      <motion.tr 
                        key={`book-${book.id}`} 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        layout
                        className="group hover:bg-gray-50/80 transition-all duration-200"
                      >
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-10 bg-blue-50/50 border border-blue-100/20 rounded-lg flex items-center justify-center text-lms-blue/20 group-hover:text-lms-blue transition-all overflow-hidden shrink-0">
                               {book.coverUrl ? (
                                 <img src={book.coverUrl} alt={book.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                               ) : (
                                 <Library size={16} />
                               )}
                            </div>
                            <div>
                              <p className="font-black text-sm text-[#141414]">{book.title}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                 <p className="text-[10px] text-gray-400 italic">ISBN: {book.isbn} • {book.author}</p>
                                 {(book as any).format && (
                                   <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 bg-gray-100 text-gray-400 rounded-md">{(book as any).format}</span>
                                 )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <span className={`inline-block px-2 py-0.5 ${getCategoryTheme(book.categoryId).bg} ${getCategoryTheme(book.categoryId).text} text-[9px] font-black uppercase tracking-widest rounded-full border ${getCategoryTheme(book.categoryId).border}`}>
                            {categories.find(c => c.id === book.categoryId)?.categoryName || 'Unknown'}
                          </span>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex flex-col items-center">
                            <div className="flex items-baseline gap-1">
                               {book.quantity > 0 ? (
                                 <>
                                   <span className={`text-sm font-black ${book.availableQuantity > 0 ? 'text-lms-blue' : 'text-red-500'}`}>{book.availableQuantity}</span>
                                   <span className="text-[10px] text-gray-300">/ {book.quantity}</span>
                                 </>
                               ) : (
                                 <span className="text-[10px] font-black text-gray-200 uppercase tracking-widest">Zero Stock</span>
                               )}
                            </div>
                            {book.quantity > 0 && (
                              <div className="w-16 h-1 bg-gray-100 rounded-full mt-1.5 overflow-hidden">
                                <motion.div 
                                  initial={{ width: 0 }}
                                  animate={{ width: `${(book.availableQuantity / book.quantity) * 100}%` }}
                                  className={`h-full ${book.availableQuantity > 0 ? 'bg-lms-blue' : 'bg-red-500'}`} 
                                />
                              </div>
                            )}
                            {book.availableQuantity === 0 && book.quantity > 0 && (
                              <p className="text-[8px] font-black uppercase text-amber-500 mt-1 tracking-tighter">Borrowed Out</p>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-5 italic text-[11px] text-gray-500 font-medium">
                          {book.shelfLocation || 'UNDESIGNATED'}
                        </td>
                        <td className="px-6 py-5 text-right">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all">
                            <button 
                              onClick={() => setMetadataBook(book)} 
                              title="MARC21 Record"
                              className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-lms-blue hover:bg-white rounded-xl shadow-sm transition-all"
                            >
                              <Code2 size={14} />
                            </button>
                            <button onClick={() => { setCurrentBook(book); setIsEditing(true); }} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-lms-blue hover:bg-white rounded-xl shadow-sm transition-all"><Edit2 size={14} /></button>
                            <button onClick={() => handleDeleteBook(book.id)} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-white rounded-xl shadow-sm transition-all"><Trash2 size={14} /></button>
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
               <div className="px-6 py-4 bg-gray-50/50 border-t border-gray-50 flex items-center justify-between">
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                    Showing {paginatedBooks.length} of {sortedBooks.length} books
                  </p>
                  <div className="flex items-center gap-1.5">
                    <button 
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(p => p - 1)}
                      className="w-8 h-8 flex items-center justify-center bg-white border border-[#14141408] rounded-xl text-gray-400 hover:text-[#5A5A40] disabled:opacity-20 transition-all shadow-sm"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                        <button 
                          key={`page-${p}`}
                          onClick={() => setCurrentPage(p)}
                          className={`w-8 h-8 rounded-xl text-[10px] font-black transition-all ${
                            currentPage === p ? 'bg-lms-blue text-white' : 'text-gray-400 hover:bg-white'
                          }`}
                        >
                          {p}
                        </button>
                      )).slice(Math.max(0, currentPage - 3), Math.min(totalPages, currentPage + 2))}
                    </div>
                    <button 
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage(p => p + 1)}
                      className="w-8 h-8 flex items-center justify-center bg-white border border-[#14141408] rounded-xl text-gray-400 hover:text-[#5A5A40] disabled:opacity-20 transition-all shadow-sm"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
               </div>
            )}
            
            {sortedBooks.length === 0 && !loading && (
               <div className="py-24 flex flex-col items-center justify-center text-center">
                  <div className="w-16 h-16 bg-[#F8F8F5] rounded-full flex items-center justify-center text-gray-200 mb-4 border border-[#14141408]">
                     <Library size={32} />
                  </div>
                  <h3 className="text-xl font-serif italic text-gray-400">Inventory Empty</h3>
                  <p className="text-xs text-gray-400 mt-2">No records match your scan. Broaden your query or add new assets.</p>
               </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <AnimatePresence>
            {metadataBook && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-gray-900 p-8 rounded-[2.5rem] border border-white/10 shadow-2xl relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500 opacity-10 rounded-full translate-x-16 -translate-y-16" />
                
                <div className="flex items-center justify-between mb-8 relative z-10">
                  <div>
                    <div className="flex items-center gap-4 mb-2">
                      <button 
                        onClick={() => setMetadataFormat('MARC21')}
                        className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full transition-all ${metadataFormat === 'MARC21' ? 'bg-white text-lms-blue shadow-lg' : 'text-white/60 hover:text-white'}`}
                      >
                        MARC21
                      </button>
                      <button 
                        onClick={() => setMetadataFormat('UNIMARC')}
                        className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full transition-all ${metadataFormat === 'UNIMARC' ? 'bg-white text-lms-blue shadow-lg' : 'text-white/60 hover:text-white'}`}
                      >
                        UNIMARC
                      </button>
                    </div>
                    <h3 className="text-white font-serif italic text-xl">{metadataFormat} Manifest</h3>
                    <p className="text-[10px] text-blue-400 font-black uppercase tracking-[0.2em] mt-1">Inter-Library Exchange Record</p>
                  </div>
                  <button 
                    onClick={() => setMetadataBook(null)}
                    className="w-8 h-8 flex items-center justify-center bg-white/5 text-gray-400 rounded-full hover:bg-white/10 transition-all"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="bg-black/40 rounded-2xl p-6 border border-white/5 space-y-4 font-mono relative z-10">
                  {(metadataFormat === 'MARC21' ? marc21Tags(metadataBook) : unimarcTags(metadataBook)).map((m, i) => (
                    <div key={`meta-${i}`} className="flex gap-4 text-xs">
                      <span className="text-blue-400 font-black w-8">{m.tag}</span>
                      <span className="text-gray-600 bg-white/5 px-1 rounded">{m.indicator}</span>
                      <span className="text-white/80 break-all">{m.value}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-8 flex items-center justify-between relative z-10">
                   <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest max-w-[150px]">
                     Machine-Readable Cataloging Standard Compliance
                   </p>
                   <button className="flex items-center gap-2 px-4 py-2 bg-white/5 text-white text-[10px] font-bold rounded-xl hover:bg-white/10 transition-all">
                      <Copy size={12} /> Copy Raw
                   </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <AnimatePresence mode="wait">
            {isEditing && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="bg-white p-7 rounded-[2.5rem] border border-[#14141408] shadow-2xl relative"
              >
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="font-serif italic text-2xl text-[#141414]">{currentBook.id ? 'Refine Record' : 'Index Novelty'}</h3>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Metadata Entry</p>
                  </div>
                  <button onClick={() => setIsEditing(false)} className="w-8 h-8 flex items-center justify-center bg-gray-50 text-gray-400 rounded-full hover:bg-gray-100 transition-all"><X size={16} /></button>
                </div>
                <form onSubmit={handleSaveBook} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-lms-blue ml-2">Format</label>
                        <select 
                          className="select-modern"
                          value={currentBook.format} onChange={e => setCurrentBook({...currentBook, format: e.target.value})}
                        >
                          <option value="Physical">Physical Book</option>
                          <option value="Digital">Digital Resource</option>
                          <option value="Serial">Serial (Journal/Mag)</option>
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-lms-blue ml-2">Standard</label>
                        <select 
                          className="select-modern"
                          value={currentBook.metadataSchema} onChange={e => setCurrentBook({...currentBook, metadataSchema: e.target.value})}
                        >
                          <option value="Standard">Standard</option>
                          <option value="MARC21">MARC21 Compliance</option>
                          <option value="RDA">RDA Industry Std</option>
                        </select>
                      </div>
                    </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-lms-blue ml-2 flex items-center justify-between">
                       <span>Is Active Acquisition?</span>
                       <input 
                         type="checkbox" 
                         className="w-4 h-4 rounded border-gray-300 text-lms-blue"
                         checked={currentBook.isAcquisition} onChange={e => setCurrentBook({...currentBook, isAcquisition: e.target.checked})} 
                       />
                    </label>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-2">
                     <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-lms-blue ml-2">Vendor/Source</label>
                        <input type="text" className="input-modern" value={currentBook.acquisitionSource} onChange={e => setCurrentBook({...currentBook, acquisitionSource: e.target.value})} />
                     </div>
                     <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-lms-blue ml-2">Budget Code</label>
                        <input type="text" className="input-modern" value={currentBook.budgetCode} onChange={e => setCurrentBook({...currentBook, budgetCode: e.target.value})} />
                     </div>
                  </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-lms-blue ml-2">Book Title</label>
                      <input 
                        type="text" placeholder="Enter full title..." required
                        className="input-modern"
                        value={currentBook.title} onChange={e => setCurrentBook({...currentBook, title: e.target.value})}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-lms-blue ml-2">Author</label>
                      <input 
                        type="text" placeholder="Full name..." required
                        className="input-modern"
                        value={currentBook.author} onChange={e => setCurrentBook({...currentBook, author: e.target.value})}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-lms-blue ml-2">ISBN</label>
                        <input 
                          type="text" placeholder="12-digit code" required
                          className="input-modern"
                          value={currentBook.isbn} onChange={e => setCurrentBook({...currentBook, isbn: e.target.value})}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-lms-blue ml-2">Units</label>
                        <input 
                          type="number" placeholder="Qty" required
                          className="input-modern font-bold"
                          value={currentBook.quantity} onChange={e => setCurrentBook({...currentBook, quantity: Number(e.target.value)})}
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-lms-blue ml-2">Category</label>
                      <select 
                        className="select-modern"
                        value={currentBook.categoryId} onChange={e => setCurrentBook({...currentBook, categoryId: Number(e.target.value)})}
                      >
                        <option value="">Uncategorized</option>
                        {categories.map(c => <option key={`cat-${c.id}`} value={c.id}>{c.categoryName}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-lms-blue ml-2">Storage Slot</label>
                      <input 
                        type="text" placeholder="e.g. CS-04-A"
                        className="input-modern italic"
                        value={currentBook.shelfLocation} onChange={e => setCurrentBook({...currentBook, shelfLocation: e.target.value})}
                      />
                    </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-lms-blue ml-2">Cover Image URL</label>
                    {currentBook.coverUrl && (
                      <div className="w-full aspect-video bg-gray-50 rounded-2xl mb-2 overflow-hidden border border-gray-100">
                        <img 
                          src={currentBook.coverUrl} 
                          alt="Cover Preview" 
                          className="w-full h-full object-cover" 
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://via.placeholder.com/400x300?text=Invalid+Image+URL';
                          }}
                        />
                      </div>
                    )}
                    <input 
                      type="text" 
                      placeholder="https://images.unsplash.com/..."
                      className="input-modern italic"
                      value={currentBook.coverUrl || ''} onChange={e => setCurrentBook({...currentBook, coverUrl: e.target.value})} 
                    />
                  </div>
                  <button type="submit" className="w-full py-4 mt-2 bg-lms-blue text-white rounded-2xl text-sm font-black uppercase tracking-[0.2em] shadow-xl shadow-blue-100 hover:scale-[1.02] active:scale-95 transition-all">
                     Process Record
                  </button>
                </form>
              </motion.div>
            )}

            {showCategoryModal && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="bg-white p-7 rounded-[2.5rem] border border-[#14141408] shadow-xl"
              >
                <div className="flex items-center justify-between mb-6">
                   <div>
                    <h3 className="font-serif italic text-2xl text-[#141414]">Class Index</h3>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Global Taxonomy</p>
                  </div>
                  <button onClick={() => setShowCategoryModal(false)} className="w-8 h-8 flex items-center justify-center bg-gray-50 text-gray-400 rounded-full hover:bg-gray-100 transition-all"><X size={16} /></button>
                </div>
                
                <div className="flex gap-2 mb-6">
                  <input 
                    type="text" placeholder="Define new class..."
                    className="flex-1 px-4 py-2.5 bg-[#F8F8F5] border border-[#14141408] rounded-xl text-xs font-bold outline-none"
                    value={newCategory} onChange={e => setNewCategory(e.target.value)}
                  />
                  <button onClick={handleAddCategory} className="w-10 h-10 bg-lms-blue text-white rounded-xl shadow-lg shadow-blue-100 flex items-center justify-center active:scale-90 transition-all leading-none">
                    <Plus size={20} />
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5 max-h-[300px] overflow-y-auto no-scrollbar pr-2">
                  {categories.map(c => (
                    <motion.span 
                      key={`cat-${c.id}`} 
                      layout
                      className="px-3 py-1.5 bg-white text-[#141414aa] text-[9px] font-black uppercase tracking-widest rounded-xl border border-[#14141408] hover:bg-gray-50 transition-all"
                    >
                      {c.categoryName}
                    </motion.span>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {!isEditing && !showCategoryModal && (
             <div className="p-8 rounded-[2.5rem] bg-gradient-to-br from-lms-blue to-blue-800 text-white shadow-2xl relative overflow-hidden">
                <Library className="absolute -bottom-4 -right-4 text-white/10" size={120} />
                <h4 className="font-serif italic text-xl mb-2 relative z-10">Librarian Insight</h4>
                <p className="text-xs leading-relaxed opacity-70 mb-6 relative z-10">Maintain the integrity of the academic archive. Ensure every book is properly indexed and categorical accuracy is preserved.</p>
                <div className="space-y-4 relative z-10">
                   <div className="flex justify-between items-center bg-white/10 p-3 rounded-2xl backdrop-blur-md">
                      <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Global Stock</span>
                      <span className="text-lg font-black">{books.reduce((acc, b) => acc + b.quantity, 0)}</span>
                   </div>
                   <div className="flex justify-between items-center bg-white/10 p-3 rounded-2xl backdrop-blur-md">
                      <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Classifications</span>
                      <span className="text-lg font-black">{categories.length}</span>
                   </div>
                </div>
             </div>
          )}
        </div>
      </div>
    </div>
  );
}
