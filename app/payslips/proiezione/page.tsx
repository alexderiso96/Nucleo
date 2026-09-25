import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabaseServer';
import NucleoHeader from '@/components/NucleoHeader';
import TfrProjectionClient from '@/components/TfrProjectionClient';
import { sortPayslips } from '@/lib/payslip-analytics';
import type { Payslip } from '@/lib/types';

export default async function ProiezionePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: rawPayslips } = await supabase
    .from('payslips')
    .select('tfr_total_accrued, tfr_accrued_this_period, period_month')
    .eq('user_id', user.id)
    .order('period_month', { ascending: true });

  const payslips = (rawPayslips ?? []) as Pick<
    Payslip,
    'tfr_total_accrued' | 'tfr_accrued_this_period' | 'period_month'
  >[];
  const sorted = sortPayslips(payslips as Payslip[]);

  const latest = sorted.at(-1);
  const currentTfr = Number(latest?.tfr_total_accrued ?? 0);

  const withAccrual = sorted.filter(p => Number(p.tfr_accrued_this_period) > 0);
  const monthlyAccrual =
    withAccrual.length > 0
      ? withAccrual.reduce((s, p) => s + Number(p.tfr_accrued_this_period), 0) / withAccrual.length
      : 0;

  const emailInitial = (user.email?.[0] ?? '?').toUpperCase();

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <NucleoHeader
        userInitial={emailInitial}
        activeNav="payslips"
        backHref="/payslips"
        backLabel="Buste paga"
        pageTitle="Proiezione TFR"
      />
      <main style={{ maxWidth: '42rem', margin: '0 auto', padding: '0 1.5rem 4rem' }}>
        {sorted.length === 0 ? (
          <div style={{ paddingTop: '3rem', textAlign: 'center', color: 'var(--text-2)', fontSize: '0.875rem' }}>
            Nessuna busta paga caricata.
          </div>
        ) : (
          <div style={{ paddingTop: '2rem' }}>
            <TfrProjectionClient
              currentTfr={currentTfr}
              monthlyAccrual={monthlyAccrual}
              dataMonths={sorted.length}
            />
          </div>
        )}
      </main>
    </div>
  );
}
