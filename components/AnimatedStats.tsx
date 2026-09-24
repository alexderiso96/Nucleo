'use client';

import { useEffect, useState } from 'react';
import { animate } from 'framer-motion';
import { TrendingDown, Hash } from 'lucide-react';

function CountUp({ to, formatter }: { to: number; formatter: (n: number) => string }) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    const controls = animate(0, to, {
      duration: 1.4,
      ease: 'easeOut',
      onUpdate: (v) => setValue(v),
    });
    return controls.stop;
  }, [to]);

  return <>{formatter(value)}</>;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);

interface Props {
  totalMonth: number;
  count: number;
  monthLabel: string;
}

export default function AnimatedStats({ totalMonth, count, monthLabel }: Props) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="card p-5 anim-slide-up anim-d1 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
            Spese {monthLabel}
          </span>
          <TrendingDown size={14} className="text-slate-600" />
        </div>
        <p className="text-2xl font-bold text-slate-100 tabular-nums">
          <CountUp to={totalMonth} formatter={fmt} />
        </p>
      </div>

      <div className="card p-5 anim-slide-up anim-d2 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
            Transazioni
          </span>
          <Hash size={14} className="text-slate-600" />
        </div>
        <p className="text-2xl font-bold text-slate-100 tabular-nums">
          <CountUp to={count} formatter={(n) => Math.round(n).toString()} />
        </p>
      </div>
    </div>
  );
}
