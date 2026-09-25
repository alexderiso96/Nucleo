import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { createClient } from '@/lib/supabaseServer';
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

  const { data: payslipThisMonth } = await supabase
    .from('payslips')
    .select('net_amount')
    .eq('user_id', user.id)
    .eq('period_month', `${year}-${String(month + 1).padStart(2, '0')}-01`)
    .maybeSingle();

  const incomeMonth = Number(payslipThisMonth?.net_amount ?? 0);

  const prevFirst = new Date(year, month - 1, 1).toISOString().split('T')[0];
  const prevLast  = new Date(year, month, 0).toISOString().split('T')[0];
  const { data: prevExpenses } = await supabase
    .from('expenses')
    .select('amount')
    .eq('user_id', user.id)
    .gte('expense_date', prevFirst)
    .lte('expense_date', prevLast);
  const prevTotalMonth = (prevExpenses ?? []).reduce((s, e) => s + Number(e.amount), 0);

  const now = new Date();
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();
  const prevDate = new Date(year, month - 1);
  const nextDate = new Date(year, month + 1);
  const monthLabel = new Date(year, month).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });

  const emailInitial = (user.email ?? '?')[0].toUpperCase();

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>

      {/* ── Header sticky ── */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 20,
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div
          style={{
            maxWidth: '42rem',
            margin: '0 auto',
            padding: '0 1.5rem',
            height: '3.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
          }}
        >
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
            <div
              style={{
                width: '1.375rem',
                height: '1.375rem',
                borderRadius: '0.25rem',
                background: 'var(--accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.625rem',
                fontWeight: 700,
                color: '#0e1512',
              }}
            >
              N
            </div>
            <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-1)' }}>
              Nucleo
            </span>
          </div>

          {/* Selettore mese — centro */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
            }}
          >
            <Link
              href={monthHref(prevDate.getFullYear(), prevDate.getMonth())}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '1.75rem',
                height: '1.75rem',
                borderRadius: '0.25rem',
                color: 'var(--text-3)',
                textDecoration: 'none',
                transition: 'color 0.15s ease',
              }}
              title="Mese precedente"
            >
              <ChevronLeft size={14} />
            </Link>

            <span
              style={{
                fontSize: '0.8125rem',
                fontWeight: 500,
                color: 'var(--text-2)',
                minWidth: '7rem',
                textAlign: 'center',
                textTransform: 'capitalize',
              }}
            >
              {monthLabel}
            </span>

            <Link
              href={isCurrentMonth ? '#' : monthHref(nextDate.getFullYear(), nextDate.getMonth())}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '1.75rem',
                height: '1.75rem',
                borderRadius: '0.25rem',
                color: isCurrentMonth ? 'var(--border)' : 'var(--text-3)',
                textDecoration: 'none',
                pointerEvents: isCurrentMonth ? 'none' : 'auto',
                transition: 'color 0.15s ease',
              }}
              title="Mese successivo"
            >
              <ChevronRight size={14} />
            </Link>
          </div>

          {/* Account */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              flexShrink: 0,
            }}
          >
            <div
              title={user.email}
              style={{
                width: '1.625rem',
                height: '1.625rem',
                borderRadius: '50%',
                background: 'var(--border)',
                border: '1px solid var(--border-strong)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.6875rem',
                fontWeight: 600,
                color: 'var(--text-2)',
              }}
            >
              {emailInitial}
            </div>
            <LogoutButton />
          </div>
        </div>

        {/* Barra di navigazione */}
        <nav
          style={{
            maxWidth: '42rem',
            margin: '0 auto',
            padding: '0 1.5rem',
            height: '2.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
            borderTop: '1px solid var(--border)',
          }}
        >
          {[
            { href: '/dashboard', label: 'Dashboard', active: true },
            { href: '/import',    label: 'Importa',   active: false },
            { href: '/payslips',  label: 'Buste paga', active: false },
          ].map(item => (
            <Link
              key={item.href}
              href={item.href}
              style={{
                fontSize: '0.75rem',
                fontWeight: item.active ? 600 : 400,
                color: item.active ? 'var(--accent)' : 'var(--text-3)',
                padding: '0.25rem 0.5rem',
                textDecoration: 'none',
                borderBottom: item.active ? '1px solid var(--accent)' : '1px solid transparent',
                marginBottom: '-1px',
                transition: 'color 0.15s ease',
              }}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      {/* ── Contenuto principale ── */}
      <main
        style={{
          maxWidth: '42rem',
          margin: '0 auto',
          padding: '0 1.5rem 4rem',
        }}
      >
        {/* Hero */}
        <DashboardStats
          totalMonth={totalMonth}
          incomeMonth={incomeMonth}
          prevTotalMonth={prevTotalMonth}
          count={list.length}
          monthLabel={monthLabel}
          dailyExpenses={[]}
        />

        <div className="divider" />

        {/* Form nuova spesa */}
        <div style={{ padding: '1.75rem 0' }}>
          <p
            style={{
              fontSize: '0.6875rem',
              fontWeight: 500,
              color: 'var(--text-3)',
              marginBottom: '1rem',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}
          >
            Nuova spesa
          </p>
          <ExpenseForm />
        </div>

        <div className="divider" />

        {/* Lista transazioni */}
        <div style={{ paddingTop: '1.75rem' }}>
          <AnimatedExpenseList expenses={list} monthLabel={monthLabel} />
        </div>
      </main>
    </div>
  );
}
