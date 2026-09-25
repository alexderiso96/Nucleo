'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabaseClient';
import { LogOut } from 'lucide-react';

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
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-500 hover:text-slate-300 transition-colors"
      style={{ border: '1px solid var(--dark-600)' }}
    >
      <LogOut size={12} />
      Esci
    </button>
  );
}
