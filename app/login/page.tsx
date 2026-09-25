'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
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
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem 1rem',
      }}
    >
      <div style={{ width: '100%', maxWidth: '22rem' }}>

        {/* Logo */}
        <div style={{ marginBottom: '2.5rem', textAlign: 'center' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '0.375rem',
            }}
          >
            <div
              style={{
                width: '1.5rem',
                height: '1.5rem',
                borderRadius: '0.25rem',
                background: 'var(--accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.625rem',
                fontWeight: 700,
                color: '#0e1512',
              }}
            >
              N
            </div>
            <span
              style={{
                fontSize: '1.125rem',
                fontWeight: 700,
                color: 'var(--text-1)',
                letterSpacing: '-0.02em',
              }}
            >
              Nucleo
            </span>
          </div>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-3)', marginTop: '0.25rem' }}>
            Analisi finanziaria personale
          </p>
        </div>

        {/* Tab Accedi / Registrati */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '1.5rem',
            marginBottom: '2rem',
          }}
        >
          {(['login', 'register'] as const).map(m => (
            <button
              key={m}
              onClick={() => switchMode(m)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: mode === m ? 600 : 400,
                color: mode === m ? 'var(--accent)' : 'var(--text-3)',
                borderBottom: mode === m ? '1px solid var(--accent)' : '1px solid transparent',
                paddingBottom: '0.125rem',
                transition: 'color 0.15s ease',
              }}
            >
              {m === 'login' ? 'Accedi' : 'Registrati'}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            <label
              htmlFor="email"
              style={{ fontSize: '0.8125rem', color: 'var(--text-2)', fontWeight: 500 }}
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="tua@email.com"
              autoComplete="email"
              className="field"
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            <label
              htmlFor="password"
              style={{ fontSize: '0.8125rem', color: 'var(--text-2)', fontWeight: 500 }}
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              minLength={6}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              className="field"
            />
          </div>

          {error && (
            <p style={{ fontSize: '0.8125rem', color: 'var(--negative)', margin: 0 }}>
              {error}
            </p>
          )}

          {message && (
            <p style={{ fontSize: '0.8125rem', color: 'var(--positive)', margin: 0 }}>
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: '0.5rem',
              padding: '0.625rem 1rem',
              border: '1px solid var(--accent)',
              borderRadius: '0.25rem',
              background: 'transparent',
              color: 'var(--accent)',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.5 : 1,
              transition: 'background 0.15s ease, color 0.15s ease',
              fontFamily: 'inherit',
            }}
            onMouseEnter={e => {
              if (!loading) {
                (e.currentTarget as HTMLButtonElement).style.background = 'var(--accent)';
                (e.currentTarget as HTMLButtonElement).style.color = '#0e1512';
              }
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--accent)';
            }}
          >
            {loading ? 'Caricamento…' : mode === 'login' ? 'Accedi' : 'Registrati'}
          </button>
        </form>
      </div>
    </div>
  );
}
