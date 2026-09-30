import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { createClient } from '@/lib/supabaseServer';
import Sidebar from '@/components/Sidebar';
import HeaderUser from '@/components/HeaderUser';
import ExpenseForm from '@/components/ExpenseForm';
import AnimatedExpenseList from '@/components/AnimatedExpenseList';
import DateRangeFilter from '@/components/DateRangeFilter';

function parseMonthParam(param: string | undefined): { year: number; month: number } {
  if (param && /^\d{4}-\d{2}$/.test(param)) {
    const [y, m] = param.split('-').map(Number);
    return { year: y, month: m - 1 };
  }
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() };
}

function monthHref(year: number, month: number): string {
  return `/spese?month=${year}-${String(month + 1).padStart(2, '0')}`;
}

export default async function SpesePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; from?: string; to?: string }>;
}) {
  const { month: monthParam, from: fromParam, to: toParam } = await searchParams;

  const hasRange = fromParam && toParam && /^\d{4}-\d{2}-\d{2}$/.test(fromParam) && /^\d{4}-\d{2}-\d{2}$/.test(toParam);
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
  const prevDate = new Date(year, month - 1);
  const nextDate = new Date(year, month + 1);
  const monthLabel = hasRange
    ? `${fromParam} → ${toParam}`
    : new Date(year, month).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });

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
              <h2 className="text-sm font-semibold text-slate-200">Spese</h2>
              <p className="text-[10px] text-slate-600 capitalize">{monthLabel}</p>
            </div>
            {!hasRange && (
              <div className="flex items-center gap-1">
                <Link
                  href={monthHref(prevDate.getFullYear(), prevDate.getMonth())}
                  className="flex items-center justify-center w-7 h-7 rounded-lg transition-colors hover:text-slate-200"
                  style={{ color: '#475569', border: '1px solid var(--dark-600)' }}
                  title="Mese precedente"
                >
                  <ChevronLeft size={14} />
                </Link>
                {!isCurrentMonth && (
                  <Link
                    href="/spese"
                    className="px-2 py-0.5 rounded text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
                    title="Torna al mese corrente"
                  >
                    Oggi
                  </Link>
                )}
                <Link
                  href={monthHref(nextDate.getFullYear(), nextDate.getMonth())}
                  className="flex items-center justify-center w-7 h-7 rounded-lg transition-colors hover:text-slate-200"
                  style={{
                    color: isCurrentMonth ? '#1e293b' : '#475569',
                    border: '1px solid var(--dark-600)',
                    pointerEvents: isCurrentMonth ? 'none' : 'auto',
                  }}
                  title="Mese successivo"
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
          <DateRangeFilter from={hasRange ? fromParam : undefined} to={hasRange ? toParam : undefined} />
          <div className="card p-5 anim-slide-up">
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-4" style={{ color: 'var(--text-3)' }}>
              Aggiungi spesa
            </p>
            <ExpenseForm userCategories={userCategories} />
          </div>
          <AnimatedExpenseList
            expenses={list}
            monthLabel={monthLabel}
            hasHousehold={hasHousehold}
            userCategories={userCategories}
          />
        </main>
      </div>
    </div>
  );
}
