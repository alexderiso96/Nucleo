'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';

export default function ProfileDangerZone() {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleDelete() {
    setLoading(true);
    const res = await fetch('/api/profile/data', { method: 'DELETE' });
    setLoading(false);
    if (res.ok) {
      setDone(true);
      setTimeout(() => router.push('/dashboard'), 1500);
    }
  }

  return (
    <div className="card p-5" style={{ borderColor: 'rgba(239,68,68,0.25)' }}>
      <p className="text-xs font-semibold text-red-400 mb-1">Zona pericolosa</p>
      <p className="text-[11px] mb-4" style={{ color: 'var(--text-3)' }}>
        Cancella tutte le spese, buste paga, mapping CSV e la connessione Drive.
        L&apos;account di accesso rimane intatto.
      </p>

      {done ? (
        <p className="text-xs text-emerald-400">Dati cancellati. Reindirizzamento...</p>
      ) : !confirm ? (
        <button
          onClick={() => setConfirm(true)}
          className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-colors"
          style={{ border: '1px solid rgba(239,68,68,0.4)', color: '#f87171', background: 'transparent' }}
        >
          <Trash2 size={13} />
          Cancella tutti i dati
        </button>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-red-400 font-semibold">Sei sicuro? L&apos;operazione è irreversibile.</p>
          <div className="flex gap-2">
            <button
              onClick={handleDelete}
              disabled={loading}
              className="px-4 py-2 text-xs font-semibold rounded-lg"
              style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', color: '#f87171' }}
            >
              {loading ? 'Cancellazione...' : 'Sì, cancella tutto'}
            </button>
            <button
              onClick={() => setConfirm(false)}
              className="px-4 py-2 text-xs transition-colors"
              style={{ color: 'var(--text-3)' }}
            >
              Annulla
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
