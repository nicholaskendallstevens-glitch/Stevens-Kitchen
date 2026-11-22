import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Called every 3 days by the Vercel cron (vercel.json) so the free Supabase project
// never hits the 7-day inactivity pause.
export const dynamic = "force-dynamic";

export async function GET() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { error } = await sb.rpc("keepalive");
  return NextResponse.json({ ok: !error, error: error?.message ?? null });
}
