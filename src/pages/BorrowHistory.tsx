import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../App';
import { 
  Clock, CheckCircle, XCircle, AlertCircle, RefreshCw, ChevronRight, 
  ArrowUpDown, ChevronLeft, Search, Filter, ArrowUp, ArrowDown 
} from 'lucide-react';
import api from '../lib/api';
import { BorrowHistoryItem } from '../types';
import { motion, AnimatePresence } from 'motion/react';

type SortField = 'borrowDate' | 'dueDate' | 'fineAmount' | 'status' | 'bookTitle';
type SortOrder = 'asc' | 'desc';

export default function BorrowHistory() {
  const { user } = useAuth();
  const [history, setHistory] = useState<BorrowHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Sorting State
  const [sortField, setSortField] = useState<SortField>('borrowDate');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await api.get('/borrow/history');
      setHistory(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (action: string, id: number) => {
    try {
      await api.post(`/borrow/${action}/${id}`);
      fetchHistory();
    } catch (err: any) {
      alert(err.response?.data?.error || `Failed to perform action: ${action}`);
      console.error(err);
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

  // Process data (Filter -> Sort -> Paginate)
  const filteredData = useMemo(() => {
    return history.filter(item => 
      item.book.title.toLowerCase().includes(search.toLowerCase()) ||
      item.user?.fullName.toLowerCase().includes(search.toLowerCase()) ||
      item.record.status.toLowerCase().includes(search.toLowerCase())
    );
  }, [history, search]);

  const sortedData = useMemo(() => {
    const data = [...filteredData];
    return data.sort((a, b) => {
      let valA: any, valB: any;
      
      switch(sortField) {
        case 'bookTitle':
          valA = a.book.title;
          valB = b.book.title;
          break;
        case 'borrowDate':
          valA = a.record.borrowDate ? new Date(a.record.borrowDate).getTime() : 0;
          valB = b.record.borrowDate ? new Date(b.record.borrowDate).getTime() : 0;
          break;
        case 'dueDate':
          valA = new Date(a.record.dueDate).getTime();
          valB = new Date(b.record.dueDate).getTime();
          break;
        case 'fineAmount':
          valA = a.record.fineAmount || 0;
          valB = b.record.fineAmount || 0;
          break;
        case 'status':
          valA = a.record.status;
          valB = b.record.status;
          break;
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredData, sortField, sortOrder]);

  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedData.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedData, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(sortedData.length / itemsPerPage);

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'requested': return 'bg-lms-blue/10 text-lms-blue border-lms-blue/20';
      case 'borrowed': return 'bg-lms-orange/10 text-lms-orange border-lms-orange/20';
      case 'returned': return 'bg-lms-green/10 text-lms-green border-lms-green/20';
      case 'return_requested': return 'bg-lms-magenta/10 text-lms-magenta border-lms-magenta/20';
      case 'overdue': return 'bg-red-50 text-red-600 border-red-100';
      default: return 'bg-gray-50 text-gray-500 border-gray-200';
    }
  };

  const SortIndicator = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown size={12} className="opacity-0 group-hover:opacity-40 ml-1 transition-opacity" />;
    return sortOrder === 'asc' ? <ArrowUp size={12} className="ml-1 text-lms-blue" /> : <ArrowDown size={12} className="ml-1 text-lms-blue" />;
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-serif italic mb-2">Borrowing Log</h1>
          <p className="text-gray-500 text-sm">Full lifecycle tracking of library assets and circulation.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-lms-blue transition-colors" size={18} />
            <input 
              type="text" 
              placeholder="Search history..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
              className="input-modern pl-10 w-64 shadow-sm"
            />
          </div>
          <button 
            onClick={fetchHistory}
            className="w-11 h-11 flex items-center justify-center bg-white border border-[#14141408] rounded-2xl text-gray-500 hover:text-lms-blue transition-all shadow-sm active:scale-95"
          >
            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="card-modern overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-100/50 bg-gray-50/50">
                <th 
                  className="px-6 py-5 cursor-pointer group hover:bg-gray-100/50 transition-colors"
                  onClick={() => toggleSort('bookTitle')}
                >
                  <div className="flex items-center text-[10px] uppercase font-bold tracking-widest text-gray-400">
                    Transaction <SortIndicator field="bookTitle" />
                  </div>
                </th>
                {user?.role !== 'student' && <th className="px-6 py-5 text-[10px] uppercase font-bold tracking-widest text-gray-400">Student</th>}
                <th 
                  className="px-6 py-5 cursor-pointer group hover:bg-gray-100/50 transition-colors"
                  onClick={() => toggleSort('borrowDate')}
                >
                  <div className="flex items-center text-[10px] uppercase font-bold tracking-widest text-gray-400">
                    Dates <SortIndicator field="borrowDate" />
                  </div>
                </th>
                <th 
                  className="px-6 py-5 cursor-pointer group hover:bg-gray-100/50 transition-colors"
                  onClick={() => toggleSort('fineAmount')}
                >
                  <div className="flex items-center text-[10px] uppercase font-bold tracking-widest text-gray-400">
                    Fine <SortIndicator field="fineAmount" />
                  </div>
                </th>
                <th 
                  className="px-6 py-5 cursor-pointer group hover:bg-gray-100/50 transition-colors"
                  onClick={() => toggleSort('status')}
                >
                  <div className="flex items-center text-[10px] uppercase font-bold tracking-widest text-gray-400">
                    Status <SortIndicator field="status" />
                  </div>
                </th>
                <th className="px-6 py-5 text-right text-[10px] uppercase font-bold tracking-widest text-gray-400 italic">Control</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              <AnimatePresence mode="popLayout">
                {paginatedData.map(({ record, book, user: member }) => (
                  <motion.tr 
                    key={`record-${record.id}`} 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    layout
                    className="group hover:bg-gray-50/80 transition-all duration-200"
                  >
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-4">
                        <div className="w-9 h-12 bg-white border border-[#14141408] rounded-lg flex items-center justify-center text-lms-blue/30 group-hover:text-lms-blue group-hover:scale-105 transition-all shadow-sm">
                           <ChevronRight size={18} />
                        </div>
                        <div>
                          <p className="font-bold text-sm text-[#141414]">{book.title}</p>
                          <p className="text-[10px] uppercase tracking-tighter text-gray-400 flex items-center gap-1.5 mt-0.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-lms-blue/30"></span>
                            ID: LIB-{record.id.toString().padStart(5, '0')}
                          </p>
                        </div>
                      </div>
                    </td>
                    {user?.role !== 'student' && (
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-2">
                           <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-400 uppercase">
                             {member?.fullName.charAt(0)}
                           </div>
                           <div>
                            <p className="text-sm font-medium">{member?.fullName}</p>
                            <p className="text-[11px] text-gray-400">{member?.email}</p>
                           </div>
                        </div>
                      </td>
                    )}
                    <td className="px-6 py-5">
                      <div className="text-xs space-y-1.5 text-gray-600">
                        <div className="flex items-center gap-2">
                          <span className="w-12 text-[10px] uppercase tracking-tighter opacity-40">Due</span>
                          <span className="font-medium text-[#141414]">{new Date(record.dueDate).toLocaleDateString()}</span>
                        </div>
                        {record.borrowDate && (
                          <div className="flex items-center gap-2">
                            <span className="w-12 text-[10px] uppercase tracking-tighter opacity-40">Took</span>
                            <span>{new Date(record.borrowDate).toLocaleDateString()}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-5 text-center">
                      {record.fineAmount && record.fineAmount > 0 ? (
                        <div className="inline-flex flex-col items-center">
                          <span className="text-sm font-bold text-red-600">${record.fineAmount.toFixed(2)}</span>
                          <span className="text-[8px] uppercase tracking-widest text-red-400 font-bold animate-pulse">Unpaid Fine</span>
                        </div>
                      ) : (
                        <div className="w-1.5 h-1.5 rounded-full bg-gray-100 mx-auto" />
                      )}
                    </td>
                    <td className="px-6 py-5">
                      <span className={`inline-block px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border shadow-sm ${getStatusStyle(record.status)}`}>
                        {record.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        {user?.role !== 'student' && record.status === 'requested' && (
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => handleAction('approve', record.id)}
                              className="h-8 px-3 bg-lms-blue text-white text-[10px] font-bold uppercase rounded-lg hover:bg-blue-700 shadow-sm transform active:scale-95 transition-all"
                            >
                              Pass
                            </button>
                            <button 
                              onClick={() => handleAction('reject', record.id)}
                              className="h-8 px-3 bg-red-50 text-red-600 text-[10px] font-bold uppercase rounded-lg hover:bg-red-100 shadow-sm transform active:scale-95 transition-all"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                        {user?.role !== 'student' && record.status === 'return_requested' && (
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => handleAction('return-approve', record.id)}
                              className="h-8 px-3 bg-lms-blue text-white text-[10px] font-bold uppercase rounded-lg hover:bg-blue-700 shadow-sm transform active:scale-95 transition-all"
                            >
                              Accept
                            </button>
                            <button 
                              onClick={() => handleAction('reject', record.id)}
                              className="h-8 px-3 bg-red-50 text-red-600 text-[10px] font-bold uppercase rounded-lg hover:bg-red-100 shadow-sm transform active:scale-95 transition-all"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                        {user?.role !== 'student' && record.fineAmount && record.fineAmount > 0 && (
                          <button 
                            onClick={() => handleAction('pay-fine', record.id)}
                            className="h-8 px-3 bg-red-600 text-white text-[10px] font-bold uppercase rounded-lg hover:bg-red-700 shadow-sm transform active:scale-95 transition-all"
                          >
                            Pay
                          </button>
                        )}
                        {user?.role === 'student' && (record.status === 'borrowed' || record.status === 'overdue') && (
                          <button 
                            onClick={() => handleAction('return-request', record.id)}
                            className="h-8 px-3 bg-[#141414] text-white text-[10px] font-bold uppercase rounded-lg shadow-sm transform active:scale-95 transition-all"
                          >
                            Drop
                          </button>
                        )}
                        {record.status === 'returned' && (
                          <div className="w-8 h-8 rounded-full bg-green-50 text-green-500 flex items-center justify-center border border-green-100">
                            <CheckCircle size={16} />
                          </div>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="px-6 py-4 border-t border-gray-50 bg-gray-50/50 flex items-center justify-between">
          <div className="text-xs text-gray-500 flex items-center gap-2">
             <span>Showing {Math.min(sortedData.length, (currentPage - 1) * itemsPerPage + 1)}-{Math.min(sortedData.length, currentPage * itemsPerPage)} of {sortedData.length} records</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button 
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              className="p-2 bg-white border border-[#14141408] rounded-xl text-gray-500 hover:text-lms-blue disabled:opacity-30 transition-all shadow-sm"
            >
              <ChevronLeft size={16} />
            </button>
            
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
              <button
                key={`page-${page}`}
                onClick={() => setCurrentPage(page)}
                className={`w-8 h-8 rounded-xl text-[10px] font-bold transition-all shadow-sm border ${
                  currentPage === page 
                    ? 'bg-lms-blue text-white border-lms-blue' 
                    : 'bg-white text-gray-400 border-[#14141408] hover:bg-gray-50'
                }`}
              >
                {page}
              </button>
            )).slice(Math.max(0, currentPage - 3), Math.min(totalPages, currentPage + 2))}

            <button 
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              className="p-2 bg-white border border-[#14141408] rounded-xl text-gray-500 hover:text-lms-blue disabled:opacity-30 transition-all shadow-sm"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {sortedData.length === 0 && !loading && (
          <div className="py-24 flex flex-col items-center justify-center text-center opacity-50">
             <AlertCircle size={48} className="mb-4 text-lms-blue/20" />
             <p className="text-lg font-serif italic text-gray-400">No transactions found matching your criteria</p>
             <button onClick={() => { setSearch(''); setCurrentPage(1); }} className="mt-4 text-xs font-bold text-lms-blue uppercase tracking-widest hover:underline">Clear Search</button>
          </div>
        )}
      </div>
    </div>
  );
}
