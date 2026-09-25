'use client';

export default function YearSelector({ years, selected }: { years: number[]; selected: number }) {
  return (
    <div className="flex items-center gap-2 no-print">
      <label className="text-[10px] text-slate-500 uppercase tracking-widest">Anno</label>
      <select
        defaultValue={selected}
        onChange={e => { window.location.href = `/payslips/annuale?year=${e.target.value}`; }}
        className="input px-2 py-1 text-xs"
        style={{ appearance: 'none', colorScheme: 'dark' }}
      >
        {years.map(y => <option key={y} value={y}>{y}</option>)}
      </select>
    </div>
  );
}
