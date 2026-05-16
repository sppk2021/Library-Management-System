import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, AreaChart, Area } from 'recharts';
import { TrendingUp, Users, Book, Clock, AlertTriangle, RefreshCw, FileDown, Trophy, Activity, Hash, Layers, AlertCircle } from 'lucide-react';
import api from '../lib/api';

const COLORS = ['#0066FF', '#3B82F6', '#141414', '#D1D1D1', '#FF6321'];

export default function AnalyticsWorkspace() {
  const [data, setData] = useState<any>(null);
  const [detailed, setDetailed] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const [resStats, resDetailed] = await Promise.all([
        api.get('/dashboard/stats'),
        api.get('/reports/detailed')
      ]);
      setData(resStats.data);
      setDetailed(resDetailed.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusData = () => {
    if (!data?.statusStats) return [];
    return data.statusStats.map((s: any) => ({
      name: s.status.replace(/_/g, ' ').toUpperCase(),
      value: s.count
    }));
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center p-24 space-y-4">
      <RefreshCw className="animate-spin text-lms-blue" size={32} />
      <p className="text-xs font-black uppercase tracking-widest text-gray-400">Compiling Analytics Data...</p>
    </div>
  );

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
         <div>
            <h3 className="text-3xl font-serif italic text-gray-900">System Intelligence</h3>
            <p className="text-[10px] text-lms-blue font-bold uppercase tracking-widest mt-1">Holistic circulation analysis & catalog performance</p>
         </div>
         <div className="flex items-center gap-3">
            <button 
              onClick={() => window.print()}
              className="flex items-center gap-2 px-6 py-3 bg-white border border-gray-100 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-50 transition-all shadow-sm"
            >
               <FileDown size={14} className="text-lms-blue" /> Export report
            </button>
            <button 
              onClick={fetchStats}
              className="w-11 h-11 flex items-center justify-center bg-lms-blue text-white rounded-2xl shadow-lg shadow-blue-200 active:scale-95 transition-all"
            >
               <RefreshCw size={18} />
            </button>
         </div>
      </div>

      {/* Hero Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatItem 
          label="Total Circulation" 
          value={data?.summary.totalBooks || 0} 
          sub="+12% this month" 
          icon={Book}
          color="blue"
        />
        <StatItem 
          label="Active Borrows" 
          value={data?.summary.activeBorrows || 0} 
          sub="Current active loans" 
          icon={Activity}
          color="indigo"
        />
        <StatItem 
          label="Catalog Requests" 
          value={data?.summary.pendingRequests || 0} 
          sub="Awaiting approval" 
          icon={Hash}
          color="blue"
        />
        <StatItem 
          label="Overdue Risk" 
          value={data?.summary.overdueCount || 0} 
          sub="Requires attention" 
          icon={AlertTriangle}
          color="red"
          isCritical={Number(data?.summary.overdueCount) > 0}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Trend Chart */}
        <div className="lg:col-span-2 card-modern p-8 bg-white min-h-[450px] flex flex-col">
           <div className="flex items-center justify-between mb-8">
              <div>
                <h4 className="text-xs font-black uppercase tracking-widest text-gray-400">Borrowing Trends</h4>
                <p className="text-[10px] font-bold text-lms-blue mt-0.5">Circulation volume over time</p>
              </div>
              <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-lms-blue">
                <TrendingUp size={20} />
              </div>
           </div>
           <div className="flex-1 w-full min-h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={detailed?.monthlyTrends || []}>
                  <defs>
                    <linearGradient id="colorBorrow" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0066FF" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#0066FF" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="month" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94a3b8', fontFamily: 'JetBrains Mono' }} 
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94a3b8', fontFamily: 'JetBrains Mono' }} 
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontFamily: 'JetBrains Mono', fontSize: '10px' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="borrow_count" 
                    stroke="#0066FF" 
                    strokeWidth={3} 
                    fillOpacity={1} 
                    fill="url(#colorBorrow)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
           </div>
        </div>

        {/* Category Breakdown */}
        <div className="card-modern p-8 bg-white min-h-[450px] flex flex-col">
           <div className="flex items-center justify-between mb-8">
              <div>
                <h4 className="text-xs font-black uppercase tracking-widest text-gray-400">Category Power</h4>
                <p className="text-[10px] font-bold text-lms-blue mt-0.5">Distribution by genre</p>
              </div>
              <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-lms-blue">
                <Layers size={20} />
              </div>
           </div>
           <div className="flex-1 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={detailed?.categoryDistribution?.slice(0, 5) || []}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {(detailed?.categoryDistribution?.slice(0, 5) || []).map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
           </div>
           <div className="grid grid-cols-2 gap-3 mt-6">
              {(detailed?.categoryDistribution?.slice(0, 4) || []).map((s: any, i: number) => (
                <div key={`catdist-${s.name}`} className="flex items-center gap-2 p-2 bg-gray-50 rounded-xl">
                   <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                   <span className="text-[9px] font-bold uppercase tracking-tight text-gray-500 truncate">{s.name}</span>
                   <span className="ml-auto font-mono text-[9px] font-black text-gray-900">{s.value}</span>
                </div>
              ))}
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Top Borrowed Books */}
        <div className="card-modern p-8 bg-white">
          <div className="flex items-center justify-between mb-8">
             <div>
               <h4 className="text-xs font-black uppercase tracking-widest text-gray-400">Premier Titles</h4>
               <p className="text-[10px] font-bold text-lms-blue mt-0.5">Most borrowed academic resources</p>
             </div>
             <Trophy className="text-yellow-500" size={20} />
          </div>
          <div className="space-y-6">
            {detailed?.topBooks.map((book: any, idx: number) => (
              <div key={`topbook-${idx}`} className="group">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs font-black text-lms-blue opacity-30">#0{idx+1}</span>
                    <span className="text-sm font-bold text-gray-900 truncate max-w-[250px]">{book.title}</span>
                  </div>
                  <span className="font-mono text-xs font-black text-gray-900">{book.borrow_count} Loans</span>
                </div>
                <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-lms-blue rounded-full transition-all duration-1000" 
                    style={{ width: `${(book.borrow_count / detailed.topBooks[0].borrow_count) * 100}%` }} 
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Borrowing Students */}
        <div className="card-modern p-8 bg-white">
          <div className="flex items-center justify-between mb-8">
             <div>
               <h4 className="text-xs font-black uppercase tracking-widest text-gray-400">Elite Readers</h4>
               <p className="text-[10px] font-bold text-lms-blue mt-0.5">Students with highest participation</p>
             </div>
             <Users className="text-indigo-500" size={20} />
          </div>
          <div className="space-y-3">
            {detailed?.topBorrowers.map((borrower: any, idx: number) => (
              <div key={`topborrower-${idx}`} className="flex items-center gap-4 p-4 rounded-2xl bg-gray-50 hover:bg-lms-blue/5 transition-colors border border-transparent hover:border-lms-blue/10">
                <div className="w-10 h-10 rounded-xl bg-white border border-gray-100 flex items-center justify-center text-lms-blue font-mono font-black text-xs shadow-sm">
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <h5 className="font-bold text-sm text-gray-900 truncate">{borrower.full_name}</h5>
                  <p className="text-[10px] text-gray-400 truncate">{borrower.email}</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-sm font-black text-lms-blue">{borrower.borrow_count}</p>
                  <p className="text-[8px] font-black uppercase tracking-widest text-gray-400">Total Borrows</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Overdue Reports */}
        <div className="card-modern p-8 bg-white border-red-50 relative overflow-hidden group">
           <div className="absolute top-0 right-0 w-32 h-32 bg-red-50 rounded-full blur-3xl -translate-y-16 translate-x-16 group-hover:scale-150 transition-transform duration-700 pointer-events-none" />
           <div className="flex items-center justify-between mb-8 relative z-10">
             <div>
               <h4 className="text-xs font-black uppercase tracking-widest text-red-500">Overdue Risk Reports</h4>
               <p className="text-[10px] font-bold text-gray-500 mt-0.5">Focus areas requiring immediate recovery</p>
             </div>
             <AlertCircle className="text-red-500" size={20} />
           </div>
           
           <div className="space-y-4 relative z-10">
             {detailed?.overdueHotspots?.length > 0 ? detailed.overdueHotspots.map((hotspot: any, idx: number) => (
                <div key={`hotspot-${idx}`} className="flex flex-col gap-1 p-4 rounded-2xl bg-red-50/20 border border-red-100/50 hover:border-red-200 transition-colors">
                  <div className="flex items-center justify-between">
                     <span className="font-bold text-sm text-gray-900 truncate">{hotspot.full_name}</span>
                     <span className="text-sm font-black text-red-600 font-mono">${hotspot.total_fines.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-red-400">
                     <span>{hotspot.overdue_count} {hotspot.overdue_count === 1 ? 'item' : 'items'} unresolved</span>
                  </div>
                </div>
             )) : (
                <div className="p-4 rounded-2xl bg-gray-50 border border-dashed border-gray-200 text-center">
                  <span className="text-gray-400 text-[10px] font-bold uppercase tracking-widest">No critical areas</span>
                </div>
             )}
           </div>
        </div>
      </div>

      {/* Audit Log / Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
        <div className="card-modern p-8 bg-white">
           <div className="flex items-center justify-between mb-8">
              <div>
                 <h4 className="text-xs font-black uppercase tracking-widest text-gray-400">Auditable Circulation Log</h4>
                 <p className="text-[10px] font-bold text-lms-blue mt-0.5">Chronological record of system transactions</p>
              </div>
              <Activity className="text-lms-blue" size={20} />
           </div>
           <div className="overflow-x-auto no-scrollbar">
              <table className="w-full text-left">
                 <thead>
                    <tr className="border-b border-gray-50">
                       <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Timestamp</th>
                       <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Resource</th>
                       <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-gray-400 text-right">Outcome</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-gray-50">
                    {detailed?.recentActivity.map((act: any) => (
                      <tr key={`act-${act.id}`} className="group hover:bg-gray-50/50 transition-colors">
                        <td className="py-4 font-mono text-[10px] text-gray-400">
                          {act.date ? new Date(act.date).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '---'}
                        </td>
                        <td className="py-4">
                          <span className="text-xs text-gray-500 italic line-clamp-1 font-sans">{act.book}</span>
                        </td>
                        <td className="py-4 text-right">
                          <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest font-mono ${
                            act.status === 'borrowed' ? 'bg-blue-50 text-lms-blue' :
                            act.status === 'returned' ? 'bg-green-50 text-green-600' :
                            act.status === 'overdue' ? 'bg-red-50 text-red-600' :
                            'bg-gray-100 text-gray-500'
                          }`}>
                            {act.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                 </tbody>
              </table>
           </div>
        </div>

        {/* Inventory Alerts (Low Stock / Out of Stock) */}
        <div className="card-modern p-8 bg-white">
           <div className="flex items-center justify-between mb-8">
              <div>
                 <h4 className="text-xs font-black uppercase tracking-widest text-gray-400">Inventory Alerts</h4>
                 <p className="text-[10px] font-bold text-red-500 mt-0.5">Low stock and out-of-stock resources</p>
              </div>
              <AlertTriangle className="text-red-500" size={20} />
           </div>
           <div className="overflow-x-auto no-scrollbar">
              <table className="w-full text-left">
                 <thead>
                    <tr className="border-b border-gray-50">
                       <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Resource Title</th>
                       <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Last Borrowed</th>
                       <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-gray-400 text-right">Status</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-gray-50">
                    {detailed?.stockStatus?.map((stock: any) => (
                      <tr key={`stock-${stock.book_id}`} className="group hover:bg-gray-50/50 transition-colors">
                        <td className="py-4">
                          <span className="text-xs font-bold text-gray-900 line-clamp-1 font-sans max-w-[200px]">{stock.title}</span>
                          <span className="text-[9px] text-gray-400 italic">Total: {stock.quantity}</span>
                        </td>
                        <td className="py-4 font-mono text-[10px] text-gray-400">
                          {stock.last_borrowed ? new Date(stock.last_borrowed).toLocaleDateString() : 'Never'}
                        </td>
                        <td className="py-4 text-right">
                          <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest font-mono ${
                            stock.available_quantity === 0 ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'
                          }`}>
                            {stock.available_quantity === 0 ? 'Out of Stock' : `Low Stock: ${stock.available_quantity}`}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {(!detailed?.stockStatus || detailed.stockStatus.length === 0) && (
                      <tr>
                        <td colSpan={3} className="py-8 text-center text-xs text-gray-400 font-medium italic">
                          No inventory alerts at this time.
                        </td>
                      </tr>
                    )}
                 </tbody>
              </table>
           </div>
        </div>
      </div>
    </div>
  );
}

function StatItem({ label, value, sub, icon: Icon, color, isCritical }: any) {
  const colorMap: any = {
    blue: 'bg-blue-50 text-lms-blue border-blue-100',
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    red: 'bg-red-50 text-red-600 border-red-100',
  };

  return (
    <div className={`card-modern p-6 border transition-all ${isCritical ? 'ring-2 ring-red-500 ring-offset-2 animate-pulse' : 'hover:scale-[1.02] active:scale-95'}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">{label}</p>
          <h4 className="text-3xl font-mono font-black text-gray-900">{value}</h4>
          <p className={`text-[10px] font-bold mt-2 ${isCritical ? 'text-red-500' : 'text-gray-400'}`}>{sub}</p>
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colorMap[color]}`}>
          <Icon size={20} />
        </div>
      </div>
    </div>
  );
}

