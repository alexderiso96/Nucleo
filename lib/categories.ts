export const CATEGORIES = [
  { value: 'alimentari',      label: 'Alimentari',        icon: '🛒', darkBg: 'rgba(16,185,129,0.14)',  darkText: '#34d399' },
  { value: 'ristoranti',      label: 'Ristoranti & Bar',  icon: '🍽️', darkBg: 'rgba(251,146,60,0.14)',  darkText: '#fb923c' },
  { value: 'trasporti',       label: 'Trasporti',          icon: '🚗', darkBg: 'rgba(56,189,248,0.14)',  darkText: '#38bdf8' },
  { value: 'casa',            label: 'Casa',               icon: '🏠', darkBg: 'rgba(250,204,21,0.14)',  darkText: '#facc15' },
  { value: 'salute',          label: 'Salute',             icon: '💊', darkBg: 'rgba(251,113,133,0.14)', darkText: '#fb7185' },
  { value: 'sport',           label: 'Sport & Fitness',    icon: '🏋️', darkBg: 'rgba(45,212,191,0.14)',  darkText: '#2dd4bf' },
  { value: 'abbigliamento',   label: 'Abbigliamento',      icon: '👗', darkBg: 'rgba(167,139,250,0.14)', darkText: '#a78bfa' },
  { value: 'intrattenimento', label: 'Intrattenimento',    icon: '🎬', darkBg: 'rgba(244,114,182,0.14)', darkText: '#f472b6' },
  { value: 'utenze',          label: 'Utenze',             icon: '⚡', darkBg: 'rgba(148,163,184,0.14)', darkText: '#94a3b8' },
  { value: 'altro',           label: 'Altro',              icon: '📦', darkBg: 'rgba(100,116,139,0.14)', darkText: '#64748b' },
] as const;

export type CategoryValue = (typeof CATEGORIES)[number]['value'];

// Retrocompatibilità — usato da AnimatedExpenseList
export const CATEGORY_COLORS: Record<string, string> = {
  alimentari:      '#d1fae5',
  ristoranti:      '#ffedd5',
  trasporti:       '#dbeafe',
  casa:            '#fef3c7',
  salute:          '#fee2e2',
  sport:           '#ccfbf1',
  abbigliamento:   '#ede9fe',
  intrattenimento: '#fce7f3',
  utenze:          '#f3f4f6',
  altro:           '#f3f4f6',
};

export const CATEGORY_TEXT: Record<string, string> = {
  alimentari:      '#065f46',
  ristoranti:      '#9a3412',
  trasporti:       '#1e40af',
  casa:            '#92400e',
  salute:          '#991b1b',
  sport:           '#134e4a',
  abbigliamento:   '#4c1d95',
  intrattenimento: '#9d174d',
  utenze:          '#374151',
  altro:           '#374151',
};
