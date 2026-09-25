'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Upload,
  FileText,
  Users,
  Settings,
} from 'lucide-react';

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/import',    icon: Upload,           label: 'Importa' },
  { href: '/payslips',  icon: FileText,          label: 'Buste paga' },
  { href: '/family',    icon: Users,             label: 'Nucleo',    soon: true },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="flex flex-col items-center py-4 gap-2 shrink-0"
      style={{
        width: '64px',
        background: 'var(--dark-800)',
        borderRight: '1px solid var(--dark-600)',
        minHeight: '100vh',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}
    >
      {/* Logo mark */}
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center mb-4 text-xs font-bold"
        style={{ background: 'var(--brand-600)', color: '#fff', boxShadow: '0 2px 10px rgba(99,102,241,0.35)' }}
      >
        N
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-1 w-full px-2">
        {navItems.map(({ href, icon: Icon, label, soon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={soon ? '#' : href}
              title={label}
              className="relative flex items-center justify-center w-full h-10 rounded-lg transition-all duration-200 group"
              style={
                active
                  ? { background: 'rgba(99,102,241,0.15)', color: 'var(--brand-400)' }
                  : { color: '#475569' }
              }
            >
              <Icon size={18} />
              {active && (
                <span
                  className="absolute right-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-l"
                  style={{ background: 'var(--brand-400)' }}
                />
              )}
              {/* Tooltip */}
              <span
                className="pointer-events-none absolute left-full ml-2 px-2 py-1 text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap"
                style={{ background: 'var(--dark-700)', border: '1px solid var(--dark-600)', color: '#94a3b8' }}
              >
                {label}{soon ? ' (presto)' : ''}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Settings in fondo */}
      <div className="mt-auto px-2 w-full">
        <button
          title="Impostazioni"
          className="flex items-center justify-center w-full h-10 rounded-lg transition-colors duration-200"
          style={{ color: '#334155' }}
        >
          <Settings size={18} />
        </button>
      </div>
    </aside>
  );
}
