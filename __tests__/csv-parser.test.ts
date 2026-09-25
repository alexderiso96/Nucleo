import { describe, it, expect } from 'vitest';
import {
  parseDate,
  parseAmount,
  parseRows,
  headersFingerprint,
  autoDetectMapping,
  type ColumnMap,
} from '../lib/csv-parser';

// ── parseDate ─────────────────────────────────────────────────────────────────

describe('parseDate', () => {
  it('parses dd/mm/yyyy', () => {
    const d = parseDate('15/03/2026');
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2026);
    expect(d!.getMonth()).toBe(2); // marzo = 2
    expect(d!.getDate()).toBe(15);
  });

  it('parses yyyy-mm-dd', () => {
    const d = parseDate('2026-03-15');
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2026);
    expect(d!.getMonth()).toBe(2);
    expect(d!.getDate()).toBe(15);
  });

  it('parses dd.mm.yyyy', () => {
    const d = parseDate('15.03.2026');
    expect(d).not.toBeNull();
    expect(d!.getDate()).toBe(15);
  });

  it('parses dd/mm/yyyy HH:MM (ignora orario)', () => {
    const d = parseDate('15/03/2026 10:30');
    expect(d).not.toBeNull();
    expect(d!.getDate()).toBe(15);
    expect(d!.getMonth()).toBe(2);
  });

  it('returns null for "not a date"', () => {
    expect(parseDate('not a date')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseDate('')).toBeNull();
  });
});

// ── parseAmount ───────────────────────────────────────────────────────────────

describe('parseAmount', () => {
  it('parses Italian 1.234,56', () => {
    expect(parseAmount('1.234,56')).toBe(1234.56);
  });

  it('parses 234,56', () => {
    expect(parseAmount('234,56')).toBe(234.56);
  });

  it('parses US 1,234.56', () => {
    expect(parseAmount('1,234.56')).toBe(1234.56);
  });

  it('parses plain integer 1234', () => {
    expect(parseAmount('1234')).toBe(1234);
  });

  it('parses negative -234,56', () => {
    expect(parseAmount('-234,56')).toBe(-234.56);
  });

  it('parses € 1.234,56', () => {
    expect(parseAmount('€ 1.234,56')).toBe(1234.56);
  });

  it('returns null for empty string', () => {
    expect(parseAmount('')).toBeNull();
  });

  it('returns null for N/A', () => {
    expect(parseAmount('N/A')).toBeNull();
  });

  it('returns null for lone dash', () => {
    expect(parseAmount('-')).toBeNull();
  });
});

// ── parseRows ─────────────────────────────────────────────────────────────────

describe('parseRows', () => {
  const map: ColumnMap = {
    date: 'Data',
    amountType: 'single',
    amount: 'Importo',
    description: 'Descrizione',
    sourceName: 'Test',
  };

  it('parses a valid row', () => {
    const rows = parseRows(
      [{ Data: '15/03/2026', Importo: '-45,00', Descrizione: 'Supermercato' }],
      map,
    );
    expect(rows[0].ok).toBe(true);
    if (rows[0].ok) {
      expect(rows[0].amount).toBe(45);
      expect(rows[0].date).toBe('2026-03-15');
      expect(rows[0].description).toBe('Supermercato');
    }
  });

  it('marks empty row as invalid', () => {
    const rows = parseRows([{ Data: '', Importo: '', Descrizione: '' }], map);
    expect(rows[0].ok).toBe(false);
    if (!rows[0].ok) {
      expect(rows[0].reason.toLowerCase()).toContain('vuota');
    }
  });

  it('marks invalid date as failed', () => {
    const rows = parseRows([{ Data: 'notadate', Importo: '45,00', Descrizione: '' }], map);
    expect(rows[0].ok).toBe(false);
  });

  it('marks invalid amount as failed', () => {
    const rows = parseRows([{ Data: '15/03/2026', Importo: 'N/A', Descrizione: '' }], map);
    expect(rows[0].ok).toBe(false);
  });

  it('assigns correct rawIndex (row 2 for first data row)', () => {
    const rows = parseRows([{ Data: '15/03/2026', Importo: '10,00', Descrizione: '' }], map);
    expect(rows[0].rawIndex).toBe(2);
  });
});

// ── headersFingerprint ────────────────────────────────────────────────────────

describe('headersFingerprint', () => {
  it('is order-independent', () => {
    const fp1 = headersFingerprint(['A', 'B', 'C']);
    const fp2 = headersFingerprint(['C', 'A', 'B']);
    expect(fp1).toBe(fp2);
  });

  it('is case-insensitive', () => {
    const fp1 = headersFingerprint(['Data', 'Importo']);
    const fp2 = headersFingerprint(['importo', 'DATA']);
    expect(fp1).toBe(fp2);
  });
});

// ── autoDetectMapping ─────────────────────────────────────────────────────────

describe('autoDetectMapping', () => {
  it('recognises standard single-amount headers', () => {
    const m = autoDetectMapping(['Data Operazione', 'Importo', 'Causale']);
    expect(m.date).toBe('Data Operazione');
    expect(m.amountType).toBe('single');
    expect(m.amount).toBe('Importo');
    expect(m.description).toBe('Causale');
  });

  it('recognises dare/avere split headers', () => {
    const m = autoDetectMapping(['Data', 'Dare', 'Avere', 'Descrizione']);
    expect(m.date).toBe('Data');
    expect(m.amountType).toBe('split');
    expect(m.debit).toBe('Dare');
    expect(m.credit).toBe('Avere');
  });

  it('returns empty object for unknown headers', () => {
    const m = autoDetectMapping(['ColA', 'ColB', 'ColC']);
    expect(m.date).toBeUndefined();
    expect(m.amountType).toBeUndefined();
  });
});
