import { NextResponse, type NextRequest } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@/lib/supabaseServer';
import { CATEGORIES } from '@/lib/categories';

const cache = new Map<string, string>();

function firstOfMonth(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-01`;
}
function lastOfMonth(year: number, month: number): string {
  return new Date(year, month + 1, 0).toISOString().split('T')[0];
}
function todayKey(): string {
  return new Date().toISOString().split('T')[0];
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ text: null }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const monthParam = searchParams.get('month');
  let year: number, month: number;
  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    [year, month] = monthParam.split('-').map(Number);
    month -= 1;
  } else {
    const now = new Date();
    year = now.getFullYear();
    month = now.getMonth();
  }

  const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
  const cacheKey = `${user.id}:${monthKey}:${todayKey()}`;
  if (cache.has(cacheKey)) {
    return NextResponse.json({ text: cache.get(cacheKey) });
  }

  const { data: expenses } = await supabase
    .from('expenses')
    .select('category, amount, is_income')
    .eq('user_id', user.id)
    .gte('expense_date', firstOfMonth(year, month))
    .lte('expense_date', lastOfMonth(year, month));

  const outgoing = (expenses ?? []).filter(e => !e.is_income);
  if (outgoing.length === 0) return NextResponse.json({ text: null });

  const byCategory: Record<string, number> = {};
  for (const e of outgoing) {
    byCategory[e.category] = (byCategory[e.category] ?? 0) + Number(e.amount);
  }
  const total = Object.values(byCategory).reduce((s, v) => s + v, 0);

  const lines = Object.entries(byCategory)
    .sort(([, a], [, b]) => b - a)
    .map(([cat, amt]) => {
      const meta = CATEGORIES.find(c => c.value === cat);
      const icon = meta?.icon ?? '📦';
      const label = meta?.label ?? cat;
      return `- ${icon} ${label}: €${amt.toFixed(0)}`;
    })
    .join('\n');

  const userPrompt = `${lines}\nTotale uscite: €${total.toFixed(0)}`;

  try {
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY ?? '');
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      systemInstruction: 'Sei un assistente finanziario personale italiano. Analizza le spese mensili e scrivi esattamente 1-2 frasi (max 30 parole totali) come osservazione utile e diretta. Non usare markdown, elenchi, intestazioni. Sii specifico sui numeri. In italiano.',
    });
    const result = await model.generateContent(userPrompt);
    const text = result.response.text().trim();
    cache.set(cacheKey, text);
    return NextResponse.json({ text });
  } catch {
    return NextResponse.json({ text: null });
  }
}
