import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ChevronLeft, ChevronRight, Plus, TrendingUp, TrendingDown } from 'lucide-react';
import { createClient } from '@/lib/supabaseServer';
import Sidebar from '@/components/Sidebar';
import PayslipTrendChart from '@/components/PayslipTrendChart';
import { sortPayslips, buildTrendPoints, computeVariation } from '@/lib/payslip-analytics';
import { detectPatterns } from '@/lib/payslip-patterns';
import type { PatternResult } from '@/lib/payslip-patterns';
import type { Payslip } from '@/lib/types';

const MONTH_FULL = [
  'Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
  'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre',
];

const fmt = (n: number | null | undefined) =>
  n != null
    ? new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(Number(n))
    : '—';

function periodLabel(p: Payslip): string {
  const parts = p.period_month.split('-');
  return `${MONTH_FULL[parseInt(parts[1]) - 1]} ${parts[0]}`;
}

function monthKey(p: Payslip): string {
  return p.period_month.substring(0, 7);
}

function parseMonthParam(param: string | undefined, payslips: Payslip[]): string | null {
  if (param && /^\d{4}-\d{2}$/.test(param)) {
    if (payslips.find(p => monthKey(p) === param)) return param;
  }
  if (payslips.length === 0) return null;
  return monthKey(payslips[payslips.length - 1]);
}

export default async function PayslipsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month: monthParam } = await searchParams;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: rawPayslips } = await supabase
    .from('payslips')
    .select('*')
    .eq('user_id', user.id)
    .order('period_month', { ascending: true });

  const payslips = (rawPayslips ?? []) as Payslip[];
  const sorted = sortPayslips(payslips);
  const selectedMonth = parseMonthParam(monthParam, sorted);

  const current = selectedMonth ? (sorted.find(p => monthKey(p) === selectedMonth) ?? null) : null;
  const currentIdx = current ? sorted.indexOf(current) : -1;
  const previous = currentIdx > 0 ? sorted[currentIdx - 1] : null;
  const hasPrev = currentIdx > 0;
  const hasNext = currentIdx >= 0 && currentIdx < sorted.length - 1;
  const prevMonth = hasPrev ? monthKey(sorted[currentIdx - 1]) : null;
  const nextMonth = hasNext ? monthKey(sorted[currentIdx + 1]) : null;

  const trendData = buildTrendPoints(sorted);
  const showTrend = trendData.length >= 2;
  const patterns = detectPatterns(sorted);

  const variation = current && previous ? computeVariation(current, previous) : null;
  const showAlert = variation && variation.percent > 5;

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--dark-900)' }}>
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">

        <header className="flex items-center justify-between px-6 py-3.5 sticky top-0 z-10"
          style={{ background: 'var(--dark-800)', borderBottom: '1px solid var(--dark-600)' }}>
          <div className="flex items-center gap-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-200">Buste paga</h2>
              {current && (
                <p className="text-[10px] text-slate-600">{periodLabel(current)}</p>
              )}
            </div>
            {sorted.length > 1 && (
              <div className="flex items-center gap-1">
                <Link
                  href={hasPrev ? `/payslips?month=${prevMonth}` : '#'}
                  className="flex items-center justify-center w-7 h-7 rounded-lg transition-colors"
                  style={{
                    color: hasPrev ? '#475569' : '#1e293b',
                    border: '1px solid var(--dark-600)',
                    pointerEvents: hasPrev ? 'auto' : 'none',
                  }}
                  title="Mese precedente">
                  <ChevronLeft size={14} />
                </Link>
                <Link
                  href={hasNext ? `/payslips?month=${nextMonth}` : '#'}
                  className="flex items-center justify-center w-7 h-7 rounded-lg transition-colors"
                  style={{
                    color: hasNext ? '#475569' : '#1e293b',
                    border: '1px solid var(--dark-600)',
                    pointerEvents: hasNext ? 'auto' : 'none',
                  }}
                  title="Mese successivo">
                  <ChevronRight size={14} />
                </Link>
              </div>
            )}
          </div>
          <Link href="/payslips/upload"
            className="btn-primary flex items-center gap-1.5 px-3 py-2 text-xs">
            <Plus size={13} /> Aggiungi
          </Link>
        </header>

        <main className="flex-1 px-6 py-6 flex flex-col gap-5 max-w-3xl w-full mx-auto">

          {/* Empty state */}
          {sorted.length === 0 && (
            <div className="card p-12 flex flex-col items-center gap-4 anim-fade text-center">
              <p className="text-slate-500 text-sm">Nessuna busta paga caricata.</p>
              <p className="text-slate-600 text-xs max-w-xs">
                Carica il PDF della tua prima busta paga per vedere l&apos;analisi completa.
              </p>
              <Link href="/payslips/upload" className="btn-primary px-4 py-2.5 text-sm mt-2">
                Carica busta paga
              </Link>
            </div>
          )}

          {current && (
            <>
              {/* Alert variazione >5% */}
              {showAlert && variation && (
                <div className="rounded-xl px-4 py-3 flex items-start gap-3 anim-slide-up anim-d1"
                  style={{
                    background: variation.direction === 'up'
                      ? 'rgba(52,211,153,0.07)'
                      : 'rgba(239,68,68,0.07)',
                    border: `1px solid ${variation.direction === 'up'
                      ? 'rgba(52,211,153,0.2)'
                      : 'rgba(239,68,68,0.2)'}`,
                  }}>
                  {variation.direction === 'up'
                    ? <TrendingUp size={15} className="text-emerald-400 mt-0.5 shrink-0" />
                    : <TrendingDown size={15} className="text-red-400 mt-0.5 shrink-0" />}
                  <div>
                    <p className="text-xs font-semibold"
                      style={{ color: variation.direction === 'up' ? '#34d399' : '#f87171' }}>
                      Netto {variation.direction === 'up' ? 'aumentato' : 'diminuito'} del {variation.percent.toFixed(1)}% rispetto al mese precedente
                    </p>
                    {variation.reason && (
                      <p className="text-[10px] text-slate-500 mt-0.5">{variation.reason}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Scomposizione principale */}
              <div className="card p-5 anim-slide-up anim-d2">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-4">
                  Scomposizione — {periodLabel(current)}
                  {current.employer_name && (
                    <span className="ml-2 normal-case font-normal text-slate-600">
                      {current.employer_name}
                    </span>
                  )}
                </p>

                <div className="grid grid-cols-2 gap-4 mb-5">
                  <div className="rounded-xl p-4"
                    style={{ background: 'var(--dark-700)', border: '1px solid var(--dark-600)' }}>
                    <p className="text-[10px] text-slate-600 mb-1">Lordo</p>
                    <p className="text-xl font-bold text-slate-100 tabular-nums">{fmt(current.gross_amount)}</p>
                  </div>
                  <div className="rounded-xl p-4"
                    style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)' }}>
                    <p className="text-[10px] text-slate-600 mb-1">Netto</p>
                    <p className="text-xl font-bold text-emerald-400 tabular-nums">{fmt(current.net_amount)}</p>
                  </div>
                </div>

                <div className="flex flex-col gap-0">
                  {([
                    { label: 'IRPEF', value: current.irpef, color: '#f87171' },
                    { label: 'Contributi INPS', value: current.inps_contributions, color: '#fb923c' },
                    { label: 'Addizionale regionale/comunale', value: current.regional_municipal_tax, color: '#facc15' },
                  ] as const).map(row => (
                    Number(row.value) > 0 ? (
                      <div key={row.label} className="flex items-center justify-between py-2"
                        style={{ borderBottom: '1px solid var(--dark-700)' }}>
                        <span className="text-xs text-slate-400">{row.label}</span>
                        <span className="text-xs font-semibold tabular-nums" style={{ color: row.color }}>
                          − {fmt(row.value)}
                        </span>
                      </div>
                    ) : null
                  ))}
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-[10px] text-slate-600">Totale trattenute</span>
                    <span className="text-xs font-semibold text-slate-400 tabular-nums">
                      − {fmt(Number(current.gross_amount) - Number(current.net_amount))}
                    </span>
                  </div>
                </div>
              </div>

              {/* Voci variabili */}
              {(Number(current.overtime_amount) > 0 || Number(current.meal_vouchers) > 0) && (
                <div className="card p-5 anim-slide-up anim-d3">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-4">
                    Voci variabili
                  </p>
                  <div className="flex flex-col gap-2">
                    {Number(current.overtime_amount) > 0 && (
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xs text-slate-400">Straordinari</span>
                          {Number(current.overtime_hours) > 0 && (
                            <span className="ml-2 text-[10px] text-slate-600">
                              {Number(current.overtime_hours).toFixed(1)} ore
                            </span>
                          )}
                        </div>
                        <span className="text-xs font-semibold tabular-nums" style={{ color: 'var(--brand-light)' }}>
                          {fmt(current.overtime_amount)}
                        </span>
                      </div>
                    )}
                    {Number(current.meal_vouchers) > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-400">Buoni pasto</span>
                        <span className="text-xs font-semibold tabular-nums" style={{ color: 'var(--brand-light)' }}>
                          {fmt(current.meal_vouchers)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TFR */}
              {(Number(current.tfr_accrued_this_period) > 0 || Number(current.tfr_total_accrued) > 0) && (
                <div className="card p-5 anim-slide-up anim-d4">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-4">TFR</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] text-slate-600 mb-1">Accantonato questo mese</p>
                      <p className="text-base font-bold text-slate-200 tabular-nums">
                        {fmt(current.tfr_accrued_this_period)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-600 mb-1">Totale accumulato</p>
                      <p className="text-base font-bold text-slate-200 tabular-nums">
                        {fmt(current.tfr_total_accrued)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 pt-3" style={{ borderTop: '1px solid var(--dark-700)' }}>
                    <Link href="/payslips/proiezione"
                      className="text-xs transition-colors" style={{ color: 'var(--brand)' }}>
                      Simulazione proiezione TFR →
                    </Link>
                  </div>
                </div>
              )}

              {/* Pattern rilevati */}
              {patterns.length > 0 && (
                <div className="card p-5 anim-slide-up anim-d5">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-3">
                    Pattern rilevati
                  </p>
                  <div className="flex flex-col gap-2">
                    {patterns.map((pattern, i) => {
                      const colors: Record<PatternResult['type'], { bg: string; border: string; text: string }> = {
                        permanent_increase: { bg: 'rgba(52,211,153,0.07)',  border: 'rgba(52,211,153,0.2)',  text: '#34d399' },
                        temporary_spike:    { bg: 'rgba(251,191,36,0.07)',  border: 'rgba(251,191,36,0.2)',  text: '#fbbf24' },
                        recurring_absence:  { bg: 'rgba(239,68,68,0.07)',   border: 'rgba(239,68,68,0.2)',   text: '#f87171' },
                      };
                      const labels: Record<PatternResult['type'], string> = {
                        permanent_increase: 'Aumento permanente',
                        temporary_spike:    'Bonus una tantum',
                        recurring_absence:  'Assenze ricorrenti',
                      };
                      const c = colors[pattern.type];
                      return (
                        <div key={i} className="rounded-xl px-3 py-2.5 flex items-start gap-3"
                          style={{ background: c.bg, border: `1px solid ${c.border}` }}>
                          <div className="flex-1">
                            <span className="text-[10px] font-bold uppercase tracking-widest"
                              style={{ color: c.text }}>
                              {labels[pattern.type]}
                            </span>
                            <p className="text-xs text-slate-400 mt-0.5">{pattern.description}</p>
                          </div>
                          <span className="text-xs font-semibold tabular-nums shrink-0"
                            style={{ color: c.text }}>
                            {pattern.deltaAmount >= 0 ? '+' : ''}
                            {new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(pattern.deltaAmount)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Trend grafico */}
              {showTrend && (
                <div className="card p-5 anim-slide-up anim-d5">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-4">
                    Andamento netto — ultimi {trendData.length} {trendData.length === 1 ? 'mese' : 'mesi'}
                  </p>
                  <PayslipTrendChart data={trendData} highlightMonth={selectedMonth ?? undefined} />
                </div>
              )}
            </>
          )}

          {sorted.length > 0 && (
            <div className="card p-4 anim-slide-up anim-d6 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-300">Riepilogo annuale</p>
                <p className="text-[10px] text-slate-600 mt-0.5">
                  Totali per anno — utile per 730 e dichiarazione dei redditi
                </p>
              </div>
              <Link
                href="/payslips/annuale"
                className="text-xs transition-colors shrink-0" style={{ color: 'var(--brand)' }}
              >
                Apri →
              </Link>
            </div>
          )}

          {sorted.length > 0 && (
            <div className="card p-4 anim-slide-up flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-300">Simulatore IRPEF</p>
                <p className="text-[10px] text-slate-600 mt-0.5">
                  Calcola l&apos;impatto netto di un aumento di stipendio
                </p>
              </div>
              <Link
                href="/payslips/simulatore"
                className="text-xs transition-colors shrink-0" style={{ color: 'var(--brand)' }}
              >
                Apri →
              </Link>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}
