'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, Plus, X } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import { useCategories } from '@/lib/use-categories';

const EMOJI_SUGGESTIONS = ['🏠','🚗','🛒','🍽️','💊','🏋️','👗','🎬','⚡','✈️','🎓','💼','🐾','🎁','🌿','💻','📱','🏖️','🎵','🍷'];

export default function SettingsPage() {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  // Categorie personalizzate
  const { categories, loading: catsLoading, reload } = useCategories();
  const userCats = categories.filter(c => c.isCustom);
  const [newLabel, setNewLabel]   = useState('');
  const [newIcon, setNewIcon]     = useState('📦');
  const [newColor, setNewColor]   = useState('#6366f1');
  const [saving, setSaving]       = useState(false);
  const [catError, setCatError]   = useState('');
  const [deleting, setDeleting]   = useState<string | null>(null);

  async function handleDelete() {
    setLoading(true);
    const res = await fetch('/api/profile/data', { method: 'DELETE' });
    setLoading(false);
    if (res.ok) {
      setDone(true);
      setTimeout(() => router.push('/dashboard'), 1500);
    }
  }

  async function handleAddCategory() {
    if (!newLabel.trim()) { setCatError('Inserisci un nome'); return; }
    setSaving(true);
    setCatError('');
    const res = await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: newLabel.trim(), label: newLabel.trim(), icon: newIcon, color: newColor }),
    });
    setSaving(false);
    if (res.ok) {
      setNewLabel('');
      setNewIcon('📦');
      setNewColor('#6366f1');
      reload();
    } else {
      const j = await res.json() as { error?: string };
      setCatError(j.error ?? 'Errore');
    }
  }

  async function handleDeleteCategory(id: string) {
    setDeleting(id);
    await fetch(`/api/categories/${id}`, { method: 'DELETE' });
    setDeleting(null);
    reload();
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

        <main className="flex-1 px-6 py-6 max-w-xl flex flex-col gap-5">

          {/* Categorie personalizzate */}
          <div className="card p-5 flex flex-col gap-4">
            <div>
              <p className="text-xs font-semibold text-slate-200 mb-0.5">Categorie personalizzate</p>
              <p className="text-[11px] text-slate-500">
                Aggiungi categorie oltre a quelle predefinite. Saranno disponibili ovunque.
              </p>
            </div>

            {/* Categorie esistenti */}
            {!catsLoading && userCats.length > 0 && (
              <div className="flex flex-col gap-1.5">
                {userCats.map(cat => (
                  <div
                    key={cat.id}
                    className="flex items-center gap-3 px-3 py-2 rounded-xl"
                    style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
                  >
                    <span className="text-base w-7 text-center">{cat.icon}</span>
                    <span className="flex-1 text-sm" style={{ color: 'var(--text-1)' }}>{cat.label}</span>
                    <span
                      className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                      style={{ background: cat.darkBg, color: cat.darkText }}
                    >
                      {cat.value}
                    </span>
                    <button
                      onClick={() => handleDeleteCategory(cat.id!)}
                      disabled={deleting === cat.id}
                      className="w-6 h-6 flex items-center justify-center rounded-lg transition-colors"
                      style={{ color: 'var(--text-3)' }}
                    >
                      {deleting === cat.id
                        ? <span className="w-3 h-3 border border-current rounded-full animate-spin inline-block" style={{ borderTopColor: 'transparent' }} />
                        : <X size={12} />}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Form nuova categoria */}
            <div className="flex flex-col gap-3 pt-1" style={{ borderTop: '1px solid var(--border)' }}>
              <p className="text-[10px] font-semibold uppercase tracking-widest pt-1" style={{ color: 'var(--text-3)' }}>
                Nuova categoria
              </p>

              {/* Nome + emoji + colore */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newLabel}
                  onChange={e => { setNewLabel(e.target.value); setCatError(''); }}
                  onKeyDown={e => { if (e.key === 'Enter') void handleAddCategory(); }}
                  placeholder="Nome categoria…"
                  className="input flex-1 px-3 py-2 text-sm"
                />
                <input
                  type="text"
                  value={newIcon}
                  onChange={e => setNewIcon(e.target.value)}
                  className="input w-12 px-2 py-2 text-center text-lg"
                  maxLength={2}
                  title="Emoji"
                />
                <input
                  type="color"
                  value={newColor}
                  onChange={e => setNewColor(e.target.value)}
                  className="w-10 h-10 rounded-lg cursor-pointer border-0 p-0.5"
                  style={{ background: 'var(--dark-700)', border: '1px solid var(--border)' }}
                  title="Colore"
                />
              </div>

              {/* Emoji suggeriti */}
              <div className="flex flex-wrap gap-1.5">
                {EMOJI_SUGGESTIONS.map(e => (
                  <button
                    key={e}
                    onClick={() => setNewIcon(e)}
                    className="w-8 h-8 rounded-lg text-base flex items-center justify-center transition-all"
                    style={{
                      background: newIcon === e ? 'rgba(99,102,241,0.2)' : 'var(--surface-2)',
                      border: `1px solid ${newIcon === e ? '#6366f1' : 'var(--border)'}`,
                    }}
                  >
                    {e}
                  </button>
                ))}
              </div>

              {catError && <p className="text-[11px] text-red-400">{catError}</p>}

              <button
                onClick={handleAddCategory}
                disabled={saving || !newLabel.trim()}
                className="btn-primary flex items-center justify-center gap-2 py-2 text-sm"
              >
                <Plus size={14} />
                {saving ? 'Salvataggio…' : 'Aggiungi categoria'}
              </button>
            </div>
          </div>

          {/* Zona pericolosa */}
          <div className="card p-5" style={{ borderColor: 'rgba(239,68,68,0.25)' }}>
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
                  <button onClick={() => setConfirm(false)} className="px-4 py-2 text-xs text-slate-500 hover:text-slate-300 transition-colors">
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
