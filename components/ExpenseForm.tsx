'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabaseClient';
import { CATEGORIES } from '@/lib/categories';
import { Plus, Check, Loader2 } from 'lucide-react';

const CATEGORY_DOTS: Record<string, string> = {
  alimentari:      '#6FA287',
  ristoranti:      '#C9A227',
  trasporti:       '#5B8BB0',
  casa:            '#B07E59',
  salute:          '#C1666B',
  sport:           '#4BA09A',
  abbigliamento:   '#9485C8',
  intrattenimento: '#BE7A9A',
  utenze:          '#7A9090',
  altro:           '#5A6B67',
};

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

const defaultCategory = 'alimentari';

const underlineInput: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  borderBottom: '1px solid var(--border)',
  color: 'var(--text-1)',
  padding: '0.5rem 0',
  width: '100%',
  outline: 'none',
  fontFamily: 'inherit',
  transition: 'border-color 0.15s ease',
};

export default function ExpenseForm() {
  const router = useRouter();
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(defaultCategory);
  const [date, setDate] = useState(todayISO());
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const catRef = useRef<HTMLDivElement>(null);

  const selectedCat = CATEGORIES.find(c => c.value === category) ?? CATEGORIES[0];
  const selectedDot = CATEGORY_DOTS[category] ?? '#5A6B67';

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
      setTimeout(() => { setSuccess(false); router.refresh(); }, 1500);
    }
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column' }}>

      {/* Riga 1 — importo */}
      <div style={{ position: 'relative' }}>
        <span style={{
          position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
          color: 'var(--text-3)', fontSize: '1.125rem', pointerEvents: 'none',
        }}>
          €
        </span>
        <input
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          placeholder="0,00"
          style={{ ...underlineInput, paddingLeft: '1.5rem', fontSize: '1.125rem', fontWeight: 600 }}
          onFocus={e => (e.currentTarget.style.borderBottomColor = 'var(--accent)')}
          onBlur={e => (e.currentTarget.style.borderBottomColor = 'var(--border)')}
        />
      </div>

      {/* Riga 2 — categoria · data · aggiungi */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '1rem',
        padding: '0.75rem 0',
        borderBottom: '1px solid var(--border)',
        flexWrap: 'wrap',
      }}>
        {/* Categoria */}
        <div ref={catRef} style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => setCatOpen(v => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-2)', fontSize: '0.875rem', fontFamily: 'inherit', padding: 0,
            }}
          >
            <span style={{
              display: 'inline-block', width: 8, height: 8,
              borderRadius: '50%', background: selectedDot, flexShrink: 0,
            }} />
            <span>{selectedCat.label}</span>
            <span style={{ color: 'var(--text-3)', fontSize: '0.7rem' }}>▾</span>
          </button>

          {catOpen && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 6px)', left: 0,
              background: 'var(--surface)', border: '1px solid var(--border)',
              zIndex: 50, minWidth: '180px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            }}>
              {CATEGORIES.map(cat => {
                const dot = CATEGORY_DOTS[cat.value] ?? '#5A6B67';
                const active = cat.value === category;
                return (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => { setCategory(cat.value); setCatOpen(false); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.625rem',
                      width: '100%', padding: '0.5rem 0.875rem',
                      background: active ? 'rgba(201,162,39,0.08)' : 'none',
                      border: 'none', cursor: 'pointer',
                      color: active ? 'var(--accent)' : 'var(--text-1)',
                      fontSize: '0.875rem', fontFamily: 'inherit', textAlign: 'left',
                    }}
                  >
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: dot, display: 'inline-block', flexShrink: 0 }} />
                    {cat.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <span aria-hidden style={{ color: 'var(--border)', userSelect: 'none' }}>·</span>

        {/* Data */}
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          style={{
            background: 'none', border: 'none', outline: 'none',
            color: 'var(--text-2)', fontSize: '0.875rem', fontFamily: 'inherit',
            cursor: 'pointer', colorScheme: 'dark',
          }}
        />

        {/* Submit */}
        <div style={{ marginLeft: 'auto' }}>
          <button
            type="submit"
            disabled={loading || !amount}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.375rem',
              padding: '0.375rem 0.875rem',
              border: success ? '1px solid var(--positive)' : '1px solid var(--accent)',
              background: 'none',
              color: success ? 'var(--positive)' : 'var(--accent)',
              fontSize: '0.875rem', fontFamily: 'inherit', fontWeight: 500,
              cursor: loading || !amount ? 'not-allowed' : 'pointer',
              opacity: loading || !amount ? 0.45 : 1,
              transition: 'background 0.15s ease, color 0.15s ease, border-color 0.15s ease',
            }}
            onMouseEnter={e => {
              if (!loading && amount && !success) {
                (e.currentTarget).style.background = 'var(--accent)';
                (e.currentTarget).style.color = '#101B1A';
              }
            }}
            onMouseLeave={e => {
              (e.currentTarget).style.background = 'none';
              (e.currentTarget).style.color = success ? 'var(--positive)' : 'var(--accent)';
            }}
          >
            {success
              ? <><Check size={14} /> Aggiunta</>
              : loading
              ? <Loader2 size={14} className="animate-spin" />
              : <><Plus size={14} /> Aggiungi</>}
          </button>
        </div>
      </div>

      {/* Riga 3 — descrizione */}
      <input
        type="text"
        value={description}
        onChange={e => setDescription(e.target.value)}
        placeholder="Descrizione (opzionale)"
        style={{ ...underlineInput, fontSize: '0.875rem', color: 'var(--text-2)' }}
        onFocus={e => (e.currentTarget.style.borderBottomColor = 'var(--accent)')}
        onBlur={e => (e.currentTarget.style.borderBottomColor = 'var(--border)')}
      />

      {error && (
        <p style={{ color: 'var(--negative)', fontSize: '0.8125rem', marginTop: '0.75rem' }}>
          {error}
        </p>
      )}
    </form>
  );
}
