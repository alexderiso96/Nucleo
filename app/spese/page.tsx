import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { createClient } from '@/lib/supabaseServer';
import Sidebar from '@/components/Sidebar';
import HeaderUser from '@/components/HeaderUser';
import ExpenseForm from '@/components/ExpenseForm';
import AnimatedExpenseList from '@/components/AnimatedExpenseList';
import CategoryExpenseView from '@/components/CategoryExpenseView';

function parseMonthParam(param: string | undefined): { year: number; month: number } {
  if (param && /^\d{4}-\d{2}$/.test(param)) {
    const [y, m] = param.split('-').map(Number);
    return { year: y, month: m - 1 };
  }
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() };
}

function monthHref(year: number, month: number, extra?: string): string {
  const base = `/spese?month=${year}-${String(month + 1).padStart(2, '0')}`;
  return extra ? `${base}&${extra}` : base;
}

export default async function SpesePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; from?: string; to?: string; view?: string }>;
}) {
  const { month: monthParam, from: fromParam, to: toParam, view } = await searchParams;

  const hasRange = fromParam && toParam &&
    /^\d{4}-\d{2}-\d{2}$/.test(fromParam) &&
    /^\d{4}-\d{2}-\d{2}$/.test(toParam);

  const { year, month } = parseMonthParam(monthParam);
  const firstDay = hasRange ? fromParam : new Date(year, month, 1).toISOString().split('T')[0];
  const lastDay  = hasRange ? toParam  : new Date(year, month + 1, 0).toISOString().split('T')[0];

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: expenses } = await supabase
    .from('expenses')
    .select('id, amount, currency, category, category_confidence, description, expense_date, source, is_income, notes')
    .gte('expense_date', firstDay)
    .lte('expense_date', lastDay)
    .order('expense_date', { ascending: false })
    .order('created_at', { ascending: false });

  const [{ data: profile }, { data: userCatsData }] = await Promise.all([
    supabase.from('profiles').select('household_id, full_name, username').eq('id', user.id).single(),
    supabase.from('user_categories').select('value, label, icon, color').eq('user_id', user.id),
  ]);

  const list = expenses ?? [];
  const hasHousehold = Boolean(profile?.household_id);
  const userCategories = (userCatsData ?? []) as { value: string; label: string; icon: string; color: string }[];

  const now = new Date();
  const isCurrentMonth = !hasRange && year === now.getFullYear() && month === now.getMonth();
  const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
  const prevDate = new Date(year, month - 1);
  const nextDate = new Date(year, month + 1);
  const monthLabel = hasRange
    ? `${fromParam} → ${toParam}`
    : new Date(year, month).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });

  // ── Vista categoria (default) ─────────────────────────────────────
  if (!view || view !== 'data') {
    return (
      <div className="flex min-h-screen" style={{ background: 'var(--dark-900)' }}>
        <Sidebar />
        <CategoryExpenseView
          expenses={list}
          userCategories={userCategories}
          monthKey={monthKey}
          monthLabel={monthLabel}
          isCurrentMonth={isCurrentMonth}
        />
      </div>
    );
  }

  // ── Vista cronologica (?view=data) ───────────────────────────────
  return (
    <div className="flex min-h-screen" style={{ background: 'var(--dark-900)' }}>
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <header
          className="flex items-center justify-between px-6 py-3.5 sticky top-0 z-10"
          style={{ background: 'var(--dark-800)', borderBottom: '1px solid var(--dark-600)' }}
        >
          <div className="flex items-center gap-4">
            <div>
              <h2 className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>Spese</h2>
              <p className="text-[10px] capitalize" style={{ color: 'var(--text-3)' }}>{monthLabel}</p>
            </div>
            {!hasRange && (
              <div className="flex items-center gap-1">
                <Link
                  href={monthHref(prevDate.getFullYear(), prevDate.getMonth(), 'view=data')}
                  className="flex items-center justify-center w-7 h-7 rounded-lg transition-colors"
                  style={{ color: '#475569', border: '1px solid var(--dark-600)' }}
                >
                  <ChevronLeft size={14} />
                </Link>
                {!isCurrentMonth && (
                  <Link
                    href="/spese?view=data"
                    className="px-2 py-0.5 rounded text-[10px] transition-colors"
                    style={{ color: 'var(--text-3)' }}
                  >
                    Oggi
                  </Link>
                )}
                <Link
                  href={monthHref(nextDate.getFullYear(), nextDate.getMonth(), 'view=data')}
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
            )}
          </div>
          <HeaderUser
            username={profile?.username ?? null}
            fullName={profile?.full_name ?? null}
            email={user.email ?? ''}
          />
        </header>

        <main className="flex-1 px-6 py-6 flex flex-col gap-5 max-w-3xl w-full mx-auto">
          <div className="card p-5">
            <ExpenseForm userCategories={userCategories} />
          </div>
          <AnimatedExpenseList
            expenses={list}
            monthLabel={monthLabel}
            hasHousehold={hasHousehold}
            userCategories={userCategories}
          />
          <div className="flex justify-center py-2">
            <Link
              href={`/spese?month=${monthKey}`}
              className="text-[12px] hover:underline transition-colors"
              style={{ color: 'var(--text-3)' }}
            >
              Ordina per categoria invece che per data →
            </Link>
          </div>
        </main>
      </div>
    </div>
  );
}
