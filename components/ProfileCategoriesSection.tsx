'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useCategories } from '@/lib/use-categories';

const EMOJI_SUGGESTIONS = ['🏠','🚗','🛒','🍽️','💊','🏋️','👗','🎬','⚡','✈️','🎓','💼','🐾','🎁','🌿','💻','📱','🏖️','🎵','🍷'];

export default function ProfileCategoriesSection() {
  const { categories, loading: catsLoading, reload } = useCategories();
  const userCats = categories.filter(c => c.isCustom);
  const [newLabel, setNewLabel] = useState('');
  const [newIcon, setNewIcon]   = useState('📦');
  const [newColor, setNewColor] = useState('#6366f1');
  const [saving, setSaving]     = useState(false);
  const [catError, setCatError] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);

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
    <div className="card p-5 flex flex-col gap-4">
      <div>
        <p className="text-xs font-semibold mb-0.5" style={{ color: 'var(--text-1)' }}>Categorie personalizzate</p>
        <p className="text-[11px]" style={{ color: 'var(--text-3)' }}>
          Aggiungi categorie oltre a quelle predefinite. Saranno disponibili ovunque.
        </p>
      </div>

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

      <div className="flex flex-col gap-3 pt-1" style={{ borderTop: '1px solid var(--border)' }}>
        <p className="text-[10px] font-semibold uppercase tracking-widest pt-1" style={{ color: 'var(--text-3)' }}>
          Nuova categoria
        </p>

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
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
            title="Colore"
          />
        </div>

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
  );
}
