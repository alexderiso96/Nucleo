import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { createClient } from '@/lib/supabaseServer';
import Sidebar from '@/components/Sidebar';
import PayslipHistorySection from '@/components/PayslipHistorySection';
import { sortPayslips, buildTrendPoints, computeVariation } from '@/lib/payslip-analytics';
import { detectPatterns } from '@/lib/payslip-patterns';
import type { PatternResult } from '@/lib/payslip-patterns';
import type { Payslip } from '@/lib/types';

const MONTH_FULL = [
  'Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
  'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre',
];

const PAYSLIP_COLORS = {
  netto:      '#10b981',
  inps:       '#eab308',
  irpef:      '#fb7185',
  addizionale:'#38bdf8',
};

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
  const patterns = detectPatterns(sorted);
  const variation = current && previous ? computeVariation(current, previous) : null;
  const showAlert = variation && variation.percent > 5;

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--dark-900)' }}>
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">

        {/* ── Header ─────────────────────────────────────────────── */}
        <header
          className="flex items-center justify-between px-6 py-3.5 sticky top-0 z-10"
          style={{ background: 'var(--dark-800)', borderBottom: '1px solid var(--dark-600)' }}
        >
          <div className="flex items-center gap-4">
            <div>
              <h2 className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>Buste paga</h2>
              {current && (
                <p className="text-[10px]" style={{ color: 'var(--text-3)' }}>
                  {periodLabel(current)}
                  {current.employer_name && ` · ${current.employer_name}`}
                </p>
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
                >
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
                >
                  <ChevronRight size={14} />
                </Link>
              </div>
            )}
          </div>
          <Link
            href="/payslips/upload"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors"
            style={{ border: '1px solid var(--brand)', color: 'var(--brand)' }}
          >
            <Plus size={13} /> Aggiungi
          </Link>
        </header>

        <main className="flex-1 px-6 max-w-3xl w-full mx-auto flex flex-col">

          {/* Empty state */}
          {sorted.length === 0 && (
            <div className="flex flex-col items-center gap-4 py-24 text-center">
              <p className="text-sm" style={{ color: 'var(--text-3)' }}>Nessuna busta paga caricata.</p>
              <p className="text-[12px] max-w-xs" style={{ color: 'var(--text-3)' }}>
                Carica il PDF della tua prima busta paga per vedere l&apos;analisi completa.
              </p>
              <Link
                href="/payslips/upload"
                className="mt-2 px-4 py-2 rounded-lg text-sm font-medium"
                style={{ border: '1px solid var(--brand)', color: 'var(--brand)' }}
              >
                Carica busta paga
              </Link>
            </div>
          )}

          {current && (
            <>
              {/* ── Alert variazione ─────────────────────────────── */}
              {showAlert && variation && (
                <div
                  className="flex items-start gap-3 py-4"
                  style={{
                    borderBottom: '1px solid var(--border)',
                    borderLeft: `3px solid ${variation.direction === 'up' ? '#10b981' : '#f87171'}`,
                    paddingLeft: '16px',
                  }}
                >
                  <div>
                    <p className="text-[13px] font-medium" style={{ color: 'var(--text-1)' }}>
                      Netto {variation.direction === 'up' ? 'aumentato' : 'diminuito'} del {variation.percent.toFixed(1)}% rispetto al mese precedente
                    </p>
                    {variation.reason && (
                      <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-3)' }}>
                        {variation.reason}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* ── Composizione del mese corrente ───────────────── */}
              <div className="py-6" style={{ borderBottom: '1px solid var(--border)' }}>
                {/* Lordo */}
                <p className="text-[11px] mb-1" style={{ color: 'var(--text-3)' }}>Lordo</p>
                <p className="tabular-nums font-bold mb-5" style={{ fontSize: '1.75rem', color: 'var(--text-1)' }}>
                  {fmt(current.gross_amount)}
                </p>

                {/* Composition bar */}
                {(() => {
                  const gross = Number(current.gross_amount) || 1;
                  const net   = Number(current.net_amount) || 0;
                  const inps  = Number(current.inps_contributions) || 0;
                  const irpef = Number(current.irpef) || 0;
                  const add   = Number(current.regional_municipal_tax) || 0;
                  const segments = [
                    { key: 'netto', label: 'Netto', value: net,  color: PAYSLIP_COLORS.netto,      bold: true },
                    { key: 'inps',  label: 'Contributi INPS', value: inps, color: PAYSLIP_COLORS.inps,  bold: false },
                    { key: 'irpef', label: 'IRPEF',    value: irpef, color: PAYSLIP_COLORS.irpef,   bold: false },
                    { key: 'add',   label: 'Addizionale', value: add, color: PAYSLIP_COLORS.addizionale, bold: false },
                  ].filter(s => s.value > 0);
                  return (
                    <>
                      <div className="flex overflow-hidden mb-5" style={{ height: 10, gap: 2, borderRadius: 9999 }}>
                        {segments.map(s => (
                          <div
                            key={s.key}
                            style={{ flex: s.value / gross, background: s.color, borderRadius: 9999 }}
                          />
                        ))}
                      </div>
                      <div className="flex flex-col" style={{ gap: 10 }}>
                        {segments.map(s => {
                          const pct = ((s.value / gross) * 100).toFixed(0);
                          return (
                            <div key={s.key} className="flex items-center gap-2.5">
                              <span style={{ color: s.color, fontSize: 14, lineHeight: 1 }}>●</span>
                              <span
                                className="flex-1 text-[13px]"
                                style={{ color: 'var(--text-2)', fontWeight: s.bold ? 600 : 400 }}
                              >
                                {s.label}
                              </span>
                              <span className="text-[11px] tabular-nums" style={{ color: 'var(--text-3)' }}>
                                {pct}%
                              </span>
                              <span
                                className="text-[13px] tabular-nums w-24 text-right"
                                style={{ color: 'var(--text-1)', fontWeight: s.bold ? 600 : 400 }}
                              >
                                {fmt(s.value)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* ── Voci variabili ───────────────────────────────── */}
              {(Number(current.overtime_amount) > 0 || Number(current.meal_vouchers) > 0) && (
                <div className="py-5" style={{ borderBottom: '1px solid var(--border)' }}>
                  <p className="text-[13px] font-medium mb-4" style={{ color: 'var(--text-1)' }}>
                    Voci variabili
                  </p>
                  <div className="flex flex-col gap-3">
                    {Number(current.overtime_amount) > 0 && (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px]" style={{ color: 'var(--text-2)' }}>Straordinari</span>
                          {Number(current.overtime_hours) > 0 && (
                            <span className="text-[11px]" style={{ color: 'var(--text-3)' }}>
                              {Number(current.overtime_hours).toFixed(1)} ore
                            </span>
                          )}
                        </div>
                        <span className="text-[13px] tabular-nums font-medium" style={{ color: PAYSLIP_COLORS.netto }}>
                          {fmt(current.overtime_amount)}
                        </span>
                      </div>
                    )}
                    {Number(current.meal_vouchers) > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-[13px]" style={{ color: 'var(--text-2)' }}>Buoni pasto</span>
                        <span className="text-[13px] tabular-nums font-medium" style={{ color: PAYSLIP_COLORS.netto }}>
                          {fmt(current.meal_vouchers)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── Storico netto ────────────────────────────────── */}
              <PayslipHistorySection
                allPoints={trendData}
                highlightMonth={selectedMonth ?? undefined}
              />

              {/* ── TFR ──────────────────────────────────────────── */}
              {(Number(current.tfr_accrued_this_period) > 0 || Number(current.tfr_total_accrued) > 0) && (
                <div className="py-6" style={{ borderBottom: '1px solid var(--border)' }}>
                  <p className="text-[13px] font-medium mb-4" style={{ color: 'var(--text-1)' }}>TFR</p>
                  <div className="grid grid-cols-2 gap-8 mb-4">
                    <div>
                      <p className="text-[10px] mb-1" style={{ color: 'var(--text-3)' }}>Accantonato questo mese</p>
                      <p className="text-[15px] font-semibold tabular-nums" style={{ color: 'var(--text-1)' }}>
                        {fmt(current.tfr_accrued_this_period)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] mb-1" style={{ color: 'var(--text-3)' }}>Totale accumulato</p>
                      <p className="text-[15px] font-semibold tabular-nums" style={{ color: 'var(--text-1)' }}>
                        {fmt(current.tfr_total_accrued)}
                      </p>
                    </div>
                  </div>
                  <Link
                    href="/payslips/proiezione"
                    className="text-[12px] transition-colors"
                    style={{ color: 'var(--brand)' }}
                  >
                    Simulazione proiezione TFR →
                  </Link>
                </div>
              )}

              {/* ── Pattern rilevati ─────────────────────────────── */}
              {patterns.length > 0 && (
                <div className="py-5" style={{ borderBottom: '1px solid var(--border)' }}>
                  <p className="text-[13px] font-medium mb-4" style={{ color: 'var(--text-1)' }}>
                    Pattern rilevati
                  </p>
                  <div className="flex flex-col gap-4">
                    {patterns.map((pattern, i) => {
                      const dotColor: Record<PatternResult['type'], string> = {
                        permanent_increase: '#10b981',
                        temporary_spike:    '#eab308',
                        recurring_absence:  '#f87171',
                      };
                      const labels: Record<PatternResult['type'], string> = {
                        permanent_increase: 'Aumento permanente',
                        temporary_spike:    'Bonus una tantum',
                        recurring_absence:  'Assenze ricorrenti',
                      };
                      const color = dotColor[pattern.type];
                      return (
                        <div key={i} className="flex items-start gap-3">
                          <span style={{ color, fontSize: 14, lineHeight: 1, marginTop: 2, flexShrink: 0 }}>●</span>
                          <div className="flex-1 min-w-0">
                            <span className="text-[13px] font-medium" style={{ color: 'var(--text-1)' }}>
                              {labels[pattern.type]}
                            </span>
                            <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-3)' }}>
                              {pattern.description}
                            </p>
                          </div>
                          <span
                            className="text-[12px] tabular-nums font-medium shrink-0"
                            style={{ color }}
                          >
                            {pattern.deltaAmount >= 0 ? '+' : ''}
                            {new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(pattern.deltaAmount)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── Footer links ─────────────────────────────────────── */}
          {sorted.length > 0 && (
            <div className="py-5 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[13px] font-medium" style={{ color: 'var(--text-1)' }}>Riepilogo annuale</p>
                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-3)' }}>
                    Totali per anno — utile per 730 e dichiarazione dei redditi
                  </p>
                </div>
                <Link href="/payslips/annuale" className="text-[12px] transition-colors" style={{ color: 'var(--brand)' }}>
                  Apri →
                </Link>
              </div>
              <div className="flex items-center justify-between" style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                <div>
                  <p className="text-[13px] font-medium" style={{ color: 'var(--text-1)' }}>Simulatore IRPEF</p>
                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-3)' }}>
                    Calcola l&apos;impatto netto di un aumento di stipendio
                  </p>
                </div>
                <Link href="/payslips/simulatore" className="text-[12px] transition-colors" style={{ color: 'var(--brand)' }}>
                  Apri →
                </Link>
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}
