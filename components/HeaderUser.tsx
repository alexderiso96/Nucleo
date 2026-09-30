'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabaseClient';
import { LogOut, User } from 'lucide-react';

interface Props {
  username: string | null;
  fullName: string | null;
  email: string;
}

function getInitials(username: string | null, fullName: string | null, email: string): string {
  if (username) return username.slice(0, 2).toUpperCase();
  if (fullName?.trim()) {
    const parts = fullName.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0].slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

export default function HeaderUser({ username, fullName, email }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  const initials = getInitials(username, fullName, email);
  const displayLabel = username ? `@${username}` : (fullName?.split(' ')[0] ?? email);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-2 py-1.5 rounded-xl transition-colors"
        style={{
          border: '1px solid var(--border)',
          background: open ? 'var(--surface-2)' : 'transparent',
        }}
      >
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
          style={{ background: 'rgba(16,185,129,0.2)', color: 'var(--brand-light)' }}
        >
          {initials}
        </div>
        <span
          className="text-[11px] font-medium hidden sm:block max-w-[120px] truncate"
          style={{ color: 'var(--text-2)' }}
        >
          {displayLabel}
        </span>
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1.5 w-48 rounded-xl py-1 z-50"
          style={{
            background: 'var(--surface-1)',
            border: '1px solid var(--border-strong)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
          }}
        >
          <div className="px-3 py-2.5" style={{ borderBottom: '1px solid var(--border)' }}>
            <p className="text-[12px] font-semibold truncate" style={{ color: 'var(--text-1)' }}>
              {username ? `@${username}` : (fullName ?? email)}
            </p>
            <p className="text-[10px] truncate mt-0.5" style={{ color: 'var(--text-3)' }}>{email}</p>
          </div>

          <Link
            href="/profile"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 w-full px-3 py-2 text-[12px] transition-colors"
            style={{ color: 'var(--text-2)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-1)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-2)')}
          >
            <User size={13} />
            Profilo
          </Link>

          <button
            onClick={handleLogout}
            className="flex items-center gap-2.5 w-full px-3 py-2 text-[12px] transition-colors"
            style={{ color: 'var(--expense)' }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.8')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            <LogOut size={13} />
            Esci
          </button>
        </div>
      )}
    </div>
  );
}
