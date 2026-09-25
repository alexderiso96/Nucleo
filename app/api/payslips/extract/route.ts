export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { pathToFileURL } from 'url';
import { createClient } from '@/lib/supabaseServer';
import { parsePayslipText } from '@/lib/payslip-parser';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let buffer: ArrayBuffer;
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'No file' }, { status: 400 });
    }
    buffer = await (file as File).arrayBuffer();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  try {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');

    // pdfjs-dist v6 richiede un workerSrc esplicito anche in Node.js.
    // Puntiamo al file worker locale; Node.js lo carica come Worker Thread.
    const workerPath = path.resolve(
      process.cwd(),
      'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs',
    );
    pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).toString();

    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(buffer),
      useWorkerFetch: false,
    });
    const pdf = await loadingTask.promise;

    const pageTexts: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();

      // Raggruppamento per riga fisica: usa la coordinata Y del transform
      // (item.transform = [scaleX, skewX, skewY, scaleY, x, y])
      const rowMap = new Map<number, { x: number; text: string }[]>();
      for (const item of content.items) {
        if (!('str' in item) || !item.str.trim()) continue;
        const y = Math.round((item as { transform: number[] }).transform[5]);
        const x = (item as { transform: number[] }).transform[4];
        if (!rowMap.has(y)) rowMap.set(y, []);
        rowMap.get(y)!.push({ x, text: item.str });
      }

      // Ordina le righe dall'alto in basso (Y decrescente in coordinate PDF)
      // poi gli item per X crescente (sinistra→destra)
      const lines = [...rowMap.entries()]
        .sort(([a], [b]) => b - a)
        .map(([, items]) =>
          items.sort((a, b) => a.x - b.x).map(i => i.text).join(' '),
        );

      pageTexts.push(lines.join('\n'));
    }

    const fullText = pageTexts.join('\n');
    const fields = parsePayslipText(fullText);

    // Debug non-sensibile: numeri sostituiti con N, solo struttura testuale
    const stripNums = (s: string) =>
      s.replace(/[0-9]+[.,][0-9]+/g, 'N').replace(/\b\d+\b/g, 'N');
    const textSample = stripNums(fullText); // intero testo, nessun importo

    return NextResponse.json({
      fields,
      _debug: {
        textLength: fullText.length,
        pagesExtracted: pdf.numPages,
        textSample,
        matchedFields: {
          grossAmount: fields.grossAmount !== undefined,
          netAmount: fields.netAmount !== undefined,
          irpef: fields.irpef !== undefined,
          inps: fields.inpsContributions !== undefined,
          period: fields.periodMonth !== undefined,
          employer: fields.employerName !== undefined,
        },
      },
    });
  } catch (err) {
    // Log solo il tipo di errore, mai il contenuto del PDF (dati finanziari)
    const message = err instanceof Error ? err.message : 'unknown';
    console.error('[payslips/extract] PDF parse failed:', message);
    return NextResponse.json({
      fields: { confidence: 'low' as const },
    });
  }
}
