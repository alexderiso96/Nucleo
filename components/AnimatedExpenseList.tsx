'use client';

import { useState, useRef } from 'react';
import { Check, Trash2, X, Loader2 } from 'lucide-react';
import { CATEGORIES } from '@/lib/categories';

interface Expense {
  id: string;
  amount: number;
  currency: string;
  category: string;
  category_confidence?: string | null;
  description: string | null;
  expense_date: string;
  source?: string | null;
  is_shared?: boolean;
}

interface Props {
  expenses: Expense[];
  monthLabel: string;
  /** Se true mostra il toggle condivisione per ogni spesa */
  hasHousehold?: boolean;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);

function categoryIcon(value: string): string {
  return CATEGORIES.find(c => c.value === value)?.icon ?? '📦';
}

function categoryLabel(value: string): string {
  return CATEGORIES.find(c => c.value === value)?.label ?? value;
}

function categoryDarkBg(value: string): string {
  return CATEGORIES.find(c => c.value === value)?.darkBg ?? 'rgba(100,116,139,0.14)';
}

function categoryDarkText(value: string): string {
  return CATEGORIES.find(c => c.value === value)?.darkText ?? '#64748b';
}

interface DayGroup {
  dateKey: string;
  label: string;
  dayTotal: number;
  items: Expense[];
}

function buildGroups(expenses: Expense[]): DayGroup[] {
  const todayStr = new Date().toISOString().split('T')[0];
  const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  const map = new Map<string, Expense[]>();
  for (const e of expenses) {
    if (!map.has(e.expense_date)) map.set(e.expense_date, []);
    map.get(e.expense_date)!.push(e);
  }

  return [...map.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, items]) => {
      let label: string;
      if (key === todayStr) label = 'Oggi';
      else if (key === yesterdayStr) label = 'Ieri';
      else {
        const [y, m, d] = key.split('-').map(Number);
        label = new Date(y, m - 1, d).toLocaleDateString('it-IT', {
          weekday: 'short', day: 'numeric', month: 'short',
        });
      }
      return {
        dateKey: key,
        label,
        dayTotal: items.reduce((s, e) => s + Number(e.amount), 0),
        items,
      };
    });
}

interface RowState {
  category: string;
  confidence: string | null;
  saved: boolean;
  deleted: boolean;
  shared: boolean;
  sharingLoading: boolean;
}

export default function AnimatedExpenseList({ expenses, monthLabel, hasHousehold = false }: Props) {
  const [rows, setRows] = useState<Record<string, RowState>>(() => {
    const init: Record<string, RowState> = {};
    for (const e of expenses) {
      init[e.id] = {
        category: e.category,
        confidence: e.category_confidence ?? null,
        saved: false,
        deleted: false,
        shared: e.is_shared ?? false,
        sharingLoading: false,
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

  async function handleToggleShare(expense: Expense) {
    const current = rows[expense.id]?.shared ?? false;
    setRows(prev => ({ ...prev, [expense.id]: { ...prev[expense.id], sharingLoading: true } }));
    try {
      const res = await fetch(`/api/expenses/${expense.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_shared: !current }),
      });
      if (res.ok) {
        setRows(prev => ({
          ...prev,
          [expense.id]: { ...prev[expense.id], shared: !current, sharingLoading: false },
        }));
      } else {
        setRows(prev => ({ ...prev, [expense.id]: { ...prev[expense.id], sharingLoading: false } }));
      }
    } catch {
      setRows(prev => ({ ...prev, [expense.id]: { ...prev[expense.id], sharingLoading: false } }));
    }
  }

  const notDeleted = expenses.filter(e => !rows[e.id]?.deleted);

  const visible = notDeleted.filter(e =>
    categoryFilter === 'all' || (rows[e.id]?.category ?? e.category) === categoryFilter,
  );

  const groups = buildGroups(visible);
  const total = visible.reduce((s, e) => s + Number(e.amount), 0);

  const usedCategories = CATEGORIES.filter(c =>
    notDeleted.some(e => (rows[e.id]?.category ?? e.category) === c.value),
  );

  return (
    <div className="card anim-slide-up anim-d4 overflow-hidden">

      {/* Header + filtri */}
      <div className="px-4 py-3 flex flex-col gap-2.5" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold" style={{ color: 'var(--text-2)' }}>
            Spese di {monthLabel}
          </span>
          <span className="text-[11px] tabular-nums" style={{ color: 'var(--text-3)' }}>
            {visible.length} di {notDeleted.length}
          </span>
        </div>

        {/* Pill filter bar */}
        <div
          className="flex gap-1.5 overflow-x-auto pb-0.5"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          <button
            onClick={() => setCategoryFilter('all')}
            className="shrink-0 px-3 py-1 rounded-full text-[11px] font-semibold transition-all"
            style={
              categoryFilter === 'all'
                ? { background: 'var(--brand)', color: '#fff' }
                : { background: 'var(--surface-2)', color: 'var(--text-2)', border: '1px solid var(--border-strong)' }
            }
          >
            Tutte
          </button>

          {usedCategories.map(cat => {
            const active = categoryFilter === cat.value;
            return (
              <button
                key={cat.value}
                onClick={() => setCategoryFilter(active ? 'all' : cat.value)}
                className="shrink-0 flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-semibold transition-all"
                style={
                  active
                    ? { background: cat.darkBg, color: cat.darkText, border: `1px solid ${cat.darkText}40` }
                    : { background: 'var(--surface-2)', color: 'var(--text-2)', border: '1px solid var(--border-strong)' }
                }
              >
                <span style={{ fontSize: '0.7rem' }}>{cat.icon}</span>
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Lista */}
      {visible.length === 0 ? (
        <div className="px-5 py-12 text-center text-sm" style={{ color: 'var(--text-3)' }}>
          {notDeleted.length === 0
            ? 'Nessuna spesa questo mese.'
            : 'Nessuna spesa per questa categoria.'}
        </div>
      ) : (
        <>
          {groups.map(group => (
            <div key={group.dateKey}>
              {/* Intestazione giorno */}
              <div
                className="flex items-center justify-between px-4 py-2"
                style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}
              >
                <span
                  className="text-[11px] font-semibold capitalize"
                  style={{ color: 'var(--text-2)' }}
                >
                  {group.label}
                </span>
                <span className="text-[11px] tabular-nums" style={{ color: 'var(--text-3)' }}>
                  {fmt(group.dayTotal)}
                </span>
              </div>

              {/* Righe */}
              {group.items.map(expense => {
                const row = rows[expense.id] ?? {
                  category: expense.category,
                  confidence: null,
                  saved: false,
                  deleted: false,
                  shared: expense.is_shared ?? false,
                  sharingLoading: false,
                };
                const isSaving = saving === expense.id;
                const isDeleting = deleting === expense.id;
                const isConfirming = confirmDelete === expense.id;
                const isEditing = editing === expense.id;
                const isLowConf = row.confidence === 'low';
                const catBg = categoryDarkBg(row.category);
                const catText = categoryDarkText(row.category);
                const label = categoryLabel(row.category);
                const icon = categoryIcon(row.category);

                return (
                  <div
                    key={expense.id}
                    className="flex items-center gap-3 px-4 py-3 group transition-colors"
                    style={{ borderBottom: '1px solid var(--border)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    {/* Icona categoria */}
                    <div
                      className="flex items-center justify-center w-8 h-8 rounded-xl shrink-0 text-base"
                      style={{ background: catBg }}
                    >
                      {icon}
                    </div>

                    {/* Testo */}
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-sm truncate"
                        style={{ color: 'var(--text-1)' }}
                        title={expense.description ?? label}
                      >
                        {expense.description ?? (
                          <span style={{ color: 'var(--text-3)' }}>{label}</span>
                        )}
                      </p>

                      {/* Badge categoria */}
                      {isEditing ? (
                        <select
                          autoFocus
                          className="input text-[10px] px-2 py-0.5 rounded-full mt-0.5"
                          style={{ appearance: 'none', colorScheme: 'dark', minWidth: 120 }}
                          defaultValue={row.category}
                          onChange={e => handleCategoryChange(expense, e.target.value)}
                          onBlur={() => setEditing(null)}
                        >
                          {CATEGORIES.map(c => (
                            <option key={c.value} value={c.value}>{c.icon} {c.label}</option>
                          ))}
                        </select>
                      ) : (
                        <button
                          onClick={() => setEditing(expense.id)}
                          title={isLowConf ? 'Categoria incerta — clicca per correggere' : 'Cambia categoria'}
                          className="flex items-center gap-1 mt-0.5"
                        >
                          {isSaving ? (
                            <Loader2 size={10} className="animate-spin" style={{ color: 'var(--text-3)' }} />
                          ) : row.saved ? (
                            <Check size={10} style={{ color: 'var(--income)' }} />
                          ) : null}

                          <span
                            className="badge text-[10px]"
                            style={
                              isLowConf
                                ? {
                                    background: 'rgba(251,191,36,0.12)',
                                    color: 'var(--warning)',
                                    border: '1px solid rgba(251,191,36,0.25)',
                                  }
                                : { background: catBg, color: catText }
                            }
                          >
                            {isLowConf && (
                              <span
                                className="w-1.5 h-1.5 rounded-full inline-block"
                                style={{ background: 'var(--warning)' }}
                              />
                            )}
                            {label}
                          </span>
                        </button>
                      )}
                    </div>

                    {/* Importo */}
                    <span
                      className="text-sm font-semibold tabular-nums shrink-0"
                      style={{ color: 'var(--expense)' }}
                    >
                      {fmt(Number(expense.amount))}
                    </span>

                    {/* Condividi (solo se nel nucleo) */}
                    {hasHousehold && (
                      <button
                        onClick={() => handleToggleShare(expense)}
                        disabled={row.sharingLoading}
                        title={row.shared ? 'Condivisa col partner — clicca per rendere privata' : 'Condividi col partner'}
                        className="w-6 h-6 flex items-center justify-center rounded-md transition-all shrink-0"
                        style={{
                          fontSize: '0.7rem',
                          opacity: row.sharingLoading ? 0.5 : 1,
                          background: row.shared ? 'rgba(16,185,129,0.12)' : 'transparent',
                          border: row.shared ? '1px solid rgba(16,185,129,0.3)' : '1px solid transparent',
                          color: row.shared ? 'var(--income)' : 'var(--text-3)',
                        }}
                      >
                        {row.sharingLoading
                          ? <Loader2 size={11} className="animate-spin" />
                          : row.shared ? '⇌' : '⇌'}
                      </button>
                    )}

                    {/* Delete */}
                    <div className="w-7 flex items-center justify-center shrink-0">
                      {isDeleting ? (
                        <Loader2 size={13} className="animate-spin" style={{ color: 'var(--text-3)' }} />
                      ) : isConfirming ? (
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleDelete(expense.id)}
                            className="w-5 h-5 flex items-center justify-center rounded transition-colors"
                            style={{ color: 'var(--expense)' }}
                            title="Conferma"
                          >
                            <Check size={11} />
                          </button>
                          <button
                            onClick={() => setConfirmDelete(null)}
                            className="w-5 h-5 flex items-center justify-center rounded transition-colors"
                            style={{ color: 'var(--text-3)' }}
                            title="Annulla"
                          >
                            <X size={11} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDelete(expense.id)}
                          className="w-6 h-6 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 transition-opacity"
                          style={{ color: 'var(--text-3)' }}
                          title="Elimina spesa"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}

          {/* Totale */}
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ borderTop: '1px solid var(--border-strong)', background: 'var(--surface-2)' }}
          >
            <span
              className="text-[11px] font-semibold uppercase tracking-widest"
              style={{ color: 'var(--text-3)' }}
            >
              Totale {monthLabel}
            </span>
            <span className="text-base font-bold tabular-nums" style={{ color: 'var(--text-1)' }}>
              {fmt(total)}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
