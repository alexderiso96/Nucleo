'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { CalendarDays, X } from 'lucide-react';

interface Props {
  from?: string;
  to?: string;
}

const PRESETS = [
  { label: '7g',    days: 7 },
  { label: '30g',   days: 30 },
  { label: '3 mesi', days: 90 },
  { label: '6 mesi', days: 180 },
  { label: 'Anno',   days: 365 },
];

function todayStr() {
  return new Date().toISOString().split('T')[0];
}
function daysAgoStr(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
}

export default function DateRangeFilter({ from, to }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isActive = !!(from && to);

  const [fromVal, setFromVal] = useState(from ?? '');
  const [toVal, setToVal]     = useState(to ?? todayStr());
  const [open, setOpen]       = useState(isActive);

  function apply(f: string, t: string) {
    if (!f || !t) return;
    router.push(`/dashboard?from=${f}&to=${t}`);
    setOpen(false);
  }

  function applyPreset(days: number) {
    const f = daysAgoStr(days);
    const t = todayStr();
    setFromVal(f);
    setToVal(t);
    apply(f, t);
  }

  function reset() {
    setFromVal('');
    setToVal(todayStr());
    router.push('/dashboard');
    setOpen(false);
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Trigger row */}
      <div className="flex items-center gap-2 flex-wrap">
        {isActive ? (
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs"
            style={{ background: 'rgba(56,189,248,0.10)', border: '1px solid rgba(56,189,248,0.3)', color: '#38bdf8' }}
          >
            <CalendarDays size={12} />
            <span>{from} → {to}</span>
            <button onClick={reset} className="hover:opacity-70 transition-opacity">
              <X size={11} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setOpen(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors"
            style={{
              background: open ? 'rgba(56,189,248,0.10)' : 'transparent',
              border: '1px solid var(--dark-600)',
              color: open ? '#38bdf8' : 'var(--text-3)',
            }}
          >
            <CalendarDays size={12} />
            Filtra per data
          </button>
        )}

        {/* Preset chips — visibili solo quando il pannello è aperto o filtro attivo */}
        {(open || isActive) && PRESETS.map(p => (
          <button
            key={p.label}
            onClick={() => applyPreset(p.days)}
            className="px-2.5 py-1 rounded-lg text-[11px] transition-colors hover:text-slate-200"
            style={{ border: '1px solid var(--dark-600)', color: 'var(--text-3)' }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Custom range inputs */}
      {open && !isActive && (
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="date"
            value={fromVal}
            onChange={e => setFromVal(e.target.value)}
            className="input px-3 py-1.5 text-xs"
            style={{ colorScheme: 'dark' }}
          />
          <span className="text-xs text-slate-600">→</span>
          <input
            type="date"
            value={toVal}
            max={todayStr()}
            onChange={e => setToVal(e.target.value)}
            className="input px-3 py-1.5 text-xs"
            style={{ colorScheme: 'dark' }}
          />
          <button
            onClick={() => apply(fromVal, toVal)}
            disabled={!fromVal || !toVal}
            className="btn-primary px-4 py-1.5 text-xs"
          >
            Applica
          </button>
        </div>
      )}
    </div>
  );
}
