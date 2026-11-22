import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function serverSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) => {
          try {
            list.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // called from a Server Component — middleware refreshes the session
          }
        },
      },
    },
  );
}

export function isAllowed(email: string | undefined | null): boolean {
  const list = (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (!list.length) return true;
  return !!email && list.includes(email.toLowerCase());
}

export async function requireUser() {
  const sb = await serverSupabase();
  const { data } = await sb.auth.getUser();
  if (!data.user || !isAllowed(data.user.email)) return { sb, user: null };
  return { sb, user: data.user };
}
