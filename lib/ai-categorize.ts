import { GoogleGenerativeAI } from '@google/generative-ai';
import { CATEGORIES } from '@/lib/categories';

const VALID_VALUES = new Set<string>(
  CATEGORIES.filter(c => c.value !== 'income').map(c => c.value),
);

const CAT_DESCRIPTIONS: Record<string, string> = {
  alimentari:      'supermercato, alimentari, drogheria, spesa',
  ristoranti:      'ristorante, bar, fast food, pizza, delivery, colazione, pranzo, cena',
  trasporti:       'benzina, treno, autobus, taxi, parcheggio, Telepass, pedaggio, carburante',
  casa:            'affitto, condominio, mutuo, mobili, bricolage, riparazione casa',
  salute:          'farmacia, medico, dentista, ospedale, analisi, ottico',
  sport:           'palestra, piscina, Decathlon, attrezzatura sportiva, abbonamento fitness',
  abbigliamento:   'vestiti, scarpe, accessori moda, boutique',
  intrattenimento: 'cinema, streaming, Netflix, Spotify, giochi, concerti, eventi',
  utenze:          'bollette luce, gas, acqua, telefono, internet, Tim, Vodafone, Enel',
  altro:           'bonifico generico, prelievo, commissione, trasferimento, tutto il resto',
};

function buildPrompt(descriptions: string[]): string {
  const catList = Object.entries(CAT_DESCRIPTIONS)
    .map(([k, v]) => `- ${k}: ${v}`)
    .join('\n');

  const descList = descriptions
    .map((d, i) => `${i + 1}. "${d}"`)
    .join('\n');

  return `Sei un assistente finanziario italiano. Per ogni descrizione di transazione bancaria assegna la categoria più appropriata.

Categorie disponibili:
${catList}

Descrizioni:
${descList}

Rispondi SOLO con un array JSON di esattamente ${descriptions.length} stringhe, una per descrizione.
Usa solo i valori esatti delle categorie (es: "alimentari", "trasporti").
Esempio con 3 descrizioni: ["alimentari","trasporti","altro"]
Nessuna spiegazione, solo l'array JSON.`;
}

function parseResult(text: string, count: number): string[] {
  const match = text.match(/\[[\s\S]*?\]/);
  if (!match) return Array(count).fill('altro') as string[];
  try {
    const arr = JSON.parse(match[0]) as unknown[];
    return arr.slice(0, count).map(v =>
      typeof v === 'string' && VALID_VALUES.has(v) ? v : 'altro',
    );
  } catch {
    return Array(count).fill('altro') as string[];
  }
}

/**
 * Categorizza in batch un array di descrizioni tramite AI.
 * Una sola chiamata per tutto il batch — Gemini first, Groq fallback.
 * Restituisce un array parallelo di category string.
 */
export async function categorizeWithAI(descriptions: string[]): Promise<string[]> {
  if (descriptions.length === 0) return [];

  const prompt = buildPrompt(descriptions);

  if (process.env.GEMINI_API_KEY) {
    try {
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' });
      const result = await model.generateContent(prompt);
      return parseResult(result.response.text().trim(), descriptions.length);
    } catch { /* fallback */ }
  }

  if (process.env.GROQ_API_KEY) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0,
          max_tokens: 300,
        }),
      });
      const json = await res.json() as { choices?: { message?: { content?: string } }[] };
      const text = json.choices?.[0]?.message?.content?.trim() ?? '';
      return parseResult(text, descriptions.length);
    } catch { /* ignore */ }
  }

  return Array(descriptions.length).fill('altro') as string[];
}
