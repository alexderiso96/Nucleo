// Parser xlsx separato da csv-parser.ts per isolare la dipendenza da read-excel-file
// (non compatibile con l'ambiente node di Vitest — solo uso browser/universal).

export async function parseXlsxBuffer(
  buffer: ArrayBuffer,
): Promise<{ headers: string[]; records: Record<string, string>[] }> {
  const { default: readXlsxFile } = await import('read-excel-file/universal');
  const sheets = await readXlsxFile(buffer);
  // Sheet = { sheet: string; data: Row[][] }
  const data = sheets[0]?.data ?? [];

  const isDate = (v: unknown): v is Date => v instanceof Date;

  // Trova riga header: prima riga con 3+ celle non vuote (salta righe titolo tipo Intesa)
  let headerIdx = 0;
  for (let i = 0; i < data.length; i++) {
    const nonEmpty = data[i].filter(c => c !== null && String(c).trim() !== '');
    if (nonEmpty.length >= 3) { headerIdx = i; break; }
  }

  // Mappa indice → nome colonna (salta celle vuote)
  const colMap: { idx: number; name: string }[] = [];
  data[headerIdx].forEach((c: unknown, idx: number) => {
    const name = c !== null && c !== undefined ? String(c).trim() : '';
    if (name) colMap.push({ idx, name });
  });
  const headers = colMap.map(c => c.name);

  const records: Record<string, string>[] = [];
  for (let i = headerIdx + 1; i < data.length; i++) {
    const row = data[i];
    const record: Record<string, string> = {};
    let hasData = false;
    for (const { idx, name } of colMap) {
      const cell: unknown = row[idx];
      let val = '';
      if (isDate(cell)) {
        // Formato dd/mm/yyyy compatibile con parseDate in csv-parser.ts
        val = `${String(cell.getDate()).padStart(2, '0')}/${String(cell.getMonth() + 1).padStart(2, '0')}/${cell.getFullYear()}`;
      } else if (cell !== null && cell !== undefined) {
        val = String(cell).trim();
      }
      record[name] = val;
      if (val !== '') hasData = true;
    }
    if (hasData) records.push(record);
  }

  return { headers, records };
}
