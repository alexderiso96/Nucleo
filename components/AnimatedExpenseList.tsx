'use client';

import { useState, useRef, useEffect } from 'react';
import { Check, Trash2, X, Loader2, Pencil, StickyNote, Search, SlidersHorizontal, ArrowUpDown } from 'lucide-react';
import { CATEGORIES } from '@/lib/categories';

interface Expense {
  id: string;
  amount: number;
  currency: string;
  category: string;
  category_confidence?: string | null;
  description: string | null;
  expense_date: string;
  source?: string | null;
  is_shared?: boolean;
  is_income?: boolean;
  notes?: string | null;
}

interface UserCat { value: string; label: string; icon: string; color: string }

interface Props {
  expenses: Expense[];
  monthLabel: string;
  hasHousehold?: boolean;
  userCategories?: UserCat[];
}

const fmt = (n: number) =>
  new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);

function hexToRgba(hex: string, alpha: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function categoryIcon(value: string, userCats: UserCat[] = []): string {
  return CATEGORIES.find(c => c.value === value)?.icon
    ?? userCats.find(c => c.value === value)?.icon
    ?? '📦';
}
function categoryLabel(value: string, userCats: UserCat[] = []): string {
  return CATEGORIES.find(c => c.value === value)?.label
    ?? userCats.find(c => c.value === value)?.label
    ?? value;
}
function categoryDarkBg(value: string, userCats: UserCat[] = []): string {
  const builtin = CATEGORIES.find(c => c.value === value)?.darkBg;
  if (builtin) return builtin;
  const uc = userCats.find(c => c.value === value);
  return uc ? hexToRgba(uc.color, 0.14) : 'rgba(100,116,139,0.14)';
}
function categoryDarkText(value: string, userCats: UserCat[] = []): string {
  return CATEGORIES.find(c => c.value === value)?.darkText
    ?? userCats.find(c => c.value === value)?.color
    ?? '#64748b';
}

type SortBy = 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc' | 'desc-asc' | 'desc-desc';
type TypeFilter = 'all' | 'expense' | 'income';
type SourceFilter = 'all' | 'manual' | 'csv' | 'payslip';

interface DayGroup {
  dateKey: string;
  label: string;
  dayTotal: number;
  items: Expense[];
}

function dayLabel(dateKey: string): string {
  const todayStr = new Date().toISOString().split('T')[0];
  const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  if (dateKey === todayStr) return 'Oggi';
  if (dateKey === yesterdayStr) return 'Ieri';
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
}

function buildGroups(expenses: Expense[], sortBy: SortBy): DayGroup[] {
  const map = new Map<string, Expense[]>();
  for (const e of expenses) {
    if (!map.has(e.expense_date)) map.set(e.expense_date, []);
    map.get(e.expense_date)!.push(e);
  }
  const dateOrder = sortBy === 'date-asc' ? 1 : -1;
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b) * dateOrder)
    .map(([key, items]) => {
      const dayTotal = items.filter(e => !e.is_income).reduce((s, e) => s + Number(e.amount), 0);
      return { dateKey: key, label: dayLabel(key), dayTotal, items };
    });
}

interface RowState {
  category: string;
  confidence: string | null;
  description: string | null;
  notes: string | null;
  saved: boolean;
  deleted: boolean;
  shared: boolean;
  sharingLoading: boolean;
}

export default function AnimatedExpenseList({ expenses, monthLabel, hasHousehold = false, userCategories = [] }: Props) {
  const [rows, setRows] = useState<Record<string, RowState>>(() => {
    const init: Record<string, RowState> = {};
    for (const e of expenses) {
      init[e.id] = {
        category: e.category,
        confidence: e.category_confidence ?? null,
        description: e.description,
        notes: e.notes ?? null,
        saved: false,
        deleted: false,
        shared: e.is_shared ?? false,
        sharingLoading: false,
      };
    }
    return init;
  });

  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editingDescription, setEditingDescription] = useState<string | null>(null);
  const [descDraft, setDescDraft] = useState('');
  const [saving, setSaving] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const savedTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Filtri
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [search, setSearch] = useState('');
  const [amountMin, setAmountMin] = useState('');
  const [amountMax, setAmountMax] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('date-desc');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Note popup
  const [noteExpenseId, setNoteExpenseId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const noteTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus textarea quando il popup si apre
  useEffect(() => {
    if (noteExpenseId) {
      setTimeout(() => noteTextareaRef.current?.focus(), 50);
    }
  }, [noteExpenseId]);

  // ── Aggiorna tutte le righe con la stessa descrizione ────────────────────────

  function updateRowsByDescription(originalDesc: string | null, patch: Partial<RowState>) {
    setRows(prev => {
      const next = { ...prev };
      for (const id of Object.keys(next)) {
        if (next[id].description === originalDesc) {
          next[id] = { ...next[id], ...patch };
        }
      }
      return next;
    });
  }

  function flashSaved(id: string) {
    setRows(prev => ({ ...prev, [id]: { ...prev[id], saved: true } }));
    clearTimeout(savedTimers.current[id]);
    savedTimers.current[id] = setTimeout(() => {
      setRows(prev => ({ ...prev, [id]: { ...prev[id], saved: false } }));
    }, 1500);
  }

  // ── Note ─────────────────────────────────────────────────────────────────────

  function openNote(expense: Expense) {
    setNoteExpenseId(expense.id);
    setNoteDraft(rows[expense.id]?.notes ?? '');
  }

  function closeNote() {
    setNoteExpenseId(null);
    setNoteDraft('');
  }

  async function saveNote() {
    if (!noteExpenseId) return;
    setSavingNote(true);
    const trimmed = noteDraft.trim() || null;
    try {
      await fetch(`/api/expenses/${noteExpenseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: trimmed }),
      });
      setRows(prev => ({
        ...prev,
        [noteExpenseId]: { ...prev[noteExpenseId], notes: trimmed },
      }));
      closeNote();
    } catch { /* ignore */ } finally { setSavingNote(false); }
  }

  // ── Modifica categoria ────────────────────────────────────────────────────────

  async function handleCategoryChange(expense: Expense, newCategory: string) {
    setEditingCategory(null);
    setSaving(expense.id);
    const originalDesc = rows[expense.id]?.description ?? expense.description;
    try {
      // Aggiorna tutte le spese con la stessa descrizione
      if (originalDesc) {
        await fetch('/api/expenses/bulk', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ originalDescription: originalDesc, category: newCategory }),
        });
      } else {
        // Nessuna descrizione: aggiorna solo questa
        await fetch(`/api/expenses/${expense.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ category: newCategory }),
        });
      }
      // Salva regola merchant per auto-categorizzazione futura
      if (originalDesc) {
        await fetch('/api/merchant-rules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ description: originalDesc, category: newCategory }),
        });
      }
      // Aggiorna stato locale per tutte le righe con la stessa descrizione
      updateRowsByDescription(originalDesc, { category: newCategory, confidence: 'high' });
      flashSaved(expense.id);
    } catch { /* ignore */ } finally { setSaving(null); }
  }

  // ── Modifica descrizione ──────────────────────────────────────────────────────

  function startEditDescription(expense: Expense) {
    setEditingDescription(expense.id);
    setDescDraft(rows[expense.id]?.description ?? expense.description ?? '');
  }

  async function commitDescription(expense: Expense) {
    const trimmed = descDraft.trim();
    const originalDesc = rows[expense.id]?.description ?? expense.description;
    setEditingDescription(null);
    if (!trimmed || trimmed === originalDesc) return;

    setSaving(expense.id);
    try {
      if (originalDesc) {
        await fetch('/api/expenses/bulk', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ originalDescription: originalDesc, description: trimmed }),
        });
      } else {
        await fetch(`/api/expenses/${expense.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ description: trimmed }),
        });
      }
      updateRowsByDescription(originalDesc, { description: trimmed });
      flashSaved(expense.id);
    } catch { /* ignore */ } finally { setSaving(null); }
  }

  // ── Elimina ───────────────────────────────────────────────────────────────────

  async function handleDelete(id: string) {
    setDeleting(id);
    setConfirmDelete(null);
    try {
      await fetch(`/api/expenses/${id}`, { method: 'DELETE' });
      setRows(prev => ({ ...prev, [id]: { ...prev[id], deleted: true } }));
    } catch { /* ignore */ } finally { setDeleting(null); }
  }

  // ── Toggle condivisione ───────────────────────────────────────────────────────

  async function handleToggleShare(expense: Expense) {
    const current = rows[expense.id]?.shared ?? false;
    setRows(prev => ({ ...prev, [expense.id]: { ...prev[expense.id], sharingLoading: true } }));
    try {
      const res = await fetch(`/api/expenses/${expense.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_shared: !current }),
      });
      if (res.ok) {
        setRows(prev => ({ ...prev, [expense.id]: { ...prev[expense.id], shared: !current, sharingLoading: false } }));
      } else {
        setRows(prev => ({ ...prev, [expense.id]: { ...prev[expense.id], sharingLoading: false } }));
      }
    } catch {
      setRows(prev => ({ ...prev, [expense.id]: { ...prev[expense.id], sharingLoading: false } }));
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  const notDeleted = expenses.filter(e => !rows[e.id]?.deleted);

  const minAmt = amountMin !== '' ? parseFloat(amountMin) : null;
  const maxAmt = amountMax !== '' ? parseFloat(amountMax) : null;
  const searchLow = search.toLowerCase().trim();

  const visible = notDeleted.filter(e => {
    const row = rows[e.id];
    const cat = row?.category ?? e.category;
    const desc = (row?.description ?? e.description ?? '').toLowerCase();
    const amt = Number(e.amount);

    if (categoryFilter !== 'all' && cat !== categoryFilter) return false;
    if (typeFilter === 'expense' && e.is_income) return false;
    if (typeFilter === 'income' && !e.is_income) return false;
    if (sourceFilter === 'manual' && e.source && e.source !== 'manual') return false;
    if (sourceFilter === 'csv' && e.source !== 'csv') return false;
    if (sourceFilter === 'payslip' && e.source !== 'payslip') return false;
    if (searchLow && !desc.includes(searchLow)) return false;
    if (minAmt !== null && amt < minAmt) return false;
    if (maxAmt !== null && amt > maxAmt) return false;
    return true;
  });

  // Ordinamento (solo per sort non-date: lista flat invece di gruppi)
  const isDateSort = sortBy === 'date-desc' || sortBy === 'date-asc';
  const sorted = isDateSort ? visible : [...visible].sort((a, b) => {
    if (sortBy === 'amount-desc') return Number(b.amount) - Number(a.amount);
    if (sortBy === 'amount-asc')  return Number(a.amount) - Number(b.amount);
    const da = (rows[a.id]?.description ?? a.description ?? '').toLowerCase();
    const db = (rows[b.id]?.description ?? b.description ?? '').toLowerCase();
    if (sortBy === 'desc-asc')  return da.localeCompare(db, 'it');
    if (sortBy === 'desc-desc') return db.localeCompare(da, 'it');
    return 0;
  });

  const groups = isDateSort ? buildGroups(sorted, sortBy) : [];
  const totalExpenses = visible.filter(e => !e.is_income).reduce((s, e) => s + Number(e.amount), 0);
  const totalIncome   = visible.filter(e => e.is_income).reduce((s, e) => s + Number(e.amount), 0);
  const usedBuiltin = CATEGORIES.filter(c =>
    notDeleted.some(e => (rows[e.id]?.category ?? e.category) === c.value),
  );
  const usedUserCats = userCategories
    .filter(c => notDeleted.some(e => (rows[e.id]?.category ?? e.category) === c.value))
    .map(c => ({
      value: c.value,
      label: c.label,
      icon: c.icon,
      darkBg: `rgba(${parseInt(c.color.slice(1,3),16)},${parseInt(c.color.slice(3,5),16)},${parseInt(c.color.slice(5,7),16)},0.14)`,
      darkText: c.color,
    }));
  const usedCategories = [...usedBuiltin, ...usedUserCats];

  const activeFilters = [
    categoryFilter !== 'all',
    typeFilter !== 'all',
    sourceFilter !== 'all',
    searchLow !== '',
    amountMin !== '',
    amountMax !== '',
    sortBy !== 'date-desc',
  ].filter(Boolean).length;

  const SORT_LABELS: Record<SortBy, string> = {
    'date-desc':   'Data ↓',
    'date-asc':    'Data ↑',
    'amount-desc': 'Importo ↓',
    'amount-asc':  'Importo ↑',
    'desc-asc':    'Descrizione A-Z',
    'desc-desc':   'Descrizione Z-A',
  };

  const SOURCE_LABELS: Record<SourceFilter, string> = {
    all:     'Tutte',
    manual:  'Manuali',
    csv:     'CSV / Drive',
    payslip: 'Busta paga',
  };

  function resetFilters() {
    setCategoryFilter('all');
    setTypeFilter('all');
    setSourceFilter('all');
    setSearch('');
    setAmountMin('');
    setAmountMax('');
    setSortBy('date-desc');
  }

  const renderTotale = () => (
    <div
      className="flex items-center justify-between gap-4 px-4 py-3"
      style={{ borderTop: '1px solid var(--border-strong)', background: 'var(--surface-2)' }}
    >
      <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>
        {monthLabel}
      </span>
      <div className="flex items-center gap-4">
        {totalIncome > 0 && (
          <span className="text-sm tabular-nums" style={{ color: 'var(--income)' }}>
            +{fmt(totalIncome)}
          </span>
        )}
        <span className="text-base font-bold tabular-nums" style={{ color: 'var(--text-1)' }}>
          {fmt(totalExpenses)}
        </span>
      </div>
    </div>
  );

  const renderRow = (expense: Expense) => {
    const row = rows[expense.id] ?? {
      category: expense.category, confidence: null,
      description: expense.description, notes: null,
      saved: false, deleted: false,
      shared: expense.is_shared ?? false, sharingLoading: false,
    };
    const isSaving      = saving === expense.id;
    const isDeleting    = deleting === expense.id;
    const isConfirming  = confirmDelete === expense.id;
    const isEditingCat  = editingCategory === expense.id;
    const isEditingDesc = editingDescription === expense.id;
    const isIncome      = expense.is_income ?? false;
    const isLowConf     = row.confidence === 'low' && !isIncome;
    const catBg         = isIncome ? 'rgba(16,185,129,0.12)' : categoryDarkBg(row.category, userCategories);
    const catText       = isIncome ? '#34d399' : categoryDarkText(row.category, userCategories);
    const label         = isIncome ? 'Entrata' : categoryLabel(row.category, userCategories);
    const icon          = isIncome ? '↑' : categoryIcon(row.category, userCategories);
    const currentDesc   = row.description;

    return (
      <div
        key={expense.id}
        className="flex items-center gap-3 px-4 py-3 group transition-colors"
        style={{ borderBottom: '1px solid var(--border)' }}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      >
        <div className="flex items-center justify-center w-8 h-8 rounded-xl shrink-0 text-base" style={{ background: catBg }}>
          {icon}
        </div>

        <div className="flex-1 min-w-0">
          {isEditingDesc ? (
            <input
              autoFocus
              value={descDraft}
              onChange={e => setDescDraft(e.target.value)}
              onBlur={() => commitDescription(expense)}
              onKeyDown={e => {
                if (e.key === 'Enter') commitDescription(expense);
                if (e.key === 'Escape') setEditingDescription(null);
              }}
              className="text-sm w-full bg-transparent outline-none"
              style={{ color: 'var(--text-1)', borderBottom: '1px solid var(--brand)', paddingBottom: '1px' }}
            />
          ) : (
            <div className="flex items-center gap-1.5 group/desc">
              <p className="text-sm truncate" style={{ color: 'var(--text-1)' }} title={currentDesc ?? label}>
                {currentDesc ?? <span style={{ color: 'var(--text-3)' }}>{label}</span>}
              </p>
              <button
                onClick={() => startEditDescription(expense)}
                className="opacity-0 group-hover/desc:opacity-100 transition-opacity shrink-0"
                title="Modifica descrizione"
                style={{ color: 'var(--text-3)' }}
              >
                <Pencil size={11} />
              </button>
            </div>
          )}

          {/* Data visibile in modalità flat */}
          {!isDateSort && (
            <span className="text-[10px] tabular-nums" style={{ color: 'var(--text-3)' }}>
              {new Date(expense.expense_date + 'T12:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: '2-digit' })}
            </span>
          )}

          {isEditingCat ? (
            <select
              autoFocus
              className="input text-[10px] px-2 py-0.5 rounded-full mt-0.5"
              style={{ appearance: 'none', colorScheme: 'dark', minWidth: 120 }}
              defaultValue={row.category}
              onChange={e => handleCategoryChange(expense, e.target.value)}
              onBlur={() => setEditingCategory(null)}
            >
              {CATEGORIES.map(c => (
                <option key={c.value} value={c.value}>{c.icon} {c.label}</option>
              ))}
              {userCategories.map(c => (
                <option key={c.value} value={c.value}>{c.icon} {c.label}</option>
              ))}
            </select>
          ) : (
            <button
              onClick={() => setEditingCategory(expense.id)}
              title={isLowConf ? 'Categoria incerta — clicca per correggere' : 'Cambia categoria'}
              className="flex items-center gap-1 mt-0.5"
            >
              {isSaving ? (
                <Loader2 size={10} className="animate-spin" style={{ color: 'var(--text-3)' }} />
              ) : row.saved ? (
                <Check size={10} style={{ color: 'var(--income)' }} />
              ) : null}
              <span
                className="badge text-[10px]"
                style={isLowConf
                  ? { background: 'rgba(251,191,36,0.12)', color: 'var(--warning)', border: '1px solid rgba(251,191,36,0.25)' }
                  : { background: catBg, color: catText }}
              >
                {isLowConf && <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: 'var(--warning)' }} />}
                {label}
              </span>
            </button>
          )}
        </div>

        <span className="text-sm font-semibold tabular-nums shrink-0" style={{ color: isIncome ? 'var(--income)' : 'var(--expense)' }}>
          {isIncome ? '+' : ''}{fmt(Number(expense.amount))}
        </span>

        <button
          onClick={() => openNote(expense)}
          title={row.notes ? 'Modifica nota' : 'Aggiungi nota'}
          className="w-6 h-6 flex items-center justify-center rounded-md transition-all shrink-0"
          style={{ color: row.notes ? 'var(--brand-light)' : 'var(--text-3)', background: row.notes ? 'rgba(16,185,129,0.1)' : 'transparent', opacity: row.notes ? 1 : undefined }}
        >
          <StickyNote size={12} />
        </button>

        {hasHousehold && (
          <button
            onClick={() => handleToggleShare(expense)}
            disabled={row.sharingLoading}
            title={row.shared ? 'Condivisa col partner — clicca per rendere privata' : 'Condividi col partner'}
            className="w-6 h-6 flex items-center justify-center rounded-md transition-all shrink-0"
            style={{ fontSize: '0.7rem', opacity: row.sharingLoading ? 0.5 : 1, background: row.shared ? 'rgba(16,185,129,0.12)' : 'transparent', border: row.shared ? '1px solid rgba(16,185,129,0.3)' : '1px solid transparent', color: row.shared ? 'var(--income)' : 'var(--text-3)' }}
          >
            {row.sharingLoading ? <Loader2 size={11} className="animate-spin" /> : '⇌'}
          </button>
        )}

        <div className="w-7 flex items-center justify-center shrink-0">
          {isDeleting ? (
            <Loader2 size={13} className="animate-spin" style={{ color: 'var(--text-3)' }} />
          ) : isConfirming ? (
            <div className="flex gap-1">
              <button onClick={() => handleDelete(expense.id)} className="w-5 h-5 flex items-center justify-center rounded" style={{ color: 'var(--expense)' }} title="Conferma">
                <Check size={11} />
              </button>
              <button onClick={() => setConfirmDelete(null)} className="w-5 h-5 flex items-center justify-center rounded" style={{ color: 'var(--text-3)' }} title="Annulla">
                <X size={11} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(expense.id)}
              className="w-6 h-6 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ color: 'var(--text-3)' }}
              title="Elimina"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
    <div className="card anim-slide-up anim-d4 overflow-hidden">

      {/* ── Barra filtri ─────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2.5 px-4 pt-3 pb-3" style={{ borderBottom: '1px solid var(--border)' }}>

        {/* Riga 1: titolo + ricerca + ordinamento + toggle avanzati */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold shrink-0" style={{ color: 'var(--text-2)' }}>
            {monthLabel}
          </span>
          <div className="flex-1 relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-3)' }} />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cerca descrizione…"
              className="input w-full pl-7 pr-2 py-1.5 text-xs"
            />
          </div>
          <div className="relative shrink-0">
            <ArrowUpDown size={11} className="absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-3)' }} />
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as SortBy)}
              className="input pl-6 pr-2 py-1.5 text-[11px]"
              style={{ appearance: 'none', colorScheme: 'dark', minWidth: 110 }}
            >
              {(Object.entries(SORT_LABELS) as [SortBy, string][]).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => setShowAdvanced(v => !v)}
            className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] transition-colors relative"
            style={{
              background: showAdvanced || activeFilters > 0 ? 'rgba(56,189,248,0.10)' : 'var(--surface-2)',
              border: `1px solid ${showAdvanced || activeFilters > 0 ? 'rgba(56,189,248,0.3)' : 'var(--border-strong)'}`,
              color: showAdvanced || activeFilters > 0 ? '#38bdf8' : 'var(--text-3)',
            }}
            title="Filtri avanzati"
          >
            <SlidersHorizontal size={12} />
            {activeFilters > 0 && (
              <span className="font-bold">{activeFilters}</span>
            )}
          </button>
        </div>

        {/* Riga 2: filtri avanzati (collassabili) */}
        {showAdvanced && (
          <div className="flex flex-col gap-2.5 pt-1">

            {/* Tipo */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-widest w-16 shrink-0" style={{ color: 'var(--text-3)' }}>Tipo</span>
              <div className="flex gap-1">
                {(['all', 'expense', 'income'] as TypeFilter[]).map(v => (
                  <button
                    key={v}
                    onClick={() => setTypeFilter(v)}
                    className="px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all"
                    style={typeFilter === v
                      ? { background: v === 'income' ? 'rgba(52,211,153,0.2)' : v === 'expense' ? 'rgba(251,113,133,0.2)' : 'var(--brand)', color: v === 'income' ? '#34d399' : v === 'expense' ? '#fb7185' : '#fff' }
                      : { background: 'var(--surface-2)', color: 'var(--text-2)', border: '1px solid var(--border-strong)' }}
                  >
                    {v === 'all' ? 'Tutti' : v === 'expense' ? 'Uscite' : 'Entrate'}
                  </button>
                ))}
              </div>
            </div>

            {/* Fonte */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-widest w-16 shrink-0" style={{ color: 'var(--text-3)' }}>Fonte</span>
              <div className="flex gap-1 flex-wrap">
                {(Object.entries(SOURCE_LABELS) as [SourceFilter, string][]).map(([v, label]) => (
                  <button
                    key={v}
                    onClick={() => setSourceFilter(v)}
                    className="px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all"
                    style={sourceFilter === v
                      ? { background: 'var(--brand)', color: '#fff' }
                      : { background: 'var(--surface-2)', color: 'var(--text-2)', border: '1px solid var(--border-strong)' }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Range importo */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-widest w-16 shrink-0" style={{ color: 'var(--text-3)' }}>Importo</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  value={amountMin}
                  onChange={e => setAmountMin(e.target.value)}
                  placeholder="Min €"
                  className="input px-2 py-1 text-xs w-20"
                />
                <span className="text-xs" style={{ color: 'var(--text-3)' }}>—</span>
                <input
                  type="number"
                  min="0"
                  value={amountMax}
                  onChange={e => setAmountMax(e.target.value)}
                  placeholder="Max €"
                  className="input px-2 py-1 text-xs w-20"
                />
              </div>
            </div>

            {/* Reset */}
            {activeFilters > 0 && (
              <button
                onClick={resetFilters}
                className="self-start text-[11px] text-red-400 hover:text-red-300 transition-colors"
              >
                Azzera tutti i filtri
              </button>
            )}
          </div>
        )}

        {/* Riga 3: filtro categoria (sempre visibile) */}
        <div className="flex gap-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          <button
            onClick={() => setCategoryFilter('all')}
            className="shrink-0 px-3 py-1 rounded-full text-[11px] font-semibold transition-all"
            style={categoryFilter === 'all'
              ? { background: 'var(--brand)', color: '#fff' }
              : { background: 'var(--surface-2)', color: 'var(--text-2)', border: '1px solid var(--border-strong)' }}
          >
            Tutte
          </button>
          {usedCategories.map(cat => {
            const active = categoryFilter === cat.value;
            return (
              <button
                key={cat.value}
                onClick={() => setCategoryFilter(active ? 'all' : cat.value)}
                className="shrink-0 flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-semibold transition-all"
                style={active
                  ? { background: cat.darkBg, color: cat.darkText, border: `1px solid ${cat.darkText}40` }
                  : { background: 'var(--surface-2)', color: 'var(--text-2)', border: '1px solid var(--border-strong)' }}
              >
                <span style={{ fontSize: '0.7rem' }}>{cat.icon}</span>
                {cat.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[10px] tabular-nums" style={{ color: 'var(--text-3)' }}>
            {visible.length} di {notDeleted.length} voci
            {!isDateSort && <span className="ml-1">· {SORT_LABELS[sortBy]}</span>}
          </span>
        </div>
      </div>

      {/* Lista */}
      {visible.length === 0 ? (
        <div className="px-5 py-12 text-center text-sm" style={{ color: 'var(--text-3)' }}>
          {notDeleted.length === 0 ? 'Nessuna voce in questo periodo.' : 'Nessuna voce corrisponde ai filtri.'}
        </div>
      ) : isDateSort ? (
        /* ── Visualizzazione raggruppata per giorno ── */
        <>
          {groups.map(group => (
            <div key={group.dateKey}>
              <div
                className="flex items-center justify-between px-4 py-2"
                style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}
              >
                <span className="text-[11px] font-semibold capitalize" style={{ color: 'var(--text-2)' }}>
                  {group.label}
                </span>
                <span className="text-[11px] tabular-nums" style={{ color: 'var(--text-3)' }}>
                  {fmt(group.dayTotal)}
                </span>
              </div>

              {group.items.map(expense => renderRow(expense))}
            </div>
          ))}
          {renderTotale()}
        </>
      ) : (
        /* ── Visualizzazione flat (ordina per importo / descrizione) ── */
        <>
          {sorted.map(expense => renderRow(expense))}
          {renderTotale()}
        </>
      )}
    </div>

      {/* ── Popup note ──────────────────────────────────────────────────── */}
      {noteExpenseId && (() => {
        const exp = expenses.find(e => e.id === noteExpenseId)!;
        const row = rows[noteExpenseId];
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
            onClick={e => { if (e.target === e.currentTarget) closeNote(); }}
          >
            <div
              className="w-full max-w-sm rounded-2xl p-5 flex flex-col gap-4"
              style={{ background: 'var(--dark-800)', border: '1px solid var(--border-strong)' }}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-1)' }}>
                    {row?.description ?? categoryLabel(row?.category ?? exp.category, userCategories)}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
                    {fmt(Number(exp.amount))} · {new Date(exp.expense_date + 'T12:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}
                  </p>
                </div>
                <button onClick={closeNote} style={{ color: 'var(--text-3)' }}>
                  <X size={16} />
                </button>
              </div>

              {/* Textarea */}
              <textarea
                ref={noteTextareaRef}
                value={noteDraft}
                onChange={e => setNoteDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) saveNote(); }}
                placeholder="Aggiungi una nota…"
                rows={4}
                className="w-full resize-none rounded-xl px-3 py-2.5 text-sm outline-none"
                style={{
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border-strong)',
                  color: 'var(--text-1)',
                  lineHeight: 1.6,
                }}
              />
              <p className="text-[10px] -mt-2" style={{ color: 'var(--text-3)' }}>
                ⌘↵ per salvare
              </p>

              {/* Footer */}
              <div className="flex gap-2 justify-end">
                {row?.notes && (
                  <button
                    onClick={() => { setNoteDraft(''); }}
                    className="px-3 py-1.5 text-xs rounded-lg"
                    style={{ color: 'var(--text-3)' }}
                  >
                    Cancella nota
                  </button>
                )}
                <button
                  onClick={closeNote}
                  className="px-3 py-1.5 text-xs rounded-lg"
                  style={{ color: 'var(--text-3)' }}
                >
                  Annulla
                </button>
                <button
                  onClick={saveNote}
                  disabled={savingNote}
                  className="px-4 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5"
                  style={{ background: 'var(--brand)', color: '#fff', opacity: savingNote ? 0.7 : 1 }}
                >
                  {savingNote ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                  Salva
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}
