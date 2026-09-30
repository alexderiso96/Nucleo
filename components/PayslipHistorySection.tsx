'use client';

import { useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import type { TrendPoint } from '@/lib/payslip-analytics';

const PayslipTrendChart = dynamic(() => import('@/components/PayslipTrendChart'), { ssr: false });

interface Props {
  allPoints: TrendPoint[];
  highlightMonth?: string;
}

type Period = 6 | 12;

const fmt = (n: number) =>
  new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);

const MONTH_FULL = [
  'Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
  'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre',
];

function monthLabel(m: string): string {
  const [y, mo] = m.split('-');
  return `${MONTH_FULL[parseInt(mo) - 1]} ${y}`;
}

export default function PayslipHistorySection({ allPoints, highlightMonth }: Props) {
  const [period, setPeriod] = useState<Period>(6);

  const points = useMemo(
    () => allPoints.slice(-period),
    [allPoints, period]
  );

  if (allPoints.length < 2) return null;

  const nets = points.map(p => p.net);
  const avg = nets.reduce((s, n) => s + n, 0) / nets.length;
  const maxNet = Math.max(...nets);
  const minNet = Math.min(...nets);
  const bestPoint  = points.find(p => p.net === maxNet)!;
  const worstPoint = points.find(p => p.net === minNet)!;

  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      {/* Header row */}
      <div className="flex items-center justify-between py-5">
        <span className="text-[13px] font-medium" style={{ color: 'var(--text-1)' }}>
          Storico netto
        </span>
        <div className="flex gap-1.5">
          {([6, 12] as Period[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className="px-3 py-1 rounded-full text-[12px] font-medium transition-all"
              style={period === p
                ? { background: 'var(--brand)', color: '#0f172a', border: '1px solid var(--brand)' }
                : { background: 'transparent', color: 'var(--text-2)', border: '1px solid var(--border)' }}
            >
              {p} mesi
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="pb-5">
        {points.length >= 2 ? (
          <PayslipTrendChart data={points} highlightMonth={highlightMonth} />
        ) : (
          <p className="text-[12px] text-center py-8" style={{ color: 'var(--text-3)' }}>
            Dati insufficienti per il periodo selezionato.
          </p>
        )}
      </div>

      {/* Stats */}
      {points.length >= 2 && (
        <div className="grid grid-cols-3 gap-4 pb-6">
          <div>
            <p className="text-[10px] mb-1" style={{ color: 'var(--text-3)' }}>Media del periodo</p>
            <p className="text-[14px] font-semibold tabular-nums" style={{ color: 'var(--text-1)' }}>
              {fmt(avg)}
            </p>
          </div>
          <div>
            <p className="text-[10px] mb-1" style={{ color: 'var(--text-3)' }}>Mese migliore</p>
            <p className="text-[14px] font-semibold tabular-nums" style={{ color: '#10b981' }}>
              {fmt(maxNet)}
            </p>
            <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-3)' }}>
              {monthLabel(bestPoint.month)}
            </p>
          </div>
          <div>
            <p className="text-[10px] mb-1" style={{ color: 'var(--text-3)' }}>Mese più basso</p>
            <p className="text-[14px] font-semibold tabular-nums" style={{ color: 'var(--text-2)' }}>
              {fmt(minNet)}
            </p>
            <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-3)' }}>
              {monthLabel(worstPoint.month)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
