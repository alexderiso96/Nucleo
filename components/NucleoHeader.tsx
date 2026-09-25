'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabaseClient';

type ActiveNav = 'dashboard' | 'import' | 'payslips';

interface Props {
  userInitial?: string;
  activeNav: ActiveNav;
  /** Per le sotto-pagine: mostra un link indietro invece del titolo */
  backHref?: string;
  backLabel?: string;
  /** Titolo della pagina corrente (mostrato accanto al breadcrumb) */
  pageTitle?: string;
  /** Slot opzionale a destra dell'header (es. pulsante "Aggiungi") */
  rightSlot?: React.ReactNode;
}

const NAV_ITEMS: { href: string; label: string; key: ActiveNav }[] = [
  { href: '/dashboard', label: 'Dashboard',  key: 'dashboard' },
  { href: '/import',    label: 'Importa',    key: 'import'    },
  { href: '/payslips',  label: 'Buste paga', key: 'payslips'  },
];

export default function NucleoHeader({
  userInitial = '?',
  activeNav,
  backHref,
  backLabel,
  pageTitle,
  rightSlot,
}: Props) {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 20,
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      {/* Riga principale */}
      <div
        style={{
          maxWidth: '42rem',
          margin: '0 auto',
          padding: '0 1.5rem',
          height: '3.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
        }}
      >
        {/* Logo + eventuale breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <Link
            href="/dashboard"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.375rem',
              textDecoration: 'none',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: '1.375rem',
                height: '1.375rem',
                borderRadius: '0.25rem',
                background: 'var(--accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.625rem',
                fontWeight: 700,
                color: '#0e1512',
                flexShrink: 0,
              }}
            >
              N
            </div>
            <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-1)' }}>
              Nucleo
            </span>
          </Link>

          {backHref && (
            <>
              <span style={{ color: 'var(--text-3)', fontSize: '0.875rem' }}>/</span>
              <Link
                href={backHref}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  fontSize: '0.8125rem',
                  color: 'var(--text-3)',
                  textDecoration: 'none',
                }}
              >
                <ArrowLeft size={12} />
                {backLabel}
              </Link>
              {pageTitle && (
                <>
                  <span style={{ color: 'var(--text-3)', fontSize: '0.875rem' }}>/</span>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-2)', fontWeight: 500 }}>
                    {pageTitle}
                  </span>
                </>
              )}
            </>
          )}
        </div>

        {/* Destra: slot + account */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
          {rightSlot}
          <div
            style={{
              width: '1.625rem',
              height: '1.625rem',
              borderRadius: '50%',
              background: 'var(--border)',
              border: '1px solid var(--border-strong)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.6875rem',
              fontWeight: 600,
              color: 'var(--text-2)',
            }}
          >
            {userInitial}
          </div>
          <button
            onClick={handleLogout}
            style={{
              fontSize: '0.75rem',
              color: 'var(--text-3)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            Esci
          </button>
        </div>
      </div>

      {/* Barra di navigazione */}
      <nav
        style={{
          maxWidth: '42rem',
          margin: '0 auto',
          padding: '0 1.5rem',
          height: '2.25rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.25rem',
          borderTop: '1px solid var(--border)',
        }}
      >
        {NAV_ITEMS.map(item => {
          const isActive = item.key === activeNav;
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                fontSize: '0.75rem',
                fontWeight: isActive ? 600 : 400,
                color: isActive ? 'var(--accent)' : 'var(--text-3)',
                padding: '0.25rem 0.5rem',
                textDecoration: 'none',
                borderBottom: isActive ? '1px solid var(--accent)' : '1px solid transparent',
                marginBottom: '-1px',
                transition: 'color 0.15s ease',
              }}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
