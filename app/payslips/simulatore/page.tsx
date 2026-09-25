import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabaseServer';
import Sidebar from '@/components/Sidebar';
import IrpefSimulatorClient from '@/components/IrpefSimulatorClient';
import type { Payslip } from '@/lib/types';

export default async function SimulatorePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: rawPayslips } = await supabase
    .from('payslips')
    .select('gross_amount, period_month')
    .eq('user_id', user.id)
    .order('period_month', { ascending: true });

  const payslips = (rawPayslips ?? []) as Pick<Payslip, 'gross_amount' | 'period_month'>[];

  const avgMonthlyGross = payslips.length > 0
    ? payslips.reduce((s, p) => s + Number(p.gross_amount), 0) / payslips.length
    : 0;
  const estimatedAnnualGross = Math.round(avgMonthlyGross * 13);

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--dark-900)' }}>
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center gap-3 px-6 py-3.5 sticky top-0 z-10"
          style={{ background: 'var(--dark-800)', borderBottom: '1px solid var(--dark-600)' }}>
          <Link href="/payslips"
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors">
            <ArrowLeft size={14} /> Buste paga
          </Link>
          <span className="text-slate-700">/</span>
          <span className="text-sm font-semibold text-slate-300">Simulatore IRPEF</span>
        </header>

        <main className="flex-1 px-6 py-6 flex flex-col gap-5 max-w-3xl w-full">
          <IrpefSimulatorClient
            currentGrossAnnual={estimatedAnnualGross}
            hasPayslipData={payslips.length > 0}
          />
        </main>
      </div>
    </div>
  );
}
