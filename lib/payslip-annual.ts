// TODO(Fase4): punto di estensione coppia — passare payslips di entrambi i partner
// e restituire AnnualSummary con campo partner_totals separato.

import type { Payslip } from './types';

export interface AnnualSummary {
  year: number;
  totalGross: number;
  totalNet: number;
  totalIrpef: number;
  totalInps: number;
  totalRegionalMunicipalTax: number;
  totalOvertime: number;
  totalMealVouchers: number;
  monthsPresent: number[];
  monthsMissing: number[];
  isComplete: boolean;
  payslips: Payslip[];
}

const MONTH_FULL = [
  '', 'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
];

export function expectedMonths(year: number): number[] {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const lastExpected = year < currentYear ? 12 : currentMonth;
  return Array.from({ length: lastExpected }, (_, i) => i + 1);
}

export function monthName(month: number): string {
  return MONTH_FULL[month] ?? String(month);
}

export function buildAnnualSummary(payslips: Payslip[], year: number): AnnualSummary {
  const filtered = payslips
    .filter(p => p.period_month.startsWith(String(year)))
    .sort((a, b) => a.period_month.localeCompare(b.period_month));

  const monthsPresent = filtered.map(p => parseInt(p.period_month.split('-')[1]));
  const expected = expectedMonths(year);
  const monthsMissing = expected.filter(m => !monthsPresent.includes(m));

  return {
    year,
    totalGross:                filtered.reduce((s, p) => s + Number(p.gross_amount), 0),
    totalNet:                  filtered.reduce((s, p) => s + Number(p.net_amount), 0),
    totalIrpef:                filtered.reduce((s, p) => s + Number(p.irpef), 0),
    totalInps:                 filtered.reduce((s, p) => s + Number(p.inps_contributions), 0),
    totalRegionalMunicipalTax: filtered.reduce((s, p) => s + Number(p.regional_municipal_tax), 0),
    totalOvertime:             filtered.reduce((s, p) => s + Number(p.overtime_amount), 0),
    totalMealVouchers:         filtered.reduce((s, p) => s + Number(p.meal_vouchers), 0),
    monthsPresent,
    monthsMissing,
    isComplete: monthsMissing.length === 0,
    payslips: filtered,
  };
}

export function summaryToCsvRows(summary: AnnualSummary): Record<string, string | number>[] {
  const months = summary.payslips.map(p => ({
    'Mese': monthName(parseInt(p.period_month.split('-')[1])),
    'Anno': summary.year,
    'Lordo (€)': Number(p.gross_amount).toFixed(2),
    'Netto (€)': Number(p.net_amount).toFixed(2),
    'IRPEF (€)': Number(p.irpef).toFixed(2),
    'INPS (€)': Number(p.inps_contributions).toFixed(2),
    'Add. regionale/comunale (€)': Number(p.regional_municipal_tax).toFixed(2),
    'Straordinari (€)': Number(p.overtime_amount).toFixed(2),
    'Buoni pasto (€)': Number(p.meal_vouchers).toFixed(2),
  }));

  const totale = {
    'Mese': 'TOTALE',
    'Anno': summary.year,
    'Lordo (€)': summary.totalGross.toFixed(2),
    'Netto (€)': summary.totalNet.toFixed(2),
    'IRPEF (€)': summary.totalIrpef.toFixed(2),
    'INPS (€)': summary.totalInps.toFixed(2),
    'Add. regionale/comunale (€)': summary.totalRegionalMunicipalTax.toFixed(2),
    'Straordinari (€)': summary.totalOvertime.toFixed(2),
    'Buoni pasto (€)': summary.totalMealVouchers.toFixed(2),
  };

  return [...months, totale];
}
