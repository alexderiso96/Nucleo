'use client';

import { useState } from 'react';

interface Props {
  initialFullName: string | null;
  initialUsername: string | null;
  email: string;
}

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

export default function ProfileInfoSection({ initialFullName, initialUsername, email }: Props) {
  const [fullName, setFullName] = useState(initialFullName ?? '');
  const [username, setUsername] = useState(initialUsername ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const usernameInvalid = username.trim() !== '' && !USERNAME_RE.test(username.trim().toLowerCase());

  async function handleSave() {
    if (usernameInvalid) return;
    setSaving(true);
    setError('');
    setSuccess(false);

    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name: fullName, username: username.trim().toLowerCase() || null }),
    });
    const json = await res.json() as { ok?: boolean; error?: string };
    setSaving(false);
    if (json.ok) {
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } else {
      setError(json.error ?? 'Errore');
    }
  }

  return (
    <div className="card p-5 flex flex-col gap-4">
      <p className="text-xs font-semibold" style={{ color: 'var(--text-1)' }}>Dati personali</p>

      <div className="flex flex-col gap-3">
        {/* Nome completo */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-medium" style={{ color: 'var(--text-3)' }}>
            Nome completo
          </label>
          <input
            type="text"
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            placeholder="es. Alessandro De Riso"
            className="input px-3 py-2 text-sm w-full"
          />
        </div>

        {/* Username */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-medium" style={{ color: 'var(--text-3)' }}>
            Username <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>(univoco)</span>
          </label>
          <div className="flex items-center" style={{ background: 'var(--surface-2)', border: `1px solid ${usernameInvalid ? 'var(--expense)' : 'var(--border)'}`, borderRadius: '10px', overflow: 'hidden' }}>
            <span className="px-3 text-sm shrink-0" style={{ color: 'var(--text-3)' }}>@</span>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value.toLowerCase())}
              placeholder="username"
              className="flex-1 py-2 pr-3 text-sm bg-transparent outline-none"
              style={{ color: 'var(--text-1)' }}
              maxLength={20}
            />
          </div>
          {usernameInvalid && (
            <p className="text-[11px]" style={{ color: 'var(--expense)' }}>
              3-20 caratteri: lettere minuscole, numeri, _
            </p>
          )}
        </div>

        {/* Email — read only */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-medium" style={{ color: 'var(--text-3)' }}>
            Email <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>(non modificabile)</span>
          </label>
          <input
            type="email"
            value={email}
            readOnly
            className="input px-3 py-2 text-sm w-full"
            style={{ opacity: 0.5, cursor: 'default' }}
          />
        </div>
      </div>

      {error && <p className="text-[11px]" style={{ color: 'var(--expense)' }}>{error}</p>}
      {success && <p className="text-[11px]" style={{ color: 'var(--brand-light)' }}>Profilo aggiornato.</p>}

      <button
        onClick={handleSave}
        disabled={saving || usernameInvalid}
        className="btn-primary py-2 text-sm"
      >
        {saving ? 'Salvataggio…' : 'Salva'}
      </button>
    </div>
  );
}
