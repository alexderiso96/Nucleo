// Script one-shot: inserisce regole merchant globali (user_id = null) via Supabase REST
// Uso: node scripts/insert-global-rules.mjs

const SUPABASE_URL = 'https://hklcenrtxpxbbksmvgcb.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
  console.error('Manca SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const HEADERS = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
  'apikey': SERVICE_ROLE_KEY,
};

// ── REGOLE GLOBALI ────────────────────────────────────────────────────────────
// Pattern: stringa normalizzata (lowercase, senza accenti, solo a-z0-9 spazi)
// Categoria: valori built-in (alimentari, ristoranti, trasporti, casa, salute,
//            sport, abbigliamento, intrattenimento, utenze, altro)
const RULES = [
  // ── ABBIGLIAMENTO ──────────────────────────────────────────────────────────
  { pattern: 'calzedonia',            category: 'abbigliamento' },
  { pattern: 'intimissimi',           category: 'abbigliamento' },
  { pattern: 'chic di erredue',       category: 'abbigliamento' },
  { pattern: 'citta della scarpa',    category: 'abbigliamento' },
  { pattern: 'angolo pelletteria',    category: 'abbigliamento' },
  { pattern: 'liu jo uomo',           category: 'abbigliamento' },
  { pattern: 'michael kors',          category: 'abbigliamento' },
  { pattern: 'ovs kids',             category: 'abbigliamento' },
  { pattern: 'primark',              category: 'abbigliamento' },
  { pattern: 'zara',                 category: 'abbigliamento' },
  { pattern: 'civico 36',            category: 'abbigliamento' },
  { pattern: 'cs pompei cc max',     category: 'abbigliamento' },
  { pattern: 'paris srls',           category: 'abbigliamento' },
  { pattern: 'plata',                category: 'abbigliamento' },
  { pattern: 'square store',         category: 'abbigliamento' },
  { pattern: 'privalia',             category: 'abbigliamento' },

  // ── ALIMENTARI ────────────────────────────────────────────────────────────
  { pattern: 'amabili tradizioni',   category: 'alimentari' },
  { pattern: 'caseificio',           category: 'alimentari' },
  { pattern: 'macelleria',           category: 'alimentari' },
  { pattern: 'panificio michelangelo', category: 'alimentari' },
  { pattern: 'salumeria di rosa',    category: 'alimentari' },
  { pattern: 'cb cannavale',         category: 'alimentari' },
  { pattern: 'deco',                 category: 'alimentari' }, // Supermercati Decò
  { pattern: 'gesca retail',         category: 'alimentari' },
  { pattern: 'mandara',              category: 'alimentari' },
  { pattern: 'a2 market',            category: 'alimentari' },
  { pattern: 'dodeca',               category: 'alimentari' }, // Dodecà
  { pattern: 'gragnano food',        category: 'alimentari' },
  { pattern: 'il supermercato',      category: 'alimentari' },
  { pattern: 'maiora',               category: 'alimentari' },
  { pattern: 'sole365',              category: 'alimentari' },
  { pattern: 'super genio',          category: 'alimentari' },
  { pattern: 'supercapri',           category: 'alimentari' },
  { pattern: 'conad',                category: 'alimentari' },
  { pattern: 'eurospin',             category: 'alimentari' },
  { pattern: 'lidl',                 category: 'alimentari' },

  // ── SALUTE (incluse farmacia e bellezza) ──────────────────────────────────
  { pattern: 'be beauty',            category: 'salute' },
  { pattern: 'ferdy s hair style',   category: 'salute' }, // Ferdy's → ferdy s
  { pattern: 'le coccole',           category: 'salute' },
  { pattern: 'catello savarese',     category: 'salute' },
  { pattern: 'emirad',               category: 'salute' },
  { pattern: 'nashi store pompeii',  category: 'salute' },
  { pattern: 'sumup santanie',       category: 'salute' },
  { pattern: 'farmacia fimiani',     category: 'salute' },
  { pattern: 'farmacia il pavone',   category: 'salute' },
  { pattern: 'farmacia internazionale', category: 'salute' },
  { pattern: 'farmacia kyros',       category: 'salute' },
  { pattern: 'farmacia schettino',   category: 'salute' },
  { pattern: 'redcare',              category: 'salute' },
  { pattern: 'dott de riso',         category: 'salute' },

  // ── CASA ──────────────────────────────────────────────────────────────────
  { pattern: 'casa store',           category: 'casa' },
  { pattern: 'iper mondo casa',      category: 'casa' },
  { pattern: 'kasanova',             category: 'casa' },
  { pattern: 'maxi casa',            category: 'casa' },
  { pattern: 'perdormire',           category: 'casa' },
  { pattern: 'vitiello detersivi',   category: 'casa' },
  { pattern: 'abashop mega store',   category: 'casa' },
  { pattern: 'gruppo negozi',        category: 'casa' },
  { pattern: 'happy shopping',       category: 'casa' },
  { pattern: 'sumup the castl',      category: 'casa' },
  { pattern: 'sumup tuttodipi',      category: 'casa' },

  // ── TRASPORTI ────────────────────────────────────────────────────────────
  { pattern: 'easypark',             category: 'trasporti' },
  { pattern: 'msc crociere',         category: 'trasporti' },
  { pattern: 'napolipark',           category: 'trasporti' },
  { pattern: 'packlink',             category: 'trasporti' },
  { pattern: 'wizz air',             category: 'trasporti' },
  { pattern: 'unico campania',       category: 'trasporti' },

  // ── RISTORANTI ────────────────────────────────────────────────────────────
  { pattern: 'gelateria k2',         category: 'ristoranti' },
  { pattern: 'pizzeria o zio aniello', category: 'ristoranti' },
  { pattern: 'solo d oro pizzeria',  category: 'ristoranti' },
  { pattern: 'turkish kebab',        category: 'ristoranti' },
  { pattern: 'new center',           category: 'ristoranti' },

  // ── UTENZE ────────────────────────────────────────────────────────────────
  { pattern: 'cattolica',            category: 'utenze' }, // Cattolica Assicurazioni
  { pattern: 'gori',                 category: 'utenze' }, // GORI spa acqua Campania
  { pattern: 'sara assicurazioni',   category: 'utenze' },
  { pattern: 'servizio spid',        category: 'utenze' },
  { pattern: 'telecom',              category: 'utenze' },
  { pattern: 'accedemia degli scugni', category: 'utenze' },

  // ── INTRATTENIMENTO ───────────────────────────────────────────────────────
  { pattern: 'acqua park isola verde', category: 'intrattenimento' },
  { pattern: 'betflag',              category: 'intrattenimento' },
  { pattern: 'e play24',             category: 'intrattenimento' },
  { pattern: 'lo zoo di napoli',     category: 'intrattenimento' },
  { pattern: 'pompei pdm',           category: 'intrattenimento' },
  { pattern: 'replatz',              category: 'intrattenimento' },
  { pattern: 'oracle italia',        category: 'intrattenimento' },

  // ── ALTRO (nessuna categoria built-in adeguata) ───────────────────────────
  { pattern: 'any any baby',         category: 'altro' }, // infanzia
  { pattern: 'baby line',            category: 'altro' },
  { pattern: 'big toys',             category: 'altro' },
  { pattern: 'carolina toys',        category: 'altro' },
  { pattern: 'pianeta bimbi',        category: 'altro' },
  { pattern: 'amazon',               category: 'altro' }, // marketplace
  { pattern: 'expert megastore',     category: 'altro' },
  { pattern: 'temu',                 category: 'altro' },
  { pattern: 'tiktok shop',          category: 'altro' },
  { pattern: 'ebay',                 category: 'altro' },
  { pattern: 'tabaccheria',          category: 'altro' },
  { pattern: 'd rodopoulos',         category: 'altro' }, // vacanza Grecia
  { pattern: 'ripamare vieste',      category: 'altro' },
];
// ─────────────────────────────────────────────────────────────────────────────

const rows = RULES.map(r => ({ user_id: null, pattern: r.pattern, category: r.category }));

// Step 1: cancella le regole globali esistenti (idempotente)
console.log('Elimino le regole globali esistenti...');
const delRes = await fetch(`${SUPABASE_URL}/rest/v1/merchant_rules?user_id=is.null`, {
  method: 'DELETE',
  headers: HEADERS,
});
if (!delRes.ok) {
  const err = await delRes.text();
  console.error(`✗ DELETE ${delRes.status}:`, err);
  process.exit(1);
}
console.log('  OK');

// Step 2: inserisce le nuove regole
console.log(`Inserisco ${rows.length} regole globali...`);
const insRes = await fetch(`${SUPABASE_URL}/rest/v1/merchant_rules`, {
  method: 'POST',
  headers: { ...HEADERS, 'Prefer': 'return=minimal' },
  body: JSON.stringify(rows),
});
if (insRes.ok) {
  console.log(`✓ Inserite ${rows.length} regole globali.`);
} else {
  const err = await insRes.text();
  console.error(`✗ INSERT ${insRes.status}:`, err);
}
