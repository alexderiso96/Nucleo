import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabaseServer';
import Sidebar from '@/components/Sidebar';
import LogoutButton from '@/components/LogoutButton';
import {
  CreateHouseholdButton,
  JoinHouseholdForm,
  CopyCodeButton,
  RegenerateCodeButton,
  LeaveHouseholdButton,
} from './_components/FamilyActions';

const fmt = (n: number) =>
  new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);

function formatCode(code: string): string {
  const clean = code.replace(/-/g, '');
  if (clean.length === 8) return `${clean.slice(0, 4)}-${clean.slice(4)}`;
  return code;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default async function FamilyPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Profilo corrente
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  const householdId = profile?.household_id ?? null;

  // ── Dati household ──────────────────────────────────────────────────────────
  let householdName: string | null = null;
  let partner: { id: string; full_name: string | null; created_at: string } | null = null;
  let inviteCode: string | null = null;
  let inviteExpiresAt: string | null = null;
  let myExpenses = 0;
  let partnerExpenses = 0;
  let sharedExpenses = 0;

  if (householdId) {
    // Household info
    const { data: household } = await supabase
      .from('households')
      .select('name')
      .eq('id', householdId)
      .single();
    householdName = household?.name ?? 'La mia famiglia';

    // Partner (altro membro del nucleo)
    const { data: members } = await supabase
      .from('profiles')
      .select('id, full_name, created_at')
      .eq('household_id', householdId)
      .neq('id', user.id);
    partner = (members ?? [])[0] ?? null;

    // Invito attivo
    const { data: invite } = await supabase
      .from('household_invites')
      .select('code, expires_at')
      .eq('household_id', householdId)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    inviteCode = invite?.code ?? null;
    inviteExpiresAt = invite?.expires_at ?? null;

    // Spese del mese corrente
    if (partner) {
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

      // Mie spese
      const { data: myExp } = await supabase
        .from('expenses')
        .select('amount, is_shared')
        .eq('user_id', user.id)
        .gte('expense_date', firstDay)
        .lte('expense_date', lastDay);

      for (const e of myExp ?? []) {
        const a = Number(e.amount);
        if (e.is_shared) sharedExpenses += a;
        else myExpenses += a;
      }

      // Spese partner condivise (visibili via RLS is_shared = true)
      const { data: partnerExp } = await supabase
        .from('expenses')
        .select('amount, is_shared')
        .eq('user_id', partner.id)
        .eq('is_shared', true)
        .gte('expense_date', firstDay)
        .lte('expense_date', lastDay);

      for (const e of partnerExp ?? []) {
        partnerExpenses += Number(e.amount);
      }
    }
  }

  const hasPartner = partner !== null;
  const totalNucleo = myExpenses + partnerExpenses + sharedExpenses;

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--dark-900)' }}>
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">

        {/* Header */}
        <header
          className="flex items-center justify-between px-6 py-3.5 sticky top-0 z-10"
          style={{ background: 'var(--dark-800)', borderBottom: '1px solid var(--dark-600)' }}
        >
          <div>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>
              Nucleo familiare
            </h2>
            {householdName && (
              <p className="text-[10px]" style={{ color: 'var(--text-3)' }}>{householdName}</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] hidden sm:block" style={{ color: 'var(--text-3)' }}>
              {user.email}
            </span>
            <LogoutButton />
          </div>
        </header>

        <main className="flex-1 px-6 py-6 flex flex-col gap-5 max-w-3xl w-full">

          {/* ── STATO 1: Nessun nucleo ───────────────────────────────────────── */}
          {!householdId && (
            <>
              <div className="anim-slide-up anim-d1">
                <h1 className="text-xl font-bold mb-2" style={{ color: 'var(--text-1)' }}>
                  Nucleo familiare
                </h1>
                <p className="text-sm" style={{ color: 'var(--text-2)' }}>
                  Collega il tuo account a quello del tuo partner per vedere le spese condivise.
                </p>
              </div>

              {/* Crea */}
              <div className="card p-5 anim-slide-up anim-d2">
                <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-2)' }}>
                  Crea un nuovo nucleo
                </p>
                <p className="text-xs mb-4" style={{ color: 'var(--text-3)' }}>
                  Sarai tu ad invitare il tuo partner con un codice.
                </p>
                <CreateHouseholdButton />
              </div>

              {/* Unisciti */}
              <div className="card p-5 anim-slide-up anim-d3">
                <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-2)' }}>
                  Hai già un codice?
                </p>
                <p className="text-xs mb-4" style={{ color: 'var(--text-3)' }}>
                  Il tuo partner ha già creato un nucleo e ti ha condiviso il codice invito.
                </p>
                <JoinHouseholdForm />
              </div>
            </>
          )}

          {/* ── STATO 2: Nucleo creato, partner non ancora unito ─────────────── */}
          {householdId && !hasPartner && (
            <>
              <div className="flex items-center gap-3 anim-slide-up anim-d1">
                <div>
                  <h1 className="text-xl font-bold" style={{ color: 'var(--text-1)' }}>
                    {householdName}
                  </h1>
                </div>
                <span
                  className="badge text-[10px]"
                  style={{ background: 'rgba(251,191,36,0.12)', color: '#fbbf24' }}
                >
                  In attesa del partner
                </span>
              </div>

              {/* Codice invito */}
              <div className="card p-5 anim-slide-up anim-d2">
                <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-2)' }}>
                  Codice invito
                </p>
                <p className="text-xs mb-4" style={{ color: 'var(--text-3)' }}>
                  Condividi questo codice con il tuo partner. Valido 7 giorni.
                </p>

                {inviteCode ? (
                  <>
                    <div
                      className="rounded-xl px-6 py-4 mb-4 text-center tabular-nums"
                      style={{
                        background: 'var(--surface-2)',
                        border: '1px solid var(--border-strong)',
                        fontSize: '1.75rem',
                        fontWeight: 700,
                        letterSpacing: '0.2em',
                        fontFamily: 'monospace',
                        color: 'var(--brand)',
                      }}
                    >
                      {formatCode(inviteCode)}
                    </div>
                    {inviteExpiresAt && (
                      <p className="text-[10px] mb-4" style={{ color: 'var(--text-3)' }}>
                        Scade il {formatDate(inviteExpiresAt)}
                      </p>
                    )}
                    <div className="flex items-center gap-3">
                      <CopyCodeButton code={formatCode(inviteCode)} />
                      <RegenerateCodeButton />
                    </div>
                  </>
                ) : (
                  <div className="flex items-center gap-3">
                    <p className="text-xs" style={{ color: 'var(--text-3)' }}>
                      Nessun codice attivo.
                    </p>
                    <RegenerateCodeButton />
                  </div>
                )}
              </div>

              {/* Lascia */}
              <div className="anim-slide-up anim-d3">
                <LeaveHouseholdButton />
              </div>
            </>
          )}

          {/* ── STATO 3: Nucleo completo ─────────────────────────────────────── */}
          {householdId && hasPartner && (
            <>
              <div className="flex items-center gap-3 anim-slide-up anim-d1">
                <div>
                  <h1 className="text-xl font-bold" style={{ color: 'var(--text-1)' }}>
                    {householdName}
                  </h1>
                </div>
                <span
                  className="badge text-[10px]"
                  style={{ background: 'rgba(52,211,153,0.12)', color: 'var(--income)' }}
                >
                  ● Nucleo attivo
                </span>
              </div>

              {/* Riepilogo mensile */}
              <div className="card p-5 anim-slide-up anim-d2">
                <p className="text-[10px] font-semibold uppercase tracking-widest mb-4"
                  style={{ color: 'var(--text-3)' }}>
                  Questo mese
                </p>
                <div className="flex flex-col gap-2">
                  {[
                    { label: 'Mie spese', value: myExpenses },
                    { label: `Spese di ${partner?.full_name ?? 'partner'}`, value: partnerExpenses },
                    { label: 'Condivise', value: sharedExpenses },
                  ].map(row => (
                    <div key={row.label} className="flex items-center justify-between">
                      <span className="text-sm" style={{ color: 'var(--text-2)' }}>{row.label}</span>
                      <span className="text-sm tabular-nums" style={{ color: 'var(--text-1)' }}>
                        {fmt(row.value)}
                      </span>
                    </div>
                  ))}
                  <div
                    className="flex items-center justify-between pt-3 mt-1"
                    style={{ borderTop: '1px solid var(--border-strong)' }}
                  >
                    <span className="text-sm font-semibold" style={{ color: 'var(--text-2)' }}>
                      Totale nucleo
                    </span>
                    <span className="text-base font-bold tabular-nums" style={{ color: 'var(--text-1)' }}>
                      {fmt(totalNucleo)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Partner */}
              <div className="card p-5 anim-slide-up anim-d3">
                <p className="text-[10px] font-semibold uppercase tracking-widest mb-3"
                  style={{ color: 'var(--text-3)' }}>
                  Partner
                </p>
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                    style={{ background: 'var(--brand-dim)', color: 'var(--brand-light)' }}
                  >
                    {(partner?.full_name ?? 'P')[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>
                      {partner?.full_name ?? 'Partner'}
                    </p>
                    {partner?.created_at && (
                      <p className="text-[10px]" style={{ color: 'var(--text-3)' }}>
                        Unito il {formatDate(partner.created_at)}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Lascia */}
              <div className="anim-slide-up anim-d4">
                <LeaveHouseholdButton />
              </div>
            </>
          )}

        </main>
      </div>
    </div>
  );
}
