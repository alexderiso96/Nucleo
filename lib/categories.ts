export const CATEGORIES = [
  { value: 'alimentari',      label: 'Alimentari' },
  { value: 'ristoranti',      label: 'Ristoranti & Bar' },
  { value: 'trasporti',       label: 'Trasporti' },
  { value: 'casa',            label: 'Casa' },
  { value: 'salute',          label: 'Salute' },
  { value: 'sport',           label: 'Sport & Fitness' },
  { value: 'abbigliamento',   label: 'Abbigliamento' },
  { value: 'intrattenimento', label: 'Intrattenimento' },
  { value: 'utenze',          label: 'Utenze' },
  { value: 'altro',           label: 'Altro' },
] as const;

export type CategoryValue = (typeof CATEGORIES)[number]['value'];

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