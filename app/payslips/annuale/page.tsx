import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, AlertTriangle, CheckCircle } from 'lucide-react';
import { createClient } from '@/lib/supabaseServer';
import Sidebar from '@/components/Sidebar';
import AnnualeActions from '@/components/AnnualeActions';
import { buildAnnualSummary, monthName } from '@/lib/payslip-annual';
import type { Payslip } from '@/lib/types';

const fmt = (n: number) =>
  new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);

const MONTH_SHORT = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];

function YearSelector({ years, selected }: { years: number[]; selected: number }) {
  return (
    <div className="flex items-center gap-2 no-print">
      <label className="text-[10px] text-slate-500 uppercase tracking-widest">Anno</label>
      <select
        defaultValue={selected}
        onChange={e => { window.location.href = `/payslips/annuale?year=${e.target.value}`; }}
        className="input px-2 py-1 text-xs"
        style={{ appearance: 'none', colorScheme: 'dark' }}
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

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          body { background: white !important; color: black !important; }
          .card { background: white !important; border: 1px solid #e2e8f0 !important; box-shadow: none !important; }
        }
        .print-only { display: none; }
      `}</style>

      <div className="flex min-h-screen" style={{ background: 'var(--dark-900)' }}>
        <div className="no-print"><Sidebar /></div>
        <div className="flex-1 flex flex-col min-w-0">

          <header
            className="flex items-center justify-between px-6 py-3.5 sticky top-0 z-10 no-print"
            style={{ background: 'var(--dark-800)', borderBottom: '1px solid var(--dark-600)' }}
          >
            <div className="flex items-center gap-3">
              <Link
                href="/payslips"
                className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
              >
                <ArrowLeft size={14} /> Buste paga
              </Link>
              <span className="text-slate-700">/</span>
              <span className="text-sm font-semibold text-slate-300">Riepilogo annuale</span>
            </div>
            <div className="flex items-center gap-3">
              <YearSelector years={yearsWithData} selected={selectedYear} />
              {summary.payslips.length > 0 && <AnnualeActions summary={summary} />}
            </div>
          </header>

          {/* Intestazione stampa */}
          <div className="print-only px-6 pt-6 pb-2">
            <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>
              Riepilogo buste paga {selectedYear}
            </h1>
            <p style={{ fontSize: 12, color: '#64748b' }}>
              Generato il {new Date().toLocaleDateString('it-IT')}
            </p>
          </div>

          <main className="flex-1 px-6 py-6 flex flex-col gap-5 max-w-3xl w-full">

            {summary.payslips.length === 0 && (
              <div className="card p-12 flex flex-col items-center gap-4 anim-fade text-center">
                <p className="text-slate-500 text-sm">Nessuna busta paga per il {selectedYear}.</p>
                <Link href="/payslips/upload" className="btn-primary px-4 py-2.5 text-sm mt-2 no-print">
                  Carica busta paga
                </Link>
              </div>
            )}

            {summary.payslips.length > 0 && (
              <>
                {/* Alert mesi mancanti */}
                {!summary.isComplete && (
                  <div
                    className="rounded-xl px-4 py-3 flex items-start gap-3 anim-slide-up anim-d1"
                    style={{ background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.2)' }}
                  >
                    <AlertTriangle size={14} className="text-amber-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-amber-400 mb-1">
                        Totale parziale — mancano {summary.monthsMissing.length}{' '}
                        {summary.monthsMissing.length === 1 ? 'mese' : 'mesi'}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        Non caricati: {summary.monthsMissing.map(m => monthName(m)).join(', ')}
                      </p>
                    </div>
                  </div>
                )}

                {summary.isComplete && (
                  <div
                    className="rounded-xl px-4 py-3 flex items-center gap-2.5 anim-slide-up anim-d1"
                    style={{ background: 'rgba(52,211,153,0.07)', border: '1px solid rgba(52,211,153,0.18)' }}
                  >
                    <CheckCircle size={14} className="text-emerald-400" />
                    <p className="text-xs text-emerald-400">
                      Anno completo — {summary.monthsPresent.length} buste paga caricate.
                    </p>
                  </div>
                )}

                {/* Totali */}
                <div className="card p-5 anim-slide-up anim-d2">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-4">
                    Totali {selectedYear}
                    {!summary.isComplete && (
                      <span className="ml-2 text-amber-500 normal-case font-normal">(parziale)</span>
                    )}
                  </p>
                  <div className="grid grid-cols-2 gap-4 mb-5">
                    <div
                      className="rounded-xl p-4"
                      style={{ background: 'var(--dark-700)', border: '1px solid var(--dark-600)' }}
                    >
                      <p className="text-[10px] text-slate-600 mb-1">Totale lordo</p>
                      <p className="text-xl font-bold text-slate-100 tabular-nums">{fmt(summary.totalGross)}</p>
                    </div>
                    <div
                      className="rounded-xl p-4"
                      style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)' }}
                    >
                      <p className="text-[10px] text-slate-600 mb-1">Totale netto</p>
                      <p className="text-xl font-bold text-emerald-400 tabular-nums">{fmt(summary.totalNet)}</p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-0">
                    {[
                      { label: 'Totale IRPEF trattenuta', value: summary.totalIrpef, color: '#f87171' },
                      { label: 'Totale contributi INPS', value: summary.totalInps, color: '#fb923c' },
                      { label: 'Totale addizionali reg./com.', value: summary.totalRegionalMunicipalTax, color: '#facc15' },
                      { label: 'Totale straordinari', value: summary.totalOvertime, color: '#38bdf8' },
                      { label: 'Totale buoni pasto', value: summary.totalMealVouchers, color: '#38bdf8' },
                    ]
                      .filter(r => r.value > 0)
                      .map(row => (
                        <div
                          key={row.label}
                          className="flex items-center justify-between py-1.5"
                          style={{ borderBottom: '1px solid var(--dark-700)' }}
                        >
                          <span className="text-xs text-slate-400">{row.label}</span>
                          <span className="text-xs font-semibold tabular-nums" style={{ color: row.color }}>
                            {fmt(row.value)}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Dettaglio mensile */}
                <div className="card overflow-hidden anim-slide-up anim-d3">
                  <div className="px-5 py-3" style={{ borderBottom: '1px solid var(--dark-600)' }}>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                      Dettaglio mensile
                    </p>
                  </div>
                  <div
                    className="grid px-5 py-2 text-[10px] font-semibold uppercase tracking-widest text-slate-600"
                    style={{
                      gridTemplateColumns: '100px 1fr 1fr 1fr 1fr',
                      gap: '0.75rem',
                      borderBottom: '1px solid var(--dark-700)',
                    }}
                  >
                    <span>Mese</span>
                    <span className="text-right">Lordo</span>
                    <span className="text-right">Netto</span>
                    <span className="text-right">IRPEF</span>
                    <span className="text-right">INPS</span>
                  </div>

                  {summary.payslips.map(p => {
                    const monthIdx = parseInt(p.period_month.split('-')[1]) - 1;
                    return (
                      <div
                        key={p.id}
                        className="grid px-5 py-2.5"
                        style={{
                          gridTemplateColumns: '100px 1fr 1fr 1fr 1fr',
                          gap: '0.75rem',
                          borderBottom: '1px solid var(--dark-700)',
                        }}
                      >
                        <span className="text-xs text-slate-400">{MONTH_SHORT[monthIdx]}</span>
                        <span className="text-xs text-slate-300 text-right tabular-nums">
                          {fmt(Number(p.gross_amount))}
                        </span>
                        <span className="text-xs text-emerald-400 text-right tabular-nums">
                          {fmt(Number(p.net_amount))}
                        </span>
                        <span className="text-xs text-red-400 text-right tabular-nums">
                          {Number(p.irpef) > 0 ? fmt(Number(p.irpef)) : '—'}
                        </span>
                        <span className="text-xs text-orange-400 text-right tabular-nums">
                          {Number(p.inps_contributions) > 0 ? fmt(Number(p.inps_contributions)) : '—'}
                        </span>
                      </div>
                    );
                  })}

                  {summary.monthsMissing.map(m => (
                    <div
                      key={m}
                      className="grid px-5 py-2.5 opacity-30"
                      style={{
                        gridTemplateColumns: '100px 1fr 1fr 1fr 1fr',
                        gap: '0.75rem',
                        borderBottom: '1px solid var(--dark-700)',
                      }}
                    >
                      <span className="text-xs text-slate-600">{MONTH_SHORT[m - 1]}</span>
                      <span className="text-xs text-slate-700 text-right col-span-4">non caricata</span>
                    </div>
                  ))}

                  <div
                    className="grid px-5 py-3.5"
                    style={{
                      gridTemplateColumns: '100px 1fr 1fr 1fr 1fr',
                      gap: '0.75rem',
                      borderTop: '1px solid var(--dark-600)',
                      background: 'rgba(255,255,255,0.01)',
                    }}
                  >
                    <span
                      className="text-[10px] font-semibold uppercase tracking-widest"
                      style={{ color: 'var(--brand-400)' }}
                    >
                      Totale
                    </span>
                    <span className="text-sm font-bold text-slate-100 text-right tabular-nums">
                      {fmt(summary.totalGross)}
                    </span>
                    <span className="text-sm font-bold text-emerald-400 text-right tabular-nums">
                      {fmt(summary.totalNet)}
                    </span>
                    <span className="text-sm font-bold text-red-400 text-right tabular-nums">
                      {summary.totalIrpef > 0 ? fmt(summary.totalIrpef) : '—'}
                    </span>
                    <span className="text-sm font-bold text-orange-400 text-right tabular-nums">
                      {summary.totalInps > 0 ? fmt(summary.totalInps) : '—'}
                    </span>
                  </div>
                </div>

                <p className="print-only text-[10px] text-slate-700 mt-2" style={{ display: 'none' }}>
                  Documento generato da Nucleo — riepilogo a scopo informativo.
                  {!summary.isComplete &&
                    ` Dati parziali: mancano ${summary.monthsMissing.map(m => monthName(m)).join(', ')}.`}
                </p>
              </>
            )}
          </main>
        </div>
      </div>
    </>
  );
}
