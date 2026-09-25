'use client';

import { useState, useMemo } from 'react';
import { Info } from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from 'recharts';
import { projectTfr, tfrAziendaRate } from '@/lib/tfr-projection';

interface Props {
  currentTfr: number;
  monthlyAccrual: number;
  dataMonths: number;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);

const fmtPct = (n: number) => `${(n * 100).toFixed(2)}%`;

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="px-3 py-2.5 rounded-lg text-xs"
      style={{ background: '#0d1526', border: '1px solid #253355', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}
    >
      <p className="text-slate-400 mb-2">Anno {label}</p>
      {payload.map(p => (
        <p key={p.name} className="font-semibold tabular-nums" style={{ color: p.color }}>
          {p.name === 'azienda' ? 'In azienda' : 'Fondo pensione'}: {fmt(p.value)}
        </p>
      ))}
    </div>
  );
}

export default function TfrProjectionClient({ currentTfr, monthlyAccrual, dataMonths }: Props) {
  const currentYear = new Date().getFullYear();

  const [years, setYears] = useState(10);
  const [inflation, setInflation] = useState('2.0');
  const [fondoReturn, setFondoReturn] = useState('5.0');
  const [usePension, setUsePension] = useState(false);
  const [birthYear, setBirthYear] = useState(String(currentYear - 35));
  const [retirementAge, setRetirementAge] = useState('67');

  const effectiveYears = useMemo(() => {
    if (usePension) {
      const age = currentYear - parseInt(birthYear || '0');
      const ret = parseInt(retirementAge || '67');
      return Math.max(1, Math.min(50, ret - age));
    }
    return years;
  }, [usePension, birthYear, retirementAge, years, currentYear]);

  const inflationRate = Math.max(0, Math.min(0.15, parseFloat(inflation || '2') / 100));
  const returnRate   = Math.max(0, Math.min(0.25, parseFloat(fondoReturn || '5') / 100));

  const points = useMemo(
    () =>
      projectTfr({
        currentBalance: currentTfr,
        monthlyAccrual,
        yearsToProject: effectiveYears,
        inflationRate,
        pensionFundReturn: returnRate,
      }),
    [currentTfr, monthlyAccrual, effectiveYears, inflationRate, returnRate],
  );

  const final = points[points.length - 1];
  const rAzienda = tfrAziendaRate(inflationRate);

  if (currentTfr === 0 && monthlyAccrual === 0) {
    return (
      <div className="card p-12 text-center anim-fade">
        <p className="text-slate-500 text-sm mb-2">Nessun dato TFR disponibile.</p>
        <p className="text-slate-600 text-xs">
          Carica almeno una busta paga con il TFR compilato per vedere la proiezione.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">

      {/* Disclaimer */}
      <div
        className="rounded-xl px-4 py-3 flex gap-2.5"
        style={{ background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.2)' }}
      >
        <Info size={14} className="text-indigo-400 shrink-0 mt-0.5" />
        <p className="text-xs text-slate-400 leading-relaxed">
          <span className="font-semibold text-indigo-300">Stima — non una previsione garantita.</span>{' '}
          I numeri dipendono dalle ipotesi che hai impostato (inflazione, rendimento del fondo).
          Non si tratta di consulenza finanziaria o fiscale.
          {dataMonths < 6 && (
            <span className="text-amber-400">
              {' '}— Basi di calcolo limitate: hai solo {dataMonths}{' '}
              {dataMonths === 1 ? 'busta' : 'buste'} paga caricate.
            </span>
          )}
        </p>
      </div>

      {/* Parametri */}
      <div className="card p-5">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-4">
          Ipotesi di calcolo
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5 block">
              Inflazione ISTAT (%/anno)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number" min="0" max="15" step="0.1" value={inflation}
                onChange={e => setInflation(e.target.value)}
                className="input px-3 py-2 text-sm w-24 tabular-nums"
              />
              <span className="text-[10px] text-slate-600">
                → rivalutazione TFR azienda: {fmtPct(rAzienda)}/anno
              </span>
            </div>
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5 block">
              Rendimento fondo pensione (%/anno)
            </label>
            <input
              type="number" min="0" max="25" step="0.5" value={fondoReturn}
              onChange={e => setFondoReturn(e.target.value)}
              className="input px-3 py-2 text-sm w-24 tabular-nums"
            />
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setUsePension(false)}
              className="text-xs px-3 py-1.5 rounded-lg transition-colors"
              style={{
                border: `1px solid ${!usePension ? '#6366f1' : 'var(--dark-600)'}`,
                background: !usePension ? 'rgba(99,102,241,0.1)' : 'transparent',
                color: !usePension ? '#a5b4fc' : '#64748b',
              }}
            >
              Anni fissi
            </button>
            <button
              onClick={() => setUsePension(true)}
              className="text-xs px-3 py-1.5 rounded-lg transition-colors"
              style={{
                border: `1px solid ${usePension ? '#6366f1' : 'var(--dark-600)'}`,
                background: usePension ? 'rgba(99,102,241,0.1)' : 'transparent',
                color: usePension ? '#a5b4fc' : '#64748b',
              }}
            >
              Data pensione
            </button>
          </div>

          {!usePension ? (
            <div className="flex items-center gap-3">
              <input
                type="range" min="1" max="40" value={years}
                onChange={e => setYears(parseInt(e.target.value))}
                className="flex-1 accent-indigo-500"
              />
              <span className="text-sm font-semibold text-slate-200 tabular-nums w-20">
                {years} {years === 1 ? 'anno' : 'anni'}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-4 flex-wrap">
              <div>
                <label className="text-[10px] text-slate-600 mb-1 block">Anno di nascita</label>
                <input
                  type="number" min="1950" max={currentYear - 18} value={birthYear}
                  onChange={e => setBirthYear(e.target.value)}
                  className="input px-3 py-2 text-sm w-28 tabular-nums"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-600 mb-1 block">Età pensione</label>
                <input
                  type="number" min="55" max="75" value={retirementAge}
                  onChange={e => setRetirementAge(e.target.value)}
                  className="input px-3 py-2 text-sm w-20 tabular-nums"
                />
              </div>
              <div className="pt-4">
                <span className="text-xs text-slate-500">→ </span>
                <span className="text-xs font-semibold text-slate-300">{effectiveYears} anni</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Scenari affiancati */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card p-5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-1">TFR in azienda</p>
          <p className="text-[10px] text-slate-700 mb-3">1,5% fisso + 75% inflazione ISTAT</p>
          <p className="text-2xl font-bold tabular-nums" style={{ color: '#818cf8' }}>
            {fmt(final?.azienda ?? 0)}
          </p>
          <p className="text-[10px] text-slate-600 mt-1">
            tra {effectiveYears} {effectiveYears === 1 ? 'anno' : 'anni'} ({currentYear + effectiveYears})
          </p>
          <p className="text-[10px] text-slate-700 mt-3">
            Tasso rivalutazione: <span className="text-slate-500">{fmtPct(rAzienda)}/anno</span>
          </p>
        </div>
        <div className="card p-5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-1">Fondo pensione</p>
          <p className="text-[10px] text-slate-700 mb-3">Rendimento configurato da te</p>
          <p className="text-2xl font-bold tabular-nums text-emerald-400">
            {fmt(final?.fondo ?? 0)}
          </p>
          <p className="text-[10px] text-slate-600 mt-1">
            tra {effectiveYears} {effectiveYears === 1 ? 'anno' : 'anni'} ({currentYear + effectiveYears})
          </p>
          <p className="text-[10px] text-slate-700 mt-3">
            Tasso rendimento: <span className="text-slate-500">{fmtPct(returnRate)}/anno</span>
          </p>
        </div>
      </div>

      {/* Grafico */}
      <div className="card p-5">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-4">
          Proiezione anno per anno
        </p>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={points} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="gradAzienda" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradFondo" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#34d399" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e2d47" vertical={false} />
            <XAxis
              dataKey="year"
              tick={{ fontSize: 10, fill: '#475569', fontFamily: 'ui-monospace, monospace' }}
              axisLine={false} tickLine={false} dy={6}
              tickFormatter={y => (y === 0 ? 'Oggi' : `+${y}a`)}
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#475569', fontFamily: 'ui-monospace, monospace' }}
              axisLine={false} tickLine={false} width={56}
              tickFormatter={n => `€${(n / 1000).toFixed(0)}k`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              formatter={value => (value === 'azienda' ? 'In azienda' : 'Fondo pensione')}
              wrapperStyle={{ fontSize: 11, color: '#64748b', paddingTop: 8 }}
            />
            <Area type="monotone" dataKey="azienda" stroke="#6366f1" strokeWidth={2}
              fill="url(#gradAzienda)" dot={false} activeDot={{ r: 4, fill: '#818cf8' }} />
            <Area type="monotone" dataKey="fondo" stroke="#34d399" strokeWidth={2}
              fill="url(#gradFondo)" dot={false} activeDot={{ r: 4, fill: '#6ee7b7' }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Riepilogo ipotesi */}
      <div className="card p-4">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-3">Ipotesi usate</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'TFR attuale', value: fmt(currentTfr) },
            { label: 'Accantonamento mensile', value: fmt(monthlyAccrual) },
            { label: 'Inflazione ISTAT', value: fmtPct(inflationRate) },
            { label: 'Rendimento fondo', value: fmtPct(returnRate) },
          ].map(item => (
            <div key={item.label}>
              <p className="text-[10px] text-slate-600">{item.label}</p>
              <p className="text-xs font-semibold text-slate-300 tabular-nums">{item.value}</p>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-slate-700 mt-3">
          Accantonamento calcolato come media dei mesi disponibili ({dataMonths}{' '}
          {dataMonths === 1 ? 'busta' : 'buste'} paga). La proiezione assume accantonamento costante
          futuro e non tiene conto di tassazione futura, detrazioni o variazioni di stipendio.
        </p>
      </div>
    </div>
  );
}
