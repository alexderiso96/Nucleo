'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { createClient } from '@/lib/supabaseClient';
import { CATEGORIES } from '@/lib/categories';
import { Plus, Check, Loader2, X } from 'lucide-react';

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

const defaultCategory = 'altro';

export default function ExpenseForm() {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(defaultCategory);
  const [date, setDate] = useState(todayISO());
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const amountRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!expanded) return;
    function onPointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setExpanded(false);
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [expanded]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setExpanded(false);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const parsed = parseFloat(amount.replace(',', '.'));
    if (isNaN(parsed) || parsed <= 0) {
      setError('Inserisci un importo valido.');
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError('Sessione scaduta.'); setLoading(false); return; }

    const { error: insertError } = await supabase.from('expenses').insert({
      user_id: user.id,
      amount: parsed,
      currency: 'EUR',
      category,
      description: description.trim() || null,
      expense_date: date,
      source: 'manual',
      is_shared: false,
    });

    if (insertError) {
      setError(insertError.message);
    } else {
      setAmount('');
      setDescription('');
      setDate(todayISO());
      setCategory(defaultCategory);
      setSuccess(true);
      setExpanded(false);
      setTimeout(() => { setSuccess(false); }, 1800);
      router.refresh();
    }
    setLoading(false);
  }

  const selectedCat = CATEGORIES.find(c => c.value === category) ?? CATEGORIES[CATEGORIES.length - 1];

  return (
    <div ref={containerRef}>
      <form onSubmit={handleSubmit}>
        {/* ── Barra compatta (sempre visibile) ── */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold"
              style={{ color: 'var(--text-3)' }}>€</span>
            <input
              ref={amountRef}
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              onFocus={() => setExpanded(true)}
              placeholder="0,00"
              className="input w-full pl-7 pr-3 py-2.5 tabular-nums"
              style={{ fontSize: '1rem', fontWeight: 600 }}
            />
          </div>

          <button
            type="button"
            onClick={() => setExpanded(v => !v)}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all shrink-0"
            style={{
              background: selectedCat.darkBg,
              color: selectedCat.darkText,
              border: `1px solid ${selectedCat.darkText}26`,
              whiteSpace: 'nowrap',
            }}
          >
            <span>{selectedCat.icon}</span>
            <span className="text-xs">{selectedCat.label}</span>
          </button>

          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="px-3 py-2.5 rounded-xl text-xs shrink-0 transition-colors hover:opacity-80"
            style={{
              background: 'var(--surface-2)',
              color: 'var(--text-2)',
              border: '1px solid var(--border-strong)',
              whiteSpace: 'nowrap',
            }}
          >
            {date === todayISO() ? 'Oggi' : new Date(date + 'T12:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}
          </button>

          <button
            type="submit"
            disabled={loading || !amount}
            className="btn-primary flex items-center justify-center gap-1.5 px-4 py-2.5 shrink-0"
            style={success ? { background: '#059669', boxShadow: '0 4px 14px rgba(5,150,105,0.3)' } : {}}
          >
            {success
              ? <Check size={15} />
              : loading
              ? <Loader2 size={15} className="animate-spin" />
              : <Plus size={15} />}
            <span className="text-sm">{success ? 'Ok' : 'Aggiungi'}</span>
          </button>
        </div>

        {/* ── Pannello espanso ── */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ opacity: 0, height: 0, marginTop: 0 }}
              animate={{ opacity: 1, height: 'auto', marginTop: 16 }}
              exit={{ opacity: 0, height: 0, marginTop: 0 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              style={{ overflow: 'hidden' }}
            >
              <div className="rounded-2xl p-4 flex flex-col gap-4"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border-strong)' }}>

                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-semibold uppercase tracking-widest"
                    style={{ color: 'var(--text-3)' }}>Categoria</p>
                  <button type="button" onClick={() => setExpanded(false)}
                    className="w-6 h-6 flex items-center justify-center rounded-lg hover:opacity-70 transition-opacity"
                    style={{ color: 'var(--text-3)' }}>
                    <X size={13} />
                  </button>
                </div>

                <div className="grid grid-cols-5 gap-2">
                  {CATEGORIES.map(cat => {
                    const active = category === cat.value;
                    return (
                      <button
                        key={cat.value}
                        type="button"
                        onClick={() => setCategory(cat.value)}
                        className="flex flex-col items-center gap-1.5 py-2.5 px-1 rounded-xl text-center transition-all"
                        style={{
                          background: active ? cat.darkBg : 'transparent',
                          border: active
                            ? `1.5px solid ${cat.darkText}50`
                            : '1.5px solid transparent',
                          color: active ? cat.darkText : 'var(--text-3)',
                        }}
                      >
                        <span style={{ fontSize: '1.25rem', lineHeight: 1 }}>{cat.icon}</span>
                        <span className="text-[10px] font-semibold leading-tight">{cat.label}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-widest mb-1.5 block"
                      style={{ color: 'var(--text-3)' }}>Data</label>
                    <input
                      type="date"
                      value={date}
                      onChange={e => setDate(e.target.value)}
                      className="input w-full px-3 py-2 text-sm"
                      style={{ colorScheme: 'dark' }}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-widest mb-1.5 block"
                      style={{ color: 'var(--text-3)' }}>Descrizione</label>
                    <input
                      type="text"
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      placeholder="es. Supermercato…"
                      className="input w-full px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {error && (
          <p className="text-xs mt-3 px-3 py-2 rounded-lg"
            style={{
              color: '#fca5a5',
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.18)',
            }}>
            {error}
          </p>
        )}
      </form>
    </div>
  );
}
