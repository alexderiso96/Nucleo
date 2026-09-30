export const CATEGORY_COLORS: Record<string, string> = {
  bonifico:        '#818cf8',  // indaco — mai grigio per tipi di pagamento
  abbigliamento:   '#a78bfa',
  viaggi:          '#2dd4bf',
  prelievo:        '#eab308',
  alimentari:      '#34d399',
  intrattenimento: '#f472b6',
  salute:          '#fb7185',
  utenze:          '#38bdf8',
  trasporti:       '#60a5fa',
  ristoranti:      '#fb923c',
  casa:            '#facc15',
  istruzione:      '#f9a8d4',
  altro:           '#94a3b8',
};

const PALETTE_FALLBACK = [
  '#34d399', '#60a5fa', '#fb923c', '#a78bfa', '#f472b6',
  '#2dd4bf', '#eab308', '#fb7185', '#38bdf8', '#facc15', '#818cf8', '#f9a8d4',
];

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function catColor(value: string): string {
  return CATEGORY_COLORS[value] ?? PALETTE_FALLBACK[hashCode(value) % PALETTE_FALLBACK.length];
}
