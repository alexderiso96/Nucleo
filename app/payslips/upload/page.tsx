'use client';

import { useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  FileText, CheckCircle, AlertTriangle, Loader2,
  ChevronLeft, RotateCcw,
} from 'lucide-react';
import { createClient } from '@/lib/supabaseClient';
import type { PayslipFields, ValidationResult } from '@/lib/payslip-parser';

// ── Tipi ─────────────────────────────────────────────────────────────────────

type Step = 'upload' | 'review' | 'saving' | 'done';

interface FormState {
  periodMonth: string;
  grossAmount: string;
  netAmount: string;
  irpef: string;
  inpsContributions: string;
  regionalMunicipalTax: string;
  overtimeHours: string;
  overtimeAmount: string;
  mealVouchers: string;
  tfrAccruedPeriod: string;
  tfrTotal: string;
  employerName: string;
}

function fieldsToForm(f: PayslipFields): FormState {
  const fmt = (n?: number) => (n !== undefined ? String(n) : '');
  const periodForInput = f.periodMonth ? f.periodMonth.slice(0, 7) : '';
  return {
    periodMonth: periodForInput,
    grossAmount: fmt(f.grossAmount),
    netAmount: fmt(f.netAmount),
    irpef: fmt(f.irpef),
    inpsContributions: fmt(f.inpsContributions),
    regionalMunicipalTax: fmt(f.regionalMunicipalTax),
    overtimeHours: fmt(f.overtimeHours),
    overtimeAmount: fmt(f.overtimeAmount),
    mealVouchers: fmt(f.mealVouchers),
    tfrAccruedPeriod: fmt(f.tfrAccruedPeriod),
    tfrTotal: fmt(f.tfrTotal),
    employerName: f.employerName ?? '',
  };
}

function formToPayload(form: FormState, confidence: 'high' | 'low', storagePath?: string) {
  const num = (s: string) => s.trim() !== '' ? parseFloat(s.replace(',', '.')) : undefined;
  return {
    period_month: form.periodMonth ? `${form.periodMonth}-01` : undefined,
    gross_amount: num(form.grossAmount),
    net_amount: num(form.netAmount),
    irpef: num(form.irpef),
    inps_contributions: num(form.inpsContributions),
    regional_municipal_tax: num(form.regionalMunicipalTax),
    overtime_hours: num(form.overtimeHours),
    overtime_amount: num(form.overtimeAmount),
    meal_vouchers: num(form.mealVouchers),
    tfr_accrued_period: num(form.tfrAccruedPeriod),
    tfr_total: num(form.tfrTotal),
    employer_name: form.employerName.trim() || undefined,
    extraction_confidence: confidence,
    storage_path: storagePath,
  };
}

function clientValidate(form: FormState): ValidationResult {
  const warnings: string[] = [];
  const gross = parseFloat(form.grossAmount);
  const net = parseFloat(form.netAmount);
  const irpef = parseFloat(form.irpef);

  if (!isNaN(gross) && !isNaN(net)) {
    if (net >= gross) warnings.push('Il netto risulta maggiore o uguale al lordo.');
    if ((gross - net) / gross > 0.7) warnings.push('Le trattenute superano il 70% del lordo.');
  }
  if (!isNaN(irpef) && !isNaN(gross) && irpef / gross > 0.5) {
    warnings.push("L'IRPEF supera il 50% del lordo.");
  }

  return { valid: warnings.length === 0, warnings };
}

// ── Campo con underline ───────────────────────────────────────────────────────

function Field({
  label, name, value, onChange, type = 'text', placeholder,
}: {
  label: string;
  name: keyof FormState;
  value: string;
  onChange: (k: keyof FormState, v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
      <label style={{ fontSize: '0.6875rem', color: 'var(--text-3)', fontWeight: 500 }}>
        {label}
      </label>
      <input
        type={type}
        className="field"
        value={value}
        placeholder={placeholder}
        onChange={e => onChange(name, e.target.value)}
        style={{ colorScheme: 'dark', fontSize: '0.875rem' }}
      />
    </div>
  );
}

// ── Step: Upload ──────────────────────────────────────────────────────────────

function UploadStep({ onFile }: { onFile: (f: File) => void }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file?.type === 'application/pdf') onFile(file);
  }, [onFile]);

  return (
    <div style={{ paddingTop: '3rem' }}>
      <p style={{ fontSize: '0.875rem', color: 'var(--text-2)', marginBottom: '2rem' }}>
        Carica un PDF — il testo verrà estratto automaticamente.
      </p>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        style={{
          border: `1px dashed ${dragging ? 'var(--accent)' : 'var(--border-strong)'}`,
          borderRadius: '0.375rem',
          padding: '3.5rem 2rem',
          textAlign: 'center',
          cursor: 'pointer',
          background: dragging ? 'rgba(201,162,39,0.04)' : 'transparent',
          transition: 'border-color 0.15s ease, background 0.15s ease',
        }}
      >
        <p style={{ fontSize: '0.875rem', color: 'var(--text-2)', marginBottom: '0.375rem' }}>
          Trascina il PDF della busta paga qui
        </p>
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-3)' }}>
          oppure clicca per sfogliare
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,application/pdf"
          style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); }}
        />
      </div>
    </div>
  );
}

// ── Step: Review ──────────────────────────────────────────────────────────────

function ReviewStep({
  form, confidence, warnings, fileName, onChange, onSave, onReset,
}: {
  form: FormState;
  confidence: 'high' | 'low';
  warnings: string[];
  fileName: string;
  onChange: (k: keyof FormState, v: string) => void;
  onSave: () => void;
  onReset: () => void;
}) {
  const validation = clientValidate(form);

  return (
    <div style={{ paddingTop: '2rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Intestazione */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
        <div>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-1)', fontWeight: 600, marginBottom: '0.25rem' }}>
            Verifica i dati
          </p>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
            <FileText size={12} />
            {fileName}
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem', flexShrink: 0 }}>
          {confidence === 'high' ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem', color: 'var(--positive)' }}>
              <CheckCircle size={12} />
              Estrazione riuscita
            </span>
          ) : (
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem', color: 'var(--accent)' }}>
              <AlertTriangle size={12} />
              Verifica i campi
            </span>
          )}
          <button
            onClick={onReset}
            style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem', color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <RotateCcw size={11} />
            Altro file
          </button>
        </div>
      </div>

      {/* Avvertenze validazione */}
      {validation.warnings.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
          {validation.warnings.map((w, i) => (
            <p key={i} style={{ fontSize: '0.8125rem', color: 'var(--accent)', display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
              <AlertTriangle size={12} style={{ marginTop: 2, flexShrink: 0 }} />
              {w}
            </p>
          ))}
        </div>
      )}

      {/* Sezione generale */}
      <section>
        <p style={{ fontSize: '0.6875rem', color: 'var(--text-3)', marginBottom: '1.25rem' }}>
          Informazioni generali
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
          <Field label="Periodo" name="periodMonth" value={form.periodMonth} onChange={onChange} type="month" />
          <Field label="Datore di lavoro" name="employerName" value={form.employerName} onChange={onChange} placeholder="es. Accenture S.p.A." />
        </div>
      </section>

      {/* Divider */}
      <div style={{ borderTop: '1px solid var(--border)' }} />

      {/* Importi principali */}
      <section>
        <p style={{ fontSize: '0.6875rem', color: 'var(--text-3)', marginBottom: '1.25rem' }}>
          Importi principali
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
          <Field label="Lordo (€)" name="grossAmount" value={form.grossAmount} onChange={onChange} placeholder="es. 2800" />
          <Field label="Netto (€)" name="netAmount" value={form.netAmount} onChange={onChange} placeholder="es. 1950" />
          <Field label="IRPEF (€)" name="irpef" value={form.irpef} onChange={onChange} placeholder="es. 560" />
          <Field label="Contributi INPS (€)" name="inpsContributions" value={form.inpsContributions} onChange={onChange} placeholder="es. 240" />
          <Field label="Addizionale reg./com. (€)" name="regionalMunicipalTax" value={form.regionalMunicipalTax} onChange={onChange} placeholder="es. 50" />
        </div>
      </section>

      {/* Divider */}
      <div style={{ borderTop: '1px solid var(--border)' }} />

      {/* Voci aggiuntive */}
      <section>
        <p style={{ fontSize: '0.6875rem', color: 'var(--text-3)', marginBottom: '1.25rem' }}>
          Voci aggiuntive
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
          <Field label="Ore straordinario" name="overtimeHours" value={form.overtimeHours} onChange={onChange} placeholder="es. 8" />
          <Field label="Compenso straordinario (€)" name="overtimeAmount" value={form.overtimeAmount} onChange={onChange} placeholder="es. 120" />
          <Field label="Buoni pasto (€)" name="mealVouchers" value={form.mealVouchers} onChange={onChange} placeholder="es. 132" />
          <Field label="TFR maturato periodo (€)" name="tfrAccruedPeriod" value={form.tfrAccruedPeriod} onChange={onChange} placeholder="es. 180" />
          <Field label="TFR totale accantonato (€)" name="tfrTotal" value={form.tfrTotal} onChange={onChange} placeholder="es. 3600" />
        </div>
      </section>

      <button
        onClick={onSave}
        disabled={!form.periodMonth}
        style={{
          fontSize: '0.875rem',
          fontWeight: 600,
          color: form.periodMonth ? 'var(--accent)' : 'var(--text-3)',
          border: `1px solid ${form.periodMonth ? 'var(--accent)' : 'var(--border)'}`,
          background: 'transparent',
          borderRadius: '0.25rem',
          padding: '0.625rem 1.5rem',
          cursor: form.periodMonth ? 'pointer' : 'not-allowed',
          transition: 'background 0.15s ease',
          alignSelf: 'flex-start',
        }}
        onMouseEnter={e => { if (form.periodMonth) { (e.currentTarget as HTMLElement).style.background = 'var(--accent)'; (e.currentTarget as HTMLElement).style.color = '#0e1512'; } }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = form.periodMonth ? 'var(--accent)' : 'var(--text-3)'; }}
      >
        Salva busta paga
      </button>
    </div>
  );
}

// ── Step: Saving / Done ───────────────────────────────────────────────────────

function SavingStep() {
  return (
    <div style={{ paddingTop: '4rem', textAlign: 'center' }}>
      <Loader2 size={28} className="animate-spin" style={{ color: 'var(--accent)', margin: '0 auto 1rem' }} />
      <p style={{ fontSize: '0.875rem', color: 'var(--text-2)' }}>Salvataggio in corso…</p>
    </div>
  );
}

function DoneStep({ onReset }: { onReset: () => void }) {
  return (
    <div style={{ paddingTop: '4rem', textAlign: 'center' }}>
      <p style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>✓</p>
      <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--positive)', marginBottom: '0.25rem' }}>
        Busta paga salvata
      </p>
      <p style={{ fontSize: '0.8125rem', color: 'var(--text-3)', marginBottom: '2rem' }}>
        I dati sono stati registrati correttamente.
      </p>
      <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
        <button
          onClick={onReset}
          style={{
            fontSize: '0.875rem',
            color: 'var(--accent)',
            border: '1px solid var(--accent)',
            background: 'transparent',
            borderRadius: '0.25rem',
            padding: '0.5rem 1.25rem',
            cursor: 'pointer',
          }}
        >
          Carica un&apos;altra
        </button>
        <Link
          href="/payslips"
          style={{
            fontSize: '0.875rem',
            color: 'var(--text-2)',
            border: '1px solid var(--border)',
            borderRadius: '0.25rem',
            padding: '0.5rem 1.25rem',
            textDecoration: 'none',
          }}
        >
          Vai alle buste paga
        </Link>
      </div>
    </div>
  );
}

// ── Wizard principale ─────────────────────────────────────────────────────────

export default function PayslipsUploadPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('upload');
  const [fileName, setFileName] = useState('');
  const [confidence, setConfidence] = useState<'high' | 'low'>('low');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [form, setForm] = useState<FormState>({
    periodMonth: '', grossAmount: '', netAmount: '', irpef: '',
    inpsContributions: '', regionalMunicipalTax: '', overtimeHours: '',
    overtimeAmount: '', mealVouchers: '', tfrAccruedPeriod: '', tfrTotal: '',
    employerName: '',
  });
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<File | null>(null);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  }

  function handleChange(k: keyof FormState, v: string) {
    setForm(prev => ({ ...prev, [k]: v }));
  }

  async function handleFile(file: File) {
    setFileName(file.name);
    fileRef.current = file;
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/payslips/extract', { method: 'POST', body: formData });
      const json = await res.json() as { fields: PayslipFields };
      const fields = json.fields;
      setForm(fieldsToForm(fields));
      setConfidence(fields.confidence);

      const v = clientValidate(fieldsToForm(fields));
      setWarnings(v.warnings);
    } catch {
      setConfidence('low');
    } finally {
      setUploading(false);
      setStep('review');
    }
  }

  async function handleSave() {
    setStep('saving');

    let storagePath: string | undefined;
    if (fileRef.current) {
      try {
        const { createClient: createRawClient } = await import('@supabase/supabase-js');
        const supabase = createRawClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        );
        const safeName = `${Date.now()}_${fileRef.current.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const path = `payslips/${safeName}`;
        const { error } = await supabase.storage.from('payslips').upload(path, fileRef.current, {
          contentType: 'application/pdf',
          upsert: true,
        });
        if (!error) storagePath = path;
      } catch { /* storage non bloccante */ }
    }

    try {
      const payload = formToPayload(form, confidence, storagePath);
      await fetch('/api/payslips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch { /* UI gestisce già gli errori */ }

    setStep('done');
  }

  function reset() {
    setStep('upload');
    setFileName('');
    setConfidence('low');
    setWarnings([]);
    setForm({
      periodMonth: '', grossAmount: '', netAmount: '', irpef: '',
      inpsContributions: '', regionalMunicipalTax: '', overtimeHours: '',
      overtimeAmount: '', mealVouchers: '', tfrAccruedPeriod: '', tfrTotal: '',
      employerName: '',
    });
    fileRef.current = null;
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Header inline */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 20,
        background: 'var(--surface)', borderBottom: '1px solid var(--border)',
      }}>
        <div style={{
          maxWidth: '42rem', margin: '0 auto', padding: '0 1.5rem',
          height: '3.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', textDecoration: 'none', flexShrink: 0 }}>
              <div style={{ width: '1.375rem', height: '1.375rem', borderRadius: '0.25rem', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.625rem', fontWeight: 700, color: '#0e1512' }}>N</div>
              <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-1)' }}>Nucleo</span>
            </Link>
            <span style={{ color: 'var(--text-3)', fontSize: '0.875rem' }}>/</span>
            <Link href="/payslips" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8125rem', color: 'var(--text-3)', textDecoration: 'none' }}>
              <ChevronLeft size={12} />
              Buste paga
            </Link>
            <span style={{ color: 'var(--text-3)', fontSize: '0.875rem' }}>/</span>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-2)', fontWeight: 500 }}>Carica</span>
          </div>
          <button onClick={handleLogout} style={{ fontSize: '0.75rem', color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer' }}>
            Esci
          </button>
        </div>
        <nav style={{ maxWidth: '42rem', margin: '0 auto', padding: '0 1.5rem', height: '2.25rem', display: 'flex', alignItems: 'center', gap: '0.25rem', borderTop: '1px solid var(--border)' }}>
          {[
            { href: '/dashboard', label: 'Dashboard', active: false },
            { href: '/import',    label: 'Importa',   active: false },
            { href: '/payslips',  label: 'Buste paga', active: true },
          ].map(item => (
            <Link key={item.href} href={item.href} style={{ fontSize: '0.75rem', fontWeight: item.active ? 600 : 400, color: item.active ? 'var(--accent)' : 'var(--text-3)', padding: '0.25rem 0.5rem', textDecoration: 'none', borderBottom: item.active ? '1px solid var(--accent)' : '1px solid transparent', marginBottom: '-1px' }}>
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      <main style={{ maxWidth: '42rem', margin: '0 auto', padding: '0 1.5rem 4rem' }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
          >
            {step === 'upload' && !uploading && <UploadStep onFile={handleFile} />}

            {step === 'upload' && uploading && (
              <div style={{ paddingTop: '4rem', textAlign: 'center' }}>
                <Loader2 size={28} className="animate-spin" style={{ color: 'var(--accent)', margin: '0 auto 1rem' }} />
                <p style={{ fontSize: '0.875rem', color: 'var(--text-2)' }}>Estrazione testo in corso…</p>
              </div>
            )}

            {step === 'review' && (
              <ReviewStep
                form={form}
                confidence={confidence}
                warnings={warnings}
                fileName={fileName}
                onChange={handleChange}
                onSave={handleSave}
                onReset={reset}
              />
            )}

            {step === 'saving' && <SavingStep />}
            {step === 'done' && <DoneStep onReset={reset} />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
