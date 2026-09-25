export interface MerchantRule {
  pattern: string;
  category: string;
}

export interface CategorizationResult {
  category: string;
  confidence: 'high' | 'low';
}

export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Dizionario keyword italiane — ordinato per specificità decrescente
const KEYWORD_DICT: { keywords: string[]; category: string }[] = [
  {
    keywords: [
      'supermercato', 'conad', 'esselunga', 'lidl', 'aldi', 'carrefour',
      'eurospin', 'pam ', 'coop', 'penny', 'iper', 'natura si', 'naturasi',
      'eataly', 'despar', 'md discount', 'tigros', 'bennet', 'simply',
      'famila', 'sigma', 'coal', 'in s', 'discount alimentare',
    ],
    category: 'alimentari',
  },
  {
    keywords: [
      'ristorante', 'trattoria', 'osteria', 'pizzeria', 'pizza', 'sushi',
      'mcdonald', 'burger king', 'kfc', 'old wild west', 'panino',
      'gelateria', 'pasticceria', 'bakery', 'bistrot', 'caffe',
      'bar ', 'pub ', 'kebab', 'poke', 'delivery',
    ],
    category: 'ristoranti',
  },
  {
    keywords: [
      'trenitalia', 'italo', 'frecciarossa', 'atm ', 'atac', 'taxi',
      'uber', 'free now', 'autobus', 'metro ', 'parcheggio', 'parking',
      'autostrada', 'telepass', 'benzina', 'carburante', 'q8',
      'eni carburanti', 'ip ', 'tamoil', 'agip', 'repsol', 'esso',
      'blablacar', 'bolt', 'flixbus',
    ],
    category: 'trasporti',
  },
  {
    keywords: [
      'affitto', 'condominio', 'amministratore', 'ikea', 'leroy merlin',
      'brico', 'castorama', 'obi ', 'bricofer', 'tecnomat',
    ],
    category: 'casa',
  },
  {
    keywords: [
      'farmacia', 'farmacie', 'clinica', 'ospedale', 'medico', 'dottore',
      'dentista', 'odontoiatrico', 'fisioterapia', 'analisi cliniche',
      'laboratorio analisi', 'ottico', 'oculista', 'parafarmacia', 'lloyds',
    ],
    category: 'salute',
  },
  {
    keywords: [
      'palestra', 'fitness', 'gym', 'decathlon', 'intersport',
      'tennis', 'nuoto', 'piscina', 'calcetto', 'running', 'yoga',
      'pilates', 'crossfit', 'worldclass', 'virgin active', 'mcfit',
    ],
    category: 'sport',
  },
  {
    keywords: [
      'zara', 'h&m', 'hm ', 'primark', 'bershka', 'pull bear', 'mango ',
      'calzedonia', 'intimissimi', 'oysho', 'uniqlo', 'abbigliamento',
      'scarpe', 'vestiti', 'camicia', 'sartoria', 'liu jo', 'ovs',
    ],
    category: 'abbigliamento',
  },
  {
    keywords: [
      'netflix', 'spotify', 'amazon prime', 'disney', 'apple tv',
      'youtube premium', 'dazn', 'sky ', 'now tv', 'cinema', 'teatro',
      'concerto', 'evento', 'steam', 'playstation', 'xbox', 'nintendo',
      'audible', 'kindle', 'twitch', 'crunchyroll',
    ],
    category: 'intrattenimento',
  },
  {
    keywords: [
      'enel ', 'eni gas', 'a2a ', 'hera ', 'iren ', 'italgas', 'sorgenia',
      'acea ', 'edison ', 'tim ', 'vodafone', 'wind ', 'iliad', 'fastweb',
      'tiscali', 'bolletta', 'utenza', 'acqua potabile',
    ],
    category: 'utenze',
  },
];

export function categorizeDescription(
  description: string | null,
  rules: MerchantRule[],
): CategorizationResult {
  if (!description) return { category: 'altro', confidence: 'low' };

  const norm = normalizeText(description);

  // Regole utente per prime — priorità assoluta
  for (const rule of rules) {
    if (norm.includes(rule.pattern)) {
      return { category: rule.category, confidence: 'high' };
    }
  }

  // Dizionario built-in
  for (const entry of KEYWORD_DICT) {
    for (const kw of entry.keywords) {
      if (norm.includes(kw.trimEnd())) {
        return { category: entry.category, confidence: 'high' };
      }
    }
  }

  return { category: 'altro', confidence: 'low' };
}
