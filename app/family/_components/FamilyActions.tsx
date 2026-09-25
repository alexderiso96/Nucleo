'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Copy, Check, RefreshCw, LogOut } from 'lucide-react';

// ── Crea nucleo ─────────────────────────────────────────────────────────────

export function CreateHouseholdButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/household/create', { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'Errore nella creazione del nucleo.');
        return;
      }
      router.refresh();
    } catch {
      setError('Errore di rete. Riprova.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={handleCreate}
        disabled={loading}
        className="btn-primary flex items-center gap-2 px-5 py-2.5 text-sm"
      >
        {loading && <Loader2 size={14} className="animate-spin" />}
        Crea il mio Nucleo
      </button>
      {error && (
        <p className="text-xs mt-2" style={{ color: 'var(--expense)' }}>{error}</p>
      )}
    </div>
  );
}

// ── Unisciti con codice ──────────────────────────────────────────────────────

export function JoinHouseholdForm() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/household/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim().toUpperCase().replace(/-/g, '') }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'Codice non valido o scaduto.');
        return;
      }
      router.refresh();
    } catch {
      setError('Errore di rete. Riprova.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleJoin} className="flex flex-col gap-3">
      <div className="flex gap-2">
        <input
          type="text"
          value={code}
          onChange={e => setCode(e.target.value.toUpperCase())}
          placeholder="A3BX9K2T"
          maxLength={9}
          className="input px-3 py-2 text-sm flex-1 tabular-nums"
          style={{ letterSpacing: '0.1em', textTransform: 'uppercase' }}
        />
        <button
          type="submit"
          disabled={loading || !code.trim()}
          className="btn-primary flex items-center gap-2 px-4 py-2 text-sm"
        >
          {loading && <Loader2 size={13} className="animate-spin" />}
          Unisciti
        </button>
      </div>
      {error && (
        <p className="text-xs" style={{ color: 'var(--expense)' }}>{error}</p>
      )}
    </form>
  );
}

// ── Copia codice invito ──────────────────────────────────────────────────────

export function CopyCodeButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition-all"
      style={{
        background: 'var(--surface-2)',
        border: '1px solid var(--border-strong)',
        color: copied ? 'var(--income)' : 'var(--text-2)',
      }}
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
      {copied ? 'Copiato!' : 'Copia codice'}
    </button>
  );
}

// ── Genera nuovo codice ──────────────────────────────────────────────────────

export function RegenerateCodeButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRegenerate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/household/invite', { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'Errore nella generazione del codice.');
        return;
      }
      router.refresh();
    } catch {
      setError('Errore di rete. Riprova.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={handleRegenerate}
        disabled={loading}
        className="flex items-center gap-2 text-xs transition-colors"
        style={{ color: 'var(--text-3)' }}
      >
        {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
        Genera nuovo codice
      </button>
      {error && (
        <p className="text-xs mt-1" style={{ color: 'var(--expense)' }}>{error}</p>
      )}
    </div>
  );
}

// ── Lascia nucleo ────────────────────────────────────────────────────────────

export function LeaveHouseholdButton() {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLeave() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/household/leave', { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'Errore.');
        return;
      }
      router.refresh();
    } catch {
      setError('Errore di rete. Riprova.');
    } finally {
      setLoading(false);
      setConfirm(false);
    }
  }

  if (!confirm) {
    return (
      <button
        onClick={() => setConfirm(true)}
        className="text-xs"
        style={{ color: 'var(--text-3)' }}
      >
        <LogOut size={11} className="inline mr-1" />
        Lascia il nucleo
      </button>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs" style={{ color: 'var(--text-2)' }}>Sei sicuro?</span>
      <button
        onClick={handleLeave}
        disabled={loading}
        className="text-xs flex items-center gap-1"
        style={{ color: 'var(--expense)' }}
      >
        {loading && <Loader2 size={11} className="animate-spin" />}
        Conferma
      </button>
      <button
        onClick={() => setConfirm(false)}
        className="text-xs"
        style={{ color: 'var(--text-3)' }}
      >
        Annulla
      </button>
      {error && <p className="text-xs" style={{ color: 'var(--expense)' }}>{error}</p>}
    </div>
  );
}
