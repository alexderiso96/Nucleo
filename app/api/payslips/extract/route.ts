export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { pathToFileURL } from 'url';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Groq from 'groq-sdk';
import { createClient } from '@/lib/supabaseServer';

const JSON_SCHEMA = `{
  "periodMonth": "YYYY-MM-01 oppure null",
  "grossAmount": "float oppure null — retribuzione lorda / totale competenze",
  "netAmount": "float oppure null — netto in pagamento / netto erogato",
  "irpef": "float oppure null",
  "inpsContributions": "float oppure null — contributi INPS a carico dipendente",
  "regionalMunicipalTax": "float oppure null — addizionale regionale + comunale",
  "overtimeHours": "float oppure null",
  "overtimeAmount": "float oppure null",
  "mealVouchers": "float oppure null — buoni pasto",
  "tfrAccruedPeriod": "float oppure null — TFR maturato nel periodo",
  "tfrTotal": "float oppure null — TFR totale accantonato",
  "employerName": "stringa oppure null"
}`;

const SYSTEM_INSTRUCTION = `Sei un esperto di buste paga italiane (LUL - Libro Unico del Lavoro).
Analizza la busta paga e restituisci SOLO un oggetto JSON valido con questo schema (null se non presente):
${JSON_SCHEMA}
I numeri italiani: punto = migliaia, virgola = decimale (es. 2.500,00 → 2500.00). Convertili in float.
Rispondi SOLO con il JSON, senza markdown né spiegazioni.`;

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseExtracted(raw: string): Record<string, unknown> {
  const json = raw.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
  return JSON.parse(json) as Record<string, unknown>;
}

function buildFields(extracted: Record<string, unknown>) {
  const num = (v: unknown): number | undefined =>
    v !== null && v !== undefined && !isNaN(Number(v)) ? Number(v) : undefined;

  const grossAmount = num(extracted.grossAmount);
  const netAmount   = num(extracted.netAmount);
  const confidence: 'high' | 'low' =
    grossAmount !== undefined && netAmount !== undefined ? 'high' : 'low';

  return {
    periodMonth:          typeof extracted.periodMonth === 'string' ? extracted.periodMonth : undefined,
    grossAmount,
    netAmount,
    irpef:                num(extracted.irpef),
    inpsContributions:    num(extracted.inpsContributions),
    regionalMunicipalTax: num(extracted.regionalMunicipalTax),
    overtimeHours:        num(extracted.overtimeHours),
    overtimeAmount:       num(extracted.overtimeAmount),
    mealVouchers:         num(extracted.mealVouchers),
    tfrAccruedPeriod:     num(extracted.tfrAccruedPeriod),
    tfrTotal:             num(extracted.tfrTotal),
    employerName:         typeof extracted.employerName === 'string' ? extracted.employerName : undefined,
    confidence,
  };
}

// ── Estrazione testo con pdfjs (usata dal fallback Groq) ─────────────────────

async function extractTextFromPdf(buffer: ArrayBuffer): Promise<string> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const workerPath = path.resolve(
    process.cwd(),
    'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs',
  );
  pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).toString();

  const pdf = await pdfjs.getDocument({ data: new Uint8Array(buffer), useWorkerFetch: false }).promise;
  let fullText = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();

    const rowMap = new Map<number, { x: number; text: string }[]>();
    for (const item of content.items) {
      if (!('str' in item) || !item.str.trim()) continue;
      const y = Math.round((item as { transform: number[] }).transform[5] / 3) * 3;
      const x = (item as { transform: number[] }).transform[4];
      if (!rowMap.has(y)) rowMap.set(y, []);
      rowMap.get(y)!.push({ x, text: item.str });
    }

    const lines = [...rowMap.entries()]
      .sort(([a], [b]) => b - a)
      .map(([, items]) => items.sort((a, b) => a.x - b.x).map(i => i.text).join('  '));

    fullText += lines.join('\n') + '\n\n';
  }

  return fullText;
}

// ── Provider 1: Google Gemini (PDF nativo, gratuito) ─────────────────────────

async function extractWithGemini(buffer: ArrayBuffer): Promise<Record<string, unknown>> {
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    systemInstruction: SYSTEM_INSTRUCTION,
  });

  const result = await model.generateContent([
    {
      inlineData: {
        mimeType: 'application/pdf',
        data: Buffer.from(buffer).toString('base64'),
      },
    },
    'Estrai i dati da questa busta paga italiana e restituisci il JSON richiesto.',
  ]);

  return parseExtracted(result.response.text());
}

// ── Provider 2: Groq LLaMA (testo estratto da pdfjs, gratuito) ───────────────

async function extractWithGroq(buffer: ArrayBuffer): Promise<Record<string, unknown>> {
  const text = await extractTextFromPdf(buffer);
  if (!text.trim()) throw new Error('empty text');

  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  const chat = await groq.chat.completions.create({
    model: 'llama-3.1-8b-instant',
    messages: [
      { role: 'system', content: SYSTEM_INSTRUCTION },
      { role: 'user',   content: `Testo busta paga:\n\n${text.slice(0, 6000)}` },
    ],
    response_format: { type: 'json_object' },
    temperature: 0,
    max_tokens: 512,
  });

  return parseExtracted(chat.choices[0]?.message?.content ?? '{}');
}

// ── Route principale ──────────────────────────────────────────────────────────

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

  // Prova Gemini → fallback Groq → fallback manuale
  const providers: Array<{ name: string; fn: () => Promise<Record<string, unknown>> }> = [
    { name: 'gemini', fn: () => extractWithGemini(buffer) },
    { name: 'groq',   fn: () => extractWithGroq(buffer)   },
  ];

  for (const { name, fn } of providers) {
    try {
      const extracted = await fn();
      return NextResponse.json({ fields: buildFields(extracted) });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown';
      console.error(`[payslips/extract] ${name} failed:`, msg);
    }
  }

  return NextResponse.json({ fields: { confidence: 'low' as const } });
}
