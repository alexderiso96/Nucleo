// Scaglioni IRPEF italiani — aggiorna ogni anno con la legge di bilancio.
// Ultima modifica: 2024 (riforma fiscale Legge 111/2023 + D.Lgs. 216/2023).
// Fonte: Agenzia delle Entrate.

export interface IrpefBracket {
  from: number;   // soglia inferiore (€ annui)
  to: number;     // soglia superiore (Infinity per l'ultimo scaglione)
  rate: number;   // aliquota decimale (es. 0.23 per 23%)
}

export const IRPEF_BRACKETS_2024: IrpefBracket[] = [
  { from: 0,      to: 28_000,   rate: 0.23 },
  { from: 28_000, to: 50_000,   rate: 0.35 },
  { from: 50_000, to: Infinity, rate: 0.43 },
];

// Aliquota INPS dipendente privato (IVS ordinaria, fino al massimale INPS 2024)
// Fonte: INPS circolare annuale.
export const INPS_EMPLOYEE_RATE = 0.0919;  // 9.19%

// Massimale contributivo INPS 2024 (€)
export const INPS_CEILING_2024 = 103_055;

// Anno di riferimento dei parametri
export const IRPEF_REFERENCE_YEAR = 2024;
