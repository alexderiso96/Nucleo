'use client';

import { useEffect, useState } from 'react';
import { animate } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface DailyPoint { date: string; total: number; }

interface Props {
  totalMonth: number;
  incomeMonth: number;
  prevTotalMonth: number;
  count: number;
  monthLabel: string;
  dailyExpenses: DailyPoint[];
}

function useCountUp(to: number, duration = 1.2) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const c = animate(0, to, { duration, ease: 'easeOut', onUpdate: setValue });
    return c.stop;
  }, [to, duration]);
  return value;
}

const fmtEur = (n: number) =>
  new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);

function Sparkline({ data }: { data: DailyPoint[] }) {
  if (data.length < 2) return null;
  const maxVal = Math.max(...data.map(d => d.total));
  const W = 80, H = 28;
  const pts = data.map((d, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = H - (d.total / maxVal) * H * 0.85 - 2;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} fill="none">
      <polyline points={pts} stroke="var(--expense)" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" opacity="0.7" />
    </svg>
  );
}

function TrendBadge({ current, previous }: { current: number; previous: number }) {
  if (previous === 0) return null;
  const delta = ((current - previous) / previous) * 100;
  const abs = Math.abs(delta).toFixed(1);
  if (Math.abs(delta) < 1) {
    return (
      <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-3)' }}>
        <Minus size={11} /> stabile
      </span>
    );
  }
  const up = delta > 0;
  return (
    <span className="flex items-center gap-0.5 text-xs font-semibold"
      style={{ color: up ? 'var(--expense)' : 'var(--income)' }}>
      {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
      {up ? '+' : '−'}{abs}%
    </span>
  );
}

export default function DashboardStats({
  totalMonth, incomeMonth, prevTotalMonth, count, monthLabel, dailyExpenses,
}: Props) {
  const animatedExpense = useCountUp(totalMonth);
  const animatedIncome  = useCountUp(incomeMonth);
  const saldo = incomeMonth - totalMonth;
  const animatedSaldo   = useCountUp(Math.abs(saldo));

  // monthLabel used for accessibility / future use
  void monthLabel;

  const labelClass = 'text-[11px] font-semibold uppercase tracking-widest' as const;

  return (
    <div className="grid grid-cols-3 gap-3 anim-slide-up anim-d1">

      {/* Entrate */}
      <div className="card p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className={labelClass} style={{ color: 'var(--text-3)' }}>Entrate</span>
          <span className="w-2 h-2 rounded-full" style={{ background: 'var(--income)' }} />
        </div>
        <p className="text-2xl font-bold tabular-nums" style={{ color: incomeMonth > 0 ? 'var(--income)' : 'var(--text-2)' }}>
          {incomeMonth > 0 ? fmtEur(animatedIncome) : '—'}
        </p>
        {incomeMonth === 0 && (
          <p className="text-[10px]" style={{ color: 'var(--text-3)' }}>Carica una busta paga</p>
        )}
      </div>

      {/* Uscite */}
      <div className="card p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className={labelClass} style={{ color: 'var(--text-3)' }}>Uscite</span>
          <div className="flex items-center gap-2">
            <TrendBadge current={totalMonth} previous={prevTotalMonth} />
            <Sparkline data={dailyExpenses} />
          </div>
        </div>
        <p className="text-2xl font-bold tabular-nums" style={{ color: 'var(--expense)' }}>
          {fmtEur(animatedExpense)}
        </p>
        <p className="text-[10px] tabular-nums" style={{ color: 'var(--text-3)' }}>
          {count} transazion{count === 1 ? 'e' : 'i'}
        </p>
      </div>

      {/* Saldo */}
      <div className="card p-4 flex flex-col gap-3"
        style={saldo > 0
          ? { border: '1px solid rgba(52,211,153,0.2)', background: 'rgba(52,211,153,0.04)' }
          : saldo < 0
          ? { border: '1px solid rgba(251,113,133,0.2)', background: 'rgba(251,113,133,0.04)' }
          : {}
        }>
        <div className="flex items-center justify-between">
          <span className={labelClass} style={{ color: 'var(--text-3)' }}>Saldo</span>
          {incomeMonth === 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full"
              style={{ background: 'var(--surface-2)', color: 'var(--text-3)' }}>
              senza entrate
            </span>
          )}
        </div>
        <p className="text-2xl font-bold tabular-nums"
          style={{ color: saldo > 0 ? 'var(--income)' : saldo < 0 ? 'var(--expense)' : 'var(--text-2)' }}>
          {incomeMonth > 0
            ? `${saldo >= 0 ? '+' : '−'}${fmtEur(animatedSaldo)}`
            : '—'}
        </p>
        {incomeMonth > 0 && (
          <p className="text-[10px]" style={{ color: 'var(--text-3)' }}>
            {saldo >= 0 ? 'Risparmio del mese' : 'Disavanzo del mese'}
          </p>
        )}
      </div>
    </div>
  );
}
