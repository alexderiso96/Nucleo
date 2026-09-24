'use client';

import { CATEGORIES, CATEGORY_COLORS, CATEGORY_TEXT } from '@/lib/categories';

interface Expense {
  id: string;
  amount: number;
  currency: string;
  category: string;
  description: string | null;
  expense_date: string;
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
    new Date(y, m - 1, d)
  );
}

function categoryLabel(value: string): string {
  return CATEGORIES.find(c => c.value === value)?.label ?? value;
}

export default function AnimatedExpenseList({ expenses, monthLabel }: Props) {
  return (
    <div className="card anim-slide-up anim-d4 overflow-hidden">
      <div
        className="px-5 py-3.5 flex items-center justify-between"
        style={{ borderBottom: '1px solid var(--dark-600)' }}
      >
        <span className="text-xs font-semibold text-slate-400">Spese di {monthLabel}</span>
        <span className="text-[10px] text-slate-600 tabular-nums">{expenses.length} transazioni</span>
      </div>

      {expenses.length === 0 ? (
        <div className="px-5 py-10 text-center text-xs text-slate-600">
          Nessuna spesa registrata questo mese.
        </div>
      ) : (
        <>
          {/* Header colonne */}
          <div
            className="grid px-5 py-2"
            style={{
              gridTemplateColumns: '72px 1fr 1fr 96px',
              gap: '1rem',
              borderBottom: '1px solid var(--dark-700)',
            }}
          >
            {['Data', 'Categoria', 'Descrizione', 'Importo'].map((h, i) => (
              <span
                key={h}
                className="text-[10px] font-semibold uppercase tracking-widest text-slate-600"
                style={i === 3 ? { textAlign: 'right' } : {}}
              >
                {h}
              </span>
            ))}
          </div>

          {/* Righe */}
          {expenses.map((expense, i) => (
            <div
              key={expense.id}
              className={`grid px-5 py-3 items-center anim-slide-left anim-d${Math.min(i + 1, 6)}`}
              style={{
                gridTemplateColumns: '72px 1fr 1fr 96px',
                gap: '1rem',
                borderBottom: '1px solid var(--dark-700)',
                transition: 'background 0.18s ease',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <span className="text-xs text-slate-500 tabular-nums">
                {formatDate(expense.expense_date)}
              </span>

              <span>
                <span
                  className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold"
                  style={{
                    background: CATEGORY_COLORS[expense.category] ?? '#f3f4f6',
                    color: CATEGORY_TEXT[expense.category] ?? '#374151',
                  }}
                >
                  {categoryLabel(expense.category)}
                </span>
              </span>

              <span className="text-xs text-slate-400 truncate">
                {expense.description ?? '—'}
              </span>

              <span className="text-xs font-semibold text-slate-200 text-right tabular-nums">
                {fmt(Number(expense.amount))}
              </span>
            </div>
          ))}

          {/* Totale */}
          <div
            className="grid px-5 py-3.5"
            style={{ gridTemplateColumns: '72px 1fr 1fr 96px', gap: '1rem', borderTop: '1px solid var(--dark-600)' }}
          >
            <span
              className="col-span-3 text-[10px] font-semibold uppercase tracking-widest"
              style={{ color: 'var(--brand-400)' }}
            >
              Totale
            </span>
            <span className="text-sm font-bold text-slate-100 text-right tabular-nums">
              {fmt(expenses.reduce((s, e) => s + Number(e.amount), 0))}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
