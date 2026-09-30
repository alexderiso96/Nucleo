'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Receipt,
  Upload,
  FileText,
  Users,
  Settings,
  BarChart2,
  User,
} from 'lucide-react';

const navItems = [
  { href: '/dashboard',   icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/spese',       icon: Receipt,          label: 'Spese' },
  { href: '/statistiche', icon: BarChart2,        label: 'Statistiche' },
  { href: '/import',      icon: Upload,           label: 'Importa' },
  { href: '/payslips',    icon: FileText,          label: 'Buste paga' },
  { href: '/family',      icon: Users,             label: 'Nucleo' },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="flex flex-col py-4 gap-1 shrink-0"
      style={{
        width: '220px',
        background: 'var(--surface-1)',
        borderRight: '1px solid var(--border-strong)',
        height: '100vh',
        position: 'sticky',
        top: 0,
        overflowY: 'auto',
        zIndex: 10,
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 mb-5">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
          style={{
            background: 'var(--brand-dark)',
            color: '#fff',
            boxShadow: '0 2px 10px rgba(16,185,129,0.3)',
          }}
        >
          N
        </div>
        <span className="text-sm font-bold tracking-tight" style={{ color: 'var(--text-1)' }}>
          Nucleo
        </span>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-0.5 w-full px-2 flex-1">
        {navItems.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className="relative flex items-center gap-3 w-full h-10 px-3 rounded-xl transition-all duration-200"
              style={
                active
                  ? {
                      background: 'rgba(16,185,129,0.12)',
                      color: 'var(--brand-light)',
                    }
                  : {
                      color: 'var(--text-3)',
                    }
              }
              onMouseEnter={e => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)';
                  (e.currentTarget as HTMLElement).style.color = 'var(--text-2)';
                }
              }}
              onMouseLeave={e => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.background = 'transparent';
                  (e.currentTarget as HTMLElement).style.color = 'var(--text-3)';
                }
              }}
            >
              {/* Left accent bar */}
              {active && (
                <span
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r"
                  style={{ background: 'var(--brand)' }}
                />
              )}

              <Icon size={16} strokeWidth={active ? 2.2 : 1.8} />

              <span className="text-sm font-medium flex-1 min-w-0 truncate">
                {label}
              </span>

            </Link>
          );
        })}
      </nav>

      {/* Profilo + Settings in fondo */}
      <div className="px-2 mt-auto pt-2 flex flex-col gap-0.5" style={{ borderTop: '1px solid var(--border-strong)' }}>
        <Link
          href="/profile"
          className="relative flex items-center gap-3 w-full h-10 px-3 rounded-xl transition-all duration-200"
          style={
            pathname === '/profile'
              ? { background: 'rgba(16,185,129,0.12)', color: 'var(--brand-light)' }
              : { color: 'var(--text-3)' }
          }
          onMouseEnter={e => {
            if (pathname !== '/profile') {
              (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)';
              (e.currentTarget as HTMLElement).style.color = 'var(--text-2)';
            }
          }}
          onMouseLeave={e => {
            if (pathname !== '/profile') {
              (e.currentTarget as HTMLElement).style.background = 'transparent';
              (e.currentTarget as HTMLElement).style.color = 'var(--text-3)';
            }
          }}
        >
          {pathname === '/profile' && (
            <span
              className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r"
              style={{ background: 'var(--brand)' }}
            />
          )}
          <User size={16} strokeWidth={pathname === '/profile' ? 2.2 : 1.8} />
          <span className="text-sm font-medium">Profilo</span>
        </Link>
        <Link
          href="/settings"
          className="relative flex items-center gap-3 w-full h-10 px-3 rounded-xl transition-all duration-200"
          style={
            pathname === '/settings'
              ? { background: 'rgba(16,185,129,0.12)', color: 'var(--brand-light)' }
              : { color: 'var(--text-3)' }
          }
          onMouseEnter={e => {
            if (pathname !== '/settings') {
              (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)';
              (e.currentTarget as HTMLElement).style.color = 'var(--text-2)';
            }
          }}
          onMouseLeave={e => {
            if (pathname !== '/settings') {
              (e.currentTarget as HTMLElement).style.background = 'transparent';
              (e.currentTarget as HTMLElement).style.color = 'var(--text-3)';
            }
          }}
        >
          {pathname === '/settings' && (
            <span
              className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r"
              style={{ background: 'var(--brand)' }}
            />
          )}
          <Settings size={16} strokeWidth={pathname === '/settings' ? 2.2 : 1.8} />
          <span className="text-sm font-medium">Impostazioni</span>
        </Link>
      </div>
    </aside>
  );
}
