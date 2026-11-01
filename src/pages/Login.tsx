/**
 * LOGIN & SIGN-UP PAGE
 * ----------------------------------------------------------------------------
 * One form with two modes:
 *   - Login:   sends email + password to POST /api/auth/login. The server replies with a
 *              JWT token, which is saved (see useAuth().login) and sent with every later request.
 *   - Sign up: sends the new member's details to POST /api/auth/register.
 *
 * SECURITY: public sign-up can only create STUDENT accounts. The server enforces this
 * (whatever the browser sends). Librarian and admin accounts are created by an admin
 * on the Admin → Members screen.
 */
import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Library, Mail, Lock, User as UserIcon, Phone, Code, Building, GraduationCap } from 'lucide-react';
import api from '../lib/api';
import { useAuth } from '../App';

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  // Public sign-up is always a student account (see the security note at the top of this file)
  const role = 'student';
  const [studentCode, setStudentCode] = useState('');
  const [department, setDepartment] = useState('');
  const [year, setYear] = useState('1');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();

  /** Runs when the form is submitted: logs in or registers, depending on the current mode. */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        const res = await api.post('/auth/login', { email, password });
        login(res.data.token, res.data.user);
      } else {
        await api.post('/auth/register', {
          fullName, email, password,
          studentCode, department, year: Number(year),
          phone
        });
        setIsLogin(true);
        setError('Registration successful! Please login.');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center relative overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute top-0 -left-20 w-80 h-80 bg-lms-blue opacity-5 blur-[100px] rounded-full" />
      <div className="absolute bottom-0 -right-20 w-80 h-80 bg-lms-orange opacity-5 blur-[100px] rounded-full" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-8 sm:p-12 rounded-[3.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.08)] w-full max-w-xl border border-white/50 relative z-10"
      >
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-gradient-to-tr from-lms-blue to-blue-400 rounded-[2rem] flex items-center justify-center text-white mx-auto mb-6 shadow-2xl shadow-blue-200 rotate-3 hover:rotate-0 transition-transform duration-500">
            <Library size={40} />
          </div>
          <h2 className="text-4xl font-serif italic mb-3 text-lms-ink">
            {isLogin ? 'Knowledge Awaits' : 'Open Your World'}
          </h2>
          <p className="text-[11px] font-black uppercase tracking-[0.25em] text-lms-blue opacity-60">
            {isLogin ? 'Secure Authentication' : 'Create Library Credentials'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {!isLogin && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="sm:col-span-2 space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-lms-blue ml-2">Display Name</label>
                <div className="relative">
                  <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                  <input 
                    type="text" placeholder="Your full name" required
                    className="input-modern pl-12"
                    value={fullName} onChange={e => setFullName(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-lms-blue ml-2">Access Role</label>
                {/* Only "Academic Student" can be chosen here; staff accounts are created by an admin. */}
                <select 
                  className="select-modern cursor-pointer"
                  value={role} onChange={() => {}}
                >
                  <option value="student">Academic Student</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-lms-blue ml-2">Contact</label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                  <input 
                    type="text" placeholder="Phone number"
                    className="input-modern pl-12"
                    value={phone} onChange={e => setPhone(e.target.value)}
                  />
                </div>
              </div>

              {role === 'student' && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="sm:col-span-2 grid grid-cols-2 gap-5 pt-2"
                >
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-lms-blue ml-2">Student ID</label>
                    <input 
                      type="text" placeholder="ID Code" required
                      className="input-modern"
                      value={studentCode} onChange={e => setStudentCode(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-lms-blue ml-2">Current Year</label>
                    <input 
                      type="number" placeholder="Year 1-5" required min="1" max="5"
                      className="input-modern"
                      value={year} onChange={e => setYear(e.target.value)}
                    />
                  </div>
                </motion.div>
              )}
            </div>
          )}

          <div className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-lms-blue ml-2">Email Identity</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                <input 
                  type="email" placeholder="email@academy.edu" required
                  className="input-modern pl-12"
                  value={email} onChange={e => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-lms-blue ml-2">Private Key</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                <input 
                  type="password" placeholder="••••••••" required
                  className="input-modern pl-12"
                  value={password} onChange={e => setPassword(e.target.value)}
                />
              </div>
            </div>
          </div>

          {error && (
            <motion.p 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-[10px] font-black uppercase tracking-widest text-red-500 bg-red-50 p-3 rounded-2xl border border-red-100 text-center"
            >
              {error}
            </motion.p>
          )}

          <button 
            type="submit" disabled={loading}
            className="w-full py-4 mt-4 bg-lms-blue text-white rounded-[1.5rem] text-xs font-black uppercase tracking-[0.25em] shadow-2xl shadow-blue-200 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {loading ? 'Validating Token...' : (isLogin ? 'Access Archive' : 'Index Profile')}
          </button>
        </form>

        <div className="mt-8 text-center">
          <button 
            onClick={() => setIsLogin(!isLogin)}
            className="text-[10px] font-black text-gray-400 uppercase tracking-widest hover:text-lms-blue transition-colors group"
          >
            {isLogin ? (
              <>Don't have credentials? <span className="text-lms-blue group-hover:underline">Join Assembly</span></>
            ) : (
              <>Already indexed? <span className="text-lms-blue group-hover:underline">Resume Session</span></>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
