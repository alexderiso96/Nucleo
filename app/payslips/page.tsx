import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { createClient } from '@/lib/supabaseServer';
import NucleoHeader from '@/components/NucleoHeader';
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

const ROW_STYLE: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '0.625rem 0',
  borderBottom: '1px solid var(--border)',
};

const LABEL_STYLE: React.CSSProperties = {
  fontSize: '0.875rem',
  color: 'var(--text-2)',
};

const VALUE_STYLE: React.CSSProperties = {
  fontSize: '0.875rem',
  color: 'var(--text-1)',
  fontVariantNumeric: 'tabular-nums',
};

const PATTERN_COLORS: Record<PatternResult['type'], { text: string }> = {
  permanent_increase: { text: 'var(--positive)' },
  temporary_spike:    { text: 'var(--accent)'   },
  recurring_absence:  { text: 'var(--negative)' },
};

const PATTERN_LABELS: Record<PatternResult['type'], string> = {
  permanent_increase: 'Aumento permanente',
  temporary_spike:    'Bonus una tantum',
  recurring_absence:  'Assenze ricorrenti',
};

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

  const emailInitial = (user.email?.[0] ?? '?').toUpperCase();

  const addButton = (
    <Link
      href="/payslips/upload"
      style={{
        fontSize: '0.8125rem',
        color: 'var(--accent)',
        border: '1px solid var(--accent)',
        borderRadius: '0.25rem',
        padding: '0.3rem 0.75rem',
        textDecoration: 'none',
        whiteSpace: 'nowrap',
      }}
    >
      + Aggiungi
    </Link>
  );

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <NucleoHeader
        userInitial={emailInitial}
        activeNav="payslips"
        rightSlot={addButton}
      />

      <main style={{ maxWidth: '42rem', margin: '0 auto', padding: '0 1.5rem 4rem' }}>

        {/* Empty state */}
        {sorted.length === 0 && (
          <div style={{ paddingTop: '4rem', textAlign: 'center' }}>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-2)', marginBottom: '0.5rem' }}>
              Nessuna busta paga caricata.
            </p>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-3)', marginBottom: '1.5rem' }}>
              Carica il PDF della tua prima busta paga per vedere l&apos;analisi completa.
            </p>
            <Link
              href="/payslips/upload"
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

        {current && (
          <>
            {/* Navigazione mesi */}
            <div style={{
              paddingTop: '2rem',
              paddingBottom: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <span style={{ fontSize: '0.875rem', color: 'var(--text-2)', textTransform: 'capitalize' }}>
                {periodLabel(current)}
              </span>
              {sorted.length > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <Link
                    href={hasPrev ? `/payslips?month=${prevMonth}` : '#'}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: '1.75rem', height: '1.75rem', borderRadius: '0.25rem',
                      color: hasPrev ? 'var(--text-3)' : 'var(--border)',
                      textDecoration: 'none',
                      pointerEvents: hasPrev ? 'auto' : 'none',
                    }}
                  >
                    <ChevronLeft size={14} />
                  </Link>
                  <Link
                    href={hasNext ? `/payslips?month=${nextMonth}` : '#'}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: '1.75rem', height: '1.75rem', borderRadius: '0.25rem',
                      color: hasNext ? 'var(--text-3)' : 'var(--border)',
                      textDecoration: 'none',
                      pointerEvents: hasNext ? 'auto' : 'none',
                    }}
                  >
                    <ChevronRight size={14} />
                  </Link>
                </div>
              )}
            </div>

            {/* Alert variazione */}
            {showAlert && variation && (
              <div style={{ paddingBottom: '1.25rem', borderBottom: '1px solid var(--border)' }}>
                <p style={{
                  fontSize: '0.8125rem',
                  color: variation.direction === 'up' ? 'var(--positive)' : 'var(--negative)',
                }}>
                  {variation.direction === 'up' ? '↑' : '↓'} Netto{' '}
                  {variation.direction === 'up' ? 'aumentato' : 'diminuito'} del{' '}
                  {variation.percent.toFixed(1)}% rispetto al mese precedente
                  {variation.reason && (
                    <span style={{ color: 'var(--text-3)', marginLeft: '0.5rem', fontWeight: 400 }}>
                      · {variation.reason}
                    </span>
                  )}
                </p>
              </div>
            )}

            {/* Scomposizione */}
            <section style={{ paddingTop: showAlert ? '1.5rem' : 0 }}>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginBottom: '1rem' }}>
                Scomposizione
                {current.employer_name && ` · ${current.employer_name}`}
              </p>

              {/* Lordo + Netto hero */}
              <div style={{ display: 'flex', gap: '2rem', marginBottom: '1.25rem' }}>
                <div>
                  <p style={{ fontSize: '0.6875rem', color: 'var(--text-3)', marginBottom: '0.25rem' }}>Lordo</p>
                  <p className="tabular-nums" style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-1)' }}>
                    {fmt(current.gross_amount)}
                  </p>
                </div>
                <div>
                  <p style={{ fontSize: '0.6875rem', color: 'var(--text-3)', marginBottom: '0.25rem' }}>Netto</p>
                  <p className="tabular-nums" style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--positive)' }}>
                    {fmt(current.net_amount)}
                  </p>
                </div>
              </div>

              {/* Trattenute */}
              {([
                { label: 'IRPEF', value: current.irpef },
                { label: 'Contributi INPS', value: current.inps_contributions },
                { label: 'Addizionale regionale/comunale', value: current.regional_municipal_tax },
              ] as const).map(row =>
                Number(row.value) > 0 ? (
                  <div key={row.label} style={ROW_STYLE}>
                    <span style={LABEL_STYLE}>{row.label}</span>
                    <span className="tabular-nums" style={{ ...VALUE_STYLE, color: 'var(--negative)' }}>
                      − {fmt(row.value)}
                    </span>
                  </div>
                ) : null
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>Totale trattenute</span>
                <span className="tabular-nums" style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>
                  − {fmt(Number(current.gross_amount) - Number(current.net_amount))}
                </span>
              </div>
            </section>

            {/* Voci variabili */}
            {(Number(current.overtime_amount) > 0 || Number(current.meal_vouchers) > 0) && (
              <section style={{ paddingTop: '1.75rem' }}>
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginBottom: '1rem' }}>
                    Voci variabili
                  </p>
                  {Number(current.overtime_amount) > 0 && (
                    <div style={ROW_STYLE}>
                      <span style={LABEL_STYLE}>
                        Straordinari
                        {Number(current.overtime_hours) > 0 && (
                          <span style={{ color: 'var(--text-3)', marginLeft: '0.5rem', fontSize: '0.8125rem' }}>
                            ({Number(current.overtime_hours).toFixed(1)} ore)
                          </span>
                        )}
                      </span>
                      <span className="tabular-nums" style={{ ...VALUE_STYLE, color: 'var(--positive)' }}>
                        {fmt(current.overtime_amount)}
                      </span>
                    </div>
                  )}
                  {Number(current.meal_vouchers) > 0 && (
                    <div style={ROW_STYLE}>
                      <span style={LABEL_STYLE}>Buoni pasto</span>
                      <span className="tabular-nums" style={{ ...VALUE_STYLE, color: 'var(--positive)' }}>
                        {fmt(current.meal_vouchers)}
                      </span>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* TFR */}
            {(Number(current.tfr_accrued_this_period) > 0 || Number(current.tfr_total_accrued) > 0) && (
              <section style={{ paddingTop: '1.75rem' }}>
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginBottom: '1rem' }}>TFR</p>
                  <div style={ROW_STYLE}>
                    <span style={LABEL_STYLE}>Accantonato questo mese</span>
                    <span className="tabular-nums" style={VALUE_STYLE}>{fmt(current.tfr_accrued_this_period)}</span>
                  </div>
                  <div style={ROW_STYLE}>
                    <span style={LABEL_STYLE}>Totale accumulato</span>
                    <span className="tabular-nums" style={{ ...VALUE_STYLE, fontWeight: 600 }}>
                      {fmt(current.tfr_total_accrued)}
                    </span>
                  </div>
                </div>
              </section>
            )}

            {/* Pattern */}
            {patterns.length > 0 && (
              <section style={{ paddingTop: '1.75rem' }}>
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginBottom: '1rem' }}>
                    Pattern rilevati
                  </p>
                  {patterns.map((pattern, i) => {
                    const c = PATTERN_COLORS[pattern.type];
                    return (
                      <div key={i} style={{ ...ROW_STYLE, alignItems: 'flex-start', gap: '1rem' }}>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: '0.8125rem', color: c.text, fontWeight: 500 }}>
                            {PATTERN_LABELS[pattern.type]}
                          </p>
                          <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: '0.125rem' }}>
                            {pattern.description}
                          </p>
                        </div>
                        <span className="tabular-nums" style={{ fontSize: '0.8125rem', color: c.text, fontWeight: 600, flexShrink: 0 }}>
                          {pattern.deltaAmount >= 0 ? '+' : ''}
                          {new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(pattern.deltaAmount)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Trend */}
            {showTrend && (
              <section style={{ paddingTop: '1.75rem' }}>
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginBottom: '1rem' }}>
                    Andamento netto — ultimi {trendData.length} {trendData.length === 1 ? 'mese' : 'mesi'}
                  </p>
                  <PayslipTrendChart data={trendData} highlightMonth={selectedMonth ?? undefined} />
                </div>
              </section>
            )}
          </>
        )}

        {/* Link sezioni */}
        {sorted.length > 0 && (
          <section style={{ paddingTop: '1.75rem' }}>
            <div style={{ borderTop: '1px solid var(--border)' }}>
              {[
                { href: '/payslips/proiezione', label: 'Proiezione TFR' },
                { href: '/payslips/annuale',    label: 'Riepilogo annuale' },
                { href: '/payslips/simulatore', label: 'Simulatore IRPEF' },
              ].map(link => (
                <Link
                  key={link.href}
                  href={link.href}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.75rem 0',
                    borderBottom: '1px solid var(--border)',
                    fontSize: '0.875rem',
                    color: 'var(--text-1)',
                    textDecoration: 'none',
                  }}
                >
                  {link.label}
                  <ChevronRight size={14} style={{ color: 'var(--text-3)' }} />
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
