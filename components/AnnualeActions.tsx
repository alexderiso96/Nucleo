'use client';

import { Download, Printer } from 'lucide-react';
import { unparse } from 'papaparse';
import type { AnnualSummary } from '@/lib/payslip-annual';
import { summaryToCsvRows } from '@/lib/payslip-annual';

export default function AnnualeActions({ summary }: { summary: AnnualSummary }) {
  function downloadCsv() {
    const rows = summaryToCsvRows(summary);
    const csv = unparse(rows, { delimiter: ';' });
    const bom = '﻿';
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `buste_paga_${summary.year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex gap-2 no-print">
      <button
        onClick={downloadCsv}
        className="flex items-center gap-1.5 px-3 py-2 text-xs rounded-lg text-slate-400 hover:text-slate-200 transition-colors"
        style={{ border: '1px solid var(--dark-600)' }}
      >
        <Download size={13} /> Esporta CSV
      </button>
      <button
        onClick={() => window.print()}
        className="flex items-center gap-1.5 px-3 py-2 text-xs rounded-lg text-slate-400 hover:text-slate-200 transition-colors"
        style={{ border: '1px solid var(--dark-600)' }}
      >
        <Printer size={13} /> Stampa / PDF
      </button>
    </div>
  );
}
