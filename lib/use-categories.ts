'use client';

import { useState, useEffect } from 'react';
import { CATEGORIES } from '@/lib/categories';

export interface CategoryDef {
  value: string;
  label: string;
  icon: string;
  darkBg: string;
  darkText: string;
  isCustom?: boolean;
  id?: string;
}

function colorToDarkBg(hex: string): string {
  // rgba con 14% opacity
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},0.14)`;
}

export function useCategories(): { categories: CategoryDef[]; loading: boolean; reload: () => void } {
  const [userCats, setUserCats] = useState<CategoryDef[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/categories');
      const json = await res.json() as {
        categories: { id: string; value: string; label: string; icon: string; color: string }[];
      };
      setUserCats(
        (json.categories ?? []).map(c => ({
          id: c.id,
          value: c.value,
          label: c.label,
          icon: c.icon,
          darkBg: colorToDarkBg(c.color),
          darkText: c.color,
          isCustom: true,
        })),
      );
    } catch { /* ignore */ } finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  const builtIn: CategoryDef[] = CATEGORIES.map(c => ({ ...c }));
  // Merge: built-in first, then user (evita duplicati per value)
  const builtInValues = new Set(builtIn.map(c => c.value));
  const merged = [...builtIn, ...userCats.filter(c => !builtInValues.has(c.value))];

  return { categories: merged, loading, reload: load };
}
