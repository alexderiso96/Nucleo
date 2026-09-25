// TODO(Fase4): punto di estensione per il confronto TFR coppia —
// aggiungere un secondo set di parametri (partner) a TfrProjectionParams
// e ritornare YearlyPoint[] con campi azienda2/fondo2.

export interface TfrProjectionParams {
  currentBalance: number;      // TFR totale accumulato attuale (€)
  monthlyAccrual: number;      // accantonamento mensile medio (€)
  yearsToProject: number;      // anni di proiezione (1–50)
  inflationRate: number;       // tasso inflazione decimale, es. 0.02 per 2%
  pensionFundReturn: number;   // rendimento fondo pensione decimale, es. 0.05 per 5%
}

export interface YearlyPoint {
  year: number;       // anni dall'oggi (0 = oggi)
  azienda: number;    // TFR in azienda proiettato
  fondo: number;      // TFR in fondo pensione proiettato
}

// Tasso di rivalutazione TFR in azienda (Legge 297/82):
// 1.5% fisso + 75% dell'inflazione ISTAT annua
export function tfrAziendaRate(inflationRate: number): number {
  return 0.015 + 0.75 * inflationRate;
}

// Proiezione compound con accantonamenti futuri costanti (FV annuity)
export function projectTfr(params: TfrProjectionParams): YearlyPoint[] {
  const { currentBalance, monthlyAccrual, yearsToProject, inflationRate, pensionFundReturn } = params;
  const rA = tfrAziendaRate(inflationRate);
  const rF = pensionFundReturn;
  const annualAccrual = monthlyAccrual * 12;

  const points: YearlyPoint[] = [];
  for (let y = 0; y <= yearsToProject; y++) {
    const aziendaBase = currentBalance * Math.pow(1 + rA, y);
    const fondoBase   = currentBalance * Math.pow(1 + rF, y);

    // FV accantonamenti futuri: P × ((1+r)^n − 1) / r
    const aziendaAccruals = rA > 0
      ? annualAccrual * (Math.pow(1 + rA, y) - 1) / rA
      : annualAccrual * y;
    const fondoAccruals = rF > 0
      ? annualAccrual * (Math.pow(1 + rF, y) - 1) / rF
      : annualAccrual * y;

    points.push({
      year: y,
      azienda: Math.round(aziendaBase + aziendaAccruals),
      fondo:   Math.round(fondoBase   + fondoAccruals),
    });
  }
  return points;
}
