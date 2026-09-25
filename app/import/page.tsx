'use client';

import { useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import Papa from 'papaparse';
import { Upload, ArrowLeft, ChevronDown, ChevronRight, Check, Loader2 } from 'lucide-react';
import {
  decodeBuffer,
  headersFingerprint,
  autoDetectMapping,
  parseRows,
  type ColumnMap,
  type ParsedRow,
} from '@/lib/csv-parser';

type Step = 'upload' | 'mapping' | 'preview' | 'importing' | 'done';

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

export default function ImportPage() {
  const [step, setStep] = useState<Step>('upload');
  const [parsedFile, setParsedFile] = useState<ParsedFile | null>(null);
  const [columnMap, setColumnMap] = useState<Partial<ColumnMap>>({});
  const [sourceName, setSourceName] = useState('');
  const [validRows, setValidRows] = useState<Extract<ParsedRow, { ok: true }>[]>([]);
  const [invalidRows, setInvalidRows] = useState<Extract<ParsedRow, { ok: false }>[]>([]);
  const [showDiscarded, setShowDiscarded] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Processa il file ────────────────────────────────────────────────────────

  const processFile = useCallback(async (file: File) => {
    setError(null);
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('Il file deve essere un CSV.');
      return;
    }

    let text: string;
    let encoding: string;
    try {
      const buffer = await file.arrayBuffer();
      ({ text, encoding } = decodeBuffer(buffer));
    } catch {
      setError('Impossibile leggere il file.');
      return;
    }

    const parsed = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: 'greedy',
    });

    if (parsed.errors.length > 0 && parsed.data.length === 0) {
      setError('Il file non è un CSV valido o è vuoto.');
      return;
    }

    if (parsed.data.length === 0) {
      setError('Il CSV non contiene righe di dati.');
      return;
    }

    const headers = parsed.meta.fields ?? [];
    if (headers.length === 0) {
      setError('Impossibile rilevare le intestazioni del CSV.');
      return;
    }

    const fp = headersFingerprint(headers);
    const auto = autoDetectMapping(headers);

    const pf: ParsedFile = {
      headers,
      records: parsed.data,
      fingerprint: fp,
      encoding,
      fileName: file.name,
    };
    setParsedFile(pf);

    // Cerca mappatura salvata
    try {
      const res = await fetch(`/api/csv/mappings?fingerprint=${encodeURIComponent(fp)}`);
      const json = await res.json() as { mapping: ColumnMap | null };
      if (json.mapping) {
        const map = json.mapping;
        setColumnMap(map);
        setSourceName(map.sourceName);
        applyMapping(pf, map);
        setStep('preview');
        return;
      }
    } catch {
      // ignora errori di rete, procedi con mapping manuale
    }

    setColumnMap(auto);
    setSourceName('');
    setStep('mapping');
  }, []);

  function applyMapping(pf: ParsedFile, map: ColumnMap) {
    const rows = parseRows(pf.records, map);
    const valid = rows.filter((r): r is Extract<ParsedRow, { ok: true }> => r.ok);
    const invalid = rows.filter((r): r is Extract<ParsedRow, { ok: false }> => !r.ok);
    setValidRows(valid);
    setInvalidRows(invalid);
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

  // ── Salva mapping ───────────────────────────────────────────────────────────

  async function handleSaveMapping() {
    if (!parsedFile) return;
    const map = columnMap as ColumnMap;
    map.sourceName = sourceName || 'Sconosciuta';

    try {
      await fetch('/api/csv/mappings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fingerprint: parsedFile.fingerprint,
          sourceName: map.sourceName,
          columnMap: map,
        }),
      });
    } catch {
      // non bloccare l'utente se il salvataggio fallisce
    }

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
        body: JSON.stringify({ rows: validRows.map(r => ({ date: r.date, amount: r.amount, description: r.description })) }),
      });
      const json = await res.json() as { imported: number; duplicates: number; total: number; error?: string };
      if (!res.ok) {
        setError(json.error ?? 'Errore durante l\'importazione.');
        setStep('preview');
        return;
      }
      setResult({
        imported: json.imported,
        duplicates: json.duplicates,
        total: json.total,
        discarded: invalidRows.length,
      });
      setStep('done');
    } catch {
      setError('Errore di rete durante l\'importazione.');
      setStep('preview');
    }
  }

  function reset() {
    setStep('upload');
    setParsedFile(null);
    setColumnMap({});
    setSourceName('');
    setValidRows([]);
    setInvalidRows([]);
    setResult(null);
    setError(null);
    setShowDiscarded(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  const labelClass = 'text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5 block';
  const selectClass = 'input w-full px-3 py-2.5 text-sm';

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen" style={{ background: 'var(--dark-900)' }}>
      <header
        className="flex items-center gap-3 px-6 py-4 sticky top-0 z-10"
        style={{ background: 'var(--dark-800)', borderBottom: '1px solid var(--dark-600)' }}
      >
        <Link
          href="/dashboard"
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          <ArrowLeft size={14} /> Dashboard
        </Link>
        <span className="text-slate-700">/</span>
        <span className="text-sm font-semibold text-slate-300">Importa CSV</span>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8">
        {/* Nota privacy */}
        <p className="text-[10px] text-slate-700 mb-6">
          Nessun dato finanziario viene registrato nei log di sistema.
        </p>

        {error && (
          <div
            className="mb-4 px-4 py-3 rounded-xl text-sm text-red-400"
            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)' }}
          >
            {error}
          </div>
        )}

        {/* ── Step: upload ─────────────────────────────────────────────────── */}
        {step === 'upload' && (
          <div className="card p-8 anim-scale">
            <h1 className="text-base font-semibold text-slate-200 mb-2">Importa estratto conto</h1>
            <p className="text-xs text-slate-500 mb-6">
              Carica un file CSV esportato dalla tua banca. Le colonne vengono mappate automaticamente o guidate la prima volta.
            </p>

            <div
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center justify-center gap-3 rounded-xl cursor-pointer transition-all duration-200 py-12"
              style={{
                border: `2px dashed ${dragging ? 'var(--brand-500)' : 'var(--dark-600)'}`,
                background: dragging ? 'rgba(99,102,241,0.05)' : 'var(--dark-700)',
              }}
            >
              <Upload size={24} className="text-slate-600" />
              <div className="text-center">
                <p className="text-sm text-slate-400">Trascina un file CSV qui</p>
                <p className="text-xs text-slate-600 mt-1">oppure clicca per selezionare</p>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        )}

        {/* ── Step: mapping ────────────────────────────────────────────────── */}
        {step === 'mapping' && parsedFile && (
          <div className="card p-6 anim-scale">
            <h1 className="text-base font-semibold text-slate-200 mb-1">
              Prima volta con questo estratto conto — mappa le colonne
            </h1>
            <p className="text-xs text-slate-500 mb-6">
              File: <span className="text-slate-400">{parsedFile.fileName}</span>
              {parsedFile.encoding !== 'UTF-8' && (
                <span className="ml-2 text-amber-400">· {parsedFile.encoding} rilevato</span>
              )}
            </p>

            <div className="flex flex-col gap-4">
              <div>
                <label className={labelClass}>Nome fonte (es. Fineco, ING, Intesa)</label>
                <input
                  type="text"
                  value={sourceName}
                  onChange={e => setSourceName(e.target.value)}
                  placeholder="Nome della banca"
                  className="input w-full px-3 py-2.5 text-sm"
                />
              </div>

              <div>
                <label className={labelClass}>Colonna Data</label>
                <select
                  value={columnMap.date ?? ''}
                  onChange={e => setColumnMap(m => ({ ...m, date: e.target.value }))}
                  className={selectClass}
                  style={{ appearance: 'none', colorScheme: 'dark' }}
                >
                  <option value="">— seleziona —</option>
                  {parsedFile.headers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>

              <div>
                <label className={labelClass}>Tipo importo</label>
                <select
                  value={columnMap.amountType ?? 'single'}
                  onChange={e => setColumnMap(m => ({ ...m, amountType: e.target.value as 'single' | 'split' }))}
                  className={selectClass}
                  style={{ appearance: 'none', colorScheme: 'dark' }}
                >
                  <option value="single">Colonna singola</option>
                  <option value="split">Dare / Avere separati</option>
                </select>
              </div>

              {(!columnMap.amountType || columnMap.amountType === 'single') && (
                <div>
                  <label className={labelClass}>Colonna Importo</label>
                  <select
                    value={columnMap.amount ?? ''}
                    onChange={e => setColumnMap(m => ({ ...m, amount: e.target.value }))}
                    className={selectClass}
                    style={{ appearance: 'none', colorScheme: 'dark' }}
                  >
                    <option value="">— seleziona —</option>
                    {parsedFile.headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              )}

              {columnMap.amountType === 'split' && (
                <>
                  <div>
                    <label className={labelClass}>Colonna Dare (uscite)</label>
                    <select
                      value={columnMap.debit ?? ''}
                      onChange={e => setColumnMap(m => ({ ...m, debit: e.target.value }))}
                      className={selectClass}
                      style={{ appearance: 'none', colorScheme: 'dark' }}
                    >
                      <option value="">— opzionale —</option>
                      {parsedFile.headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Colonna Avere (entrate)</label>
                    <select
                      value={columnMap.credit ?? ''}
                      onChange={e => setColumnMap(m => ({ ...m, credit: e.target.value }))}
                      className={selectClass}
                      style={{ appearance: 'none', colorScheme: 'dark' }}
                    >
                      <option value="">— opzionale —</option>
                      {parsedFile.headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                </>
              )}

              <div>
                <label className={labelClass}>Colonna Descrizione (opzionale)</label>
                <select
                  value={columnMap.description ?? ''}
                  onChange={e => setColumnMap(m => ({ ...m, description: e.target.value || undefined }))}
                  className={selectClass}
                  style={{ appearance: 'none', colorScheme: 'dark' }}
                >
                  <option value="">— nessuna —</option>
                  {parsedFile.headers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => setStep('upload')} className="px-4 py-2.5 text-sm text-slate-400 rounded-lg transition-colors hover:text-slate-200" style={{ border: '1px solid var(--dark-600)' }}>
                  Indietro
                </button>
                <button
                  onClick={handleSaveMapping}
                  disabled={!columnMap.date || (!columnMap.amount && !columnMap.debit && !columnMap.credit)}
                  className="btn-primary flex-1 py-2.5 text-sm"
                >
                  Salva e continua
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Step: preview ────────────────────────────────────────────────── */}
        {step === 'preview' && parsedFile && (
          <div className="flex flex-col gap-4 anim-scale">
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-slate-200">Anteprima importazione</h2>
                <span className="text-xs text-slate-500">
                  {parsedFile.records.length} righe · <span className="text-emerald-400">{validRows.length} valide</span>
                  {invalidRows.length > 0 && <> · <span className="text-amber-400">{invalidRows.length} scartate</span></>}
                </span>
              </div>

              {validRows.length > 0 ? (
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--dark-600)' }}>
                      {['Data', 'Importo', 'Descrizione'].map(h => (
                        <th key={h} className="text-left py-2 text-[10px] uppercase tracking-widest text-slate-600 font-semibold pb-2">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {validRows.slice(0, 5).map(r => (
                      <tr key={r.rawIndex} style={{ borderBottom: '1px solid var(--dark-700)' }}>
                        <td className="py-2 text-slate-400 tabular-nums">{r.date}</td>
                        <td className="py-2 text-slate-200 tabular-nums">{fmt(r.amount)}</td>
                        <td className="py-2 text-slate-500 truncate max-w-[200px]">{r.description ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-sm text-amber-400">Nessuna riga valida trovata. Torna indietro e controlla la mappatura.</p>
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
                      <div className="px-5 py-2 text-xs text-slate-600">
                        …e altre {invalidRows.length - 5} righe
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setStep('upload')}
                className="px-4 py-2.5 text-sm text-slate-400 rounded-lg transition-colors hover:text-slate-200"
                style={{ border: '1px solid var(--dark-600)' }}
              >
                Indietro
              </button>
              <button
                onClick={handleImport}
                disabled={validRows.length === 0}
                className="btn-primary flex-1 py-2.5 text-sm"
              >
                Importa {validRows.length} spese
              </button>
            </div>
          </div>
        )}

        {/* ── Step: importing ──────────────────────────────────────────────── */}
        {step === 'importing' && (
          <div className="card p-12 flex flex-col items-center gap-4 anim-fade">
            <Loader2 size={32} className="text-indigo-400 animate-spin" />
            <p className="text-sm text-slate-400">Importazione in corso…</p>
          </div>
        )}

        {/* ── Step: done ───────────────────────────────────────────────────── */}
        {step === 'done' && result && (
          <div className="card p-8 anim-scale">
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
