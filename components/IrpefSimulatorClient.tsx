'use client';

import { useState, useMemo } from 'react';
import { Info, AlertTriangle } from 'lucide-react';
import { simulateDelta } from '@/lib/irpef-simulator';
import { IRPEF_REFERENCE_YEAR } from '@/lib/irpef-brackets';

interface Props {
  currentGrossAnnual: number;
  hasPayslipData: boolean;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
const fmtPct = (n: number) => `${(n * 100).toFixed(1)}%`;

export default function IrpefSimulatorClient({ currentGrossAnnual, hasPayslipData }: Props) {
  const [grossInput, setGrossInput] = useState(String(Math.round(currentGrossAnnual)));
  const [increaseInput, setIncreaseInput] = useState('2400');

  const currentGross = Math.max(0, parseFloat(grossInput.replace(/[^\d.]/g, '')) || 0);
  const increaseAmount = Math.max(0, parseFloat(increaseInput.replace(/[^\d.]/g, '')) || 0);

  const result = useMemo(
    () => simulateDelta(currentGross, increaseAmount),
    [currentGross, increaseAmount],
  );

  const inputClass = 'input px-3 py-2 text-sm w-full tabular-nums';
  const labelClass = 'text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5 block';

  return (
    <div className="flex flex-col gap-5">

      {/* Disclaimer */}
      <div className="rounded-xl px-4 py-3 flex gap-2.5"
        style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.18)' }}>
        <AlertTriangle size={14} className="text-amber-400 shrink-0 mt-0.5" />
        <p className="text-xs text-slate-400 leading-relaxed">
          <span className="font-semibold text-amber-300">Stima semplificata.</span>{' '}
          Non include detrazioni personali (coniuge, figli a carico), bonus IRPEF, addizionali regionali e comunali
          specifiche del tuo comune, o altre voci individuali. I numeri sono indicativi e non sostituiscono il
          calcolo del tuo sostituto d&apos;imposta. Scaglioni IRPEF aggiornati al {IRPEF_REFERENCE_YEAR}.
        </p>
      </div>

      {!hasPayslipData && (
        <div className="rounded-xl px-4 py-2.5 flex gap-2"
          style={{ background: 'var(--brand-dim)', border: '1px solid rgba(16,185,129,0.18)' }}>
          <Info size={13} className="shrink-0 mt-0.5" style={{ color: 'var(--brand)' }} />
          <p className="text-xs text-slate-500">
            Nessuna busta paga caricata. Inserisci manualmente il tuo lordo annuo.
          </p>
        </div>
      )}

      {/* Input parametri */}
      <div className="card p-5">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-4">Parametri</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Lordo annuo attuale (€)</label>
            <input type="text" value={grossInput}
              onChange={e => setGrossInput(e.target.value)}
              className={inputClass} placeholder="es. 35000" />
            {hasPayslipData && (
              <p className="text-[10px] text-slate-700 mt-1">Pre-compilato dalla media delle tue buste paga × 13</p>
            )}
          </div>
          <div>
            <label className={labelClass}>Aumento lordo annuo (€)</label>
            <input type="text" value={increaseInput}
              onChange={e => setIncreaseInput(e.target.value)}
              className={inputClass} placeholder="es. 2400" />
            {increaseAmount > 0 && (
              <p className="text-[10px] text-slate-700 mt-1">
                +{fmt(increaseAmount / 13)}/mese lordo
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Risultato principale */}
      {increaseAmount > 0 && currentGross > 0 && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div className="card p-5">
              <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Situazione attuale</p>
              <p className="text-2xl font-bold text-slate-200 tabular-nums mb-1">{fmt(result.current.netAnnual)}</p>
              <p className="text-[10px] text-slate-600">netto annuo stimato</p>
              <p className="text-sm font-semibold text-slate-400 tabular-nums mt-2">{fmt(result.current.netMonthly)}/mese</p>
            </div>
            <div className="card p-5" style={{ border: '1px solid rgba(16,185,129,0.3)' }}>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Con l&apos;aumento</p>
              <p className="text-2xl font-bold tabular-nums mb-1" style={{ color: 'var(--brand-light)' }}>
                {fmt(result.increased.netAnnual)}
              </p>
              <p className="text-[10px] text-slate-600">netto annuo stimato</p>
              <p className="text-sm font-semibold tabular-nums mt-2" style={{ color: 'var(--brand-light)' }}>
                {fmt(result.increased.netMonthly)}/mese
              </p>
            </div>
          </div>

          {/* Guadagno netto */}
          <div className="card p-4 flex items-center justify-between"
            style={{ background: 'var(--brand-dim)', border: '1px solid rgba(16,185,129,0.2)' }}>
            <div>
              <p className="text-xs" style={{ color: 'var(--text-2)' }}>Aumento netto stimato</p>
              <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-3)' }}>
                Su {fmt(increaseAmount)} lordi aggiuntivi, il {fmtPct(result.effectiveRate)} va in tasse e contributi
              </p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold tabular-nums" style={{ color: 'var(--brand-light)' }}>
                +{fmt(result.netGainAnnual)}/anno
              </p>
              <p className="text-xs tabular-nums" style={{ color: 'var(--brand)' }}>
                +{fmt(result.netGainMonthly)}/mese
              </p>
            </div>
          </div>

          {/* Dettaglio scaglioni */}
          <div className="card p-5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-3">
              Dettaglio scaglioni IRPEF — situazione attuale
            </p>
            <div className="flex flex-col gap-1">
              {result.current.bracketDetails.map(b => (
                <div key={b.label} className="flex items-center justify-between py-1.5"
                  style={{ borderBottom: '1px solid var(--dark-700)' }}>
                  <div>
                    <span className="text-xs text-slate-400">{b.label}</span>
                    <span className="ml-2 text-[10px] text-slate-600">
                      ({fmtPct(b.rate)} su {fmt(b.taxable)})
                    </span>
                  </div>
                  <span className="text-xs font-semibold text-red-400 tabular-nums">
                    − {fmt(b.tax)}
                  </span>
                </div>
              ))}
              <div className="flex justify-between pt-1.5">
                <span className="text-xs text-slate-400">INPS dipendente (9,19%)</span>
                <span className="text-xs font-semibold text-orange-400 tabular-nums">
                  − {fmt(result.current.inpsAnnual)}
                </span>
              </div>
            </div>
          </div>
        </>
      )}

      {currentGross > 0 && increaseAmount === 0 && (
        <div className="card p-5 text-center text-xs text-slate-600">
          Inserisci un aumento lordo per vedere la simulazione.
        </div>
      )}
    </div>
  );
}
