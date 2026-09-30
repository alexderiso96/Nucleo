'use client';

import { useState, useEffect } from 'react';
import { useCategories } from '@/lib/use-categories';

interface Budget { id: string; category: string; amount: number }

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(): string {
  return new Date().toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
}

export default function BudgetSection() {
  const { categories, loading: catsLoading } = useCategories();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null); // category value
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const spendingCats = categories.filter(c => c.value !== 'income');

  useEffect(() => {
    fetch(`/api/budgets?month=${currentMonth()}`)
      .then(r => r.json())
      .then((d: { budgets: Budget[] }) => setBudgets(d.budgets ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function getBudget(cat: string): number | null {
    return budgets.find(b => b.category === cat)?.amount ?? null;
  }

  function openEdit(cat: string) {
    const existing = getBudget(cat);
    setDraft(existing ? String(existing) : '');
    setEditing(cat);
  }

  async function saveBudget(cat: string) {
    const amount = parseFloat(draft.replace(',', '.'));
    setSaving(true);
    if (!draft.trim() || isNaN(amount) || amount <= 0) {
      // cancella budget
      await fetch(`/api/budgets?category=${encodeURIComponent(cat)}&month=${currentMonth()}`, { method: 'DELETE' });
      setBudgets(prev => prev.filter(b => b.category !== cat));
    } else {
      await fetch('/api/budgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: cat, amount, month: currentMonth() }),
      });
      setBudgets(prev => {
        const without = prev.filter(b => b.category !== cat);
        return [...without, { id: '', category: cat, amount }];
      });
    }
    setSaving(false);
    setEditing(null);
  }

  const fmt = (n: number) =>
    new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);

  if (loading || catsLoading) return null;

  return (
    <div className="card p-5 flex flex-col gap-4">
      <div>
        <p className="text-xs font-semibold mb-0.5" style={{ color: 'var(--text-1)' }}>Budget mensili</p>
        <p className="text-[11px]" style={{ color: 'var(--text-3)' }}>
          Imposta un limite di spesa per categoria — {monthLabel()}
        </p>
      </div>

      <div className="flex flex-col gap-1">
        {spendingCats.map(cat => {
          const budget = getBudget(cat.value);
          const isEditing = editing === cat.value;
          return (
            <div
              key={cat.value}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
            >
              <span className="text-base w-6 text-center shrink-0">{cat.icon}</span>
              <span className="flex-1 text-sm" style={{ color: 'var(--text-1)' }}>{cat.label}</span>

              {isEditing ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    inputMode="decimal"
                    autoFocus
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') void saveBudget(cat.value);
                      if (e.key === 'Escape') setEditing(null);
                    }}
                    placeholder="es. 200"
                    className="input w-24 px-2 py-1 text-sm text-right tabular-nums"
                  />
                  <button
                    onClick={() => void saveBudget(cat.value)}
                    disabled={saving}
                    className="text-[11px] font-semibold px-3 py-1 rounded-lg transition-colors"
                    style={{ background: 'var(--brand)', color: '#fff', opacity: saving ? 0.7 : 1 }}
                  >
                    {saving ? '…' : 'Salva'}
                  </button>
                  <button
                    onClick={() => setEditing(null)}
                    className="text-[11px] px-2 py-1"
                    style={{ color: 'var(--text-3)' }}
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => openEdit(cat.value)}
                  className="text-[11px] px-2 py-1 rounded-lg transition-colors"
                  style={budget
                    ? { background: 'rgba(16,185,129,0.1)', color: 'var(--brand-light)' }
                    : { color: 'var(--text-3)' }}
                >
                  {budget ? fmt(budget) : '+ Imposta'}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
