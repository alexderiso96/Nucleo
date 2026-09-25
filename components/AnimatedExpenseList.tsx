'use client';

import { useState, useRef } from 'react';
import { Check, Loader2, Trash2, X } from 'lucide-react';
import { CATEGORIES, CATEGORY_COLORS, CATEGORY_TEXT } from '@/lib/categories';

interface Expense {
  id: string;
  amount: number;
  currency: string;
  category: string;
  category_confidence?: string | null;
  description: string | null;
  expense_date: string;
  source?: string | null;
}

interface Props {
  expenses: Expense[];
  monthLabel: string;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);

function formatDate(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: 'short' }).format(
    new Date(y, m - 1, d),
  );
}

function categoryLabel(value: string): string {
  return CATEGORIES.find(c => c.value === value)?.label ?? value;
}

interface RowState {
  category: string;
  confidence: string | null;
  saved: boolean;
  deleted: boolean;
}

export default function AnimatedExpenseList({ expenses, monthLabel }: Props) {
  const [rows, setRows] = useState<Record<string, RowState>>(() => {
    const init: Record<string, RowState> = {};
    for (const e of expenses) {
      init[e.id] = {
        category: e.category,
        confidence: e.category_confidence ?? null,
        saved: false,
        deleted: false,
      };
    }
    return init;
  });
  const [editing, setEditing] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const savedTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  async function handleCategoryChange(expense: Expense, newCategory: string) {
    setEditing(null);
    setSaving(expense.id);
    try {
      await fetch(`/api/expenses/${expense.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: newCategory }),
      });
      if (expense.description) {
        await fetch('/api/merchant-rules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ description: expense.description, category: newCategory }),
        });
      }
      setRows(prev => ({
        ...prev,
        [expense.id]: { ...prev[expense.id], category: newCategory, confidence: 'high', saved: true },
      }));
      clearTimeout(savedTimers.current[expense.id]);
      savedTimers.current[expense.id] = setTimeout(() => {
        setRows(prev => ({ ...prev, [expense.id]: { ...prev[expense.id], saved: false } }));
      }, 1500);
    } catch { /* ignore */ } finally { setSaving(null); }
  }

  async function handleDelete(id: string) {
    setDeleting(id);
    setConfirmDelete(null);
    try {
      await fetch(`/api/expenses/${id}`, { method: 'DELETE' });
      setRows(prev => ({ ...prev, [id]: { ...prev[id], deleted: true } }));
    } catch { /* ignore */ } finally { setDeleting(null); }
  }

  const visible = expenses.filter(e => {
    if (rows[e.id]?.deleted) return false;
    if (categoryFilter !== 'all' && (rows[e.id]?.category ?? e.category) !== categoryFilter) return false;
    return true;
  });

  const total = visible.reduce((s, e) => s + Number(e.amount), 0);

  return (
    <div className="card anim-slide-up anim-d4 overflow-hidden">
      <div
        className="px-5 py-3 flex items-center justify-between gap-3"
        style={{ borderBottom: '1px solid var(--dark-600)' }}
      >
        <span className="text-xs font-semibold text-slate-400 shrink-0">Spese di {monthLabel}</span>
        <div className="flex items-center gap-2 min-w-0">
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="input px-2 py-1 text-[10px]"
            style={{ appearance: 'none', colorScheme: 'dark', minWidth: '120px' }}
          >
            <option value="all">Tutte le categorie</option>
            {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <span className="text-[10px] text-slate-600 tabular-nums shrink-0">
            {visible.length} di {expenses.filter(e => !rows[e.id]?.deleted).length}
          </span>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="px-5 py-10 text-center text-xs text-slate-600">
          {expenses.filter(e => !rows[e.id]?.deleted).length === 0
            ? 'Nessuna spesa registrata questo mese.'
            : 'Nessuna spesa per questa categoria.'}
        </div>
      ) : (
        <>
          <div
            className="grid px-5 py-2"
            style={{ gridTemplateColumns: '72px 1fr 1fr 96px 32px', gap: '0.75rem', borderBottom: '1px solid var(--dark-700)' }}
          >
            {['Data', 'Categoria', 'Descrizione', 'Importo', ''].map((h, i) => (
              <span
                key={i}
                className="text-[10px] font-semibold uppercase tracking-widest text-slate-600"
                style={i === 3 ? { textAlign: 'right' } : {}}
              >
                {h}
              </span>
            ))}
          </div>

          {visible.map((expense, i) => {
            const row = rows[expense.id] ?? {
              category: expense.category,
              confidence: null,
              saved: false,
              deleted: false,
            };
            const isEditing = editing === expense.id;
            const isSaving = saving === expense.id;
            const isDeleting = deleting === expense.id;
            const isConfirming = confirmDelete === expense.id;
            const isLowConf = row.confidence === 'low';

            return (
              <div
                key={expense.id}
                className={`grid px-5 py-3 items-center anim-slide-left anim-d${Math.min(i + 1, 6)}`}
                style={{
                  gridTemplateColumns: '72px 1fr 1fr 96px 32px',
                  gap: '0.75rem',
                  borderBottom: '1px solid var(--dark-700)',
                  transition: 'background 0.18s ease',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <span className="text-xs text-slate-500 tabular-nums">
                  {formatDate(expense.expense_date)}
                </span>

                <span className="relative">
                  {isEditing ? (
                    <select
                      autoFocus
                      className="input px-2 py-0.5 text-[10px] font-bold rounded-full"
                      style={{ appearance: 'none', colorScheme: 'dark', minWidth: '120px' }}
                      defaultValue={row.category}
                      onChange={e => handleCategoryChange(expense, e.target.value)}
                      onBlur={() => setEditing(null)}
                    >
                      {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                  ) : (
                    <button
                      title={isLowConf ? 'Categoria incerta — clicca per correggere' : 'Cambia categoria'}
                      onClick={() => setEditing(expense.id)}
                      className="flex items-center gap-1 cursor-pointer"
                    >
                      {isSaving ? (
                        <Loader2 size={12} className="text-slate-500 animate-spin" />
                      ) : row.saved ? (
                        <Check size={12} className="text-emerald-400" />
                      ) : null}
                      <span
                        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold transition-opacity hover:opacity-80"
                        style={{
                          background: CATEGORY_COLORS[row.category] ?? '#f3f4f6',
                          color: CATEGORY_TEXT[row.category] ?? '#374151',
                        }}
                      >
                        {categoryLabel(row.category)}
                        {isLowConf && (
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                        )}
                      </span>
                    </button>
                  )}
                </span>

                <span className="text-xs text-slate-400 truncate">
                  {expense.description ?? '—'}
                </span>

                <span className="text-xs font-semibold text-slate-200 text-right tabular-nums">
                  {fmt(Number(expense.amount))}
                </span>

                <span className="flex items-center justify-center">
                  {isDeleting ? (
                    <Loader2 size={13} className="text-slate-500 animate-spin" />
                  ) : isConfirming ? (
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleDelete(expense.id)}
                        className="w-5 h-5 flex items-center justify-center rounded text-red-400 hover:text-red-300 transition-colors"
                        title="Conferma elimina"
                      >
                        <Check size={11} />
                      </button>
                      <button
                        onClick={() => setConfirmDelete(null)}
                        className="w-5 h-5 flex items-center justify-center rounded text-slate-500 hover:text-slate-300 transition-colors"
                        title="Annulla"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDelete(expense.id)}
                      className="w-6 h-6 flex items-center justify-center rounded transition-colors hover:text-red-400"
                      style={{ color: '#334155' }}
                      title="Elimina spesa"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </span>
              </div>
            );
          })}

          <div
            className="grid px-5 py-3.5"
            style={{ gridTemplateColumns: '72px 1fr 1fr 96px 32px', gap: '0.75rem', borderTop: '1px solid var(--dark-600)' }}
          >
            <span
              className="col-span-3 text-[10px] font-semibold uppercase tracking-widest"
              style={{ color: 'var(--brand-400)' }}
            >
              Totale
            </span>
            <span className="text-sm font-bold text-slate-100 text-right tabular-nums">
              {fmt(total)}
            </span>
            <span />
          </div>
        </>
      )}
    </div>
  );
}
