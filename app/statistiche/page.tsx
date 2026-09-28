'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import { CATEGORIES } from '@/lib/categories';
import {
  PieChart, Pie, Cell, Tooltip,
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';

type Period = 'today' | 'week' | 'month' | 'year' | 'all' | 'custom';
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

function periodRange(period: Period, customFrom: string, customTo: string): { from?: string; to?: string } {
  const today = todayStr();
  switch (period) {
    case 'today':  return { from: today,          to: today };
    case 'week':   return { from: weekStartStr(),  to: today };
    case 'month':  return { from: monthStartStr(), to: today };
    case 'year':   return { from: yearStartStr(),  to: today };
    case 'all':    return {};
    case 'custom': return { from: customFrom || undefined, to: customTo || undefined };
  }
}

function getCatMeta(value: string) {
  return CATEGORIES.find(c => c.value === value) ?? {
    label: value, icon: '📦',
    darkBg: 'rgba(100,116,139,0.14)', darkText: '#64748b',
  };
}

const PERIODS: { key: Period; label: string }[] = [
  { key: 'today', label: 'Oggi' },
  { key: 'week',  label: 'Settimana' },
  { key: 'month', label: 'Mese' },
  { key: 'year',  label: 'Anno' },
  { key: 'all',   label: 'Sempre' },
  { key: 'custom', label: 'Personalizzato' },
];

export default function StatistichePage() {
  const [period, setPeriod]       = useState<Period>('month');
  const [type, setType]           = useState<ExpType>('expense');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo]   = useState(todayStr());
  const [data, setData]           = useState<CategoryStat[]>([]);
  const [total, setTotal]         = useState(0);
  const [loading, setLoading]     = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { from, to } = periodRange(period, customFrom, customTo);
    const params = new URLSearchParams({ type });
    if (from) params.set('from', from);
    if (to)   params.set('to', to);
    try {
      const res = await fetch(`/api/stats/categories?${params}`);
      const json = await res.json() as { data: CategoryStat[]; total: number };
      setData(json.data ?? []);
      setTotal(json.total ?? 0);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [period, type, customFrom, customTo]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const pieData = data.map(d => ({
    ...d,
    fill: getCatMeta(d.category).darkText,
    label: getCatMeta(d.category).label,
  }));

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--dark-900)' }}>
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <header
          className="flex items-center gap-3 px-6 py-3.5 sticky top-0 z-10"
          style={{ background: 'var(--dark-800)', borderBottom: '1px solid var(--dark-600)' }}
        >
          <Link href="/dashboard" className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors">
            <ArrowLeft size={14} />
          </Link>
          <h2 className="text-sm font-semibold text-slate-200">Statistiche</h2>
        </header>

        <main className="flex-1 px-6 py-6 flex flex-col gap-5 max-w-3xl w-full">

          {/* Filtri periodo */}
          <div className="card p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-semibold uppercase tracking-widest w-14 shrink-0" style={{ color: 'var(--text-3)' }}>Periodo</span>
              <div className="flex gap-1 flex-wrap">
                {PERIODS.map(p => (
                  <button
                    key={p.key}
                    onClick={() => setPeriod(p.key)}
                    className="px-3 py-1 rounded-full text-[11px] font-semibold transition-all"
                    style={period === p.key
                      ? { background: 'var(--brand)', color: '#fff' }
                      : { background: 'var(--surface-2)', color: 'var(--text-2)', border: '1px solid var(--border-strong)' }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {period === 'custom' && (
              <div className="flex items-center gap-2 ml-16">
                <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                  className="input px-3 py-1.5 text-xs" style={{ colorScheme: 'dark' }} />
                <span className="text-xs" style={{ color: 'var(--text-3)' }}>→</span>
                <input type="date" value={customTo} max={todayStr()} onChange={e => setCustomTo(e.target.value)}
                  className="input px-3 py-1.5 text-xs" style={{ colorScheme: 'dark' }} />
              </div>
            )}

            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-widest w-14 shrink-0" style={{ color: 'var(--text-3)' }}>Tipo</span>
              <div className="flex gap-1">
                {(['expense', 'income'] as ExpType[]).map(t => (
                  <button
                    key={t}
                    onClick={() => setType(t)}
                    className="px-3 py-1 rounded-full text-[11px] font-semibold transition-all"
                    style={type === t
                      ? { background: t === 'expense' ? 'rgba(251,113,133,0.25)' : 'rgba(52,211,153,0.25)', color: t === 'expense' ? '#fb7185' : '#34d399' }
                      : { background: 'var(--surface-2)', color: 'var(--text-2)', border: '1px solid var(--border-strong)' }}
                  >
                    {t === 'expense' ? 'Uscite' : 'Entrate'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {loading ? (
            <div className="card p-12 flex items-center justify-center">
              <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--brand)', borderTopColor: 'transparent' }} />
            </div>
          ) : data.length === 0 ? (
            <div className="card p-12 text-center text-sm" style={{ color: 'var(--text-3)' }}>
              Nessun dato per questo periodo.
            </div>
          ) : (
            <>
              {/* Grafico a ciambella */}
              <div className="card p-5">
                <p className="text-[10px] font-semibold uppercase tracking-widest mb-4" style={{ color: 'var(--text-3)' }}>
                  Distribuzione per categoria
                </p>
                <div className="flex flex-col md:flex-row items-center gap-6">
                  {/* Donut */}
                  <div className="relative shrink-0" style={{ width: 220, height: 220 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={68}
                          outerRadius={100}
                          paddingAngle={2}
                          dataKey="total"
                          strokeWidth={0}
                        >
                          {pieData.map((entry, i) => (
                            <Cell key={i} fill={entry.fill} opacity={0.9} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value) => [fmt(Number(value)), '']}
                          contentStyle={{
                            background: 'var(--dark-800)',
                            border: '1px solid var(--dark-600)',
                            borderRadius: 8,
                            fontSize: 11,
                            color: 'var(--text-1)',
                          }}
                          itemStyle={{ color: 'var(--text-1)' }}
                          labelFormatter={(_, payload) => payload?.[0]?.payload?.label ?? ''}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    {/* Totale al centro */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>
                        Totale
                      </span>
                      <span className="text-base font-bold tabular-nums mt-0.5" style={{ color: 'var(--text-1)' }}>
                        {fmt(total)}
                      </span>
                    </div>
                  </div>

                  {/* Legenda */}
                  <div className="flex flex-col gap-2 flex-1 w-full">
                    {pieData.map((entry, i) => {
                      const pct = total > 0 ? (entry.total / total) * 100 : 0;
                      const meta = getCatMeta(entry.category);
                      return (
                        <div key={i} className="flex items-center gap-2">
                          <span className="text-base shrink-0 w-6 text-center">{meta.icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-0.5">
                              <span className="text-xs truncate" style={{ color: 'var(--text-2)' }}>{meta.label}</span>
                              <span className="text-xs tabular-nums ml-2 shrink-0 font-semibold" style={{ color: 'var(--text-1)' }}>{fmt(entry.total)}</span>
                            </div>
                            <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--dark-600)' }}>
                              <div
                                className="h-full rounded-full transition-all"
                                style={{ width: `${pct}%`, background: entry.fill }}
                              />
                            </div>
                            <span className="text-[10px]" style={{ color: 'var(--text-3)' }}>
                              {pct.toFixed(1)}% · {entry.count} voce{entry.count !== 1 ? '' : ''}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Grafico a barre orizzontali */}
              <div className="card p-5">
                <p className="text-[10px] font-semibold uppercase tracking-widest mb-4" style={{ color: 'var(--text-3)' }}>
                  Confronto categorie
                </p>
                <ResponsiveContainer width="100%" height={Math.max(180, data.length * 36)}>
                  <BarChart
                    layout="vertical"
                    data={pieData}
                    margin={{ top: 0, right: 60, bottom: 0, left: 80 }}
                  >
                    <CartesianGrid horizontal={false} stroke="var(--dark-600)" strokeDasharray="3 3" />
                    <XAxis
                      type="number"
                      tickFormatter={v => `€${(v as number).toLocaleString('it-IT', { minimumFractionDigits: 0 })}`}
                      tick={{ fontSize: 10, fill: 'var(--text-3)' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="label"
                      tick={{ fontSize: 11, fill: 'var(--text-2)' }}
                      axisLine={false}
                      tickLine={false}
                      width={76}
                    />
                    <Tooltip
                      formatter={(value) => [fmt(Number(value)), 'Importo']}
                      contentStyle={{
                        background: 'var(--dark-800)',
                        border: '1px solid var(--dark-600)',
                        borderRadius: 8,
                        fontSize: 11,
                        color: 'var(--text-1)',
                      }}
                    />
                    <Bar dataKey="total" radius={[0, 4, 4, 0]} maxBarSize={20}>
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} opacity={0.85} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
