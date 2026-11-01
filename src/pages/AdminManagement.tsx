/**
 * SYSTEM ADMINISTRATION PAGE (admin only)
 * ----------------------------------------------------------------------------
 * Three tabs:
 *   1. Membership:    list, search, add ("Enroll"), edit and delete members of any role.
 *                     New accounts go to POST /api/admin/users (admin-only), the only
 *                     way to create librarian or admin accounts.
 *   2. Database Dump: downloads a full MySQL backup (.sql) and explains how to restore it.
 *   3. Settings:      library rules (loan days, fine rate, loan limit); see components/LibrarySettings.tsx.
 */
import React, { useState, useEffect } from 'react';
import { Users, Search, UserMinus, Edit3, Plus, X, User as UserIcon, Database, Download, Settings } from 'lucide-react';
import api from '../lib/api';
import { User as UserType } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import LibrarySettings from '../components/LibrarySettings';

export default function AdminManagement() {
  const [users, setUsers] = useState<UserType[]>([]);
  const [activeTab, setActiveTab] = useState<'users' | 'database' | 'settings'>('users');
  const [downloading, setDownloading] = useState(false);
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [newUser, setNewUser] = useState({
    fullName: '', email: '', password: '', role: 'student',
    studentCode: '', department: '', year: 1, employeeCode: '', phone: ''
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  /** Loads the member list from the server. */
  const fetchUsers = async () => {
    const res = await api.get('/admin/users');
    setUsers(res.data);
  };

  const filteredUsers = users.filter(u => 
    u.fullName.toLowerCase().includes(search.toLowerCase()) || 
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    u.role.toLowerCase().includes(search.toLowerCase())
  );

  /** Saves the Enroll/Edit form: updates an existing member, or creates a new one. */
  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingUserId) {
        await api.put(`/admin/users/${editingUserId}`, newUser);
      } else {
        // Admin-only route: allows any role (public sign-up can only create students)
        await api.post('/admin/users', newUser);
      }
      setShowAddModal(false);
      setEditingUserId(null);
      setNewUser({
        fullName: '', email: '', password: '', role: 'student',
        studentCode: '', department: '', year: 1, employeeCode: '', phone: ''
      });
      fetchUsers();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Operation failed');
    } finally {
      setLoading(false);
    }
  };

  const renderMembership = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-4 bg-white px-6 py-4 rounded-[2rem] border border-[#14141408] shadow-sm group focus-within:ring-2 focus-within:ring-[#5A5A401a] transition-all">
        <Search className="text-gray-300 group-focus-within:text-[#5A5A40]" size={20} />
        <input 
          type="text" 
          placeholder="Query members by profile data..."
          className="flex-1 bg-transparent outline-none text-sm font-medium"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence mode="popLayout">
          {filteredUsers.map((u) => (
            <motion.div 
              key={`user-${u.id}-${u.email}`}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="card-modern p-6 flex flex-col justify-between group h-full hover:border-[#5A5A4040] transition-colors"
            >
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-[#F8F8F5] border border-[#14141408] rounded-2xl flex items-center justify-center text-gray-300 group-hover:text-[#5A5A40] group-hover:bg-white transition-all">
                    <UserIcon size={24} />
                  </div>
                  <div>
                    <h4 className="font-black text-[#141414] leading-tight">{u.fullName}</h4>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">{u.email}</p>
                  </div>
                </div>
                <span className={`text-[9px] uppercase font-black tracking-[0.2em] px-2.5 py-1 rounded-full border ${
                  u.role === 'admin' ? 'bg-[#141414] text-white border-black shadow-lg shadow-black/10' : u.role === 'librarian' ? 'bg-[#5A5A40] text-white border-[#5A5A40] shadow-lg shadow-[#5A5A4033]' : 'bg-white text-gray-400 border-gray-100'
                }`}>
                  {u.role}
                </span>
              </div>
              <div className="pt-5 border-t border-gray-50 flex items-center justify-between gap-4">
                 <div className="text-[9px] text-gray-300 font-black uppercase tracking-[0.2em]">
                    Enrolled: {new Date(u.createdAt!).toLocaleDateString()}
                 </div>
                 <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all">
                    <button 
                      onClick={() => {
                        setEditingUserId(u.id);
                        setNewUser({
                          fullName: u.fullName || '',
                          email: u.email || '',
                          password: '',
                          role: u.role || 'student',
                          studentCode: u.studentCode || '',
                          department: u.department || '',
                          year: u.year || 1,
                          employeeCode: u.employeeCode || '',
                          phone: u.phone || ''
                        });
                        setShowAddModal(true);
                      }}
                      className="w-9 h-9 flex items-center justify-center bg-white text-gray-300 hover:text-blue-500 border border-gray-100 rounded-xl shadow-sm transition-all" 
                      title="Edit Profile"
                    >
                      <Edit3 size={16} />
                    </button>
                    <button 
                      onClick={async () => {
                        if (confirm('Are you sure you want to delete this user? Electronic records will be purged.')) {
                          try {
                            await api.delete(`/admin/users/${u.id}`);
                            fetchUsers();
                          } catch (err: any) {
                            alert(err.response?.data?.error || 'Purge failed');
                          }
                        }
                      }}
                      className="w-9 h-9 flex items-center justify-center bg-white text-gray-300 hover:text-red-500 border border-gray-100 rounded-xl shadow-sm transition-all" 
                      title="Purge User"
                    >
                      <UserMinus size={16} />
                    </button>
                 </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );

  /**
   * Downloads the MySQL backup file.
   * The request goes through our `api` helper so the login token is attached.
   * (Bug fix: the old version used window.location, which sends no token → 401 error.)
   * The file arrives as a "blob" (raw file data); we then make a temporary link and click it.
   */
  const handleDownloadBackup = async () => {
    setDownloading(true);
    try {
      const res = await api.get('/admin/database-dump', { responseType: 'blob' });
      const fileName = `library_backup_${new Date().toISOString().slice(0, 10)}.sql`;
      const url = URL.createObjectURL(res.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert('Failed to retrieve server dump');
    } finally {
      setDownloading(false);
    }
  };

  const renderDatabaseBackup = () => (
    <div className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-fade-in">
        {/* Left column: Quick Actions */}
        <div className="lg:col-span-5 space-y-6">
          <div className="card-modern p-8 bg-white border border-[#14141408] rounded-[2.5rem] shadow-sm space-y-6">
            <div className="w-16 h-16 bg-[#5A5A4010] border border-[#5A5A4020] rounded-2xl flex items-center justify-center text-[#5A5A40]">
              <Database size={32} />
            </div>
            <div>
              <h3 className="text-2xl font-serif italic text-[#141414] leading-tight">MySQL Relational SQL Export</h3>
              <p className="text-gray-400 text-[10px] font-bold uppercase tracking-wider mt-1">Ready-to-restore script for MySQL / phpMyAdmin</p>
            </div>

            <p className="text-[#141414bc] text-xs font-semibold leading-relaxed">
              This system exports every MySQL table—including profiles, book listings, categorizations, and borrow chronicles—into a single SQL script that rebuilds the complete database.
            </p>

            <button
              type="button"
              onClick={handleDownloadBackup}
              disabled={downloading}
              className="w-full flex items-center justify-center gap-2.5 py-4 bg-[#141414] hover:bg-[#5A5A40] text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:scale-[1.01] active:scale-95 transition-all shadow-xl shadow-[#14141410] disabled:opacity-50 cursor-pointer"
            >
              <Download size={14} />
              {downloading ? 'Compiling Dump...' : 'Download library_backup.sql'}
            </button>
          </div>

          <div className="card-modern p-6 bg-[#F8F8F5] border border-[#14141408] rounded-[2rem] space-y-4">
            <div className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse" />
              <div className="text-[9px] text-gray-500 font-black uppercase tracking-widest">MySQL Database Engine Online</div>
            </div>
            <p className="text-[11px] text-[#1414148a] font-black leading-relaxed">
              The backup is generated live from the <code className="bg-white px-1.5 py-0.5 border border-black/5 rounded font-mono text-[9px] text-green-700">library_db</code> MySQL database, so it always includes the latest members, catalog changes and transactions.
            </p>
          </div>
        </div>

        {/* Right column: how to restore the backup in phpMyAdmin or the MySQL command line */}
        <div className="lg:col-span-7 card-modern p-10 bg-white border border-[#14141408] rounded-[2.5rem] shadow-sm space-y-8">
          <div>
            <div className="text-[9px] text-[#5A5A40] font-black uppercase tracking-[0.2em] mb-1">Restoration Workflow</div>
            <h3 className="text-2xl font-serif italic text-[#141414]">Restoring a Backup into MySQL</h3>
          </div>

          <div className="space-y-6">
            <div className="flex gap-4">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-50 text-[10px] font-black font-mono border border-gray-100 text-[#5A5A40] shrink-0">1</span>
              <div>
                <h4 className="text-xs font-black text-[#141414] uppercase tracking-wide">Acquire Backup File</h4>
                <p className="text-xs text-gray-400 font-medium leading-relaxed mt-0.5">Click the dark download button on the left to extract the precompiled script <code className="bg-[#F8F8F5] px-1 py-0.5 rounded text-[10px] font-mono text-[#5A5A40]">library_backup.sql</code>.</p>
              </div>
            </div>

            <div className="flex gap-4">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-50 text-[10px] font-black font-mono border border-gray-100 text-[#5A5A40] shrink-0">2</span>
              <div>
                <h4 className="text-xs font-black text-[#141414] uppercase tracking-wide font-medium">Option A: phpMyAdmin (XAMPP)</h4>
                <p className="text-xs text-gray-400 font-medium leading-relaxed mt-0.5">Open phpMyAdmin, select the database, then use the Import tab:</p>
                <pre className="p-3 bg-[#F8F8F5] border border-gray-100 rounded-xl text-[10px] font-mono text-gray-600 mt-2">
                  http://localhost/phpmyadmin → library_db → Import → Choose file → Import
                </pre>
              </div>
            </div>

            <div className="flex gap-4">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-50 text-[10px] font-black font-mono border border-gray-100 text-[#5A5A40] shrink-0">3</span>
              <div>
                <h4 className="text-xs font-black text-[#141414] uppercase tracking-wide font-medium">Option B: MySQL Command Line</h4>
                <p className="text-xs text-gray-400 font-medium leading-relaxed mt-0.5 font-medium leading-relaxed">Run the script against any MySQL server, local or cloud (e.g. Aiven):</p>
                <pre className="p-3 bg-[#F8F8F5] border border-gray-100 rounded-xl text-[9px] font-mono text-gray-600 mt-2 leading-relaxed">
                  # Tables are dropped and recreated, then all rows are re-inserted<br />
                  mysql -u root -p library_db &lt; library_backup.sql
                </pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );



  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-serif italic text-[#141414]">System Administration</h1>
          <p className="text-gray-500 font-medium tracking-tight">Monitor system activity and manage cross-module operational parameters.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex bg-white p-1.5 rounded-2xl border border-[#14141408] shadow-sm overflow-x-auto no-scrollbar max-w-full">
            <TabButton active={activeTab === 'users'} onClick={() => setActiveTab('users')} icon={<Users size={14} />} label="Membership" />
            <TabButton active={activeTab === 'database'} onClick={() => setActiveTab('database')} icon={<Database size={14} />} label="Database Dump" />
            <TabButton active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon={<Settings size={14} />} label="Settings" />
          </div>
          {activeTab === 'users' && (
            <button 
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-5 py-3 bg-[#141414] text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-[#5A5A40] transition-all shadow-xl shadow-[#1414141a] active:scale-95"
            >
              <Plus size={16} /> Enroll
            </button>
          )}
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
           key={`tab-${activeTab}`}
           initial={{ opacity: 0, y: 10 }}
           animate={{ opacity: 1, y: 0 }}
           exit={{ opacity: 0, y: -10 }}
        >
          {activeTab === 'users' && renderMembership()}
          {activeTab === 'database' && renderDatabaseBackup()}
          {activeTab === 'settings' && <LibrarySettings />}
        </motion.div>
      </AnimatePresence>

      {/* Enrolment Modal Code (Existing remains similar) */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => { setShowAddModal(false); setEditingUserId(null); }} className="absolute inset-0 bg-[#14141440] backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="bg-white w-full max-w-xl rounded-[2.5rem] shadow-2xl relative overflow-hidden">
               <div className="p-12">
                  <div className="flex items-center justify-between mb-8">
                    <h2 className="text-3xl font-serif italic text-[#141414]">{editingUserId ? 'Edit Membership' : 'Member Enrollment'}</h2>
                    <button onClick={() => { setShowAddModal(false); setEditingUserId(null); }} className="w-10 h-10 flex items-center justify-center bg-gray-50 text-gray-400 rounded-full hover:bg-gray-100 transition-all"><X size={20} /></button>
                  </div>
                  <form onSubmit={handleAddUser} className="space-y-5">
                    {/* Simplified Form for space, keeping logic */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase tracking-widest text-[#5A5A40] ml-2">Full Name</label>
                          <input type="text" required className="input-modern" value={newUser.fullName} onChange={e => setNewUser({...newUser, fullName: e.target.value})} />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase tracking-widest text-[#5A5A40] ml-2">Email</label>
                          <input type="email" required className="input-modern" value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase tracking-widest text-[#5A5A40] ml-2">Password</label>
                          <input type="password" required={!editingUserId} className="input-modern" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase tracking-widest text-[#5A5A40] ml-2">Role</label>
                          <select className="select-modern" value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})}>
                            <option value="student">Student</option>
                            <option value="librarian">Librarian</option>
                            <option value="admin">Admin</option>
                          </select>
                        </div>
                    </div>
                    <button type="submit" disabled={loading} className="w-full py-4 mt-6 bg-[#5A5A40] text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-[#5A5A4033] hover:scale-[1.02] active:scale-95 transition-all">
                      {loading ? 'Processing...' : 'Finalize Record'}
                    </button>
                  </form>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TabButton({ active, onClick, icon, label }: any) {
  return (
    <button 
      onClick={onClick}
      className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 shrink-0 ${active ? 'bg-[#5A5A40] text-white shadow-lg shadow-[#5A5A4033]' : 'text-gray-400 hover:bg-gray-50'}`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
