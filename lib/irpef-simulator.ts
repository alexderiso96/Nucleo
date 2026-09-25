// TODO(Fase4): punto di estensione coppia — aggiungere simulazione combinata
// per due redditi (detrazioni coniuge a carico, cumulo agevolato, ecc.)

import { IRPEF_BRACKETS_2024, INPS_EMPLOYEE_RATE, INPS_CEILING_2024, type IrpefBracket } from './irpef-brackets';

export interface IrpefBreakdown {
  grossAnnual: number;
  inpsAnnual: number;
  irpefAnnual: number;
  netAnnual: number;
  netMonthly: number;
  bracketDetails: { label: string; taxable: number; rate: number; tax: number }[];
}

// Calcola IRPEF lorda su base imponibile annua con scaglioni progressivi
export function computeIrpef(taxableIncome: number, brackets: IrpefBracket[] = IRPEF_BRACKETS_2024): number {
  let total = 0;
  for (const bracket of brackets) {
    if (taxableIncome <= bracket.from) break;
    const taxable = Math.min(taxableIncome, bracket.to) - bracket.from;
    total += taxable * bracket.rate;
  }
  return total;
}

// Calcola il dettaglio per scaglione (per la visualizzazione)
export function irpefBracketDetails(
  taxableIncome: number,
  brackets: IrpefBracket[] = IRPEF_BRACKETS_2024,
): { label: string; taxable: number; rate: number; tax: number }[] {
  return brackets
    .filter(b => taxableIncome > b.from)
    .map(b => {
      const taxable = Math.min(taxableIncome, b.to === Infinity ? taxableIncome : b.to) - b.from;
      return {
        label: b.to === Infinity
          ? `Oltre €${(b.from / 1000).toFixed(0)}k`
          : `€${(b.from / 1000).toFixed(0)}k – €${(b.to / 1000).toFixed(0)}k`,
        taxable: Math.max(0, taxable),
        rate: b.rate,
        tax: Math.max(0, taxable) * b.rate,
      };
    });
}

// Simulazione completa
// NOTA: calcolo semplificato — non include detrazioni personali (coniuge, figli),
// addizionali regionali/comunali specifiche del comune, bonus Irpef (ex bonus 80€),
// o altre voci individuali. Il risultato è una stima di massima.
export function simulateNet(grossAnnual: number): IrpefBreakdown {
  const inpsBase = Math.min(grossAnnual, INPS_CEILING_2024);
  const inpsAnnual = inpsBase * INPS_EMPLOYEE_RATE;

  // Base imponibile IRPEF = lordo - contributi INPS dipendente
  const taxableIncome = Math.max(0, grossAnnual - inpsAnnual);
  const irpefAnnual = computeIrpef(taxableIncome);
  const netAnnual = grossAnnual - inpsAnnual - irpefAnnual;

  return {
    grossAnnual,
    inpsAnnual,
    irpefAnnual,
    netAnnual,
    netMonthly: netAnnual / 13,
    bracketDetails: irpefBracketDetails(taxableIncome),
  };
}

export function simulateDelta(currentGrossAnnual: number, increaseAnnual: number): {
  current: IrpefBreakdown;
  increased: IrpefBreakdown;
  netGainAnnual: number;
  netGainMonthly: number;
  effectiveRate: number;
} {
  const current = simulateNet(currentGrossAnnual);
  const increased = simulateNet(currentGrossAnnual + increaseAnnual);
  const netGainAnnual = increased.netAnnual - current.netAnnual;
  const netGainMonthly = increased.netMonthly - current.netMonthly;
  const effectiveRate = increaseAnnual > 0 ? 1 - netGainAnnual / increaseAnnual : 0;
  return { current, increased, netGainAnnual, netGainMonthly, effectiveRate };
}
