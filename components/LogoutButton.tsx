'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabaseClient';

export default function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      style={{
        fontSize: '0.75rem',
        color: 'var(--text-3)',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: '0.25rem 0',
        transition: 'color 0.15s ease',
      }}
    >
      Esci
    </button>
  );
}
