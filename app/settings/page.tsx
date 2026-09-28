'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';

export default function SettingsPage() {
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
    <div className="flex min-h-screen" style={{ background: 'var(--dark-900)' }}>
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <header
          className="flex items-center px-6 py-3.5 sticky top-0 z-10"
          style={{ background: 'var(--dark-800)', borderBottom: '1px solid var(--dark-600)' }}
        >
          <h2 className="text-sm font-semibold text-slate-200">Impostazioni</h2>
        </header>

        <main className="flex-1 px-6 py-6 max-w-xl">
          <div
            className="card p-5"
            style={{ borderColor: 'rgba(239,68,68,0.25)' }}
          >
            <p className="text-xs font-semibold text-red-400 mb-1">Zona pericolosa</p>
            <p className="text-[11px] text-slate-500 mb-4">
              Cancella tutte le spese, buste paga, mapping CSV e la connessione Drive.
              L&apos;account di accesso rimane intatto.
            </p>

            {done ? (
              <p className="text-xs text-emerald-400">Dati cancellati. Reindirizzamento...</p>
            ) : !confirm ? (
              <button
                onClick={() => setConfirm(true)}
                className="px-4 py-2 text-xs font-semibold rounded-lg transition-colors"
                style={{
                  border: '1px solid rgba(239,68,68,0.4)',
                  color: '#f87171',
                  background: 'transparent',
                }}
              >
                Cancella tutti i dati
              </button>
            ) : (
              <div className="flex flex-col gap-3">
                <p className="text-xs text-red-400 font-semibold">
                  Sei sicuro? L&apos;operazione è irreversibile.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleDelete}
                    disabled={loading}
                    className="px-4 py-2 text-xs font-semibold rounded-lg"
                    style={{
                      background: 'rgba(239,68,68,0.15)',
                      border: '1px solid rgba(239,68,68,0.4)',
                      color: '#f87171',
                    }}
                  >
                    {loading ? 'Cancellazione...' : 'Sì, cancella tutto'}
                  </button>
                  <button
                    onClick={() => setConfirm(false)}
                    className="px-4 py-2 text-xs text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    Annulla
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
