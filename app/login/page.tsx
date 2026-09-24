'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@/lib/supabaseClient';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    const supabase = createClient();

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(error.message);
      } else {
        router.push('/dashboard');
        router.refresh();
      }
    } else {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setError(error.message);
      } else {
        setMessage('Controlla la tua email per confermare la registrazione.');
      }
    }

    setLoading(false);
  }

  function switchMode(next: 'login' | 'register') {
    setMode(next);
    setError(null);
    setMessage(null);
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--dark-900)' }}>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-sm card p-8"
      >
        {/* Logo */}
        <div className="mb-8">
          <h1
            className="text-2xl font-bold tracking-tight"
            style={{ background: 'linear-gradient(90deg, #818cf8, #6366f1, #a5b4fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
          >
            Nucleo
          </h1>
          <p className="mt-1 text-xs text-slate-500">Analisi finanziaria personale</p>
        </div>

        {/* Tabs */}
        <div
          className="flex gap-1 mb-6 rounded-lg p-1"
          style={{ background: 'var(--dark-700)', border: '1px solid var(--dark-600)' }}
        >
          {(['login', 'register'] as const).map((m) => (
            <button
              key={m}
              onClick={() => switchMode(m)}
              className="flex-1 py-2 text-xs font-semibold rounded-md transition-all duration-200"
              style={
                mode === m
                  ? { background: 'var(--brand-600)', color: '#fff', boxShadow: '0 2px 10px rgba(99,102,241,0.3)' }
                  : { color: '#64748b' }
              }
            >
              {m === 'login' ? 'Accedi' : 'Registrati'}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="tua@email.com"
              autoComplete="email"
              className="input w-full px-3 py-2.5 text-sm"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              minLength={6}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              className="input w-full px-3 py-2.5 text-sm"
            />
          </div>

          <AnimatePresence mode="wait">
            {error && (
              <motion.p
                key="error"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-xs text-red-400 px-3 py-2.5 rounded-lg"
                style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)' }}
              >
                {error}
              </motion.p>
            )}
            {message && (
              <motion.p
                key="msg"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-xs text-emerald-400 px-3 py-2.5 rounded-lg"
                style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.18)' }}
              >
                {message}
              </motion.p>
            )}
          </AnimatePresence>

          <button type="submit" disabled={loading} className="btn-primary w-full py-2.5 text-sm mt-1">
            {loading ? 'Caricamento…' : mode === 'login' ? 'Accedi' : 'Registrati'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
