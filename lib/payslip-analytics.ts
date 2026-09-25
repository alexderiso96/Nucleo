import type { Payslip } from './types';

export interface TrendPoint {
  month: string;   // "YYYY-MM"
  label: string;   // "Set 26"
  net: number;
  gross: number;
}

export interface VariationResult {
  percent: number;
  direction: 'up' | 'down' | 'stable';
  reason?: string;
}

const MONTH_SHORT = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];

export function sortPayslips(payslips: Payslip[]): Payslip[] {
  return [...payslips].sort((a, b) => a.period_month.localeCompare(b.period_month));
}

export function buildTrendPoints(payslips: Payslip[]): TrendPoint[] {
  const sorted = sortPayslips(payslips);
  const last12 = sorted.slice(-12);
  return last12.map(p => {
    const parts = p.period_month.split('-');
    const year = parts[0];
    const monthIdx = parseInt(parts[1]) - 1;
    return {
      month: `${year}-${parts[1]}`,
      label: `${MONTH_SHORT[monthIdx]} ${year.slice(2)}`,
      net: Number(p.net_amount),
      gross: Number(p.gross_amount),
    };
  });
}

export function computeVariation(current: Payslip, previous: Payslip): VariationResult {
  const curr = Number(current.net_amount);
  const prev = Number(previous.net_amount);
  if (prev === 0) return { percent: 0, direction: 'stable' };
  const diff = curr - prev;
  const percent = Math.abs(diff / prev) * 100;
  const direction: VariationResult['direction'] =
    diff > 0.01 ? 'up' : diff < -0.01 ? 'down' : 'stable';
  const reason = detectVariationReason(current, previous);
  return { percent, direction, reason };
}

export function detectVariationReason(current: Payslip, previous: Payslip): string | undefined {
  const overtimeDiff = Number(current.overtime_amount) - Number(previous.overtime_amount);
  if (Math.abs(overtimeDiff) >= 50) {
    const abs = Math.abs(overtimeDiff).toFixed(0);
    return overtimeDiff > 0
      ? `Aumento degli straordinari (+€${abs})`
      : `Riduzione degli straordinari (−€${abs})`;
  }
  const grossDiff = Number(current.gross_amount) - Number(previous.gross_amount);
  if (Math.abs(grossDiff) >= 100) {
    return grossDiff > 0 ? 'Aumento della retribuzione lorda' : 'Riduzione della retribuzione lorda';
  }
  return undefined;
}
