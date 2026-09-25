'use client';

import { useEffect, useState } from 'react';
import { animate } from 'framer-motion';

interface DailyPoint { date: string; total: number; }

interface Props {
  totalMonth: number;
  incomeMonth: number;
  prevTotalMonth: number;
  count: number;
  monthLabel: string;
  dailyExpenses: DailyPoint[];
}

function useCountUp(to: number, duration = 1.4) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const c = animate(0, to, { duration, ease: 'easeOut', onUpdate: setValue });
    return c.stop;
  }, [to, duration]);
  return value;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);

function TrendLine({ current, previous }: { current: number; previous: number }) {
  if (previous === 0) return null;
  const delta = ((current - previous) / previous) * 100;
  const abs = Math.abs(delta).toFixed(1);

  if (Math.abs(delta) < 1) {
    return <span style={{ color: 'var(--text-3)' }}>→ stabile vs mese prec.</span>;
  }

  const up = delta > 0;
  return (
    <span style={{ color: up ? 'var(--negative)' : 'var(--positive)' }}>
      {up ? '↑' : '↓'} {up ? '+' : '−'}{abs}% vs mese prec.
    </span>
  );
}

export default function DashboardStats({
  totalMonth,
  incomeMonth,
  prevTotalMonth,
  count,
  monthLabel,
  dailyExpenses: _dailyExpenses,
}: Props) {
  void _dailyExpenses;

  const saldo = incomeMonth - totalMonth;
  const heroValue = incomeMonth > 0 ? Math.abs(saldo) : totalMonth;
  const animated = useCountUp(heroValue);

  let heroColor: string;
  let heroPrefix = '';
  if (incomeMonth > 0) {
    if (saldo > 0) { heroColor = 'var(--positive)'; heroPrefix = '+'; }
    else if (saldo < 0) { heroColor = 'var(--negative)'; heroPrefix = '−'; }
    else { heroColor = 'var(--text-1)'; }
  } else {
    heroColor = 'var(--text-1)';
  }

  return (
    <div style={{ paddingTop: '2rem', paddingBottom: '2rem' }}>
      <p style={{
        color: 'var(--text-2)',
        fontSize: '0.875rem',
        marginBottom: '1.5rem',
        textTransform: 'capitalize',
        letterSpacing: '0.01em',
      }}>
        {monthLabel}
      </p>

      <p style={{ color: 'var(--text-3)', fontSize: '0.75rem', marginBottom: '0.375rem', letterSpacing: '0.01em' }}>
        {incomeMonth > 0 ? 'Saldo netto' : 'Uscite del mese'}
      </p>

      <p
        className="tabular-nums"
        style={{
          fontSize: '3.75rem',
          fontWeight: 700,
          lineHeight: 1.05,
          color: heroColor,
          letterSpacing: '-0.025em',
        }}
      >
        {heroPrefix}{fmt(animated)}
      </p>

      <div style={{
        marginTop: '1rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.875rem',
        fontSize: '0.875rem',
        color: 'var(--text-2)',
        flexWrap: 'wrap',
      }}>
        <TrendLine current={totalMonth} previous={prevTotalMonth} />
        {prevTotalMonth > 0 && (
          <span aria-hidden style={{ color: 'var(--border)', userSelect: 'none' }}>·</span>
        )}
        <span style={{ color: 'var(--text-3)' }}>
          {count} {count === 1 ? 'transazione' : 'transazioni'}
        </span>
      </div>
    </div>
  );
}
