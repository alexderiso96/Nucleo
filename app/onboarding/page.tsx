import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabaseServer';
import OnboardingForm from '@/components/OnboardingForm';

export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', user.id)
    .maybeSingle();

  if (profile?.username) redirect('/dashboard');

  return <OnboardingForm email={user.email ?? ''} />;
}
