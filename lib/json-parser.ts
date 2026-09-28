export interface NucleoJsonRow {
  date: string;
  amount: number;
  description: string | null;
  isIncome: boolean;
}

export function parseNucleoJson(text: string): { valid: NucleoJsonRow[]; errors: string[] } {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch {
    return { valid: [], errors: ['JSON non valido: controlla la sintassi.'] };
  }
  if (!Array.isArray(raw))
    return { valid: [], errors: ['Il JSON deve essere un array di oggetti.'] };

  const valid: NucleoJsonRow[] = [];
  const errors: string[] = [];

  for (let i = 0; i < (raw as unknown[]).length; i++) {
    const row = (raw as unknown[])[i] as Record<string, unknown>;
    if (typeof row !== 'object' || row === null) {
      errors.push(`Elemento ${i + 1}: non è un oggetto`);
      continue;
    }

    const isItalian = 'data' in row || 'importo' in row;
    let date: string, amount: number, description: string | null, isIncome: boolean;

    if (isItalian) {
      if (typeof row.data !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(row.data)) {
        errors.push(`Elemento ${i + 1}: "data" deve essere "YYYY-MM-DD"`);
        continue;
      }
      if (typeof row.importo !== 'number' || row.importo === 0 || !isFinite(row.importo)) {
        errors.push(`Elemento ${i + 1}: "importo" deve essere un numero diverso da zero`);
        continue;
      }
      date = row.data;
      amount = Math.abs(row.importo);
      description = typeof row.descrizione === 'string' ? row.descrizione : null;
      isIncome = typeof row.tipo === 'string'
        ? row.tipo.toLowerCase() === 'accredito'
        : row.importo > 0;
    } else {
      if (typeof row.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(row.date)) {
        errors.push(`Elemento ${i + 1}: "date" deve essere "YYYY-MM-DD"`);
        continue;
      }
      if (typeof row.amount !== 'number' || row.amount <= 0 || !isFinite(row.amount)) {
        errors.push(`Elemento ${i + 1}: "amount" deve essere un numero positivo`);
        continue;
      }
      date = row.date;
      amount = row.amount;
      description = typeof row.description === 'string' ? row.description : null;
      isIncome = row.isIncome === true;
    }

    valid.push({ date, amount, description, isIncome });
  }
  return { valid, errors };
}
