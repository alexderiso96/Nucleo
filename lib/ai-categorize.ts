import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@/lib/supabaseServer';
import { CATEGORIES } from '@/lib/categories';

export interface NewCategory {
  isNew: true;
  value: string;
  label: string;
  icon: string;
  color: string;
}

export type AICategory = string | NewCategory;

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
};

function buildPrompt(descriptions: string[], userCats: { value: string; label: string }[]): string {
  const builtInList = Object.entries(CAT_DESCRIPTIONS)
    .map(([k, v]) => `- ${k}: ${v}`)
    .join('\n');

  const userCatList = userCats.length > 0
    ? '\n\nCategorie personalizzate utente:\n' +
      userCats.map(c => `- ${c.value}: ${c.label}`).join('\n')
    : '';

  const descList = descriptions.map((d, i) => `${i + 1}. "${d}"`).join('\n');

  return `Sei un assistente finanziario italiano. Per ogni descrizione di transazione bancaria assegna la categoria più appropriata.

Categorie predefinite:
${builtInList}${userCatList}
- altro: tutto ciò che non rientra nelle categorie sopra

Se la descrizione appartiene chiaramente a una categoria NON ancora esistente (non "altro"), proponi una nuova categoria con questo oggetto JSON:
{"isNew":true,"value":"slug_minuscolo","label":"Nome Italiano","icon":"emoji","color":"#hexcolor"}
Usa "isNew" solo quando la categoria mancante è ovvia e ricorrente (es: assicurazione, viaggi, istruzione, animali). Non abusare: preferisci categorie esistenti quando possibile.

Descrizioni:
${descList}

Rispondi SOLO con un array JSON di esattamente ${descriptions.length} elementi.
Ogni elemento è una stringa (categoria esistente) o un oggetto {"isNew":true,...} (nuova categoria).
Esempio: ["alimentari",{"isNew":true,"value":"assicurazione","label":"Assicurazione","icon":"🛡️","color":"#3b82f6"},"trasporti"]
Nessuna spiegazione, solo l'array JSON.`;
}

function parseResult(text: string, count: number): AICategory[] {
  const match = text.match(/\[[\s\S]*?\]/);
  if (!match) return Array(count).fill('altro') as string[];
  try {
    const arr = JSON.parse(match[0]) as unknown[];
    return arr.slice(0, count).map(v => {
      if (typeof v === 'string') return VALID_VALUES.has(v) ? v : 'altro';
      if (v && typeof v === 'object') {
        const obj = v as Record<string, unknown>;
        if (obj.isNew !== true) return 'altro';
        const value = String(obj.value ?? '').toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 40);
        const label = String(obj.label ?? value);
        const icon  = String(obj.icon  ?? '📦').slice(0, 4);
        const color = /^#[0-9a-f]{6}$/i.test(String(obj.color ?? '')) ? String(obj.color) : '#6366f1';
        if (!value) return 'altro';
        return { isNew: true as const, value, label, icon, color };
      }
      return 'altro';
    });
  } catch {
    return Array(count).fill('altro') as string[];
  }
}

export async function categorizeWithAI(
  descriptions: string[],
  userCats: { value: string; label: string }[] = [],
): Promise<AICategory[]> {
  if (descriptions.length === 0) return [];

  console.log(`[ai] categorizeWithAI count=${descriptions.length} GEMINI=${!!process.env.GEMINI_API_KEY} GROQ=${!!process.env.GROQ_API_KEY}`);

  const prompt = buildPrompt(descriptions, userCats);

  if (process.env.GEMINI_API_KEY) {
    try {
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' });
      const result = await model.generateContent(prompt);
      const raw = result.response.text().trim();
      console.log('[ai] Gemini raw response (first 300):', raw.slice(0, 300));
      const parsed = parseResult(raw, descriptions.length);
      console.log('[ai] Gemini parsed:', parsed);
      return parsed;
    } catch (err) {
      console.error('[ai] Gemini error:', err instanceof Error ? err.message : String(err));
    }
  }

  if (process.env.GROQ_API_KEY) {
    // Modelli in ordine di preferenza — saltiamo quelli rimossi automaticamente
    const groqModels = process.env.GROQ_MODEL
      ? [process.env.GROQ_MODEL]
      : [
          'openai/gpt-oss-20b',    // ottimale per categorizzazione: veloce, gratis
          'openai/gpt-oss-120b',   // fallback più capace
        ];

    for (const model of groqModels) {
      try {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          },
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0,
            max_tokens: 1000,
          }),
        });

        if (res.status === 400 || res.status === 404) {
          const errBody = await res.text();
          console.warn(`[ai] Groq model "${model}" non disponibile (${res.status}), provo il prossimo`);
          if (errBody.includes('decommissioned') || errBody.includes('does not exist')) continue;
          // Altro errore 400 non legato al modello
          console.error(`[ai] Groq HTTP ${res.status}:`, errBody.slice(0, 200));
          break;
        }

        if (!res.ok) {
          const errBody = await res.text();
          console.error(`[ai] Groq HTTP ${res.status}:`, errBody.slice(0, 300));
          break;
        }

        const json = await res.json() as {
          choices?: { message?: { content?: string } }[];
          error?: { message: string; type?: string };
        };
        if (json.error) {
          console.error('[ai] Groq API error:', json.error.message);
          break;
        }

        const raw = json.choices?.[0]?.message?.content?.trim() ?? '';
        console.log(`[ai] Groq model="${model}" raw (first 500):`, raw.slice(0, 500));
        const parsed = parseResult(raw, descriptions.length);
        console.log('[ai] Groq parsed:', parsed);
        return parsed;
      } catch (err) {
        console.error(`[ai] Groq model="${model}" exception:`, err instanceof Error ? err.message : String(err));
        break;
      }
    }
  }

  console.warn('[ai] nessuna API key configurata — fallback a tutto "altro"');
  return Array(descriptions.length).fill('altro') as string[];
}

/**
 * Risolve i risultati AI: crea le categorie nuove in user_categories e
 * restituisce un array parallelo di stringhe (valori categoria).
 */
export async function resolveAICategories(
  results: AICategory[],
  userId: string,
): Promise<string[]> {
  const supabase = await createClient();

  // Collect unique new categories first to avoid duplicate inserts
  const newCats = new Map<string, NewCategory>();
  for (const r of results) {
    if (typeof r !== 'string' && !newCats.has(r.value)) {
      newCats.set(r.value, r);
    }
  }

  for (const [value, cat] of newCats) {
    const { data: existing } = await supabase
      .from('user_categories')
      .select('value')
      .eq('user_id', userId)
      .eq('value', value)
      .maybeSingle();

    if (!existing) {
      await supabase.from('user_categories').insert({
        user_id: userId,
        value:   cat.value,
        label:   cat.label,
        icon:    cat.icon,
        color:   cat.color,
      });
    }
  }

  return results.map(r => (typeof r === 'string' ? r : r.value));
}
