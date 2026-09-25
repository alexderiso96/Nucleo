// TODO(Fase4): punto di estensione coppia — passare payslips di entrambi i partner
// e rilevare pattern comuni (es. mesi di assenza sincronizzati) nel confronto incrociato.

import type { Payslip } from './types';
import { sortPayslips } from './payslip-analytics';

export type PatternType = 'permanent_increase' | 'temporary_spike' | 'recurring_absence';

export interface PatternResult {
  type: PatternType;
  month: string;        // "YYYY-MM-01" — mese in cui è stato rilevato
  deltaPercent: number; // variazione % rispetto alla baseline
  deltaAmount: number;  // variazione in € rispetto alla baseline
  description: string;
}

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

const MONTH_IT = ['','Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];

export function formatMonth(periodMonth: string): string {
  const parts = periodMonth.split('-');
  const m = parseInt(parts[1]);
  return `${MONTH_IT[m] ?? parts[1]} ${parts[0]}`;
}

// Aumento permanente: netto sale ≥3% sulla baseline dei 2 mesi precedenti
// e rimane elevato nei mesi successivi disponibili.
export function detectPermanentIncreases(payslips: Payslip[]): PatternResult[] {
  const sorted = sortPayslips(payslips);
  if (sorted.length < 3) return [];
  const results: PatternResult[] = [];

  for (let i = 2; i < sorted.length; i++) {
    const baseline = avg([
      Number(sorted[i - 2].net_amount),
      Number(sorted[i - 1].net_amount),
    ]);
    const current = Number(sorted[i].net_amount);
    const delta = (current - baseline) / baseline;
    if (delta < 0.03) continue;

    const subsequent = sorted.slice(i + 1, i + 3).map(p => Number(p.net_amount));
    const anyDropBack = subsequent.some(n => n < baseline * 1.02);
    if (!anyDropBack) {
      results.push({
        type: 'permanent_increase',
        month: sorted[i].period_month,
        deltaPercent: delta * 100,
        deltaAmount: current - baseline,
        description: `Aumento permanente del netto rilevato a partire da ${formatMonth(sorted[i].period_month)}`,
      });
    }
  }
  return results;
}

// Bonus temporaneo: netto sale ≥5% sulla baseline e il mese successivo
// torna entro il 3% della baseline.
export function detectTemporarySpikes(payslips: Payslip[]): PatternResult[] {
  const sorted = sortPayslips(payslips);
  if (sorted.length < 3) return [];
  const results: PatternResult[] = [];

  for (let i = 2; i < sorted.length - 1; i++) {
    const baseline = avg([
      Number(sorted[i - 2].net_amount),
      Number(sorted[i - 1].net_amount),
    ]);
    const current = Number(sorted[i].net_amount);
    const next = Number(sorted[i + 1].net_amount);
    const deltaUp = (current - baseline) / baseline;
    const nextRelative = Math.abs(next - baseline) / baseline;

    if (deltaUp >= 0.05 && nextRelative < 0.03) {
      results.push({
        type: 'temporary_spike',
        month: sorted[i].period_month,
        deltaPercent: deltaUp * 100,
        deltaAmount: current - baseline,
        description: `Bonus o variazione una tantum a ${formatMonth(sorted[i].period_month)} — il netto è tornato al livello precedente`,
      });
    }
  }
  return results;
}

// Assenze ricorrenti: il lordo scende >5% sulla baseline in almeno 2 degli
// ultimi 4 mesi. Proxy per permessi/malattia non retribuiti.
export function detectRecurringAbsences(payslips: Payslip[]): PatternResult[] {
  const sorted = sortPayslips(payslips);
  if (sorted.length < 5) return [];

  const baseline = avg(sorted.slice(0, -4).map(p => Number(p.gross_amount)));
  if (baseline === 0) return [];

  const lastFour = sorted.slice(-4);
  const lowMonths = lastFour.filter(p => Number(p.gross_amount) < baseline * 0.95);

  if (lowMonths.length >= 2) {
    const avgDelta = avg(lowMonths.map(p => Number(p.gross_amount))) - baseline;
    return [{
      type: 'recurring_absence',
      month: sorted[sorted.length - 1].period_month,
      deltaPercent: (avgDelta / baseline) * 100,
      deltaAmount: avgDelta,
      description: `Possibili assenze ricorrenti: il lordo è risultato inferiore alla media in ${lowMonths.length} degli ultimi 4 mesi`,
    }];
  }
  return [];
}

export function detectPatterns(payslips: Payslip[]): PatternResult[] {
  const sorted = sortPayslips(payslips);
  if (sorted.length < 3) return [];
  return [
    ...detectPermanentIncreases(sorted),
    ...detectTemporarySpikes(sorted),
    ...detectRecurringAbsences(sorted),
  ];
}
