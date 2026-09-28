export interface ColumnMap {
  date: string;
  amountType: 'single' | 'split';
  amount?: string;
  debit?: string;
  credit?: string;
  description?: string;
  sourceName: string;
  typeColumn?: string;
  typeFilter?: 'debit' | 'credit' | 'all';
  // per colonna singola con segno: filtra per segno dell'importo
  signFilter?: 'negative' | 'positive' | 'all';
}

export type ParsedRow =
  | { ok: true; date: string; amount: number; description: string | null; rawIndex: number }
  | { ok: false; reason: string; rawIndex: number };

// ── Encoding ─────────────────────────────────────────────────────────────────

export function decodeBuffer(buffer: ArrayBuffer): { text: string; encoding: string } {
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    return { text, encoding: 'UTF-8' };
  } catch {
    const text = new TextDecoder('windows-1252').decode(buffer);
    return { text, encoding: 'Windows-1252' };
  }
}

// ── Fingerprint ───────────────────────────────────────────────────────────────

export function headersFingerprint(headers: string[]): string {
  return [...headers]
    .map(h => h.trim().toLowerCase())
    .sort()
    .join('|');
}

// ── Auto-detect colonne banche italiane ───────────────────────────────────────

const DATE_PATTERNS = [
  'data operazione', 'data valuta', 'data contabile', 'data di valuta',
  'data', 'date',
];

const AMOUNT_PATTERNS = ['importo €', 'importo', 'amount', 'valore', 'ammontare'];

const DEBIT_PATTERNS = ['dare', 'uscite', 'addebito', 'uscita'];
const CREDIT_PATTERNS = ['avere', 'entrate', 'accredito', 'entrata'];

const DESC_PATTERNS = [
  'causale/descrizione', 'causale descrizione', 'descrizione', 'causale',
  'dettagli', 'nota', 'memo',
];

const TYPE_PATTERNS = ['tipo operazione', 'tipo movimento', 'tipo transazione', 'tipo'];
const DEBIT_TYPE_KEYWORDS = ['addebito', 'pagamento', 'uscita', 'dare', 'debit'];
const CREDIT_TYPE_KEYWORDS = ['accredito', 'entrata', 'avere', 'credit', 'stipendio'];

function matchHeader(headers: string[], patterns: string[]): string | undefined {
  const lower = headers.map(h => h.trim().toLowerCase());
  for (const pattern of patterns) {
    const idx = lower.findIndex(h => h === pattern || h.includes(pattern));
    if (idx !== -1) return headers[idx];
  }
  return undefined;
}

// ── isEmptyAmount ─────────────────────────────────────────────────────────────
// Considera vuota una cella che è blank, "-", "0", "0,00", "0.00", ecc.

function isEmptyAmount(s: string | undefined): boolean {
  if (!s || s.trim() === '' || s.trim() === '-') return true;
  const n = parseAmount(s.trim());
  return n === null || n === 0;
}

// ── detectSignConvention ──────────────────────────────────────────────────────
// Analizza i valori della colonna importo per capire quale segno indica un'uscita.

export function detectSignConvention(
  records: Record<string, string>[],
  amountCol: string,
): 'negative' | 'positive' | 'all' {
  let hasNeg = false;
  let hasPos = false;
  // Scansiona tutti i record con early-exit appena trovati entrambi i segni
  for (const r of records) {
    const n = parseAmount(r[amountCol]?.trim() ?? '');
    if (n === null) continue;
    if (n < 0) hasNeg = true;
    if (n > 0) hasPos = true;
    if (hasNeg && hasPos) break;
  }
  // Se ci sono sia positivi che negativi → addebiti = negativi (standard IT)
  if (hasNeg && hasPos) return 'negative';
  return 'all';
}

export function autoDetectMapping(headers: string[], records?: Record<string, string>[]): Partial<ColumnMap> {
  const result: Partial<ColumnMap> = {};

  const dateCol = matchHeader(headers, DATE_PATTERNS);
  if (dateCol) result.date = dateCol;

  const debitCol = matchHeader(headers, DEBIT_PATTERNS);
  const creditCol = matchHeader(headers, CREDIT_PATTERNS);

  if (debitCol || creditCol) {
    result.amountType = 'split';
    if (debitCol) result.debit = debitCol;
    if (creditCol) result.credit = creditCol;
  } else {
    const amountCol = matchHeader(headers, AMOUNT_PATTERNS);
    if (amountCol) {
      result.amountType = 'single';
      result.amount = amountCol;
    }
  }

  const descCol = matchHeader(headers, DESC_PATTERNS);
  if (descCol) result.description = descCol;

  const typeCol = matchHeader(headers, TYPE_PATTERNS);
  if (typeCol) {
    result.typeColumn = typeCol;
    result.typeFilter = 'debit';
  }

  // Per colonna singola: rileva convenzione del segno dai dati reali
  if (result.amountType === 'single' && result.amount && records?.length) {
    result.signFilter = detectSignConvention(records, result.amount);
  }

  return result;
}

// ── Parse date ────────────────────────────────────────────────────────────────
// Supporta: dd/mm/yyyy, dd.mm.yyyy, yyyy-mm-dd, dd-mm-yyyy
// Tronca eventuale orario finale.

export function parseDate(s: string): Date | null {
  if (!s || !s.trim()) return null;
  const raw = s.trim().split(/\s+/)[0]; // tronca orario

  // dd/mm/yyyy o dd.mm.yyyy
  const dmy = raw.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    const dt = new Date(Number(y), Number(m) - 1, Number(d));
    if (isNaN(dt.getTime())) return null;
    return dt;
  }

  // yyyy-mm-dd
  const ymd = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymd) {
    const [, y, m, d] = ymd;
    const dt = new Date(Number(y), Number(m) - 1, Number(d));
    if (isNaN(dt.getTime())) return null;
    return dt;
  }

  // dd-mm-yyyy
  const dmy2 = raw.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dmy2) {
    const [, d, m, y] = dmy2;
    const dt = new Date(Number(y), Number(m) - 1, Number(d));
    if (isNaN(dt.getTime())) return null;
    return dt;
  }

  return null;
}

// ── Parse importo ─────────────────────────────────────────────────────────────
// Italiano: "1.234,56" o "234,56"
// US: "1,234.56"
// Senza migliaia: "1234"
// Gestisce segno, simbolo €, spazi.

export function parseAmount(s: string): number | null {
  if (!s || !s.trim()) return null;

  let cleaned = s.trim()
    .replace(/−/g, '-') // segno meno Unicode (Excel)
    .replace(/€/g, '')
    .replace(/\s/g, '');
  if (cleaned === '' || cleaned === '-' || cleaned === '+') return null;

  const negative = cleaned.startsWith('-');
  cleaned = cleaned.replace(/^[+-]/, '');

  // Formato italiano: punto migliaia, virgola decimale
  // Distingui da US: se c'è sia "." che "," guarda quale viene per ultimo
  const hasDot = cleaned.includes('.');
  const hasComma = cleaned.includes(',');

  let normalized: string;

  if (hasDot && hasComma) {
    const lastDot = cleaned.lastIndexOf('.');
    const lastComma = cleaned.lastIndexOf(',');
    if (lastComma > lastDot) {
      // italiano: 1.234,56
      normalized = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      // US: 1,234.56
      normalized = cleaned.replace(/,/g, '');
    }
  } else if (hasComma && !hasDot) {
    // solo virgola → decimale italiano: 234,56
    normalized = cleaned.replace(',', '.');
  } else {
    // solo punto o nessuno
    normalized = cleaned;
  }

  const n = parseFloat(normalized);
  if (isNaN(n)) return null;

  return negative ? -n : n;
}

// ── toISODate ─────────────────────────────────────────────────────────────────

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ── parseRows ─────────────────────────────────────────────────────────────────

export function parseRows(
  records: Record<string, string>[],
  map: ColumnMap,
): ParsedRow[] {
  return records.map((row, i) => {
    const rawIndex = i + 2; // riga 1 = header

    // Riga vuota: tutte le celle sono vuote
    const vals = Object.values(row).map(v => v.trim());
    if (vals.every(v => v === '')) {
      return { ok: false, reason: 'Riga vuota', rawIndex };
    }

    // Data
    const rawDate = row[map.date]?.trim() ?? '';
    const parsedDate = parseDate(rawDate);
    if (!parsedDate) {
      return { ok: false, reason: `Data non valida: "${rawDate}"`, rawIndex };
    }

    // Importo
    let rawAmount: string;
    if (map.amountType === 'split') {
      const debit = map.debit ? row[map.debit]?.trim() : '';
      const credit = map.credit ? row[map.credit]?.trim() : '';
      // isEmptyAmount gestisce blank, "-", "0", "0,00", "0.00"
      const hasDebit = !isEmptyAmount(debit);
      const hasCredit = !isEmptyAmount(credit);

      // Determina tipo di movimento e applica filtro (default: solo addebiti)
      const filter = map.typeFilter ?? 'debit';
      if (filter !== 'all') {
        if (filter === 'debit' && !hasDebit && hasCredit) {
          return { ok: false, reason: `Accredito ignorato`, rawIndex };
        }
        if (filter === 'credit' && hasDebit && !hasCredit) {
          return { ok: false, reason: `Addebito ignorato`, rawIndex };
        }
      }

      rawAmount = hasDebit ? debit! : (credit ?? '');
    } else {
      rawAmount = map.amount ? row[map.amount]?.trim() ?? '' : '';
    }

    const parsedAmount = parseAmount(rawAmount);
    if (parsedAmount === null) {
      return { ok: false, reason: `Importo non valido: "${rawAmount}"`, rawIndex };
    }

    // Filtro per segno (colonna singola con valori +/-)
    if (map.amountType === 'single' && map.signFilter && map.signFilter !== 'all') {
      if (map.signFilter === 'negative' && parsedAmount > 0) {
        return { ok: false, reason: `Accredito ignorato (importo positivo)`, rawIndex };
      }
      if (map.signFilter === 'positive' && parsedAmount < 0) {
        return { ok: false, reason: `Accredito ignorato (importo negativo)`, rawIndex };
      }
    }

    // Filtro tipo da colonna testuale (es. "Addebito" / "Accredito")
    if (map.typeColumn && map.typeFilter && map.typeFilter !== 'all') {
      const rawType = (row[map.typeColumn] ?? '').trim().toLowerCase();
      const isCredit = CREDIT_TYPE_KEYWORDS.some(k => rawType.includes(k));
      const isDebit = DEBIT_TYPE_KEYWORDS.some(k => rawType.includes(k));
      if (map.typeFilter === 'debit' && isCredit && !isDebit) {
        return { ok: false, reason: `Accredito ignorato: "${row[map.typeColumn]}"`, rawIndex };
      }
      if (map.typeFilter === 'credit' && isDebit && !isCredit) {
        return { ok: false, reason: `Addebito ignorato: "${row[map.typeColumn]}"`, rawIndex };
      }
    }

    const description = map.description
      ? (row[map.description]?.trim() || null)
      : null;

    return {
      ok: true,
      date: toISODate(parsedDate),
      amount: Math.abs(parsedAmount),
      description,
      rawIndex,
    };
  });
}
