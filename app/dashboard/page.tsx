import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { createClient } from '@/lib/supabaseServer';
import Sidebar from '@/components/Sidebar';
import LogoutButton from '@/components/LogoutButton';
import ExpenseForm from '@/components/ExpenseForm';
import AnimatedExpenseList from '@/components/AnimatedExpenseList';
import DashboardStats from '@/components/DashboardStats';

function parseMonthParam(param: string | undefined): { year: number; month: number } {
  if (param && /^\d{4}-\d{2}$/.test(param)) {
    const [y, m] = param.split('-').map(Number);
    return { year: y, month: m - 1 };
  }
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() };
}

function monthHref(year: number, month: number): string {
  return `/dashboard?month=${year}-${String(month + 1).padStart(2, '0')}`;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month: monthParam } = await searchParams;
  const { year, month } = parseMonthParam(monthParam);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  await supabase
    .from('profiles')
    .upsert({ id: user.id }, { onConflict: 'id', ignoreDuplicates: true });

  const firstDay = new Date(year, month, 1).toISOString().split('T')[0];
  const lastDay  = new Date(year, month + 1, 0).toISOString().split('T')[0];

  const { data: expenses } = await supabase
    .from('expenses')
    .select('id, amount, currency, category, category_confidence, description, expense_date, source')
    .gte('expense_date', firstDay)
    .lte('expense_date', lastDay)
    .order('expense_date', { ascending: false })
    .order('created_at', { ascending: false });

  const list = expenses ?? [];
  const totalMonth = list.reduce((sum, e) => sum + Number(e.amount), 0);

  // Netto del mese corrente da buste paga (per "Entrate")
  const { data: payslipThisMonth } = await supabase
    .from('payslips')
    .select('net_amount')
    .eq('user_id', user.id)
    .eq('period_month', `${year}-${String(month + 1).padStart(2, '0')}-01`)
    .maybeSingle();

  const incomeMonth = Number(payslipThisMonth?.net_amount ?? 0);

  // Spese mese precedente (per trend %)
  const prevFirst = new Date(year, month - 1, 1).toISOString().split('T')[0];
  const prevLast  = new Date(year, month, 0).toISOString().split('T')[0];
  const { data: prevExpenses } = await supabase
    .from('expenses')
    .select('amount')
    .eq('user_id', user.id)
    .gte('expense_date', prevFirst)
    .lte('expense_date', prevLast);
  const prevTotalMonth = (prevExpenses ?? []).reduce((s, e) => s + Number(e.amount), 0);

  // Spese giornaliere per sparkline
  const dailyMap: Record<string, number> = {};
  for (const e of list) {
    dailyMap[e.expense_date] = (dailyMap[e.expense_date] ?? 0) + Number(e.amount);
  }
  const dailyExpenses = Object.entries(dailyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, total]) => ({ date, total }));

  const now = new Date();
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();
  const prevDate = new Date(year, month - 1);
  const nextDate = new Date(year, month + 1);
  const monthLabel = new Date(year, month).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });

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
              <h2 className="text-sm font-semibold text-slate-200">Dashboard</h2>
              <p className="text-[10px] text-slate-600 capitalize">{monthLabel}</p>
            </div>
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
                  href="/dashboard"
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
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-slate-600 hidden sm:block">{user.email}</span>
            <LogoutButton />
          </div>
        </header>

        <main className="flex-1 px-6 py-6 flex flex-col gap-5 max-w-3xl w-full">
          <DashboardStats
            totalMonth={totalMonth}
            incomeMonth={incomeMonth}
            prevTotalMonth={prevTotalMonth}
            count={list.length}
            monthLabel={monthLabel}
            dailyExpenses={dailyExpenses}
          />
          <div className="card p-5 anim-slide-up anim-d3">
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-4"
              style={{ color: 'var(--text-3)' }}>Aggiungi spesa</p>
            <ExpenseForm />
          </div>
          <AnimatedExpenseList expenses={list} monthLabel={monthLabel} />
        </main>
      </div>
    </div>
  );
}
