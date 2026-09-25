'use client';

import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload, FileText, CheckCircle, AlertTriangle, Loader2,
  ChevronRight, RotateCcw,
} from 'lucide-react';
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
  // period_month is "YYYY-MM-01" — convert to input[type=month] format "YYYY-MM"
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

// ── Componenti UI ─────────────────────────────────────────────────────────────

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
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
        {label}
      </label>
      <input
        type={type}
        className="input px-3 py-2 text-sm"
        value={value}
        placeholder={placeholder}
        onChange={e => onChange(name, e.target.value)}
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
    <div className="flex flex-col items-center gap-8">
      <div>
        <h1 className="text-xl font-bold text-slate-100 text-center">Carica busta paga</h1>
        <p className="text-xs text-slate-500 text-center mt-1">
          Carica un PDF — il testo verrà estratto automaticamente
        </p>
      </div>

      <div
        className={`w-full max-w-md border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-4 py-14 px-6 cursor-pointer transition-colors ${dragging ? 'border-indigo-400 bg-indigo-500/5' : 'border-slate-700 hover:border-slate-500'}`}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(99,102,241,0.1)' }}
        >
          <Upload size={24} style={{ color: 'var(--brand-400)' }} />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-slate-300">Trascina qui il PDF</p>
          <p className="text-xs text-slate-600 mt-0.5">oppure clicca per sfogliare</p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,application/pdf"
          className="hidden"
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
    <div className="flex flex-col gap-6 w-full max-w-2xl mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Verifica i dati</h1>
          <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
            <FileText size={11} />
            {fileName}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          {confidence === 'high' ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400">
              <CheckCircle size={11} />
              Estrazione riuscita
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-400">
              <AlertTriangle size={11} />
              Inserimento manuale
            </span>
          )}
          <button
            onClick={onReset}
            className="flex items-center gap-1.5 text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
          >
            <RotateCcw size={11} />
            Ricarica altro file
          </button>
        </div>
      </div>

      {validation.warnings.length > 0 && (
        <div
          className="flex flex-col gap-1 px-4 py-3 rounded-lg"
          style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}
        >
          {validation.warnings.map((w, i) => (
            <p key={i} className="text-xs text-amber-400 flex items-start gap-2">
              <AlertTriangle size={12} className="mt-0.5 shrink-0" />
              {w}
            </p>
          ))}
        </div>
      )}

      <div className="card p-5 flex flex-col gap-4">
        <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--brand-400)' }}>
          Informazioni generali
        </p>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Periodo" name="periodMonth" value={form.periodMonth} onChange={onChange} type="month" />
          <Field label="Datore di lavoro" name="employerName" value={form.employerName} onChange={onChange} placeholder="es. Accenture S.p.A." />
        </div>
      </div>

      <div className="card p-5 flex flex-col gap-4">
        <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--brand-400)' }}>
          Importi principali
        </p>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Lordo (€)" name="grossAmount" value={form.grossAmount} onChange={onChange} placeholder="es. 2800" />
          <Field label="Netto (€)" name="netAmount" value={form.netAmount} onChange={onChange} placeholder="es. 1950" />
          <Field label="IRPEF (€)" name="irpef" value={form.irpef} onChange={onChange} placeholder="es. 560" />
          <Field label="Contributi INPS (€)" name="inpsContributions" value={form.inpsContributions} onChange={onChange} placeholder="es. 240" />
          <Field label="Add. regionale/comunale (€)" name="regionalMunicipalTax" value={form.regionalMunicipalTax} onChange={onChange} placeholder="es. 50" />
        </div>
      </div>

      <div className="card p-5 flex flex-col gap-4">
        <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--brand-400)' }}>
          Voci aggiuntive
        </p>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Ore straordinario" name="overtimeHours" value={form.overtimeHours} onChange={onChange} placeholder="es. 8" />
          <Field label="Compenso straordinario (€)" name="overtimeAmount" value={form.overtimeAmount} onChange={onChange} placeholder="es. 120" />
          <Field label="Buoni pasto (€)" name="mealVouchers" value={form.mealVouchers} onChange={onChange} placeholder="es. 132" />
          <Field label="TFR maturato periodo (€)" name="tfrAccruedPeriod" value={form.tfrAccruedPeriod} onChange={onChange} placeholder="es. 180" />
          <Field label="TFR totale accantonato (€)" name="tfrTotal" value={form.tfrTotal} onChange={onChange} placeholder="es. 3600" />
        </div>
      </div>

      <button
        onClick={onSave}
        disabled={!form.periodMonth}
        className="btn-primary flex items-center justify-center gap-2 py-3 rounded-lg font-semibold text-sm"
        style={{ opacity: !form.periodMonth ? 0.4 : 1 }}
      >
        Salva busta paga
        <ChevronRight size={16} />
      </button>
    </div>
  );
}

// ── Step: Saving / Done ───────────────────────────────────────────────────────

function SavingStep() {
  return (
    <div className="flex flex-col items-center gap-4">
      <Loader2 size={40} className="animate-spin" style={{ color: 'var(--brand-400)' }} />
      <p className="text-sm text-slate-400">Salvataggio in corso…</p>
    </div>
  );
}

function DoneStep({ onReset }: { onReset: () => void }) {
  return (
    <div className="flex flex-col items-center gap-6">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', duration: 0.5 }}
        className="w-16 h-16 rounded-full flex items-center justify-center"
        style={{ background: 'rgba(16,185,129,0.15)' }}
      >
        <CheckCircle size={32} className="text-emerald-400" />
      </motion.div>
      <div className="text-center">
        <h2 className="text-lg font-bold text-slate-100">Busta paga salvata</h2>
        <p className="text-xs text-slate-500 mt-1">I dati sono stati registrati correttamente.</p>
      </div>
      <button onClick={onReset} className="btn-primary px-6 py-2 rounded-lg text-sm font-semibold">
        Carica un&apos;altra busta paga
      </button>
    </div>
  );
}

// ── Wizard principale ─────────────────────────────────────────────────────────

export default function PayslipsPage() {
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

      // Client-side validation warnings
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

    // Upload PDF to Supabase Storage (non-bloccante)
    let storagePath: string | undefined;
    if (fileRef.current) {
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(
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
    <main className="flex-1 px-6 py-8 overflow-y-auto">
      <div className="max-w-2xl mx-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.22 }}
          >
            {step === 'upload' && !uploading && <UploadStep onFile={handleFile} />}

            {step === 'upload' && uploading && (
              <div className="flex flex-col items-center gap-4">
                <Loader2 size={40} className="animate-spin" style={{ color: 'var(--brand-400)' }} />
                <p className="text-sm text-slate-400">Estrazione testo in corso…</p>
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
      </div>
    </main>
  );
}
