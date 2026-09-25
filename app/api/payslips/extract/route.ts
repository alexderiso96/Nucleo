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
      const pageText = content.items
        .map((item) => ('str' in item ? (item.str ?? '') : ''))
        .join(' ');
      pageTexts.push(pageText);
    }

    const fullText = pageTexts.join('\n');
    const fields = parsePayslipText(fullText);
    return NextResponse.json({ fields });
  } catch (err) {
    // Log solo il tipo di errore, mai il contenuto del PDF (dati finanziari)
    const message = err instanceof Error ? err.message : 'unknown';
    console.error('[payslips/extract] PDF parse failed:', message);
    return NextResponse.json({
      fields: { confidence: 'low' as const },
    });
  }
}
