import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabaseServer';
import NucleoHeader from '@/components/NucleoHeader';
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

  const emailInitial = (user.email?.[0] ?? '?').toUpperCase();

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <NucleoHeader
        userInitial={emailInitial}
        activeNav="payslips"
        backHref="/payslips"
        backLabel="Buste paga"
        pageTitle="Simulatore IRPEF"
      />
      <main style={{ maxWidth: '42rem', margin: '0 auto', padding: '0 1.5rem 4rem' }}>
        <div style={{ paddingTop: '2rem' }}>
          <IrpefSimulatorClient
            currentGrossAnnual={estimatedAnnualGross}
            hasPayslipData={payslips.length > 0}
          />
        </div>
      </main>
    </div>
  );
}
