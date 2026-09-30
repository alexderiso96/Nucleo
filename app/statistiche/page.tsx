'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Sidebar from '@/components/Sidebar';
import { useCategories } from '@/lib/use-categories';
import { catColor } from '@/lib/category-colors';

const CategoryCharts = dynamic(() => import('@/components/CategoryCharts'), { ssr: false });

type Period = 'today' | 'week' | 'month' | 'year' | 'all';
type ExpType = 'expense' | 'income';

interface CategoryStat {
  category: string;
  total: number;
  count: number;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);

function todayStr() { return new Date().toISOString().split('T')[0]; }
function weekStartStr() {
  const d = new Date();
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.toISOString().split('T')[0];
}
function monthStartStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}
function yearStartStr() { return `${new Date().getFullYear()}-01-01`; }

function periodRange(period: Period): { from?: string; to?: string } {
  const today = todayStr();
  switch (period) {
    case 'today':  return { from: today,          to: today };
    case 'week':   return { from: weekStartStr(),  to: today };
    case 'month':  return { from: monthStartStr(), to: today };
    case 'year':   return { from: yearStartStr(),  to: today };
    case 'all':    return {};
  }
}

const PERIODS: { key: Period; label: string }[] = [
  { key: 'today', label: 'Oggi' },
  { key: 'week',  label: 'Settimana' },
  { key: 'month', label: 'Mese' },
  { key: 'year',  label: 'Anno' },
  { key: 'all',   label: 'Sempre' },
];


export default function StatistichePage() {
  const [period, setPeriod] = useState<Period>('month');
  const [type, setType]     = useState<ExpType>('expense');
  const [data, setData]     = useState<CategoryStat[]>([]);
  const [total, setTotal]   = useState(0);
  const [loading, setLoading] = useState(true);

  const { categories } = useCategories();

  const getCatMeta = useCallback((value: string) => {
    return categories.find(c => c.value === value) ?? {
      label: value, icon: '📦', darkBg: '', darkText: '#64748b',
    };
  }, [categories]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { from, to } = periodRange(period);
    const params = new URLSearchParams({ type });
    if (from) params.set('from', from);
    if (to)   params.set('to', to);
    try {
      const res = await fetch(`/api/stats/categories?${params}`);
      const json = await res.json() as { data: CategoryStat[]; total: number };
      setData(json.data ?? []);
      setTotal(json.total ?? 0);
    } catch { /* noop */ } finally { setLoading(false); }
  }, [period, type]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const pieData = data.map(d => {
    const meta = getCatMeta(d.category);
    return {
      ...d,
      fill:  catColor(d.category),
      label: meta.label,
      icon:  meta.icon,
    };
  });

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--dark-900)' }}>
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <header
          className="flex items-center px-6 py-3.5 sticky top-0 z-10"
          style={{ background: 'var(--dark-800)', borderBottom: '1px solid var(--dark-600)' }}
        >
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>Statistiche</h2>
        </header>

        <main className="flex-1 px-6 max-w-3xl w-full mx-auto flex flex-col">

          {/* ── Filtri ─────────────────────────────────────────── */}
          <div className="py-5 flex flex-col gap-3" style={{ borderBottom: '1px solid var(--border)' }}>
            {/* Periodo */}
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm w-20 shrink-0" style={{ color: 'var(--text-3)' }}>Periodo</span>
              <div className="flex gap-1.5 flex-wrap">
                {PERIODS.map(p => (
                  <button
                    key={p.key}
                    onClick={() => setPeriod(p.key)}
                    className="px-3 py-1 rounded-full text-[12px] font-medium transition-all"
                    style={period === p.key
                      ? { background: 'var(--brand)', color: '#0f172a', border: '1px solid var(--brand)' }
                      : { background: 'transparent', color: 'var(--text-2)', border: '1px solid var(--border)' }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tipo */}
            <div className="flex items-center gap-3">
              <span className="text-sm w-20 shrink-0" style={{ color: 'var(--text-3)' }}>Tipo</span>
              <div className="flex gap-1.5">
                {(['expense', 'income'] as ExpType[]).map(t => {
                  const active = type === t;
                  const ac = t === 'expense' ? 'var(--expense)' : 'var(--income)';
                  return (
                    <button
                      key={t}
                      onClick={() => setType(t)}
                      className="px-3 py-1 rounded-full text-[12px] font-medium transition-all"
                      style={active
                        ? { background: 'transparent', color: ac, border: `1.5px solid ${ac}` }
                        : { background: 'transparent', color: 'var(--text-2)', border: '1px solid var(--border)' }}
                    >
                      {t === 'expense' ? 'Uscite' : 'Entrate'}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── Contenuto ─────────────────────────────────────── */}
          {loading ? (
            <div className="flex-1 flex items-center justify-center py-20">
              <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--brand)', borderTopColor: 'transparent' }} />
            </div>
          ) : data.length === 0 ? (
            <div className="py-20 text-center text-sm" style={{ color: 'var(--text-3)' }}>
              Nessun dato per questo periodo.
            </div>
          ) : (
            <CategoryCharts pieData={pieData} total={total} fmt={fmt} />
          )}
        </main>
      </div>
    </div>
  );
}
