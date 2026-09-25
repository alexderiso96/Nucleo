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
  const cleaned = s.replace(/\./g, '').replace(',', '.').replace(/[€\s]/g, '').replace(/−/g, '-');
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : Math.abs(n);
}

// ── Cerca valore dopo etichetta ───────────────────────────────────────────────

function findAfterLabel(text: string, patterns: RegExp[]): number | null {
  for (const re of patterns) {
    const m = re.exec(text);
    if (m?.[1]) {
      const n = parseItNumber(m[1]);
      if (n !== null) return n;
    }
  }
  return null;
}

function findStringAfterLabel(text: string, patterns: RegExp[]): string | null {
  for (const re of patterns) {
    const m = re.exec(text);
    if (m?.[1]) return m[1].trim();
  }
  return null;
}

// ── Parser principale ─────────────────────────────────────────────────────────

export function parsePayslipText(text: string): PayslipFields {
  const t = text.replace(/\r\n/g, '\n');

  const grossAmount = findAfterLabel(t, [
    /retribuzione\s+lorda[:\s]+([0-9.,]+)/i,
    /totale\s+competenze[:\s]+([0-9.,]+)/i,
    /imponibile\s+previdenziale[:\s]+([0-9.,]+)/i,
    /lordo\s+mensile[:\s]+([0-9.,]+)/i,
    /stipendio\s+lordo[:\s]+([0-9.,]+)/i,
  ]);

  const netAmount = findAfterLabel(t, [
    /netto\s+in\s+pagamento[:\s]+([0-9.,]+)/i,
    /totale\s+netto[:\s]+([0-9.,]+)/i,
    /netto\s+erogato[:\s]+([0-9.,]+)/i,
    /da\s+pagare[:\s]+([0-9.,]+)/i,
    /stipendio\s+netto[:\s]+([0-9.,]+)/i,
  ]);

  const irpef = findAfterLabel(t, [
    /irpef[:\s]+([0-9.,]+)/i,
    /ritenuta\s+irpef[:\s]+([0-9.,]+)/i,
    /imposta\s+irpef[:\s]+([0-9.,]+)/i,
  ]);

  const inpsContributions = findAfterLabel(t, [
    /contributi?\s+inps[:\s]+([0-9.,]+)/i,
    /contributi?\s+previdenziali[:\s]+([0-9.,]+)/i,
    /inps[:\s]+([0-9.,]+)/i,
  ]);

  const regionalMunicipalTax = findAfterLabel(t, [
    /addizionale\s+regionale[:\s]+([0-9.,]+)/i,
    /addizionale\s+comunale[:\s]+([0-9.,]+)/i,
    /add\.\s*reg[:\s]+([0-9.,]+)/i,
    /add\.\s*com[:\s]+([0-9.,]+)/i,
  ]);

  const overtimeHours = findAfterLabel(t, [
    /ore\s+straordinar[ie]+[:\s]+([0-9.,]+)/i,
    /straordinari\s+ore[:\s]+([0-9.,]+)/i,
  ]);

  const overtimeAmount = findAfterLabel(t, [
    /straordinari[:\s]+([0-9.,]+)/i,
    /compenso\s+straordinari[:\s]+([0-9.,]+)/i,
  ]);

  const mealVouchers = findAfterLabel(t, [
    /buoni?\s+pasto[:\s]+([0-9.,]+)/i,
    /ticket\s+restaurant[:\s]+([0-9.,]+)/i,
    /buoni?\s+mensa[:\s]+([0-9.,]+)/i,
    /welfare\s+buoni?\s+pasto[:\s]+([0-9.,]+)/i,
  ]);

  const tfrAccruedPeriod = findAfterLabel(t, [
    /tfr\s+maturato\s+nel\s+periodo[:\s]+([0-9.,]+)/i,
    /quota\s+tfr[:\s]+([0-9.,]+)/i,
  ]);

  const tfrTotal = findAfterLabel(t, [
    /tfr\s+accantonato[:\s]+([0-9.,]+)/i,
    /totale\s+tfr[:\s]+([0-9.,]+)/i,
    /trattamento\s+fine\s+rapporto[:\s]+([0-9.,]+)/i,
  ]);

  const employerName = findStringAfterLabel(t, [
    /datore\s+di\s+lavoro[:\s]+([^\n]+)/i,
    /azienda[:\s]+([^\n]+)/i,
    /societ[àa][:\s]+([^\n]+)/i,
  ]);

  // Periodo: cerca "Competenza MESE ANNO" o "Mese MESE ANNO"
  let periodMonth: string | undefined;
  const periodMatch = t.match(/competenza\s+([a-zà-ú]+\s+\d{4})/i)
    ?? t.match(/periodo\s*[:\-]?\s*([a-zà-ú]+\s+\d{4})/i)
    ?? t.match(/mese\s*[:\-]?\s*([a-zà-ú]+\s+\d{4})/i);
  if (periodMatch?.[1]) {
    periodMonth = parseItMonth(periodMatch[1]) ?? undefined;
  }

  // Confidence: alta se abbiamo lordo + netto
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
