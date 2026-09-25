import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

type CookieOpts = {
  path?: string; domain?: string; maxAge?: number; expires?: Date;
  httpOnly?: boolean; secure?: boolean; sameSite?: 'strict' | 'lax' | 'none';
};

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOpts }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // In Server Components cookies() è read-only; il middleware
            // gestisce il refresh del token, quindi si può ignorare.
          }
        },
      },
    }
  );
}