'use client';

import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';

interface CategoryStat {
  category: string;
  total: number;
  count: number;
  fill: string;
  label: string;
  icon: string;
}

interface Props {
  pieData: CategoryStat[];
  total: number;
  fmt: (n: number) => string;
}

const MAX_VISIBLE = 6;
const OTHERS_COLOR = '#64748b';

export default function CategoryCharts({ pieData, total, fmt }: Props) {
  const visible = pieData.slice(0, MAX_VISIBLE);
  const others  = pieData.slice(MAX_VISIBLE);
  const othersTotal = others.reduce((s, e) => s + e.total, 0);
  const hasOthers   = others.length > 0;

  const barData: { name: string; total: number; fill: string }[] = [
    ...visible.map(d => ({ name: d.label, total: d.total, fill: d.fill })),
    ...(hasOthers ? [{ name: `+${others.length} altre`, total: othersTotal, fill: OTHERS_COLOR }] : []),
  ];

  const tooltipStyle = {
    background: 'var(--dark-800)',
    border: '1px solid var(--dark-600)',
    borderRadius: 8,
    fontSize: 11,
    color: 'var(--text-1)',
  };

  return (
    <>
      {/* ── Distribuzione per categoria ─────────────────────── */}
      <div className="py-6" style={{ borderBottom: '1px solid var(--border)' }}>
        <p className="text-sm font-semibold mb-5" style={{ color: 'var(--text-1)' }}>
          Distribuzione per categoria
        </p>

        <div className="flex flex-col md:flex-row items-start gap-8">
          {/* Donut */}
          <div className="relative shrink-0 mx-auto md:mx-0" style={{ width: 200, height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={62}
                  outerRadius={92}
                  paddingAngle={2}
                  dataKey="total"
                  strokeWidth={0}
                >
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v) => [fmt(Number(v)), '']}
                  contentStyle={tooltipStyle}
                  itemStyle={{ color: 'var(--text-1)' }}
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.label ?? ''}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Totale centro */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[10px]" style={{ color: 'var(--text-3)' }}>Totale</span>
              <span className="text-sm font-bold tabular-nums mt-0.5" style={{ color: 'var(--text-1)' }}>
                {fmt(total)}
              </span>
            </div>
          </div>

          {/* Lista categorie */}
          <div className="flex flex-col flex-1 w-full" style={{ gap: '10px' }}>
            {visible.map(entry => {
              const pct = total > 0 ? (entry.total / total) * 100 : 0;
              return (
                <div key={entry.category} className="flex items-center gap-2.5">
                  <span className="text-[15px] shrink-0 leading-none" style={{ color: entry.fill }}>●</span>
                  <span className="flex-1 text-[13px] truncate" style={{ color: 'var(--text-2)' }}>
                    {entry.label}
                  </span>
                  <span className="text-[11px] tabular-nums shrink-0" style={{ color: 'var(--text-3)' }}>
                    {pct.toFixed(0)}%
                  </span>
                  <span className="text-[13px] tabular-nums font-medium shrink-0 w-24 text-right" style={{ color: 'var(--text-1)' }}>
                    {fmt(entry.total)}
                  </span>
                </div>
              );
            })}

            {hasOthers && (
              <div className="flex items-center gap-2.5">
                <span className="text-[15px] shrink-0 leading-none" style={{ color: OTHERS_COLOR }}>●</span>
                <span className="flex-1 text-[13px]" style={{ color: 'var(--text-3)' }}>
                  + {others.length} altr{others.length === 1 ? 'a' : 'e'}
                </span>
                <span className="text-[11px] tabular-nums shrink-0" style={{ color: 'var(--text-3)' }}>
                  {total > 0 ? ((othersTotal / total) * 100).toFixed(0) : 0}%
                </span>
                <span className="text-[13px] tabular-nums font-medium shrink-0 w-24 text-right" style={{ color: 'var(--text-2)' }}>
                  {fmt(othersTotal)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Confronto categorie ──────────────────────────────── */}
      <div className="py-6">
        <p className="text-sm font-semibold mb-5" style={{ color: 'var(--text-1)' }}>
          Confronto categorie
        </p>
        <ResponsiveContainer width="100%" height={Math.max(160, barData.length * 38)}>
          <BarChart
            layout="vertical"
            data={barData}
            margin={{ top: 0, right: 64, bottom: 0, left: 96 }}
          >
            <CartesianGrid horizontal={false} stroke="var(--border)" strokeDasharray="3 3" />
            <XAxis
              type="number"
              tickFormatter={v => `€${Number(v).toLocaleString('it-IT', { maximumFractionDigits: 0 })}`}
              tick={{ fontSize: 10, fill: 'var(--text-3)' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 12, fill: 'var(--text-2)' }}
              axisLine={false}
              tickLine={false}
              width={92}
            />
            <Tooltip
              formatter={(v) => [fmt(Number(v)), 'Importo']}
              contentStyle={tooltipStyle}
              itemStyle={{ color: 'var(--text-1)' }}
              cursor={{ fill: 'rgba(255,255,255,0.04)' }}
            />
            <Bar dataKey="total" radius={[0, 4, 4, 0]} maxBarSize={18}>
              {barData.map((entry, i) => (
                <Cell key={i} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}
