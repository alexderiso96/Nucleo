import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabaseServer';
import NucleoHeader from '@/components/NucleoHeader';
import AnnualeActions from '@/components/AnnualeActions';
import { buildAnnualSummary, monthName } from '@/lib/payslip-annual';
import type { Payslip } from '@/lib/types';

const fmt = (n: number) =>
  new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);

const MONTH_SHORT = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];

function YearSelector({ years, selected }: { years: number[]; selected: number }) {
  return (
    <div className="flex items-center gap-2 no-print">
      <label style={{ fontSize: '0.6875rem', color: 'var(--text-3)' }}>Anno</label>
      <select
        defaultValue={selected}
        onChange={e => { window.location.href = `/payslips/annuale?year=${e.target.value}`; }}
        className="input px-2 py-1 text-xs"
        style={{ appearance: 'none', colorScheme: 'dark', fontSize: '0.8125rem', borderRadius: '0.25rem' }}
      >
        {years.map(y => <option key={y} value={y}>{y}</option>)}
      </select>
    </div>
  );
}

export default async function AnnualePage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const { year: yearParam } = await searchParams;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: rawPayslips } = await supabase
    .from('payslips')
    .select('*')
    .eq('user_id', user.id)
    .order('period_month', { ascending: true });

  const payslips = (rawPayslips ?? []) as Payslip[];

  const currentYear = new Date().getFullYear();
  const yearsSet = new Set(payslips.map(p => parseInt(p.period_month.split('-')[0])));
  yearsSet.add(currentYear);
  const yearsWithData = [...yearsSet].sort((a, b) => b - a);

  const selectedYear =
    yearParam && /^\d{4}$/.test(yearParam)
      ? parseInt(yearParam)
      : (yearsWithData[0] ?? currentYear);

  const summary = buildAnnualSummary(payslips, selectedYear);
  const emailInitial = (user.email?.[0] ?? '?').toUpperCase();

  const rightSlot = (
    <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
      <YearSelector years={yearsWithData} selected={selectedYear} />
      {summary.payslips.length > 0 && <AnnualeActions summary={summary} />}
    </div>
  );

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          body { background: white !important; color: black !important; }
        }
        .print-only { display: none; }
      `}</style>

      <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
        <div className="no-print">
          <NucleoHeader
            userInitial={emailInitial}
            activeNav="payslips"
            backHref="/payslips"
            backLabel="Buste paga"
            pageTitle="Riepilogo annuale"
            rightSlot={rightSlot}
          />
        </div>

        {/* Intestazione stampa */}
        <div className="print-only" style={{ padding: '1.5rem 1.5rem 0.5rem' }}>
          <p style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '0.25rem' }}>
            Riepilogo buste paga {selectedYear}
          </p>
          <p style={{ fontSize: '0.75rem', color: '#64748b' }}>
            Generato il {new Date().toLocaleDateString('it-IT')}
          </p>
        </div>

        <main style={{ maxWidth: '42rem', margin: '0 auto', padding: '0 1.5rem 4rem' }}>

          {summary.payslips.length === 0 && (
            <div style={{ paddingTop: '3rem', textAlign: 'center' }}>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-2)', marginBottom: '1rem' }}>
                Nessuna busta paga per il {selectedYear}.
              </p>
              <Link
                href="/payslips/upload"
                className="no-print"
                style={{
                  fontSize: '0.875rem',
                  color: 'var(--accent)',
                  border: '1px solid var(--accent)',
                  borderRadius: '0.25rem',
                  padding: '0.5rem 1.25rem',
                  textDecoration: 'none',
                }}
              >
                Carica busta paga
              </Link>
            </div>
          )}

          {summary.payslips.length > 0 && (
            <>
              <div style={{ paddingTop: '2rem' }}>
                {/* Alert mesi mancanti */}
                {!summary.isComplete && (
                  <p style={{ fontSize: '0.8125rem', color: 'var(--accent)', marginBottom: '1.5rem' }}>
                    ⚠ Totale parziale — mancano {summary.monthsMissing.length}{' '}
                    {summary.monthsMissing.length === 1 ? 'mese' : 'mesi'}
                    {': '}
                    {summary.monthsMissing.map(m => monthName(m)).join(', ')}
                  </p>
                )}
                {summary.isComplete && (
                  <p style={{ fontSize: '0.8125rem', color: 'var(--positive)', marginBottom: '1.5rem' }}>
                    ✓ Anno completo — {summary.monthsPresent.length} buste paga caricate.
                  </p>
                )}
              </div>

              {/* Totali hero */}
              <div style={{ display: 'flex', gap: '2.5rem', marginBottom: '1.5rem' }}>
                <div>
                  <p style={{ fontSize: '0.6875rem', color: 'var(--text-3)', marginBottom: '0.25rem' }}>
                    Totale lordo {!summary.isComplete && <span style={{ color: 'var(--accent)' }}>(parziale)</span>}
                  </p>
                  <p className="tabular-nums" style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-1)' }}>
                    {fmt(summary.totalGross)}
                  </p>
                </div>
                <div>
                  <p style={{ fontSize: '0.6875rem', color: 'var(--text-3)', marginBottom: '0.25rem' }}>Totale netto</p>
                  <p className="tabular-nums" style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--positive)' }}>
                    {fmt(summary.totalNet)}
                  </p>
                </div>
              </div>

              {/* Dettagli totali */}
              {[
                { label: 'Totale IRPEF trattenuta',      value: summary.totalIrpef,               color: 'var(--negative)' },
                { label: 'Totale contributi INPS',       value: summary.totalInps,                color: 'var(--negative)' },
                { label: 'Totale addizionali reg./com.', value: summary.totalRegionalMunicipalTax, color: 'var(--negative)' },
                { label: 'Totale straordinari',          value: summary.totalOvertime,            color: 'var(--positive)' },
                { label: 'Totale buoni pasto',           value: summary.totalMealVouchers,        color: 'var(--positive)' },
              ]
                .filter(r => r.value > 0)
                .map(row => (
                  <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-2)' }}>{row.label}</span>
                    <span className="tabular-nums" style={{ fontSize: '0.875rem', color: row.color, fontWeight: 500 }}>
                      {fmt(row.value)}
                    </span>
                  </div>
                ))}

              {/* Dettaglio mensile */}
              <section style={{ paddingTop: '2rem' }}>
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginBottom: '1rem' }}>
                    Dettaglio mensile
                  </p>

                  {/* Header colonne */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '80px 1fr 1fr 1fr 1fr',
                    gap: '0.5rem',
                    paddingBottom: '0.5rem',
                    borderBottom: '1px solid var(--border)',
                  }}>
                    {['Mese','Lordo','Netto','IRPEF','INPS'].map((h, i) => (
                      <span key={h} style={{ fontSize: '0.6875rem', color: 'var(--text-3)', textAlign: i > 0 ? 'right' : 'left' }}>
                        {h}
                      </span>
                    ))}
                  </div>

                  {summary.payslips.map(p => {
                    const monthIdx = parseInt(p.period_month.split('-')[1]) - 1;
                    return (
                      <div
                        key={p.id}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '80px 1fr 1fr 1fr 1fr',
                          gap: '0.5rem',
                          padding: '0.5rem 0',
                          borderBottom: '1px solid var(--border)',
                        }}
                      >
                        <span style={{ fontSize: '0.8125rem', color: 'var(--text-2)' }}>{MONTH_SHORT[monthIdx]}</span>
                        <span className="tabular-nums" style={{ fontSize: '0.8125rem', color: 'var(--text-1)', textAlign: 'right' }}>
                          {fmt(Number(p.gross_amount))}
                        </span>
                        <span className="tabular-nums" style={{ fontSize: '0.8125rem', color: 'var(--positive)', textAlign: 'right' }}>
                          {fmt(Number(p.net_amount))}
                        </span>
                        <span className="tabular-nums" style={{ fontSize: '0.8125rem', color: 'var(--negative)', textAlign: 'right' }}>
                          {Number(p.irpef) > 0 ? fmt(Number(p.irpef)) : '—'}
                        </span>
                        <span className="tabular-nums" style={{ fontSize: '0.8125rem', color: 'var(--negative)', textAlign: 'right' }}>
                          {Number(p.inps_contributions) > 0 ? fmt(Number(p.inps_contributions)) : '—'}
                        </span>
                      </div>
                    );
                  })}

                  {summary.monthsMissing.map(m => (
                    <div
                      key={m}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '80px 1fr 1fr 1fr 1fr',
                        gap: '0.5rem',
                        padding: '0.5rem 0',
                        borderBottom: '1px solid var(--border)',
                        opacity: 0.35,
                      }}
                    >
                      <span style={{ fontSize: '0.8125rem', color: 'var(--text-3)' }}>{MONTH_SHORT[m - 1]}</span>
                      <span style={{ fontSize: '0.8125rem', color: 'var(--text-3)', textAlign: 'right', gridColumn: '2 / -1' }}>
                        non caricata
                      </span>
                    </div>
                  ))}

                  {/* Totale */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '80px 1fr 1fr 1fr 1fr',
                    gap: '0.5rem',
                    padding: '0.625rem 0',
                  }}>
                    <span style={{ fontSize: '0.6875rem', color: 'var(--accent)', fontWeight: 600 }}>Totale</span>
                    <span className="tabular-nums" style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-1)', textAlign: 'right' }}>
                      {fmt(summary.totalGross)}
                    </span>
                    <span className="tabular-nums" style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--positive)', textAlign: 'right' }}>
                      {fmt(summary.totalNet)}
                    </span>
                    <span className="tabular-nums" style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--negative)', textAlign: 'right' }}>
                      {summary.totalIrpef > 0 ? fmt(summary.totalIrpef) : '—'}
                    </span>
                    <span className="tabular-nums" style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--negative)', textAlign: 'right' }}>
                      {summary.totalInps > 0 ? fmt(summary.totalInps) : '—'}
                    </span>
                  </div>
                </div>
              </section>

              <p className="print-only" style={{ display: 'none', marginTop: '1rem', fontSize: '0.6875rem', color: '#64748b' }}>
                Documento generato da Nucleo — riepilogo a scopo informativo.
                {!summary.isComplete && ` Dati parziali: mancano ${summary.monthsMissing.map(m => monthName(m)).join(', ')}.`}
              </p>
            </>
          )}
        </main>
      </div>
    </>
  );
}
