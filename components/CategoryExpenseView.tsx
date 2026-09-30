'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, ChevronDown, AlertTriangle, Plus, X } from 'lucide-react';
import ExpenseForm from '@/components/ExpenseForm';
import { catColor } from '@/lib/category-colors';
import { useCategories } from '@/lib/use-categories';

interface Expense {
  id: string;
  amount: number;
  category: string;
  category_confidence: string | null;
  description: string | null;
  expense_date: string;
  is_income: boolean;
  notes: string | null;
}

interface UserCat {
  value: string;
  label: string;
  icon: string;
  color: string;
}

interface Props {
  expenses: Expense[];
  userCategories: UserCat[];
  monthKey: string;
  monthLabel: string;
  isCurrentMonth: boolean;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);

const fmtDate = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });

const MAX_BAR_SEGS = 5;
const OTHERS_BAR_COLOR = '#475569';

export default function CategoryExpenseView({
  expenses,
  userCategories,
  monthKey,
  monthLabel,
  isCurrentMonth,
}: Props) {
  const { categories } = useCategories();

  const catGroups = useMemo(() => {
    const map = new Map<string, { items: Expense[]; total: number }>();
    for (const e of expenses) {
      if (e.is_income) continue;
      const cur = map.get(e.category) ?? { items: [], total: 0 };
      cur.items.push(e);
      cur.total += e.amount;
      map.set(e.category, cur);
    }
    return [...map.entries()]
      .map(([cat, { items, total }]) => ({ cat, items, total }))
      .sort((a, b) => b.total - a.total);
  }, [expenses]);

  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [expandedCats, setExpandedCats] = useState<Set<string>>(() =>
    catGroups[0] ? new Set([catGroups[0].cat]) : new Set()
  );

  const getCatLabel = (value: string): string => {
    return (
      userCategories.find(c => c.value === value)?.label ??
      categories.find(c => c.value === value)?.label ??
      value
    );
  };

  const grandTotal = catGroups.reduce((s, g) => s + g.total, 0);

  const barSegs = useMemo(() => {
    const top = catGroups.slice(0, MAX_BAR_SEGS);
    const rest = catGroups.slice(MAX_BAR_SEGS);
    const othersTotal = rest.reduce((s, g) => s + g.total, 0);
    const segs = top.map(g => ({ key: g.cat, color: catColor(g.cat), flex: g.total }));
    if (othersTotal > 0) segs.push({ key: '__altri', color: OTHERS_BAR_COLOR, flex: othersTotal });
    return segs;
  }, [catGroups]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return catGroups;
    return catGroups.filter(g =>
      getCatLabel(g.cat).toLowerCase().includes(q) || g.cat.toLowerCase().includes(q)
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catGroups, search, userCategories, categories]);

  const toggle = (cat: string) =>
    setExpandedCats(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });

  const [y, m] = monthKey.split('-').map(Number);
  const prevDate = new Date(y, m - 2);
  const nextDate = new Date(y, m);
  const prevHref = `/spese?month=${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
  const nextHref = `/spese?month=${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`;

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Sticky header */}
      <header
        className="flex items-center justify-between px-6 py-3.5 sticky top-0 z-10"
        style={{ background: 'var(--dark-800)', borderBottom: '1px solid var(--dark-600)' }}
      >
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>Spese</h2>
            <p className="text-[10px] capitalize" style={{ color: 'var(--text-3)' }}>
              {monthLabel}
              {grandTotal > 0 && <> · {fmt(grandTotal)}</>}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Link
              href={prevHref}
              className="flex items-center justify-center w-7 h-7 rounded-lg transition-colors"
              style={{ color: '#475569', border: '1px solid var(--dark-600)' }}
            >
              <ChevronLeft size={14} />
            </Link>
            {!isCurrentMonth && (
              <Link
                href="/spese"
                className="px-2 py-0.5 rounded text-[10px] transition-colors"
                style={{ color: 'var(--text-3)' }}
              >
                Oggi
              </Link>
            )}
            <Link
              href={nextHref}
              className="flex items-center justify-center w-7 h-7 rounded-lg transition-colors"
              style={{
                color: isCurrentMonth ? '#1e293b' : '#475569',
                border: '1px solid var(--dark-600)',
                pointerEvents: isCurrentMonth ? 'none' : 'auto',
              }}
            >
              <ChevronRight size={14} />
            </Link>
          </div>
        </div>

        <button
          onClick={() => setShowForm(f => !f)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors"
          style={{ border: '1px solid var(--brand)', color: 'var(--brand)' }}
        >
          {showForm ? <X size={13} /> : <Plus size={13} />}
          {showForm ? 'Chiudi' : 'Aggiungi'}
        </button>
      </header>

      {/* Collapsible form */}
      {showForm && (
        <div className="px-6 py-5" style={{ borderBottom: '1px solid var(--border)' }}>
          <ExpenseForm userCategories={userCategories} />
        </div>
      )}

      <main className="flex-1 flex flex-col max-w-3xl w-full mx-auto px-6 py-5">
        {/* Segmented bar */}
        {grandTotal > 0 && (
          <div className="flex overflow-hidden mb-5" style={{ height: 8, gap: 2, borderRadius: 9999 }}>
            {barSegs.map(seg => (
              <div
                key={seg.key}
                style={{ flex: seg.flex, background: seg.color, borderRadius: 9999 }}
              />
            ))}
          </div>
        )}

        {/* Search */}
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Filtra categorie..."
          className="w-full mb-4 px-3 py-2 rounded-lg text-[13px] outline-none"
          style={{
            background: 'var(--surface-1)',
            border: '1px solid var(--border)',
            color: 'var(--text-1)',
          }}
        />

        {/* Empty state */}
        {filtered.length === 0 && (
          <p className="text-center py-12 text-[13px]" style={{ color: 'var(--text-3)' }}>
            {search ? 'Nessuna categoria trovata.' : 'Nessuna spesa per questo mese.'}
          </p>
        )}

        {/* Category rows */}
        {filtered.map((g, i) => {
          const isExpanded = expandedCats.has(g.cat);
          const label = getCatLabel(g.cat);
          const color = catColor(g.cat);
          return (
            <div
              key={g.cat}
              style={{ borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : undefined }}
            >
              <button
                onClick={() => toggle(g.cat)}
                className="w-full flex items-center gap-3 py-3.5 text-left"
              >
                <span style={{ color, fontSize: 14, lineHeight: 1, flexShrink: 0 }}>●</span>
                <span className="flex-1 text-[13px] font-medium truncate" style={{ color: 'var(--text-1)' }}>
                  {label}
                </span>
                <span className="text-[11px] shrink-0" style={{ color: 'var(--text-3)' }}>
                  {g.items.length} {g.items.length === 1 ? 'spesa' : 'spese'}
                </span>
                <span className="text-[13px] tabular-nums font-medium ml-3 shrink-0" style={{ color: 'var(--text-1)' }}>
                  {fmt(g.total)}
                </span>
                {isExpanded
                  ? <ChevronDown size={14} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
                  : <ChevronRight size={14} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
                }
              </button>

              {isExpanded && (
                <div className="pb-1">
                  {g.items.map(e => (
                    <div key={e.id} className="flex items-center gap-3 py-2 pl-5">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[12px] truncate" style={{ color: 'var(--text-2)' }}>
                            {e.description ?? '—'}
                          </span>
                          {e.category_confidence === 'low' && (
                            <AlertTriangle size={11} style={{ color: 'var(--warning)', flexShrink: 0 }} />
                          )}
                        </div>
                        <span className="text-[10px]" style={{ color: 'var(--text-3)' }}>
                          {fmtDate(e.expense_date)}
                        </span>
                      </div>
                      <span className="text-[12px] tabular-nums shrink-0" style={{ color: 'var(--text-2)' }}>
                        {fmt(e.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Footer */}
        <div className="pt-8 pb-2 flex justify-center">
          <Link
            href={`/spese?view=data&month=${monthKey}`}
            className="text-[12px] transition-colors hover:underline"
            style={{ color: 'var(--text-3)' }}
          >
            Ordina per data invece che per categoria →
          </Link>
        </div>
      </main>
    </div>
  );
}
