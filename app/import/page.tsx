'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import Link from 'next/link';
import DriveStatus from '@/components/DriveStatus';
import Papa from 'papaparse';
import { Upload, ArrowLeft, ChevronDown, ChevronRight, Check, Loader2, Sparkles, Braces } from 'lucide-react';
import {
  decodeBuffer,
  headersFingerprint,
  autoDetectMapping,
  detectSignConvention,
  parseRows,
  type ColumnMap,
  type ParsedRow,
} from '@/lib/csv-parser';
import { parseXlsxBuffer } from '@/lib/xlsx-parser';
import { parseNucleoJson } from '@/lib/json-parser';

type Step = 'upload' | 'mapping' | 'preview' | 'importing' | 'done';
type ColRole = '' | 'date' | 'amount' | 'debit' | 'credit' | 'description' | 'type';

interface ParsedFile {
  headers: string[];
  records: Record<string, string>[];
  fingerprint: string;
  encoding: string;
  fileName: string;
}

interface ImportResult {
  imported: number;
  duplicates: number;
  total: number;
  discarded: number;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);

const ROLE_LABELS: Record<ColRole, string> = {
  '': '— ignora —',
  date: '📅 Data',
  amount: '💶 Importo',
  debit: '↓ Dare (uscite)',
  credit: '↑ Avere (entrate)',
  description: '📝 Descrizione',
  type: '🏷 Tipo movimento',
};

const ROLE_BG: Record<ColRole, string> = {
  '': 'transparent',
  date: 'rgba(56,189,248,0.08)',
  amount: 'rgba(52,211,153,0.08)',
  debit: 'rgba(251,113,133,0.10)',
  credit: 'rgba(52,211,153,0.10)',
  description: 'rgba(167,139,250,0.08)',
  type: 'rgba(251,191,36,0.08)',
};

const ROLE_BORDER: Record<ColRole, string> = {
  '': 'transparent',
  date: 'rgba(56,189,248,0.35)',
  amount: 'rgba(52,211,153,0.35)',
  debit: 'rgba(251,113,133,0.35)',
  credit: 'rgba(52,211,153,0.35)',
  description: 'rgba(167,139,250,0.35)',
  type: 'rgba(251,191,36,0.35)',
};

type ImportMode = 'csv' | 'json';

interface JsonImportRow {
  date: string;
  amount: number;
  description?: string;
  isIncome?: boolean;
}

function parseJsonImport(text: string): {
  valid: Extract<ParsedRow, { ok: true }>[];
  errors: string[];
} {
  const { valid: rows, errors } = parseNucleoJson(text);
  const valid = rows.map((r, i) => ({ ok: true as const, rawIndex: i, ...r }));
  return { valid, errors };
}

export default function ImportPage() {
  const [importMode, setImportMode] = useState<ImportMode>('csv');
  const [jsonText, setJsonText] = useState('');
  const [jsonErrors, setJsonErrors] = useState<string[]>([]);
  const [step, setStep] = useState<Step>('upload');
  const [parsedFile, setParsedFile] = useState<ParsedFile | null>(null);
  const [columnMap, setColumnMap] = useState<Partial<ColumnMap>>({});
  const [sourceName, setSourceName] = useState('');
  const [validRows, setValidRows] = useState<Extract<ParsedRow, { ok: true }>[]>([]);
  const [invalidRows, setInvalidRows] = useState<Extract<ParsedRow, { ok: false }>[]>([]);
  const [liveValid, setLiveValid] = useState<Extract<ParsedRow, { ok: true }>[]>([]);
  const [liveFilteredCount, setLiveFilteredCount] = useState(0);
  const [showDiscarded, setShowDiscarded] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiReasoning, setAiReasoning] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const jsonFileRef = useRef<HTMLInputElement>(null);

  // ── Anteprima live nel mapping step ─────────────────────────────────────────

  useEffect(() => {
    if (step !== 'mapping' || !parsedFile || !columnMap.date) {
      setLiveValid([]);
      setLiveFilteredCount(0);
      return;
    }
    const hasAmount = columnMap.amountType === 'split'
      ? !!(columnMap.debit || columnMap.credit)
      : !!columnMap.amount;
    if (!hasAmount) { setLiveValid([]); setLiveFilteredCount(0); return; }

    const rows = parseRows(parsedFile.records, columnMap as ColumnMap);
    const valid = rows.filter((r): r is Extract<ParsedRow, { ok: true }> => r.ok);
    const filtered = rows.filter(r => !r.ok && (r as {reason:string}).reason.startsWith('Accredito'));
    setLiveValid(valid.slice(0, 5));
    setLiveFilteredCount(filtered.length);
  }, [columnMap, parsedFile, step]);

  // ── Role helpers ─────────────────────────────────────────────────────────────

  function getColumnRole(col: string): ColRole {
    if (col === columnMap.date) return 'date';
    if (col === columnMap.amount) return 'amount';
    if (col === columnMap.debit) return 'debit';
    if (col === columnMap.credit) return 'credit';
    if (col === columnMap.description) return 'description';
    if (col === columnMap.typeColumn) return 'type';
    return '';
  }

  function assignColumnRole(col: string, role: ColRole) {
    setColumnMap(prev => {
      const next = { ...prev };
      // Rimuovi questo colonna da qualsiasi ruolo precedente
      if (next.date === col) delete (next as Record<string, unknown>).date;
      if (next.amount === col) delete next.amount;
      if (next.debit === col) delete next.debit;
      if (next.credit === col) delete next.credit;
      if (next.description === col) delete next.description;
      if (next.typeColumn === col) delete next.typeColumn;
      // Rimuovi anche da altri eventuali conflitti di ruolo esclusivo
      if (role === 'date') { next.date = col; }
      else if (role === 'amount') {
        next.amount = col;
        next.amountType = 'single';
        delete next.debit;
        delete next.credit;
        // Auto-rileva convenzione del segno dai dati reali
        if (parsedFile) {
          next.signFilter = detectSignConvention(parsedFile.records, col);
        }
      }
      else if (role === 'debit') { next.debit = col; next.amountType = 'split'; delete next.amount; delete next.signFilter; }
      else if (role === 'credit') { next.credit = col; next.amountType = 'split'; delete next.amount; delete next.signFilter; }
      else if (role === 'description') { next.description = col; }
      else if (role === 'type') { next.typeColumn = col; }
      return next;
    });
  }

  // ── Rileva mapping con AI ────────────────────────────────────────────────────

  async function detectWithAI() {
    if (!parsedFile) return;
    setAiLoading(true);
    setAiReasoning(null);
    try {
      const res = await fetch('/api/csv/detect-mapping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          headers: parsedFile.headers,
          rows: parsedFile.records.slice(0, 8),
          fileName: parsedFile.fileName,
        }),
      });
      const json = await res.json() as {
        mapping?: Partial<ColumnMap>;
        reasoning?: string;
        error?: string;
      };
      if (json.mapping) {
        setColumnMap(json.mapping);
        if (json.mapping.sourceName) setSourceName(json.mapping.sourceName);
        setAiReasoning(json.reasoning ?? null);
      }
    } catch { /* ignora */ } finally {
      setAiLoading(false);
    }
  }

  // ── Processa il file ────────────────────────────────────────────────────────

  const processFile = useCallback(async (file: File) => {
    setError(null);
    const name = file.name.toLowerCase();
    const isXlsx = name.endsWith('.xlsx') || name.endsWith('.xls');
    if (!isXlsx && !name.endsWith('.csv')) {
      setError('Il file deve essere un CSV o un file Excel (.xlsx).');
      return;
    }

    let headers: string[];
    let records: Record<string, string>[];
    let encoding: string;

    try {
      const buffer = await file.arrayBuffer();
      if (isXlsx) {
        ({ headers, records } = await parseXlsxBuffer(buffer));
        encoding = 'Excel';
      } else {
        const decoded = decodeBuffer(buffer);
        encoding = decoded.encoding;
        const parsed = Papa.parse<Record<string, string>>(decoded.text, {
          header: true,
          skipEmptyLines: 'greedy',
        });
        if ((parsed.errors.length > 0 && parsed.data.length === 0) || parsed.data.length === 0) {
          setError('Il file non è un CSV valido o è vuoto.');
          return;
        }
        headers = parsed.meta.fields ?? [];
        records = parsed.data;
      }
    } catch {
      setError('Impossibile leggere il file.');
      return;
    }

    if (records.length === 0) { setError('Il file non contiene righe di dati.'); return; }
    if (headers.length === 0) { setError('Impossibile rilevare le intestazioni del file.'); return; }

    const fp = headersFingerprint(headers);
    const pf: ParsedFile = { headers, records, fingerprint: fp, encoding, fileName: file.name };
    setParsedFile(pf);

    // Cerca mappatura salvata
    try {
      const res = await fetch(`/api/csv/mappings?fingerprint=${encodeURIComponent(fp)}`);
      const json = await res.json() as { mapping: ColumnMap | null };
      if (json.mapping) {
        const map = { ...json.mapping };
        // Se colonna singola (o amountType non definito = vecchia mappatura) senza signFilter, rileva dai dati
        const isSingleOrLegacy = !map.amountType || map.amountType === 'single';
        if (isSingleOrLegacy && !map.signFilter && map.amount) {
          map.signFilter = detectSignConvention(records, map.amount);
        }
        // Normalizza amountType se mancante
        if (!map.amountType) {
          map.amountType = map.debit || map.credit ? 'split' : 'single';
        }
        setColumnMap(map);
        setSourceName(map.sourceName);
        applyMapping(pf, map);
        setStep('preview');
        return;
      }
    } catch { /* ignora */ }

    const auto = autoDetectMapping(headers, records);
    setColumnMap(auto);
    setSourceName('');
    setStep('mapping');
  }, []);

  function applyMapping(pf: ParsedFile, map: ColumnMap) {
    const rows = parseRows(pf.records, map);
    setValidRows(rows.filter((r): r is Extract<ParsedRow, { ok: true }> => r.ok));
    setInvalidRows(rows.filter((r): r is Extract<ParsedRow, { ok: false }> => !r.ok));
  }

  // ── Drag & drop ─────────────────────────────────────────────────────────────

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) await processFile(file);
  }, [processFile]);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await processFile(file);
  }, [processFile]);

  // ── Salva mapping e vai a preview ────────────────────────────────────────────

  async function handleSaveMapping() {
    if (!parsedFile) return;
    const map = { ...columnMap } as ColumnMap;
    map.sourceName = sourceName || 'Sconosciuta';

    try {
      await fetch('/api/csv/mappings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fingerprint: parsedFile.fingerprint, sourceName: map.sourceName, columnMap: map }),
      });
    } catch { /* ignora */ }

    applyMapping(parsedFile, map);
    setStep('preview');
  }

  // ── Import ──────────────────────────────────────────────────────────────────

  async function handleImport() {
    setStep('importing');
    setError(null);
    try {
      const res = await fetch('/api/csv/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: validRows.map(r => ({ date: r.date, amount: r.amount, description: r.description, isIncome: r.isIncome })) }),
      });
      const json = await res.json() as { imported: number; duplicates: number; total: number; error?: string };
      if (!res.ok) {
        setError(json.error ?? 'Errore durante l\'importazione.');
        setStep('preview');
        return;
      }
      setResult({ imported: json.imported, duplicates: json.duplicates, total: json.total, discarded: invalidRows.length });
      setStep('done');
    } catch {
      setError('Errore di rete durante l\'importazione.');
      setStep('preview');
    }
  }

  // ── JSON import ──────────────────────────────────────────────────────────────

  function handleJsonLoad() {
    setJsonErrors([]);
    const { valid, errors } = parseJsonImport(jsonText);
    if (errors.length > 0 && valid.length === 0) {
      setJsonErrors(errors);
      return;
    }
    if (valid.length === 0) {
      setJsonErrors(['Nessuna riga valida trovata nel JSON.']);
      return;
    }
    setValidRows(valid);
    setInvalidRows([]);
    setJsonErrors(errors); // mostra eventuali errori parziali
    setStep('preview');
  }

  async function handleJsonFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      setJsonText(text);
      setJsonErrors([]);
    } catch {
      setJsonErrors(['Impossibile leggere il file.']);
    }
    if (jsonFileRef.current) jsonFileRef.current.value = '';
  }

  function reset() {
    setStep('upload');
    setParsedFile(null);
    setColumnMap({});
    setSourceName('');
    setValidRows([]);
    setInvalidRows([]);
    setLiveValid([]);
    setResult(null);
    setError(null);
    setShowDiscarded(false);
    setAiReasoning(null);
    setJsonText('');
    setJsonErrors([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (jsonFileRef.current) jsonFileRef.current.value = '';
  }

  const isReadyToSave = !!(
    columnMap.date &&
    (columnMap.amount || columnMap.debit || columnMap.credit) &&
    sourceName.trim()
  );

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen" style={{ background: 'var(--dark-900)' }}>
      <header
        className="flex items-center gap-3 px-6 py-4 sticky top-0 z-10"
        style={{ background: 'var(--dark-800)', borderBottom: '1px solid var(--dark-600)' }}
      >
        <Link href="/dashboard" className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors">
          <ArrowLeft size={14} /> Dashboard
        </Link>
        <span className="text-slate-700">/</span>
        <span className="text-sm font-semibold text-slate-300">Importa CSV</span>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <DriveStatus />

        <p className="text-[10px] text-slate-700 mt-6 mb-6">
          Nessun dato finanziario viene registrato nei log di sistema.
        </p>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl text-sm text-red-400" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)' }}>
            {error}
          </div>
        )}

        {/* ── Upload ─────────────────────────────────────────────────────────── */}
        {step === 'upload' && (
          <div className="card p-8 anim-scale max-w-2xl mx-auto">
            <h1 className="text-base font-semibold text-slate-200 mb-2">Importa estratto conto</h1>

            {/* Tab selector */}
            <div className="flex mb-6 rounded-xl overflow-hidden" style={{ border: '1px solid var(--dark-600)' }}>
              <button
                onClick={() => setImportMode('csv')}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors"
                style={{
                  background: importMode === 'csv' ? 'var(--dark-700)' : 'transparent',
                  color: importMode === 'csv' ? 'var(--text-1)' : 'var(--text-3)',
                  borderRight: '1px solid var(--dark-600)',
                }}
              >
                <Upload size={14} /> CSV / Excel
              </button>
              <button
                onClick={() => setImportMode('json')}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors"
                style={{
                  background: importMode === 'json' ? 'var(--dark-700)' : 'transparent',
                  color: importMode === 'json' ? 'var(--text-1)' : 'var(--text-3)',
                }}
              >
                <Braces size={14} /> JSON
              </button>
            </div>

            {/* CSV tab */}
            {importMode === 'csv' && (
              <>
                <p className="text-xs text-slate-500 mb-4">
                  Carica un file CSV o Excel esportato dalla tua banca.
                </p>
                <div
                  onDragOver={e => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center gap-3 rounded-xl cursor-pointer transition-all duration-200 py-12"
                  style={{
                    border: `2px dashed ${dragging ? 'var(--brand-500)' : 'var(--dark-600)'}`,
                    background: dragging ? 'rgba(16,185,129,0.05)' : 'var(--dark-700)',
                  }}
                >
                  <Upload size={24} className="text-slate-600" />
                  <div className="text-center">
                    <p className="text-sm text-slate-400">Trascina un file CSV o Excel qui</p>
                    <p className="text-xs text-slate-600 mt-1">oppure clicca per selezionare · .csv, .xlsx</p>
                  </div>
                </div>
                <input ref={fileInputRef} type="file" accept=".csv,text/csv,.xlsx,.xls" className="hidden" onChange={handleFileChange} />
              </>
            )}

            {/* JSON tab */}
            {importMode === 'json' && (
              <>
                <p className="text-xs text-slate-500 mb-4">
                  Incolla o carica un file JSON con le tue transazioni.
                </p>
                <pre
                  className="text-[11px] rounded-xl px-4 py-3 mb-4 overflow-x-auto"
                  style={{ background: 'var(--dark-700)', border: '1px solid var(--dark-600)', color: '#a78bfa' }}
                >{`[
  { "data": "2026-04-02", "descrizione": "Supermercato", "importo": -10, "tipo": "Addebito" },
  { "data": "2026-04-03", "descrizione": "Bonifico",     "importo": 1308, "tipo": "Accredito" }
]`}</pre>
                <p className="text-[10px] text-slate-600 mb-4">
                  Campi extra (es. <code>mese</code>, <code>gmailId</code>) vengono ignorati automaticamente.
                </p>

                <div className="flex items-center gap-3 mb-3">
                  <button
                    onClick={() => jsonFileRef.current?.click()}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-400 transition-colors hover:text-slate-200"
                    style={{ border: '1px solid var(--dark-600)' }}
                  >
                    <Upload size={12} /> Carica file .json
                  </button>
                  <input ref={jsonFileRef} type="file" accept=".json,application/json" className="hidden" onChange={handleJsonFileChange} />
                  <span className="text-xs text-slate-600">oppure incolla qui sotto</span>
                </div>

                <textarea
                  value={jsonText}
                  onChange={e => { setJsonText(e.target.value); setJsonErrors([]); }}
                  placeholder={'[\n  { "date": "2024-01-15", "amount": 45.80, "description": "...", "isIncome": false }\n]'}
                  rows={8}
                  className="input w-full px-3 py-2.5 text-xs font-mono resize-y"
                  style={{ minHeight: 140 }}
                />

                {jsonErrors.length > 0 && (
                  <div className="mt-3 px-4 py-3 rounded-xl text-xs text-red-400 flex flex-col gap-1" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)' }}>
                    {jsonErrors.slice(0, 5).map((e, i) => <span key={i}>{e}</span>)}
                    {jsonErrors.length > 5 && <span className="text-slate-500">…e altri {jsonErrors.length - 5} errori</span>}
                  </div>
                )}

                <button
                  onClick={handleJsonLoad}
                  disabled={!jsonText.trim()}
                  className="btn-primary w-full mt-4 py-2.5 text-sm"
                >
                  Valida e visualizza anteprima
                </button>
              </>
            )}
          </div>
        )}

        {/* ── Mapping: tabella interattiva ───────────────────────────────────── */}
        {step === 'mapping' && parsedFile && (
          <div className="flex flex-col gap-5 anim-scale">

            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-base font-semibold text-slate-200">
                  Aggancia le colonne ai campi
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Usa il menu sotto ogni intestazione per dire a Nucleo cosa contiene quella colonna.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] text-slate-600">
                  {parsedFile.fileName}
                  {parsedFile.encoding !== 'UTF-8' && parsedFile.encoding !== 'Excel' && (
                    <span className="ml-2 text-amber-400">{parsedFile.encoding}</span>
                  )}
                </span>
                <button
                  onClick={detectWithAI}
                  disabled={aiLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                  style={{
                    background: 'rgba(167,139,250,0.12)',
                    border: '1px solid rgba(167,139,250,0.3)',
                    color: '#a78bfa',
                    opacity: aiLoading ? 0.7 : 1,
                  }}
                  title="Usa l'AI per rilevare automaticamente le colonne"
                >
                  {aiLoading
                    ? <><Loader2 size={12} className="animate-spin" /> Analisi…</>
                    : <><Sparkles size={12} /> Rileva con AI</>
                  }
                </button>
              </div>
            </div>

            {/* Spiegazione AI */}
            {aiReasoning && (
              <div
                className="flex items-start gap-2 px-4 py-3 rounded-xl text-xs"
                style={{ background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.2)', color: '#c4b5fd' }}
              >
                <Sparkles size={13} className="shrink-0 mt-0.5" />
                <span>{aiReasoning}</span>
              </div>
            )}

            {/* Tabella interattiva */}
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr>
                      {parsedFile.headers.map(col => {
                        const role = getColumnRole(col);
                        return (
                          <th
                            key={col}
                            className="p-0 align-top"
                            style={{
                              minWidth: 130,
                              background: role ? ROLE_BG[role] : 'var(--surface-2)',
                              borderRight: '1px solid var(--border)',
                              borderBottom: '1px solid var(--border)',
                            }}
                          >
                            {/* Nome colonna */}
                            <div
                              className="px-3 pt-2.5 pb-1.5 text-[11px] font-semibold truncate"
                              style={{
                                color: role ? ROLE_BORDER[role].replace('0.35', '1') : 'var(--text-2)',
                                borderBottom: `2px solid ${role ? ROLE_BORDER[role] : 'transparent'}`,
                              }}
                              title={col}
                            >
                              {col}
                            </div>
                            {/* Dropdown ruolo */}
                            <div className="px-2 pb-2">
                              <select
                                value={role}
                                onChange={e => assignColumnRole(col, e.target.value as ColRole)}
                                className="w-full rounded-lg px-2 py-1 text-[11px] outline-none"
                                style={{
                                  background: role ? ROLE_BG[role] : 'var(--dark-700)',
                                  border: `1px solid ${role ? ROLE_BORDER[role] : 'var(--border)'}`,
                                  color: role ? ROLE_BORDER[role].replace('0.35', '1') : 'var(--text-3)',
                                  appearance: 'none',
                                  colorScheme: 'dark',
                                }}
                              >
                                {(Object.keys(ROLE_LABELS) as ColRole[]).map(r => (
                                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                                ))}
                              </select>
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {parsedFile.records.slice(0, 7).map((row, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                        {parsedFile.headers.map(col => {
                          const role = getColumnRole(col);
                          return (
                            <td
                              key={col}
                              className="px-3 py-2 tabular-nums truncate max-w-[160px]"
                              style={{
                                background: role ? ROLE_BG[role] : 'transparent',
                                borderRight: '1px solid var(--border)',
                                color: role ? 'var(--text-1)' : 'var(--text-3)',
                              }}
                              title={row[col]}
                            >
                              {row[col] || <span style={{ color: 'var(--text-3)', opacity: 0.4 }}>—</span>}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Legenda ruoli */}
            <div className="flex flex-wrap gap-2">
              {(Object.entries(ROLE_LABELS) as [ColRole, string][])
                .filter(([r]) => r !== '')
                .map(([r, label]) => (
                  <span
                    key={r}
                    className="px-2 py-0.5 rounded-full text-[10px]"
                    style={{ background: ROLE_BG[r], border: `1px solid ${ROLE_BORDER[r]}`, color: ROLE_BORDER[r].replace('0.35', '1') }}
                  >
                    {label}
                  </span>
                ))}
            </div>

            {/* Opzioni + anteprima live */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              {/* Opzioni */}
              <div className="card p-4 flex flex-col gap-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>
                  Opzioni
                </p>

                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5 block">
                    Nome banca / fonte *
                  </label>
                  <input
                    type="text"
                    value={sourceName}
                    onChange={e => setSourceName(e.target.value)}
                    placeholder="es. Fineco, ING, Intesa…"
                    className="input w-full px-3 py-2 text-sm"
                  />
                </div>

                {/* Opzione segno per colonna singola */}
                {columnMap.amountType === 'single' && (
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5 block">
                      Segno importo
                    </label>
                    <select
                      value={columnMap.signFilter ?? 'all'}
                      onChange={e => setColumnMap(m => ({ ...m, signFilter: e.target.value as 'negative' | 'positive' | 'all' }))}
                      className="input w-full px-3 py-2 text-sm"
                      style={{ appearance: 'none', colorScheme: 'dark' }}
                    >
                      <option value="all">Tutti i movimenti</option>
                      <option value="negative">Solo negativi = uscite (es. −50,00)</option>
                      <option value="positive">Solo positivi = uscite (es. +50,00)</option>
                    </select>
                  </div>
                )}

                {/* Opzione filtro per split */}
                {columnMap.amountType === 'split' && (
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5 block">
                      Importa
                    </label>
                    <select
                      value={columnMap.typeFilter ?? 'debit'}
                      onChange={e => setColumnMap(m => ({ ...m, typeFilter: e.target.value as 'debit' | 'credit' | 'all' }))}
                      className="input w-full px-3 py-2 text-sm"
                      style={{ appearance: 'none', colorScheme: 'dark' }}
                    >
                      <option value="debit">Solo addebiti / uscite</option>
                      <option value="credit">Solo accrediti / entrate</option>
                      <option value="all">Tutti i movimenti</option>
                    </select>
                  </div>
                )}

                {/* Opzione tipo testo */}
                {columnMap.typeColumn && (
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5 block">
                      Filtra tipo testo
                    </label>
                    <select
                      value={columnMap.typeFilter ?? 'debit'}
                      onChange={e => setColumnMap(m => ({ ...m, typeFilter: e.target.value as 'debit' | 'credit' | 'all' }))}
                      className="input w-full px-3 py-2 text-sm"
                      style={{ appearance: 'none', colorScheme: 'dark' }}
                    >
                      <option value="debit">Solo addebiti (uscite)</option>
                      <option value="credit">Solo accrediti (entrate)</option>
                      <option value="all">Tutti</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Anteprima live */}
              <div className="card p-4">
                <p className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--text-3)' }}>
                  Anteprima risultato
                </p>
                {liveValid.length === 0 ? (
                  <p className="text-xs text-slate-600 italic">
                    {!columnMap.date
                      ? 'Assegna almeno la colonna Data per vedere l\'anteprima.'
                      : 'Assegna anche una colonna Importo (o Dare/Avere).'}
                  </p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {liveValid.map((r, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs"
                        style={{ background: 'var(--surface-2)' }}
                      >
                        <span style={{ color: 'var(--text-3)' }} className="tabular-nums shrink-0">{r.date}</span>
                        <span style={{ color: 'var(--text-1)' }} className="flex-1 truncate">{r.description ?? '—'}</span>
                        <span className="tabular-nums font-semibold shrink-0" style={{ color: 'var(--expense)' }}>
                          {fmt(r.amount)}
                        </span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-[10px]" style={{ color: 'var(--text-3)' }}>
                        Prime 5 righe valide
                      </p>
                      {liveFilteredCount > 0 && (
                        <p className="text-[10px]" style={{ color: 'var(--income)' }}>
                          ✓ {liveFilteredCount} accrediti esclusi
                        </p>
                      )}
                      {liveFilteredCount === 0 && columnMap.signFilter && columnMap.signFilter !== 'all' && (
                        <p className="text-[10px] text-amber-400">
                          ⚠ 0 accrediti esclusi — verifica il segno
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Azioni */}
            <div className="flex gap-3">
              <button onClick={() => setStep('upload')} className="px-4 py-2.5 text-sm text-slate-400 rounded-lg transition-colors hover:text-slate-200" style={{ border: '1px solid var(--dark-600)' }}>
                Indietro
              </button>
              <button
                onClick={handleSaveMapping}
                disabled={!isReadyToSave}
                className="btn-primary flex-1 py-2.5 text-sm"
              >
                {isReadyToSave ? 'Salva mappatura e continua' : 'Assegna Data, Importo e Nome banca'}
              </button>
            </div>
          </div>
        )}

        {/* ── Preview ────────────────────────────────────────────────────────── */}
        {step === 'preview' && (
          <div className="flex flex-col gap-4 anim-scale max-w-2xl mx-auto">
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-slate-200">Anteprima importazione</h2>
                <span className="text-xs text-slate-500">
                  {parsedFile ? parsedFile.records.length : validRows.length} righe ·{' '}
                  <span className="text-emerald-400">{validRows.length} valide</span>
                  {invalidRows.length > 0 && <> · <span className="text-amber-400">{invalidRows.length} scartate</span></>}
                </span>
              </div>
              {validRows.length > 0 ? (
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--dark-600)' }}>
                      {['Data', 'Importo', 'Descrizione', 'Tipo'].map(h => (
                        <th key={h} className="text-left py-2 text-[10px] uppercase tracking-widest text-slate-600 font-semibold pb-2">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {validRows.slice(0, 5).map(r => (
                      <tr key={r.rawIndex} style={{ borderBottom: '1px solid var(--dark-700)' }}>
                        <td className="py-2 text-slate-400 tabular-nums">{r.date}</td>
                        <td className="py-2 tabular-nums font-medium" style={{ color: r.isIncome ? 'var(--income)' : 'var(--text-1)' }}>
                          {r.isIncome ? '+' : ''}{fmt(r.amount)}
                        </td>
                        <td className="py-2 text-slate-500 truncate max-w-[200px]">{r.description ?? '—'}</td>
                        <td className="py-2">
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={r.isIncome ? { background: 'rgba(16,185,129,0.12)', color: '#34d399' } : { background: 'rgba(100,116,139,0.12)', color: '#64748b' }}>
                            {r.isIncome ? 'Entrata' : 'Uscita'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-sm text-amber-400">Nessuna riga valida. Torna indietro e controlla la mappatura.</p>
              )}
            </div>

            {invalidRows.length > 0 && (
              <div className="card overflow-hidden">
                <button
                  onClick={() => setShowDiscarded(v => !v)}
                  className="w-full flex items-center justify-between px-5 py-3.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
                >
                  <span>{invalidRows.length} righe scartate</span>
                  {showDiscarded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
                {showDiscarded && (
                  <div style={{ borderTop: '1px solid var(--dark-600)' }}>
                    {invalidRows.slice(0, 5).map(r => (
                      <div key={r.rawIndex} className="px-5 py-2.5 text-xs" style={{ borderBottom: '1px solid var(--dark-700)' }}>
                        <span className="text-slate-600 mr-2">Riga {r.rawIndex}</span>
                        <span className="text-amber-400">{r.reason}</span>
                      </div>
                    ))}
                    {invalidRows.length > 5 && (
                      <div className="px-5 py-2 text-xs text-slate-600">…e altre {invalidRows.length - 5} righe</div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => importMode === 'json' ? setStep('upload') : setStep('mapping')}
                className="px-4 py-2.5 text-sm text-slate-400 rounded-lg transition-colors hover:text-slate-200"
                style={{ border: '1px solid var(--dark-600)' }}
              >
                {importMode === 'json' ? 'Modifica JSON' : 'Modifica mappatura'}
              </button>
              <button onClick={handleImport} disabled={validRows.length === 0} className="btn-primary flex-1 py-2.5 text-sm">
                {(() => {
                  const incomeCount = validRows.filter(r => r.isIncome).length;
                  const expenseCount = validRows.length - incomeCount;
                  if (incomeCount > 0 && expenseCount > 0)
                    return `Importa ${expenseCount} uscite + ${incomeCount} entrate`;
                  if (incomeCount > 0)
                    return `Importa ${incomeCount} entrate`;
                  return `Importa ${expenseCount} uscite`;
                })()}
              </button>
            </div>
          </div>
        )}

        {/* ── Importing ──────────────────────────────────────────────────────── */}
        {step === 'importing' && (
          <div className="card p-12 flex flex-col items-center gap-4 anim-fade max-w-2xl mx-auto">
            <Loader2 size={32} className="animate-spin" style={{ color: 'var(--brand)' }} />
            <p className="text-sm text-slate-400">Importazione in corso…</p>
          </div>
        )}

        {/* ── Done ───────────────────────────────────────────────────────────── */}
        {step === 'done' && result && (
          <div className="card p-8 anim-scale max-w-2xl mx-auto">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'rgba(52,211,153,0.15)' }}>
                <Check size={16} className="text-emerald-400" />
              </div>
              <h2 className="text-base font-semibold text-slate-200">Importazione completata</h2>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-8">
              {[
                { label: 'Importate', value: result.imported, color: 'text-emerald-400' },
                { label: 'Duplicate (ignorate)', value: result.duplicates, color: 'text-slate-400' },
                { label: 'Scartate', value: result.discarded, color: 'text-amber-400' },
              ].map(({ label, value, color }) => (
                <div key={label} className="rounded-xl p-4 text-center" style={{ background: 'var(--dark-700)', border: '1px solid var(--dark-600)' }}>
                  <p className={`text-2xl font-bold tabular-nums ${color}`}>{value}</p>
                  <p className="text-[10px] text-slate-600 mt-1 uppercase tracking-wider">{label}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={reset} className="flex-1 px-4 py-2.5 text-sm text-slate-400 rounded-lg transition-colors hover:text-slate-200" style={{ border: '1px solid var(--dark-600)' }}>
                Importa un altro file
              </button>
              <Link href="/dashboard" className="btn-primary flex-1 py-2.5 text-sm text-center">
                Vai alla dashboard
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
