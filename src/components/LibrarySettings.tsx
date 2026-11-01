/**
 * LIBRARY SETTINGS (Admin → Settings tab)
 * ----------------------------------------------------------------------------
 * Lets an admin change the library rules stored in the `system_config` table:
 *   - LOAN_DURATION_DAYS  → how many days a loan lasts (from the day it is approved)
 *   - DAILY_FINE_RATE     → fine charged per day a book is late
 *   - MAX_LOANS_PER_USER  → how many books a student may hold or request at once
 *
 * How it works:
 *   1. GET /api/config loads the current values when the tab opens.
 *   2. The admin edits the numbers; "Save Changes" sends only the changed values,
 *      one PUT /api/config/:key request each.
 *   3. The server checks each value is in an allowed range (e.g. no negative fines),
 *      saves it, and writes an audit-log entry. New values apply immediately.
 *
 * (LIBRARY_NAME and CURRENCY_SYMBOL are also in the table but are not used by the
 *  screens yet, so they are not shown here.)
 */
import React, { useState, useEffect } from 'react';
import { Settings, Clock, Coins, BookCopy, Save, CheckCircle, AlertCircle, RotateCcw } from 'lucide-react';
import api from '../lib/api';

/** One row of the system_config table, as returned by the API. */
interface ConfigRow {
  key: string;
  value: string;
  description?: string;
  updatedAt?: string;
}

/** The rules shown on this screen, with the input limits used for the browser-side check. */
const EDITABLE_RULES = [
  { key: 'LOAN_DURATION_DAYS', title: 'Loan Duration', unit: 'days', icon: Clock, min: 1, max: 365, step: 1,
    help: 'How long a student may keep a book. Counted from the day the loan is approved.' },
  { key: 'DAILY_FINE_RATE', title: 'Daily Fine Rate', unit: 'per day', icon: Coins, min: 0, max: 1000, step: 0.01,
    help: 'Charged for every day (or part of a day) a book is overdue.' },
  { key: 'MAX_LOANS_PER_USER', title: 'Loan Limit', unit: 'books', icon: BookCopy, min: 1, max: 100, step: 1,
    help: 'Maximum books one student can hold or have requested at the same time.' },
];

export default function LibrarySettings() {
  const [saved, setSaved] = useState<Record<string, ConfigRow>>({}); // values currently in the database
  const [draft, setDraft] = useState<Record<string, string>>({});    // values being edited
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  /** Loads all settings and fills the form with the saved values. */
  const loadSettings = async () => {
    setLoading(true);
    try {
      const res = await api.get('/config');
      const byKey: Record<string, ConfigRow> = {};
      res.data.forEach((row: ConfigRow) => { byKey[row.key] = row; });
      setSaved(byKey);
      setDraft(Object.fromEntries(EDITABLE_RULES.map(r => [r.key, byKey[r.key]?.value ?? ''])));
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Could not load settings' });
    } finally {
      setLoading(false);
    }
  };

  /** Keys whose edited value differs from the saved value. */
  const changedKeys = EDITABLE_RULES.map(r => r.key).filter(key => draft[key] !== saved[key]?.value);

  /** Saves every changed setting. Stops at the first value the server rejects and shows its message. */
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      for (const key of changedKeys) {
        await api.put(`/config/${key}`, { value: draft[key] });
      }
      await loadSettings();
      setMessage({ type: 'success', text: 'Settings saved. New loans and fines use these values from now on.' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Saving failed' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="card-modern p-10 bg-white rounded-[2.5rem] text-xs text-gray-400 font-bold uppercase tracking-widest">Loading settings...</div>;
  }

  return (
    <form onSubmit={handleSave} className="space-y-8">
      <div className="card-modern p-8 bg-white border border-[#14141408] rounded-[2.5rem] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 bg-[#5A5A4010] border border-[#5A5A4020] rounded-2xl flex items-center justify-center text-[#5A5A40] shrink-0">
            <Settings size={32} />
          </div>
          <div>
            <h3 className="text-2xl font-serif italic text-[#141414] leading-tight">Circulation Policy</h3>
            <p className="text-gray-400 text-[10px] font-bold uppercase tracking-wider mt-1">Rules applied to every loan and fine</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => { setDraft(Object.fromEntries(EDITABLE_RULES.map(r => [r.key, saved[r.key]?.value ?? '']))); setMessage(null); }}
            disabled={changedKeys.length === 0 || saving}
            className="flex items-center gap-2 px-5 py-3 bg-white border border-[#14141410] text-gray-500 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-50 transition-all disabled:opacity-40"
          >
            <RotateCcw size={14} /> Undo
          </button>
          <button
            type="submit"
            disabled={changedKeys.length === 0 || saving}
            className="flex items-center gap-2 px-5 py-3 bg-[#141414] text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-[#5A5A40] transition-all shadow-xl shadow-[#1414141a] active:scale-95 disabled:opacity-40"
          >
            <Save size={14} /> {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {message && (
        <div className={`flex items-center gap-3 px-6 py-4 rounded-2xl text-xs font-bold ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-600 border border-red-100'}`}>
          {message.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {EDITABLE_RULES.map(rule => {
          const Icon = rule.icon;
          const isChanged = changedKeys.includes(rule.key);
          const updatedAt = saved[rule.key]?.updatedAt;
          return (
            <div key={rule.key} className={`card-modern p-6 bg-white rounded-[2rem] border transition-colors flex flex-col gap-4 ${isChanged ? 'border-[#5A5A4060]' : 'border-[#14141408]'}`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#F8F8F5] border border-gray-100 flex items-center justify-center text-[#5A5A40]">
                  <Icon size={18} />
                </div>
                <div>
                  <h4 className="text-sm font-black text-[#141414]">{rule.title}</h4>
                  <p className="text-[9px] font-mono text-gray-400">{rule.key}</p>
                </div>
              </div>
              <p className="text-xs text-gray-400 font-medium leading-relaxed flex-1">{rule.help}</p>
              <div className="space-y-1.5">
                <label htmlFor={rule.key} className="text-[10px] font-black uppercase tracking-widest text-[#5A5A40] ml-2">
                  Value ({rule.unit})
                </label>
                <input
                  id={rule.key}
                  type="number"
                  required
                  min={rule.min}
                  max={rule.max}
                  step={rule.step}
                  className="input-modern"
                  value={draft[rule.key] ?? ''}
                  onChange={e => setDraft({ ...draft, [rule.key]: e.target.value })}
                />
              </div>
              <p className="text-[9px] text-gray-300 font-bold uppercase tracking-widest">
                {isChanged ? 'Unsaved change' : updatedAt ? `Updated ${new Date(updatedAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}` : '—'}
              </p>
            </div>
          );
        })}
      </div>
    </form>
  );
}
