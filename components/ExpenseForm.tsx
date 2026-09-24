'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabaseClient';
import { CATEGORIES } from '@/lib/categories';
import { Plus, Check } from 'lucide-react';

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

export default function ExpenseForm() {
  const router = useRouter();
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('altro');
  const [date, setDate] = useState(todayISO());
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

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
      setCategory('altro');
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
      router.refresh();
    }

    setLoading(false);
  }

  const labelClass = 'text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5 block';
  const inputClass = 'input w-full px-3 py-2.5 text-sm';

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* Riga 1 */}
      <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr 160px' }}>
        <div>
          <label className={labelClass}>Importo (€)</label>
          <input
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            required
            placeholder="0,00"
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>Categoria</label>
          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
            className={inputClass}
            style={{ appearance: 'none', cursor: 'pointer' }}
          >
            {CATEGORIES.map(c => (
              <option key={c.value} value={c.value} style={{ background: '#162038' }}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass}>Data</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            required
            className={inputClass}
            style={{ colorScheme: 'dark' }}
          />
        </div>
      </div>

      {/* Riga 2 */}
      <div className="flex gap-3 items-end">
        <div className="flex-1">
          <label className={labelClass}>Descrizione (opzionale)</label>
          <input
            type="text"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="es. Supermercato, Carburante…"
            className={inputClass}
          />
        </div>

        <button
          type="submit"
          disabled={loading || success}
          className="btn-primary flex items-center gap-2 px-5 py-2.5 text-sm"
          style={success ? { background: '#059669', boxShadow: '0 4px 14px rgba(5,150,105,0.3)' } : {}}
        >
          {success ? (
            <><Check size={14} /> Aggiunta</>
          ) : loading ? (
            '…'
          ) : (
            <><Plus size={14} /> Aggiungi</>
          )}
        </button>
      </div>

      {error && (
        <p
          className="text-xs text-red-400 px-3 py-2.5 rounded-lg"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)' }}
        >
          {error}
        </p>
      )}
    </form>
  );
}
