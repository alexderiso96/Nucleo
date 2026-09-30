import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabaseServer';
import Sidebar from '@/components/Sidebar';
import ProfileInfoSection from '@/components/ProfileInfoSection';
import ProfileCategoriesSection from '@/components/ProfileCategoriesSection';
import ProfileDangerZone from '@/components/ProfileDangerZone';
import BudgetSection from '@/components/BudgetSection';

const TABS = ['profilo', 'budget', 'categorie', 'integrazioni', 'account'] as const;
type Tab = typeof TABS[number];

function getInitials(fullName: string | null, email: string): string {
  if (fullName?.trim()) {
    const parts = fullName.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0].slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab: tabParam } = await searchParams;
  const activeTab: Tab = TABS.includes(tabParam as Tab) ? (tabParam as Tab) : 'profilo';

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const lastDay  = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

  const [
    { count: expenseCount },
    { count: payslipCount },
    { count: userCatCount },
    { count: ruleCount },
    { data: thisMonth },
    { data: profile },
  ] = await Promise.all([
    supabase.from('expenses').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase.from('payslips').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase.from('user_categories').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase.from('merchant_rules').select('*', { count: 'exact', head: true }).eq('user_id', user.id).not('user_id', 'is', null),
    supabase.from('expenses').select('amount').eq('user_id', user.id).eq('is_income', false).gte('expense_date', firstDay).lte('expense_date', lastDay),
    supabase.from('profiles').select('household_id, drive_folder_id, drive_refresh_token, drive_last_synced_at, full_name, username').eq('id', user.id).single(),
  ]);

  const thisMonthTotal = (thisMonth ?? []).reduce((s, e) => s + Number(e.amount), 0);
  const fmt = (n: number) =>
    new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
  const memberSince = new Date(user.created_at).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
  const monthLabel = now.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
  const initials = getInitials(profile?.full_name ?? null, user.email ?? '?');
  const displayName = profile?.full_name?.trim() || user.email;
  const hasHousehold = Boolean(profile?.household_id);
  const hasDrive = Boolean(profile?.drive_refresh_token && profile?.drive_folder_id);

  const stats = [
    { value: (expenseCount ?? 0).toString(), label: 'Spese totali' },
    { value: (payslipCount ?? 0).toString(), label: 'Buste paga' },
    { value: fmt(thisMonthTotal),            label: `Speso a ${monthLabel}` },
    { value: (userCatCount ?? 0).toString(), label: 'Categorie custom' },
  ];

  const tabDefs: { id: Tab; label: string }[] = [
    { id: 'profilo',       label: 'Profilo' },
    { id: 'budget',        label: 'Budget' },
    { id: 'categorie',     label: 'Categorie' },
    { id: 'integrazioni',  label: 'Integrazioni' },
    { id: 'account',       label: 'Account' },
  ];

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--dark-900)' }}>
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <header
          className="flex items-center px-6 py-3.5 sticky top-0 z-10"
          style={{ background: 'var(--dark-800)', borderBottom: '1px solid var(--dark-600)' }}
        >
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>Profilo</h2>
        </header>

        <main className="flex-1 px-6 py-6 max-w-2xl w-full mx-auto flex flex-col gap-5">

          {/* HERO */}
          <div className="card p-6 flex items-center gap-5">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold shrink-0"
              style={{
                background: 'rgba(16,185,129,0.15)',
                color: 'var(--brand-light)',
                border: '2px solid rgba(16,185,129,0.25)',
              }}
            >
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-base font-semibold truncate" style={{ color: 'var(--text-1)' }}>
                {displayName}
              </p>
              {profile?.username && (
                <p className="text-xs font-medium" style={{ color: 'var(--brand-light)' }}>
                  @{profile.username}
                </p>
              )}
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
                Membro dal {memberSince}
              </p>
            </div>
          </div>

          {/* STATS */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {stats.map(({ value, label }) => (
              <div key={label} className="card p-4 flex flex-col gap-1">
                <p className="text-2xl font-bold tabular-nums" style={{ color: 'var(--text-1)' }}>{value}</p>
                <p className="text-[11px]" style={{ color: 'var(--text-3)' }}>{label}</p>
              </div>
            ))}
          </div>

          {/* TAB NAV */}
          <div
            className="flex gap-1 p-1 rounded-xl overflow-x-auto"
            style={{ background: 'var(--surface-2)' }}
          >
            {tabDefs.map(t => (
              <Link
                key={t.id}
                href={`/profile?tab=${t.id}`}
                className="px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors shrink-0"
                style={
                  activeTab === t.id
                    ? { background: 'var(--surface-1)', color: 'var(--text-1)' }
                    : { color: 'var(--text-3)' }
                }
              >
                {t.label}
              </Link>
            ))}
          </div>

          {/* TAB CONTENT */}
          {activeTab === 'profilo' && (
            <ProfileInfoSection
              initialFullName={profile?.full_name ?? null}
              initialUsername={profile?.username ?? null}
              email={user.email ?? ''}
            />
          )}

          {activeTab === 'budget' && <BudgetSection />}

          {activeTab === 'categorie' && <ProfileCategoriesSection />}

          {activeTab === 'integrazioni' && (
            <div className="card p-5 flex flex-col gap-0">
              <p className="text-xs font-semibold mb-3" style={{ color: 'var(--text-2)' }}>Integrazioni</p>

              <div className="flex items-center justify-between py-3" style={{ borderBottom: '1px solid var(--border)' }}>
                <div className="flex items-center gap-3">
                  <span className="text-base">☁️</span>
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>Google Drive</p>
                    {hasDrive && profile?.drive_last_synced_at && (
                      <p className="text-[10px]" style={{ color: 'var(--text-3)' }}>
                        Ultima sync: {new Date(profile.drive_last_synced_at).toLocaleDateString('it-IT')}
                      </p>
                    )}
                  </div>
                </div>
                <span
                  className="text-[10px] font-semibold px-2.5 py-1 rounded-full shrink-0"
                  style={hasDrive
                    ? { background: 'rgba(16,185,129,0.12)', color: 'var(--brand-light)' }
                    : { background: 'var(--surface-2)', color: 'var(--text-3)' }}
                >
                  {hasDrive ? '● Connesso' : '○ Non connesso'}
                </span>
              </div>

              <div className="flex items-center justify-between py-3" style={{ borderBottom: '1px solid var(--border)' }}>
                <div className="flex items-center gap-3">
                  <span className="text-base">👨‍👩‍👧</span>
                  <p className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>Nucleo familiare</p>
                </div>
                <span
                  className="text-[10px] font-semibold px-2.5 py-1 rounded-full shrink-0"
                  style={hasHousehold
                    ? { background: 'rgba(16,185,129,0.12)', color: 'var(--brand-light)' }
                    : { background: 'var(--surface-2)', color: 'var(--text-3)' }}
                >
                  {hasHousehold ? '● Connesso' : '○ Non connesso'}
                </span>
              </div>

              <div className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <span className="text-base">📋</span>
                  <p className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>Regole merchant</p>
                </div>
                <span
                  className="text-[10px] font-semibold px-2.5 py-1 rounded-full shrink-0"
                  style={{ background: 'var(--surface-2)', color: 'var(--text-2)' }}
                >
                  {ruleCount ?? 0} personali · 98 globali
                </span>
              </div>
            </div>
          )}

          {activeTab === 'account' && <ProfileDangerZone />}

        </main>
      </div>
    </div>
  );
}
