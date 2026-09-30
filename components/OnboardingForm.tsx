'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

interface Props { email: string }

export default function OnboardingForm({ email }: Props) {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const usernameInvalid = username.trim() !== '' && !USERNAME_RE.test(username.trim());

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim()) { setError('Inserisci il tuo nome'); return; }
    if (!username.trim()) { setError('Scegli uno username'); return; }
    if (usernameInvalid) { setError('Username non valido'); return; }

    setSaving(true);
    setError('');

    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name: fullName.trim(), username: username.trim() }),
    });
    const json = await res.json() as { ok?: boolean; error?: string };
    if (json.ok) {
      router.push('/dashboard');
      router.refresh();
    } else {
      setSaving(false);
      setError(json.error ?? 'Errore nel salvataggio');
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'var(--bg)' }}
    >
      <div className="w-full max-w-sm flex flex-col gap-6">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold"
            style={{ background: 'var(--brand-dark)', color: '#fff', boxShadow: '0 2px 12px rgba(16,185,129,0.3)' }}
          >
            N
          </div>
          <span className="text-base font-bold tracking-tight" style={{ color: 'var(--text-1)' }}>Nucleo</span>
        </div>

        <div>
          <h1 className="text-xl font-bold mb-1" style={{ color: 'var(--text-1)' }}>
            Benvenuto/a 👋
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-3)' }}>
            Configura il tuo profilo per continuare.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Email read-only */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-medium" style={{ color: 'var(--text-3)' }}>Email</label>
            <input
              type="email"
              value={email}
              readOnly
              className="input px-3 py-2.5 text-sm"
              style={{ opacity: 0.5, cursor: 'default' }}
            />
          </div>

          {/* Nome completo */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-medium" style={{ color: 'var(--text-3)' }}>
              Nome completo <span style={{ color: 'var(--expense)' }}>*</span>
            </label>
            <input
              type="text"
              value={fullName}
              onChange={e => { setFullName(e.target.value); setError(''); }}
              placeholder="es. Alessandro De Riso"
              className="input px-3 py-2.5 text-sm"
              autoFocus
            />
          </div>

          {/* Username */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-medium" style={{ color: 'var(--text-3)' }}>
              Username <span style={{ color: 'var(--expense)' }}>*</span>
            </label>
            <div
              className="flex items-center overflow-hidden"
              style={{
                background: 'var(--surface-2)',
                border: `1px solid ${usernameInvalid ? 'var(--expense)' : 'var(--border)'}`,
                borderRadius: '10px',
              }}
            >
              <span className="px-3 text-sm shrink-0" style={{ color: 'var(--text-3)' }}>@</span>
              <input
                type="text"
                value={username}
                onChange={e => { setUsername(e.target.value.toLowerCase()); setError(''); }}
                placeholder="username"
                className="flex-1 py-2.5 pr-3 text-sm bg-transparent outline-none"
                style={{ color: 'var(--text-1)' }}
                maxLength={20}
              />
            </div>
            {usernameInvalid && (
              <p className="text-[10px]" style={{ color: 'var(--expense)' }}>
                3-20 caratteri: lettere minuscole, numeri, _
              </p>
            )}
            {!usernameInvalid && username.trim() && (
              <p className="text-[10px]" style={{ color: 'var(--text-3)' }}>
                Il tuo profilo sarà @{username.trim()}
              </p>
            )}
          </div>

          {error && (
            <p className="text-[11px]" style={{ color: 'var(--expense)' }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={saving || usernameInvalid || !fullName.trim() || !username.trim()}
            className="btn-primary py-2.5 text-sm font-semibold"
          >
            {saving ? 'Salvataggio…' : 'Inizia →'}
          </button>
        </form>
      </div>
    </div>
  );
}
