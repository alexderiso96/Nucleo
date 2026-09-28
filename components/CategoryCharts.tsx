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
}

const fmt = (n: number) =>
  new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);

interface Props {
  pieData: CategoryStat[];
  total: number;
}

export default function CategoryCharts({ pieData, total }: Props) {
  return (
    <>
      {/* Donut */}
      <div className="flex flex-col md:flex-row items-center gap-6">
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
            return (
              <div key={i} className="flex items-center gap-2">
                <span className="text-base shrink-0 w-6 text-center">{entry.label.startsWith('📦') || entry.label.length <= 2 ? entry.label : ''}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs truncate" style={{ color: 'var(--text-2)' }}>{entry.label}</span>
                    <span className="text-xs tabular-nums ml-2 shrink-0 font-semibold" style={{ color: 'var(--text-1)' }}>{fmt(entry.total)}</span>
                  </div>
                  <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--dark-600)' }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: entry.fill }} />
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

      {/* Barre orizzontali */}
      <div className="mt-6">
        <p className="text-[10px] font-semibold uppercase tracking-widest mb-4" style={{ color: 'var(--text-3)' }}>
          Confronto categorie
        </p>
        <ResponsiveContainer width="100%" height={Math.max(180, pieData.length * 36)}>
          <BarChart
            layout="vertical"
            data={pieData}
            margin={{ top: 0, right: 60, bottom: 0, left: 90 }}
          >
            <CartesianGrid horizontal={false} stroke="var(--dark-600)" strokeDasharray="3 3" />
            <XAxis
              type="number"
              tickFormatter={v => `€${Number(v).toLocaleString('it-IT', { minimumFractionDigits: 0 })}`}
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
              width={86}
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
  );
}
