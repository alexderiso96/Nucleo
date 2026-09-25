import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabaseServer';
import Sidebar from '@/components/Sidebar';
import LogoutButton from '@/components/LogoutButton';
import ExpenseForm from '@/components/ExpenseForm';
import AnimatedStats from '@/components/AnimatedStats';
import AnimatedExpenseList from '@/components/AnimatedExpenseList';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  await supabase
    .from('profiles')
    .upsert({ id: user.id }, { onConflict: 'id', ignoreDuplicates: true });

  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const lastDay  = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

  const { data: expenses } = await supabase
    .from('expenses')
    .select('id, amount, currency, category, category_confidence, description, expense_date')
    .gte('expense_date', firstDay)
    .lte('expense_date', lastDay)
    .order('expense_date', { ascending: false })
    .order('created_at', { ascending: false });

  const list = expenses ?? [];
  const totalMonth = list.reduce((sum, e) => sum + Number(e.amount), 0);
  const monthLabel = now.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--dark-900)' }}>
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header
          className="flex items-center justify-between px-6 py-3.5 sticky top-0 z-10"
          style={{ background: 'var(--dark-800)', borderBottom: '1px solid var(--dark-600)' }}
        >
          <div>
            <h2 className="text-sm font-semibold text-slate-200">Dashboard</h2>
            <p className="text-[10px] text-slate-600 capitalize">{monthLabel}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-slate-600 hidden sm:block">{user.email}</span>
            <LogoutButton />
          </div>
        </header>

        {/* Contenuto */}
        <main className="flex-1 px-6 py-6 flex flex-col gap-5 max-w-3xl w-full">
          <AnimatedStats totalMonth={totalMonth} count={list.length} monthLabel={monthLabel} />

          {/* Form */}
          <div className="card p-5 anim-slide-up anim-d3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-4">
              Nuova spesa
            </p>
            <ExpenseForm />
          </div>

          <AnimatedExpenseList expenses={list} monthLabel={monthLabel} />
        </main>
      </div>
    </div>
  );
}
