'use client';

import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  Tooltip, CartesianGrid, ReferenceLine,
} from 'recharts';
import type { TrendPoint } from '@/lib/payslip-analytics';

interface Props {
  data: TrendPoint[];
  highlightMonth?: string;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('it-IT', {
    style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
  }).format(n);

interface TooltipProps {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="px-3 py-2 rounded-lg text-xs"
      style={{ background: '#0d1526', border: '1px solid #253355', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
      <p className="text-slate-400 mb-1">{label}</p>
      <p className="font-semibold text-emerald-400">{fmt(payload[0].value)}</p>
    </div>
  );
}

export default function PayslipTrendChart({ data, highlightMonth }: Props) {
  const nets = data.map(d => d.net);
  const minNet = Math.min(...nets);
  const maxNet = Math.max(...nets);
  const padding = (maxNet - minNet) * 0.15 || 100;
  const yMin = Math.floor((minNet - padding) / 100) * 100;
  const yMax = Math.ceil((maxNet + padding) / 100) * 100;

  const highlighted = highlightMonth ? data.find(d => d.month === highlightMonth) : null;

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e2d47" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: '#475569', fontFamily: 'ui-monospace, monospace' }}
          axisLine={false}
          tickLine={false}
          dy={6}
        />
        <YAxis
          domain={[yMin, yMax]}
          tick={{ fontSize: 10, fill: '#475569', fontFamily: 'ui-monospace, monospace' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(n: number) => `€${(n / 1000).toFixed(1)}k`}
          width={52}
        />
        <Tooltip content={<CustomTooltip />} />
        {highlighted && (
          <ReferenceLine
            x={highlighted.label}
            stroke="#6366f1"
            strokeDasharray="4 3"
            strokeWidth={1.5}
          />
        )}
        <Line
          type="monotone"
          dataKey="net"
          stroke="#6366f1"
          strokeWidth={2}
          dot={{ r: 3, fill: '#6366f1', strokeWidth: 0 }}
          activeDot={{ r: 5, fill: '#818cf8', strokeWidth: 0 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
