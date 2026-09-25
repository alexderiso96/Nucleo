'use client';

import { useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Papa from 'papaparse';
import { ChevronDown, ChevronRight, Check, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabaseClient';
import {
  decodeBuffer,
  headersFingerprint,
  autoDetectMapping,
  parseRows,
  type ColumnMap,
  type ParsedRow,
} from '@/lib/csv-parser';
import { parseXlsxBuffer } from '@/lib/xlsx-parser';

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

const btnOutline: React.CSSProperties = {
  border: '1px solid var(--accent)',
  color: 'var(--accent)',
  background: 'transparent',
  borderRadius: '0.25rem',
  fontSize: '0.875rem',
  fontWeight: 500,
  cursor: 'pointer',
  padding: '0.625rem 1.25rem',
  transition: 'background 0.15s ease, color 0.15s ease',
  fontFamily: 'inherit',
};

const btnGhost: React.CSSProperties = {
  border: '1px solid var(--border)',
  color: 'var(--text-2)',
  background: 'transparent',
  borderRadius: '0.25rem',
  fontSize: '0.875rem',
  fontWeight: 400,
  cursor: 'pointer',
  padding: '0.625rem 1.25rem',
  transition: 'color 0.15s ease',
  fontFamily: 'inherit',
};

const selectStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  borderBottom: '1px solid var(--border)',
  color: 'var(--text-1)',
  width: '100%',
  padding: '0.5rem 0',
  fontSize: '0.875rem',
  fontFamily: 'inherit',
  colorScheme: 'dark' as React.CSSProperties['colorScheme'],
  outline: 'none',
  cursor: 'pointer',
};

export default function ImportPage() {
  const router = useRouter();
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

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
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

    if (records.length === 0) {
      setError('Il file non contiene righe di dati.');
      return;
    }
    if (headers.length === 0) {
      setError('Impossibile rilevare le intestazioni del file.');
      return;
    }

    const fp = headersFingerprint(headers);
    const auto = autoDetectMapping(headers);

    const pf: ParsedFile = { headers, records, fingerprint: fp, encoding, fileName: file.name };
    setParsedFile(pf);

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

  async function handleSaveMapping() {
    if (!parsedFile) return;
    const map = columnMap as ColumnMap;
    map.sourceName = sourceName || 'Sconosciuta';
    try {
      await fetch('/api/csv/mappings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fingerprint: parsedFile.fingerprint, sourceName: map.sourceName, columnMap: map }),
      });
    } catch { /* non bloccare l'utente */ }
    applyMapping(parsedFile, map);
    setStep('preview');
  }

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
      setResult({ imported: json.imported, duplicates: json.duplicates, total: json.total, discarded: invalidRows.length });
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

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>

      {/* Header */}
      <header style={{ position: 'sticky', top: 0, zIndex: 20, background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ maxWidth: '42rem', margin: '0 auto', padding: '0 1.5rem', height: '3.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', textDecoration: 'none' }}>
            <div style={{ width: '1.375rem', height: '1.375rem', borderRadius: '0.25rem', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.625rem', fontWeight: 700, color: '#0e1512' }}>N</div>
            <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-1)' }}>Nucleo</span>
          </Link>
          <button onClick={handleLogout} style={{ fontSize: '0.75rem', color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Esci</button>
        </div>
        <nav style={{ maxWidth: '42rem', margin: '0 auto', padding: '0 1.5rem', height: '2.25rem', display: 'flex', alignItems: 'center', gap: '0.25rem', borderTop: '1px solid var(--border)' }}>
          {[
            { href: '/dashboard', label: 'Dashboard', active: false },
            { href: '/import',    label: 'Importa',   active: true  },
            { href: '/payslips',  label: 'Buste paga', active: false },
          ].map(item => (
            <Link key={item.href} href={item.href} style={{ fontSize: '0.75rem', fontWeight: item.active ? 600 : 400, color: item.active ? 'var(--accent)' : 'var(--text-3)', padding: '0.25rem 0.5rem', textDecoration: 'none', borderBottom: item.active ? '1px solid var(--accent)' : '1px solid transparent', marginBottom: '-1px', transition: 'color 0.15s ease' }}>{item.label}</Link>
          ))}
        </nav>
      </header>

      <main style={{ maxWidth: '42rem', margin: '0 auto', padding: '2rem 1.5rem 4rem' }}>

        {/* Nota privacy */}
        <p style={{ fontSize: '0.6875rem', color: 'var(--text-3)', marginBottom: '1.5rem' }}>
          Nessun dato finanziario viene registrato nei log di sistema.
        </p>

        {/* Errore */}
        {error && (
          <p style={{ color: 'var(--negative)', fontSize: '0.875rem', marginBottom: '1rem' }}>
            {error}
          </p>
        )}

        {/* ── Step: upload ─────────────────────────────────────────────────── */}
        {step === 'upload' && (
          <div>
            <h1 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-1)', marginBottom: '0.5rem' }}>
              Importa estratto conto
            </h1>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-2)', marginBottom: '2rem' }}>
              Carica un file CSV o Excel della tua banca. Le colonne vengono mappate automaticamente o guidate la prima volta.
            </p>

            <div
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `1px dashed ${dragging ? 'var(--accent)' : 'var(--border-strong)'}`,
                borderRadius: '0.25rem',
                padding: '3rem 2rem',
                textAlign: 'center',
                cursor: 'pointer',
                background: dragging ? 'rgba(201,162,39,0.04)' : 'transparent',
                transition: 'border-color 0.15s ease, background 0.15s ease',
                marginBottom: '1rem',
              }}
            >
              <p style={{ fontSize: '0.9375rem', color: 'var(--text-2)', marginBottom: '0.375rem' }}>
                Trascina un file CSV o Excel qui
              </p>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-3)' }}>
                oppure clicca per sfogliare · .csv, .xlsx
              </p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
          </div>
        )}

        {/* ── Step: mapping ────────────────────────────────────────────────── */}
        {step === 'mapping' && parsedFile && (
          <div>
            <h1 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-1)', marginBottom: '0.25rem' }}>
              Abbina le colonne
            </h1>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-2)', marginBottom: '2rem' }}>
              File: <span style={{ color: 'var(--text-1)' }}>{parsedFile.fileName}</span>
              {parsedFile.encoding === 'Excel' && <span style={{ color: 'var(--info)', marginLeft: '0.5rem' }}>· Excel</span>}
              {parsedFile.encoding !== 'UTF-8' && parsedFile.encoding !== 'Excel' && (
                <span style={{ color: 'var(--warning)', marginLeft: '0.5rem' }}>· {parsedFile.encoding} rilevato</span>
              )}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-2)', display: 'block', marginBottom: '0.375rem' }}>Nome fonte (es. Fineco, ING, Intesa)</label>
                <input type="text" value={sourceName} onChange={e => setSourceName(e.target.value)} placeholder="Nome della banca" className="field" />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-2)', display: 'block', marginBottom: '0.375rem' }}>Colonna Data</label>
                <select value={columnMap.date ?? ''} onChange={e => setColumnMap(m => ({ ...m, date: e.target.value }))} style={selectStyle}>
                  <option value="">— seleziona —</option>
                  {parsedFile.headers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-2)', display: 'block', marginBottom: '0.375rem' }}>Tipo importo</label>
                <select value={columnMap.amountType ?? 'single'} onChange={e => setColumnMap(m => ({ ...m, amountType: e.target.value as 'single' | 'split' }))} style={selectStyle}>
                  <option value="single">Colonna singola</option>
                  <option value="split">Dare / Avere separati</option>
                </select>
              </div>

              {(!columnMap.amountType || columnMap.amountType === 'single') && (
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-2)', display: 'block', marginBottom: '0.375rem' }}>Colonna Importo</label>
                  <select value={columnMap.amount ?? ''} onChange={e => setColumnMap(m => ({ ...m, amount: e.target.value }))} style={selectStyle}>
                    <option value="">— seleziona —</option>
                    {parsedFile.headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              )}

              {columnMap.amountType === 'split' && (
                <>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-2)', display: 'block', marginBottom: '0.375rem' }}>Colonna Dare (uscite)</label>
                    <select value={columnMap.debit ?? ''} onChange={e => setColumnMap(m => ({ ...m, debit: e.target.value }))} style={selectStyle}>
                      <option value="">— opzionale —</option>
                      {parsedFile.headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-2)', display: 'block', marginBottom: '0.375rem' }}>Colonna Avere (entrate)</label>
                    <select value={columnMap.credit ?? ''} onChange={e => setColumnMap(m => ({ ...m, credit: e.target.value }))} style={selectStyle}>
                      <option value="">— opzionale —</option>
                      {parsedFile.headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                </>
              )}

              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-2)', display: 'block', marginBottom: '0.375rem' }}>Colonna Descrizione (opzionale)</label>
                <select value={columnMap.description ?? ''} onChange={e => setColumnMap(m => ({ ...m, description: e.target.value || undefined }))} style={selectStyle}>
                  <option value="">— nessuna —</option>
                  {parsedFile.headers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-2)', display: 'block', marginBottom: '0.375rem' }}>Colonna Tipo (opzionale)</label>
                <select value={columnMap.typeColumn ?? ''} onChange={e => setColumnMap(m => ({ ...m, typeColumn: e.target.value || undefined }))} style={selectStyle}>
                  <option value="">— nessuna —</option>
                  {parsedFile.headers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>

              {columnMap.typeColumn && (
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-2)', display: 'block', marginBottom: '0.375rem' }}>Filtra per tipo</label>
                  <select value={columnMap.typeFilter ?? 'debit'} onChange={e => setColumnMap(m => ({ ...m, typeFilter: e.target.value as 'debit' | 'credit' | 'all' }))} style={selectStyle}>
                    <option value="debit">Solo addebiti (uscite)</option>
                    <option value="credit">Solo accrediti (entrate)</option>
                    <option value="all">Tutti</option>
                  </select>
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.75rem', paddingTop: '0.5rem' }}>
                <button onClick={() => setStep('upload')} style={btnGhost}>Indietro</button>
                <button
                  onClick={handleSaveMapping}
                  disabled={!columnMap.date || (!columnMap.amount && !columnMap.debit && !columnMap.credit)}
                  style={{ ...btnOutline, flex: 1, opacity: (!columnMap.date || (!columnMap.amount && !columnMap.debit && !columnMap.credit)) ? 0.35 : 1 }}
                >
                  Salva e continua
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Step: preview ────────────────────────────────────────────────── */}
        {step === 'preview' && parsedFile && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-1)' }}>Anteprima importazione</h2>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-2)' }}>
                  <span style={{ color: 'var(--positive)' }}>{validRows.length} valide</span>
                  {invalidRows.length > 0 && <> · <span style={{ color: 'var(--warning)' }}>{invalidRows.length} scartate</span></>}
                </span>
              </div>

              {validRows.length > 0 ? (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      {['Data', 'Importo', 'Descrizione'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '0.375rem 0', fontSize: '0.75rem', color: 'var(--text-3)', fontWeight: 500 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {validRows.slice(0, 5).map(r => (
                      <tr key={r.rawIndex} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '0.625rem 0', fontSize: '0.8125rem', color: 'var(--text-2)' }} className="tabular-nums">{r.date}</td>
                        <td style={{ padding: '0.625rem 0', fontSize: '0.8125rem', color: 'var(--text-1)' }} className="tabular-nums">{fmt(r.amount)}</td>
                        <td style={{ padding: '0.625rem 0', fontSize: '0.8125rem', color: 'var(--text-2)', maxWidth: '12rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.description ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p style={{ fontSize: '0.875rem', color: 'var(--warning)' }}>Nessuna riga valida trovata. Torna indietro e controlla la mappatura.</p>
              )}
            </div>

            {invalidRows.length > 0 && (
              <div style={{ borderTop: '1px solid var(--border)' }}>
                <button onClick={() => setShowDiscarded(v => !v)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '0.75rem 0', fontSize: '0.8125rem', color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                  <span>{invalidRows.length} righe scartate</span>
                  {showDiscarded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
                {showDiscarded && invalidRows.slice(0, 5).map(r => (
                  <div key={r.rawIndex} style={{ padding: '0.375rem 0', fontSize: '0.8125rem', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ color: 'var(--text-3)', marginRight: '0.5rem' }}>Riga {r.rawIndex}</span>
                    <span style={{ color: 'var(--warning)' }}>{r.reason}</span>
                  </div>
                ))}
                {showDiscarded && invalidRows.length > 5 && (
                  <p style={{ fontSize: '0.8125rem', color: 'var(--text-3)', padding: '0.375rem 0' }}>…e altre {invalidRows.length - 5} righe</p>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={() => setStep('upload')} style={btnGhost}>Indietro</button>
              <button onClick={handleImport} disabled={validRows.length === 0} style={{ ...btnOutline, flex: 1, opacity: validRows.length === 0 ? 0.35 : 1 }}>
                Importa {validRows.length} spese
              </button>
            </div>
          </div>
        )}

        {/* ── Step: importing ──────────────────────────────────────────────── */}
        {step === 'importing' && (
          <div style={{ padding: '4rem 0', textAlign: 'center' }}>
            <Loader2 size={24} className="animate-spin" style={{ color: 'var(--accent)', display: 'inline-block', marginBottom: '1rem' }} />
            <p style={{ fontSize: '0.875rem', color: 'var(--text-2)' }}>Importazione in corso…</p>
          </div>
        )}

        {/* ── Step: done ───────────────────────────────────────────────────── */}
        {step === 'done' && result && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '2rem' }}>
              <Check size={18} style={{ color: 'var(--positive)' }} />
              <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-1)' }}>Importazione completata</h2>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px', background: 'var(--border)', marginBottom: '2rem' }}>
              {[
                { label: 'Importate',         value: result.imported,   color: 'var(--positive)' },
                { label: 'Duplicate ignorate', value: result.duplicates, color: 'var(--text-2)'   },
                { label: 'Scartate',           value: result.discarded,  color: 'var(--warning)'  },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ background: 'var(--surface)', padding: '1.25rem', textAlign: 'center' }}>
                  <p style={{ fontSize: '1.75rem', fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>{value}</p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: '0.25rem' }}>{label}</p>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={reset} style={{ ...btnGhost, flex: 1 }}>Importa un altro file</button>
              <Link href="/dashboard" style={{ ...btnOutline, flex: 1, textAlign: 'center', textDecoration: 'none', display: 'block', paddingTop: '0.625rem', paddingBottom: '0.625rem' }}>
                Vai alla dashboard
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
