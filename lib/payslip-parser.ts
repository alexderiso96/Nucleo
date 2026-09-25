export interface PayslipFields {
  periodMonth?: string;       // "YYYY-MM-01"
  grossAmount?: number;
  netAmount?: number;
  irpef?: number;
  inpsContributions?: number;
  regionalMunicipalTax?: number;
  overtimeHours?: number;
  overtimeAmount?: number;
  mealVouchers?: number;
  tfrAccruedPeriod?: number;
  tfrTotal?: number;
  employerName?: string;
  confidence: 'high' | 'low';
}

export interface ValidationResult {
  valid: boolean;
  warnings: string[];
}

// ── Mese italiano → numero ────────────────────────────────────────────────────

const MONTH_IT: Record<string, string> = {
  gennaio: '01', febbraio: '02', marzo: '03', aprile: '04',
  maggio: '05', giugno: '06', luglio: '07', agosto: '08',
  settembre: '09', ottobre: '10', novembre: '11', dicembre: '12',
  gen: '01', feb: '02', mar: '03', apr: '04', mag: '05', giu: '06',
  lug: '07', ago: '08', set: '09', ott: '10', nov: '11', dic: '12',
};

function parseItMonth(s: string): string | null {
  const lower = s.toLowerCase().trim();
  const m = lower.match(/(\w+)\s+(\d{4})/);
  if (!m) return null;
  const month = MONTH_IT[m[1]];
  if (!month) return null;
  return `${m[2]}-${month}-01`;
}

// ── Numero italiano ───────────────────────────────────────────────────────────

function parseItNumber(s: string): number | null {
  if (!s) return null;
  const cleaned = s
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/[€\s]/g, '')
    .replace(/−/g, '-');
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : Math.abs(n);
}

// ── Separatore flessibile ─────────────────────────────────────────────────────
// Permette: spazi, newline, due punti, euro, pipe, trattini, asterischi, slash
const SEP = '[\\s:€|\\-–—./,;*]{0,40}';

function findAfterLabel(text: string, labels: RegExp[]): number | null {
  for (const re of labels) {
    const m = re.exec(text);
    if (m?.[1]) {
      const n = parseItNumber(m[1]);
      if (n !== null && n > 0) return n;
    }
  }
  return null;
}

function findStringAfterLabel(text: string, labels: RegExp[]): string | null {
  for (const re of labels) {
    const m = re.exec(text);
    if (m?.[1]) return m[1].trim();
  }
  return null;
}

// Crea regex con separatore flessibile
function rx(label: string): RegExp {
  return new RegExp(`${label}${SEP}([0-9][0-9.,]*)`, 'i');
}

// ── Parser principale ─────────────────────────────────────────────────────────

export function parsePayslipText(text: string): PayslipFields {
  const t = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  const grossAmount = findAfterLabel(t, [
    rx('retribuzione\\s+lorda'),
    rx('totale\\s+competenze'),
    rx('totale\\s+voci\\s+retributive'),
    rx('totale\\s+voci\\s+stipendio'),
    rx('imponibile\\s+previdenziale'),
    rx('lordo\\s+mensile'),
    rx('stipendio\\s+lordo'),
    rx('paga\\s+base\\s+lorda'),
    rx('retribuzione\\s+mensile\\s+lorda'),
    rx('retribuzione\\s+globale\\s+di\\s+fatto'),
    rx('totale\\s+emolumenti'),
    rx('totale\\s+a\\s+credito'),
  ]);

  const netAmount = findAfterLabel(t, [
    rx('netto\\s+in\\s+pagamento'),
    rx('totale\\s+netto\\s+in\\s+pagamento'),
    rx('netto\\s+a\\s+pagare'),
    rx('totale\\s+netto\\s+a\\s+pagare'),
    rx('netto\\s+erogato'),
    rx('totale\\s+netto'),
    rx('da\\s+pagare'),
    rx('stipendio\\s+netto'),
    rx('netto\\s+mensile'),
    rx('importo\\s+netto'),
    rx('accredito\\s+in\\s+banca'),
    rx('totale\\s+a\\s+vostro\\s+credito'),
    rx('netto\\s+percepito'),
    rx('importo\\s+accreditato'),
  ]);

  const irpef = findAfterLabel(t, [
    rx('ritenuta\\s+irpef'),
    rx('imposta\\s+irpef'),
    rx('totale\\s+irpef'),
    rx('totale\\s+ritenute\\s+irpef'),
    rx('irpef\\s+a\\s+credito'),
    rx('irpef\\s+a\\s+debito'),
    rx('irpef'),
  ]);

  const inpsContributions = findAfterLabel(t, [
    rx('contributi?\\s+inps\\s+a\\s+carico\\s+dipendente'),
    rx('contributi?\\s+a\\s+carico\\s+dipendente'),
    rx('contributi?\\s+previdenziali\\s+dipendente'),
    rx('contributi?\\s+inps'),
    rx('contributi?\\s+previdenziali'),
    rx('totale\\s+contributi?'),
    rx('inps\\s+dipendente'),
    rx('inps'),
  ]);

  const regionalMunicipalTax = findAfterLabel(t, [
    rx('addizionale\\s+regionale\\s+irpef'),
    rx('addizionale\\s+comunale\\s+irpef'),
    rx('addizionale\\s+regionale'),
    rx('addizionale\\s+comunale'),
    rx('add\\.\\s*reg'),
    rx('add\\.\\s*com'),
    rx('add\\.\\s+regionale'),
    rx('add\\.\\s+comunale'),
  ]);

  const overtimeHours = findAfterLabel(t, [
    rx('ore\\s+straordinar[ie]+'),
    rx('straordinari\\s+ore'),
    rx('h\\.\\s*straord'),
  ]);

  const overtimeAmount = findAfterLabel(t, [
    rx('compenso\\s+straordinari'),
    rx('straordinari'),
    rx('lavoro\\s+straordinario'),
  ]);

  const mealVouchers = findAfterLabel(t, [
    rx('welfare\\s+buoni?\\s+pasto'),
    rx('buoni?\\s+pasto'),
    rx('ticket\\s+restaurant'),
    rx('buoni?\\s+mensa'),
    rx('meal\\s+voucher'),
  ]);

  const tfrAccruedPeriod = findAfterLabel(t, [
    rx('tfr\\s+maturato\\s+nel\\s+periodo'),
    rx('tfr\\s+del\\s+periodo'),
    rx('quota\\s+tfr\\s+periodo'),
    rx('quota\\s+tfr'),
    rx('accantonamento\\s+tfr\\s+periodo'),
  ]);

  const tfrTotal = findAfterLabel(t, [
    rx('tfr\\s+totale\\s+accantonato'),
    rx('tfr\\s+accantonato'),
    rx('totale\\s+tfr'),
    rx('trattamento\\s+fine\\s+rapporto'),
    rx('tfr\\s+in\\s+azienda'),
  ]);

  const employerName = findStringAfterLabel(t, [
    /datore\s+di\s+lavoro[:\s]+([^\n]{2,60})/i,
    /azienda[:\s]+([^\n]{2,60})/i,
    /societ[àa][:\s]+([^\n]{2,60})/i,
    /societ[àa]?\s+([A-Z][^\n]{2,50}(?:S\.p\.A\.|S\.r\.l\.|S\.a\.s\.|SpA|Srl))/i,
  ]);

  // Periodo: cerca pattern comuni nelle buste paga italiane
  let periodMonth: string | undefined;
  const periodPatterns = [
    /competenza[:\s]+([a-zà-ú]+\s+\d{4})/i,
    /periodo[:\s\-]+([a-zà-ú]+\s+\d{4})/i,
    /mese[:\s\-]+([a-zà-ú]+\s+\d{4})/i,
    /cedolino\s+(?:di\s+)?([a-zà-ú]+\s+\d{4})/i,
    /paga\s+(?:di\s+)?([a-zà-ú]+\s+\d{4})/i,
    /retribuzione\s+(?:del\s+)?(?:mese\s+(?:di\s+)?)?([a-zà-ú]+\s+\d{4})/i,
  ];
  for (const p of periodPatterns) {
    const m = t.match(p);
    if (m?.[1]) {
      periodMonth = parseItMonth(m[1]) ?? undefined;
      if (periodMonth) break;
    }
  }

  const confidence: 'high' | 'low' =
    grossAmount !== null && netAmount !== null ? 'high' : 'low';

  return {
    periodMonth,
    grossAmount: grossAmount ?? undefined,
    netAmount: netAmount ?? undefined,
    irpef: irpef ?? undefined,
    inpsContributions: inpsContributions ?? undefined,
    regionalMunicipalTax: regionalMunicipalTax ?? undefined,
    overtimeHours: overtimeHours ?? undefined,
    overtimeAmount: overtimeAmount ?? undefined,
    mealVouchers: mealVouchers ?? undefined,
    tfrAccruedPeriod: tfrAccruedPeriod ?? undefined,
    tfrTotal: tfrTotal ?? undefined,
    employerName: employerName ?? undefined,
    confidence,
  };
}

// ── Validazione coerenza ──────────────────────────────────────────────────────

export function validatePayslip(f: PayslipFields): ValidationResult {
  const warnings: string[] = [];

  if (f.grossAmount && f.netAmount) {
    if (f.netAmount >= f.grossAmount) {
      warnings.push('Il netto risulta maggiore o uguale al lordo.');
    }
    const deductions = f.grossAmount - f.netAmount;
    if (deductions / f.grossAmount > 0.7) {
      warnings.push('Le trattenute superano il 70% del lordo — verifica i valori.');
    }
  }

  if (f.irpef && f.grossAmount && f.irpef / f.grossAmount > 0.5) {
    warnings.push("L'IRPEF supera il 50% del lordo — verifica il valore.");
  }

  if (f.netAmount && f.netAmount < 0) {
    warnings.push('Il netto risulta negativo.');
  }

  return { valid: warnings.length === 0, warnings };
}
