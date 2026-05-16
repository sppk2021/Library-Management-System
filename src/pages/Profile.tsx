import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { User, Mail, Phone, Code, Building, GraduationCap, Save, CheckCircle } from 'lucide-react';
import api from '../lib/api';
import { motion, AnimatePresence } from 'motion/react';

export default function Profile() {
  const { user: authUser, login } = useAuth();
  const [formData, setFormData] = useState<any>({
    fullName: '',
    phone: '',
    studentCode: '',
    department: '',
    year: 1,
    employeeCode: ''
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (authUser) {
      setFormData({
        fullName: authUser.fullName || '',
        phone: authUser.phone || '',
        studentCode: authUser.studentCode || '',
        department: authUser.department || '',
        year: authUser.year || 1,
        employeeCode: authUser.employeeCode || ''
      });
    }
  }, [authUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.put('/auth/profile', formData);
      // Refresh user context
      const userRes = await api.get('/auth/me');
      const token = localStorage.getItem('library_token');
      if (token) login(token, userRes.data);
      
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error(err);
      alert('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  if (!authUser) return null;

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-serif italic text-[#141414]">Member Profile</h1>
          <p className="text-gray-500 font-medium">Manage your personal credentials and academic information.</p>
        </div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card-modern p-10 relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#5A5A400a] rounded-full -translate-y-16 translate-x-16" />
        
        <div className="flex items-center gap-6 mb-10">
          <div className="w-20 h-20 bg-[#F8F8F5] border border-[#14141408] rounded-[2rem] flex items-center justify-center text-[#5A5A40]">
            <User size={40} />
          </div>
          <div>
            <h2 className="text-2xl font-bold">{authUser.fullName}</h2>
            <p className="text-sm text-gray-400 capitalize">{authUser.role} &bull; Library Member</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-[#5A5A40] ml-2">Full Name</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                <input 
                  type="text"
                  required
                  className="w-full pl-12 pr-5 py-3.5 bg-[#F8F8F5] border border-[#14141408] rounded-2xl text-sm outline-none focus:ring-2 focus:ring-[#5A5A401a]"
                  value={formData.fullName}
                  onChange={e => setFormData({...formData, fullName: e.target.value})}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-[#5A5A40] ml-2">Email (Static)</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-200" size={18} />
                <input 
                  type="email"
                  disabled
                  className="w-full pl-12 pr-5 py-3.5 bg-gray-50 border border-[#14141408] rounded-2xl text-sm text-gray-300 cursor-not-allowed"
                  value={authUser.email}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-[#5A5A40] ml-2">Phone</label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                <input 
                  type="tel"
                  className="w-full pl-12 pr-5 py-3.5 bg-[#F8F8F5] border border-[#14141408] rounded-2xl text-sm outline-none focus:ring-2 focus:ring-[#5A5A401a]"
                  value={formData.phone}
                  onChange={e => setFormData({...formData, phone: e.target.value})}
                />
              </div>
            </div>

            {authUser.role === 'student' ? (
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-[#5A5A40] ml-2">Student ID</label>
                <div className="relative">
                  <Code className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                  <input 
                    type="text"
                    className="w-full pl-12 pr-5 py-3.5 bg-[#F8F8F5] border border-[#14141408] rounded-2xl text-sm outline-none focus:ring-2 focus:ring-[#5A5A401a]"
                    value={formData.studentCode}
                    onChange={e => setFormData({...formData, studentCode: e.target.value})}
                  />
                </div>
              </div>
            ) : authUser.role === 'librarian' ? (
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-[#5A5A40] ml-2">Employee ID</label>
                <div className="relative">
                  <Code className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                  <input 
                    type="text"
                    className="w-full pl-12 pr-5 py-3.5 bg-[#F8F8F5] border border-[#14141408] rounded-2xl text-sm outline-none focus:ring-2 focus:ring-[#5A5A401a]"
                    value={formData.employeeCode}
                    onChange={e => setFormData({...formData, employeeCode: e.target.value})}
                  />
                </div>
              </div>
            ) : null}
          </div>

          {authUser.role === 'student' && (
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-[#5A5A40] ml-2">Department</label>
                <div className="relative">
                  <Building className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                  <input 
                    type="text"
                    className="w-full pl-12 pr-5 py-3.5 bg-[#F8F8F5] border border-[#14141408] rounded-2xl text-sm outline-none focus:ring-2 focus:ring-[#5A5A401a]"
                    value={formData.department}
                    onChange={e => setFormData({...formData, department: e.target.value})}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-[#5A5A40] ml-2">Academic Year</label>
                <div className="relative">
                  <GraduationCap className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                  <input 
                    type="number"
                    className="w-full pl-12 pr-5 py-3.5 bg-[#F8F8F5] border border-[#14141408] rounded-2xl text-sm outline-none focus:ring-2 focus:ring-[#5A5A401a]"
                    value={formData.year}
                    onChange={e => setFormData({...formData, year: Number(e.target.value)})}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="pt-6 border-t border-gray-50 flex items-center justify-between">
            <p className="text-xs text-gray-400 italic">Member since {new Date(authUser.createdAt!).toLocaleDateString()}</p>
            <button 
              type="submit"
              disabled={loading}
              className="px-8 py-3.5 bg-[#5A5A40] text-white rounded-2xl text-xs font-black uppercase tracking-[0.2em] shadow-xl shadow-[#5A5A4033] hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
            >
              {loading ? 'Processing...' : (
                <>
                  <Save size={16} /> Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>

      <AnimatePresence>
        {success && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-[#5A5A40] text-white px-6 py-3 rounded-full flex items-center gap-2 shadow-2xl z-50 text-xs font-bold uppercase tracking-widest"
          >
            <CheckCircle size={16} /> Changes saved successfully
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
