import Link from 'next/link';
import { CATEGORIES } from '@/lib/categories';

interface Budget { category: string; amount: number }
interface Expense { category: string; amount: number; is_income: boolean }
interface UserCat { value: string; label: string; icon: string; color: string }
interface Props {
  budgets: Budget[];
  expenses: Expense[];
  userCategories: UserCat[];
}

const fmt = (n: number) =>
  new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);

export default function BudgetBars({ budgets, expenses, userCategories }: Props) {
  const byCategory: Record<string, number> = {};
  for (const e of expenses) {
    if (!e.is_income) {
      byCategory[e.category] = (byCategory[e.category] ?? 0) + Number(e.amount);
    }
  }

  const entries = Object.entries(byCategory).sort(([, a], [, b]) => b - a);
  if (entries.length === 0) return null;

  const maxSpent = entries[0][1];

  function catMeta(value: string): { icon: string; label: string } {
    const builtin = CATEGORIES.find(c => c.value === value);
    if (builtin) return { icon: builtin.icon, label: builtin.label };
    const custom = userCategories.find(c => c.value === value);
    if (custom) return { icon: custom.icon, label: custom.label };
    return { icon: '📦', label: value };
  }

  return (
    <div className="card p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold" style={{ color: 'var(--text-1)' }}>Spese per categoria</p>
        <Link
          href="/profile?tab=budget"
          className="text-[11px] font-medium transition-colors"
          style={{ color: 'var(--brand-light)' }}
        >
          Gestisci budget →
        </Link>
      </div>

      <div className="flex flex-col gap-3">
        {entries.map(([cat, actual]) => {
          const budget = budgets.find(b => b.category === cat);
          const { icon, label } = catMeta(cat);

          let barWidth: number;
          let barColor: string;

          if (budget) {
            const pct = (actual / budget.amount) * 100;
            barWidth = Math.min(pct, 100);
            barColor = pct < 75 ? 'var(--brand)' : pct < 100 ? 'var(--warning)' : 'var(--expense)';
          } else {
            barWidth = (actual / maxSpent) * 100;
            barColor = 'var(--brand)';
          }

          return (
            <div key={cat} className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <span className="text-sm w-5 text-center shrink-0">{icon}</span>
                <span className="flex-1 text-[13px]" style={{ color: 'var(--text-1)' }}>{label}</span>
                <span className="text-[12px] tabular-nums font-medium" style={{ color: 'var(--text-2)' }}>
                  {fmt(actual)}
                </span>
                {budget ? (
                  <span className="text-[11px]" style={{ color: 'var(--text-3)' }}>/ {fmt(budget.amount)}</span>
                ) : (
                  <Link
                    href="/profile?tab=budget"
                    className="text-[10px] px-1.5 py-0.5 rounded-md transition-colors"
                    style={{ color: 'var(--text-3)', border: '1px solid var(--border)' }}
                  >
                    + budget
                  </Link>
                )}
              </div>
              <div style={{ height: '4px', borderRadius: '9999px', background: 'var(--surface-2)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${barWidth}%`, borderRadius: '9999px', background: barColor, transition: 'width 0.4s ease' }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
