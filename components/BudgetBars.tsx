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

  function catMeta(value: string): { icon: string; label: string } {
    const builtin = CATEGORIES.find(c => c.value === value);
    if (builtin) return { icon: builtin.icon, label: builtin.label };
    const custom = userCategories.find(c => c.value === value);
    if (custom) return { icon: custom.icon, label: custom.label };
    return { icon: '📦', label: value };
  }

  return (
    <div className="card p-5 flex flex-col gap-3">
      <p className="text-xs font-semibold" style={{ color: 'var(--text-1)' }}>Budget del mese</p>

      {budgets.length === 0 ? (
        <p className="text-[11px]" style={{ color: 'var(--text-3)' }}>
          Nessun budget impostato.{' '}
          <a href="/settings" style={{ color: 'var(--brand-light)' }}>Impostali in Impostazioni →</a>
        </p>
      ) : (
        budgets.map(b => {
          const actual = byCategory[b.category] ?? 0;
          const pct = Math.min((actual / b.amount) * 100, 100);
          const barColor = pct < 75 ? 'var(--brand)' : pct < 100 ? 'var(--warning)' : 'var(--expense)';
          const { icon, label } = catMeta(b.category);
          return (
            <div key={b.category} className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <span className="text-sm w-5 text-center shrink-0">{icon}</span>
                <span className="flex-1 text-[13px]" style={{ color: 'var(--text-1)' }}>{label}</span>
                <span className="text-[12px] tabular-nums" style={{ color: 'var(--text-2)' }}>
                  {fmt(actual)}
                </span>
                <span className="text-[11px]" style={{ color: 'var(--text-3)' }}>/ {fmt(b.amount)}</span>
              </div>
              <div style={{ height: '4px', borderRadius: '9999px', background: 'var(--surface-2)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, borderRadius: '9999px', background: barColor, transition: 'width 0.4s ease' }} />
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
