'use client';

import { useState } from 'react';
import { Trash2, Check, X, Loader2, AlertTriangle } from 'lucide-react';
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
}

interface Props {
  expenses: Expense[];
  monthLabel: string;
}

interface DayGroup {
  dateKey: string;
  label: string;
  dayTotal: number;
  items: Expense[];
}

const CATEGORY_DOTS: Record<string, string> = {
  alimentari:      '#6FA287',
  ristoranti:      '#C9A227',
  trasporti:       '#5B8BB0',
  casa:            '#B07E59',
  salute:          '#C1666B',
  sport:           '#4BA09A',
  abbigliamento:   '#9485C8',
  intrattenimento: '#BE7A9A',
  utenze:          '#7A9090',
  altro:           '#5A6B67',
};

const fmt = (n: number) =>
  new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);

function getCategoryDot(category: string): string {
  return CATEGORY_DOTS[category] ?? '#5A6B67';
}

function getCategoryLabel(category: string): string {
  return CATEGORIES.find(c => c.value === category)?.label ?? category;
}

function buildGroups(expenses: Expense[]): DayGroup[] {
  const map = new Map<string, Expense[]>();
  for (const e of expenses) {
    if (!map.has(e.expense_date)) map.set(e.expense_date, []);
    map.get(e.expense_date)!.push(e);
  }
  return [...map.entries()].map(([key, items]) => {
    const [y, m, d] = key.split('-').map(Number);
    const label = new Date(y, m - 1, d).toLocaleDateString('it-IT', {
      weekday: 'long', day: 'numeric', month: 'long',
    });
    return {
      dateKey: key,
      label,
      dayTotal: items.reduce((s, e) => s + Number(e.amount), 0),
      items,
    };
  });
}

export default function AnimatedExpenseList({ expenses, monthLabel }: Props) {
  const [deleted, setDeleted] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);

  async function handleDelete(id: string) {
    setDeleting(id);
    setConfirmDelete(null);
    try {
      await fetch(`/api/expenses/${id}`, { method: 'DELETE' });
      setDeleted(prev => new Set([...prev, id]));
    } catch { /* ignore */ } finally {
      setDeleting(null);
    }
  }

  const visible = expenses.filter(e => !deleted.has(e.id));
  const groups = buildGroups(visible);

  if (visible.length === 0) {
    return (
      <div style={{ paddingTop: '2rem', paddingBottom: '2rem' }}>
        <p style={{
          color: 'var(--text-3)', fontSize: '0.875rem',
          borderTop: '1px solid var(--border)', paddingTop: '1.5rem',
        }}>
          Nessuna transazione in {monthLabel}.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Header sezione */}
      <div style={{
        borderTop: '1px solid var(--border)',
        paddingTop: '1.5rem',
        paddingBottom: '1rem',
      }}>
        <span style={{ color: 'var(--text-3)', fontSize: '0.8125rem' }}>
          {visible.length} {visible.length === 1 ? 'transazione' : 'transazioni'} in {monthLabel}
        </span>
      </div>

      {/* Gruppi per giorno */}
      {groups.map(group => (
        <div key={group.dateKey} style={{ marginBottom: '2rem' }}>

          {/* Intestazione giorno */}
          <div style={{
            display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
            paddingBottom: '0.5rem',
            borderBottom: '1px solid var(--border)',
          }}>
            <span style={{
              color: 'var(--text-2)', fontSize: '0.8125rem', fontWeight: 500,
              textTransform: 'capitalize',
            }}>
              {group.label}
            </span>
            <span className="tabular-nums" style={{ color: 'var(--text-3)', fontSize: '0.8125rem' }}>
              −{fmt(group.dayTotal)}
            </span>
          </div>

          {/* Righe */}
          {group.items.map(expense => {
            const isDeleting = deleting === expense.id;
            const isConfirming = confirmDelete === expense.id;
            const isHovered = hoveredRow === expense.id;
            const isLowConf = expense.category_confidence === 'low';
            const dot = getCategoryDot(expense.category);
            const catLabel = getCategoryLabel(expense.category);

            return (
              <div
                key={expense.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  padding: '0.625rem 0',
                  borderBottom: '1px solid var(--border)',
                  opacity: isDeleting ? 0.4 : 1,
                  transition: 'opacity 0.2s ease',
                }}
                onMouseEnter={() => setHoveredRow(expense.id)}
                onMouseLeave={() => setHoveredRow(null)}
              >
                {/* Pallino categoria */}
                <span style={{
                  display: 'inline-block', width: 8, height: 8,
                  borderRadius: '50%', background: dot, flexShrink: 0,
                }} />

                {/* Descrizione + categoria */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', minWidth: 0 }}>
                    <span style={{
                      color: 'var(--text-1)', fontSize: '0.9375rem',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {expense.description ?? catLabel}
                    </span>
                    {isLowConf && (
                      <span title="Categoria incerta" style={{ lineHeight: 1, flexShrink: 0, display: 'inline-flex' }}>
                        <AlertTriangle size={11} style={{ color: 'var(--accent)' }} />
                      </span>
                    )}
                  </div>
                  {expense.description && (
                    <div style={{ color: 'var(--text-3)', fontSize: '0.75rem', marginTop: '0.1rem' }}>
                      {catLabel}
                    </div>
                  )}
                </div>

                {/* Importo */}
                <span
                  className="tabular-nums"
                  style={{ color: 'var(--negative)', fontSize: '0.9375rem', fontWeight: 500, flexShrink: 0 }}
                >
                  −{fmt(Number(expense.amount))}
                </span>

                {/* Azioni delete */}
                <div style={{ width: '3.5rem', display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
                  {isDeleting ? (
                    <Loader2 size={13} className="animate-spin" style={{ color: 'var(--text-3)' }} />
                  ) : isConfirming ? (
                    <div style={{ display: 'flex', gap: '0.35rem' }}>
                      <button
                        onClick={() => handleDelete(expense.id)}
                        title="Conferma"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--negative)', padding: 0, lineHeight: 1 }}
                      >
                        <Check size={13} />
                      </button>
                      <button
                        onClick={() => setConfirmDelete(null)}
                        title="Annulla"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 0, lineHeight: 1 }}
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ) : isHovered ? (
                    <button
                      onClick={() => setConfirmDelete(expense.id)}
                      title="Elimina"
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--text-3)', padding: 0, lineHeight: 1,
                        transition: 'color 0.15s ease',
                      }}
                      onMouseEnter={e => { (e.currentTarget).style.color = 'var(--negative)'; }}
                      onMouseLeave={e => { (e.currentTarget).style.color = 'var(--text-3)'; }}
                    >
                      <Trash2 size={13} />
                    </button>
                  ) : (
                    <div style={{ width: 13 }} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
