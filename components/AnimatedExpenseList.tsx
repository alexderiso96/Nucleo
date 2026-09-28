'use client';

import { useState, useRef, useEffect } from 'react';
import { Check, Trash2, X, Loader2, Pencil, StickyNote } from 'lucide-react';
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
  notes?: string | null;
}

interface Props {
  expenses: Expense[];
  monthLabel: string;
  hasHousehold?: boolean;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);

function categoryIcon(value: string): string {
  return CATEGORIES.find(c => c.value === value)?.icon ?? '📦';
}
function categoryLabel(value: string): string {
  return CATEGORIES.find(c => c.value === value)?.label ?? value;
}
function categoryDarkBg(value: string): string {
  return CATEGORIES.find(c => c.value === value)?.darkBg ?? 'rgba(100,116,139,0.14)';
}
function categoryDarkText(value: string): string {
  return CATEGORIES.find(c => c.value === value)?.darkText ?? '#64748b';
}

interface DayGroup {
  dateKey: string;
  label: string;
  dayTotal: number;
  items: Expense[];
}

function buildGroups(expenses: Expense[]): DayGroup[] {
  const todayStr = new Date().toISOString().split('T')[0];
  const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const map = new Map<string, Expense[]>();
  for (const e of expenses) {
    if (!map.has(e.expense_date)) map.set(e.expense_date, []);
    map.get(e.expense_date)!.push(e);
  }
  return [...map.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, items]) => {
      let label: string;
      if (key === todayStr) label = 'Oggi';
      else if (key === yesterdayStr) label = 'Ieri';
      else {
        const [y, m, d] = key.split('-').map(Number);
        label = new Date(y, m - 1, d).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
      }
      return { dateKey: key, label, dayTotal: items.reduce((s, e) => s + Number(e.amount), 0), items };
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

export default function AnimatedExpenseList({ expenses, monthLabel, hasHousehold = false }: Props) {
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
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const savedTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

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
  const visible = notDeleted.filter(e =>
    categoryFilter === 'all' || (rows[e.id]?.category ?? e.category) === categoryFilter,
  );
  const groups = buildGroups(visible);
  const total = visible.reduce((s, e) => s + Number(e.amount), 0);
  const usedCategories = CATEGORIES.filter(c =>
    notDeleted.some(e => (rows[e.id]?.category ?? e.category) === c.value),
  );

  return (
    <>
    <div className="card anim-slide-up anim-d4 overflow-hidden">

      {/* Header + filtri */}
      <div className="px-4 py-3 flex flex-col gap-2.5" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold" style={{ color: 'var(--text-2)' }}>
            Spese di {monthLabel}
          </span>
          <span className="text-[11px] tabular-nums" style={{ color: 'var(--text-3)' }}>
            {visible.length} di {notDeleted.length}
          </span>
        </div>
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
      </div>

      {/* Lista */}
      {visible.length === 0 ? (
        <div className="px-5 py-12 text-center text-sm" style={{ color: 'var(--text-3)' }}>
          {notDeleted.length === 0 ? 'Nessuna spesa questo mese.' : 'Nessuna spesa per questa categoria.'}
        </div>
      ) : (
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

              {group.items.map(expense => {
                const row = rows[expense.id] ?? {
                  category: expense.category, confidence: null,
                  description: expense.description, saved: false,
                  deleted: false, shared: expense.is_shared ?? false, sharingLoading: false,
                };
                const isSaving = saving === expense.id;
                const isDeleting = deleting === expense.id;
                const isConfirming = confirmDelete === expense.id;
                const isEditingCat = editingCategory === expense.id;
                const isEditingDesc = editingDescription === expense.id;
                const isLowConf = row.confidence === 'low';
                const catBg = categoryDarkBg(row.category);
                const catText = categoryDarkText(row.category);
                const label = categoryLabel(row.category);
                const icon = categoryIcon(row.category);
                const currentDesc = row.description;

                return (
                  <div
                    key={expense.id}
                    className="flex items-center gap-3 px-4 py-3 group transition-colors"
                    style={{ borderBottom: '1px solid var(--border)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    {/* Icona categoria */}
                    <div
                      className="flex items-center justify-center w-8 h-8 rounded-xl shrink-0 text-base"
                      style={{ background: catBg }}
                    >
                      {icon}
                    </div>

                    {/* Testo */}
                    <div className="flex-1 min-w-0">
                      {/* Descrizione — editabile inline */}
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
                          style={{
                            color: 'var(--text-1)',
                            borderBottom: '1px solid var(--brand)',
                            paddingBottom: '1px',
                          }}
                        />
                      ) : (
                        <div className="flex items-center gap-1.5 group/desc">
                          <p
                            className="text-sm truncate"
                            style={{ color: 'var(--text-1)' }}
                            title={currentDesc ?? label}
                          >
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

                      {/* Badge categoria */}
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
                            {isLowConf && (
                              <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: 'var(--warning)' }} />
                            )}
                            {label}
                          </span>
                        </button>
                      )}
                    </div>

                    {/* Importo */}
                    <span className="text-sm font-semibold tabular-nums shrink-0" style={{ color: 'var(--expense)' }}>
                      {fmt(Number(expense.amount))}
                    </span>

                    {/* Note */}
                    <button
                      onClick={() => openNote(expense)}
                      title={row.notes ? 'Modifica nota' : 'Aggiungi nota'}
                      className="w-6 h-6 flex items-center justify-center rounded-md transition-all shrink-0"
                      style={{
                        color: row.notes ? 'var(--brand-light)' : 'var(--text-3)',
                        background: row.notes ? 'rgba(16,185,129,0.1)' : 'transparent',
                        opacity: row.notes ? 1 : undefined,
                      }}
                    >
                      <StickyNote size={12} />
                    </button>

                    {/* Condividi */}
                    {hasHousehold && (
                      <button
                        onClick={() => handleToggleShare(expense)}
                        disabled={row.sharingLoading}
                        title={row.shared ? 'Condivisa col partner — clicca per rendere privata' : 'Condividi col partner'}
                        className="w-6 h-6 flex items-center justify-center rounded-md transition-all shrink-0"
                        style={{
                          fontSize: '0.7rem',
                          opacity: row.sharingLoading ? 0.5 : 1,
                          background: row.shared ? 'rgba(16,185,129,0.12)' : 'transparent',
                          border: row.shared ? '1px solid rgba(16,185,129,0.3)' : '1px solid transparent',
                          color: row.shared ? 'var(--income)' : 'var(--text-3)',
                        }}
                      >
                        {row.sharingLoading ? <Loader2 size={11} className="animate-spin" /> : '⇌'}
                      </button>
                    )}

                    {/* Delete */}
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
                          title="Elimina spesa"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}

          {/* Totale */}
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ borderTop: '1px solid var(--border-strong)', background: 'var(--surface-2)' }}
          >
            <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>
              Totale {monthLabel}
            </span>
            <span className="text-base font-bold tabular-nums" style={{ color: 'var(--text-1)' }}>
              {fmt(total)}
            </span>
          </div>
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
                    {row?.description ?? categoryLabel(row?.category ?? exp.category)}
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
