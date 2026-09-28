import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { createClient } from '@/lib/supabaseServer';
import { syncDriveForUser } from '@/lib/drive-sync';
import Sidebar from '@/components/Sidebar';
import LogoutButton from '@/components/LogoutButton';
import ExpenseForm from '@/components/ExpenseForm';
import AnimatedExpenseList from '@/components/AnimatedExpenseList';
import DashboardStats from '@/components/DashboardStats';
import DriveSyncBanner from '@/components/DriveSyncBanner';
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
  return `/dashboard?month=${year}-${String(month + 1).padStart(2, '0')}`;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; from?: string; to?: string }>;
}) {
  const { month: monthParam, from: fromParam, to: toParam } = await searchParams;

  // Se presenti from/to, usa range personalizzato; altrimenti mese corrente
  const hasRange = fromParam && toParam && /^\d{4}-\d{2}-\d{2}$/.test(fromParam) && /^\d{4}-\d{2}-\d{2}$/.test(toParam);
  const { year, month } = parseMonthParam(monthParam);

  const firstDay = hasRange ? fromParam : new Date(year, month, 1).toISOString().split('T')[0];
  const lastDay  = hasRange ? toParam  : new Date(year, month + 1, 0).toISOString().split('T')[0];

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  await supabase
    .from('profiles')
    .upsert({ id: user.id }, { onConflict: 'id', ignoreDuplicates: true });

  // Sync automatico da Drive (incrementale, solo file nuovi)
  const driveSync = await syncDriveForUser().catch(() => null);

  const { data: expenses } = await supabase
    .from('expenses')
    .select('id, amount, currency, category, category_confidence, description, expense_date, source, is_income')
    .gte('expense_date', firstDay)
    .lte('expense_date', lastDay)
    .order('expense_date', { ascending: false })
    .order('created_at', { ascending: false });

  const list = expenses ?? [];
  // Solo uscite per il totale spese
  const totalMonth = list
    .filter(e => !e.is_income)
    .reduce((sum, e) => sum + Number(e.amount), 0);

  // Nucleo familiare — per abilitare il toggle di condivisione spese
  const { data: profile } = await supabase
    .from('profiles')
    .select('household_id')
    .eq('id', user.id)
    .single();
  const hasHousehold = Boolean(profile?.household_id);

  // Netto del mese corrente da buste paga (per "Entrate")
  const { data: payslipThisMonth } = await supabase
    .from('payslips')
    .select('net_amount')
    .eq('user_id', user.id)
    .eq('period_month', `${year}-${String(month + 1).padStart(2, '0')}-01`)
    .maybeSingle();

  // Entrate: busta paga + accrediti da CSV
  const csvIncome = list
    .filter(e => e.is_income)
    .reduce((sum, e) => sum + Number(e.amount), 0);
  const incomeMonth = Number(payslipThisMonth?.net_amount ?? 0) + csvIncome;

  // Spese mese precedente (per trend %)
  const prevFirst = new Date(year, month - 1, 1).toISOString().split('T')[0];
  const prevLast  = new Date(year, month, 0).toISOString().split('T')[0];
  const { data: prevExpenses } = await supabase
    .from('expenses')
    .select('amount, is_income')
    .eq('user_id', user.id)
    .gte('expense_date', prevFirst)
    .lte('expense_date', prevLast);
  const prevTotalMonth = (prevExpenses ?? [])
    .filter(e => !e.is_income)
    .reduce((s, e) => s + Number(e.amount), 0);

  // Spese giornaliere per sparkline (solo uscite)
  const dailyMap: Record<string, number> = {};
  for (const e of list) {
    if (!e.is_income) {
      dailyMap[e.expense_date] = (dailyMap[e.expense_date] ?? 0) + Number(e.amount);
    }
  }
  const dailyExpenses = Object.entries(dailyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, total]) => ({ date, total }));

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
              <h2 className="text-sm font-semibold text-slate-200">Dashboard</h2>
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
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-slate-600 hidden sm:block">{user.email}</span>
            <LogoutButton />
          </div>
        </header>

        <main className="flex-1 px-6 py-6 flex flex-col gap-5 max-w-3xl w-full">
          {driveSync && !driveSync.skipped && driveSync.imported > 0 && (
            <DriveSyncBanner imported={driveSync.imported} files={driveSync.files} recategorized={driveSync.recategorized} />
          )}
          <DateRangeFilter from={hasRange ? fromParam : undefined} to={hasRange ? toParam : undefined} />
          <DashboardStats
            totalMonth={totalMonth}
            incomeMonth={incomeMonth}
            prevTotalMonth={prevTotalMonth}
            count={list.filter(e => !e.is_income).length}
            monthLabel={monthLabel}
            dailyExpenses={dailyExpenses}
          />
          <div className="card p-5 anim-slide-up anim-d3">
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-4"
              style={{ color: 'var(--text-3)' }}>Aggiungi spesa</p>
            <ExpenseForm />
          </div>
          <AnimatedExpenseList expenses={list} monthLabel={monthLabel} hasHousehold={hasHousehold} />
        </main>
      </div>
    </div>
  );
}
