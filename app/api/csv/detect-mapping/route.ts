export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabaseServer';
import { GoogleGenerativeAI } from '@google/generative-ai';

const PROMPT = (fileName: string, table: string) => `Sei un assistente che analizza estratti conto bancari italiani in formato CSV/Excel.

Ecco le prime righe del file "${fileName}":
\`\`\`
${table}
\`\`\`

Identifica i ruoli delle colonne e restituisci SOLO un oggetto JSON (senza markdown, senza commenti) con questa struttura:
{
  "date": "nome_esatta_colonna_data",
  "amountType": "single" | "split",
  "amount": "nome_colonna" (solo se amountType=single, ometti altrimenti),
  "debit": "nome_colonna" (solo se amountType=split, ometti altrimenti),
  "credit": "nome_colonna" (solo se amountType=split, ometti altrimenti),
  "description": "nome_colonna" | null,
  "typeColumn": "nome_colonna" | null,
  "signFilter": "negative" | "positive" | "all" (solo se amountType=single),
  "reasoning": "breve spiegazione in italiano"
}

Regole:
- Usa i nomi ESATTI delle colonne come appaiono nel file (maiuscole/minuscole incluse)
- amountType=split: colonna "Dare"/"Addebito"/"Uscite" → "debit"; "Avere"/"Accredito"/"Entrate" → "credit"
- amountType=single con segno: in estratti conto italiani le uscite sono di solito NEGATIVE → signFilter="negative"
- Se non identifichi una colonna, ometti il campo (non mettere null per amountType, date, o i required)
- description e typeColumn possono essere null se non presenti`;

function buildTable(headers: string[], rows: Record<string, string>[]): string {
  const lines = [
    headers.join(' | '),
    headers.map(() => '---').join(' | '),
    ...rows.slice(0, 6).map(r => headers.map(h => (r[h] ?? '').slice(0, 30)).join(' | ')),
  ];
  return lines.join('\n');
}

function parseJsonFromText(text: string): Record<string, unknown> {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Nessun JSON trovato nella risposta');
  return JSON.parse(match[0]) as Record<string, unknown>;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json() as {
    headers: string[];
    rows: Record<string, string>[];
    fileName?: string;
  };

  if (!body.headers?.length || !body.rows?.length) {
    return NextResponse.json({ error: 'Headers e righe richiesti' }, { status: 400 });
  }

  const table = buildTable(body.headers, body.rows);
  const prompt = PROMPT(body.fileName ?? 'estratto.csv', table);

  // Prova Gemini
  if (process.env.GEMINI_API_KEY) {
    try {
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' });
      const result = await model.generateContent(prompt);
      const parsed = parseJsonFromText(result.response.text().trim());
      const { reasoning, ...mapping } = parsed;
      return NextResponse.json({ mapping, reasoning });
    } catch { /* fallback a Groq */ }
  }

  // Fallback Groq
  if (process.env.GROQ_API_KEY) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0,
          max_tokens: 600,
        }),
      });
      const json = await res.json() as { choices?: { message?: { content?: string } }[] };
      const text = json.choices?.[0]?.message?.content?.trim() ?? '';
      const parsed = parseJsonFromText(text);
      const { reasoning, ...mapping } = parsed;
      return NextResponse.json({ mapping, reasoning });
    } catch { /* ignora */ }
  }

  return NextResponse.json({ error: 'Nessun provider AI configurato' }, { status: 500 });
}
