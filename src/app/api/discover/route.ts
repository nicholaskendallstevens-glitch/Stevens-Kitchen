import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { findSuggestions } from "@/lib/discover";
import { aiEnabled } from "@/lib/import/claude";

export const runtime = "nodejs";
export const maxDuration = 60;

// POST { week, more?: boolean } → generates this week's ideas (or more of them)
export async function POST(req: Request) {
  const { sb, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!aiEnabled()) return NextResponse.json({ error: "Add ANTHROPIC_API_KEY in Vercel to get weekly ideas." }, { status: 422 });

  const { week, more } = (await req.json()) as { week: string; more?: boolean };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(week)) return NextResponse.json({ error: "Bad week" }, { status: 400 });

  const { data: existing } = await sb.from("suggestions").select("id").eq("week_start", week);
  if (existing?.length && !more) return NextResponse.json({ added: 0 });

  // never suggest the same thing twice, or something already in the recipe book
  const [{ data: past }, { data: recipes }] = await Promise.all([
    sb.from("suggestions").select("title, url").order("created_at", { ascending: false }).limit(150),
    sb.from("recipes").select("title, source_url"),
  ]);
  const knownUrls = new Set([...(past ?? []).map((p) => p.url), ...(recipes ?? []).map((r) => r.source_url).filter(Boolean)]);
  const avoid = [...(past ?? []).map((p) => p.title), ...(recipes ?? []).map((r) => r.title)];
  const month = new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  try {
    const found = (await findSuggestions({ count: 8, avoid, month })).filter((s) => !knownUrls.has(s.url));
    if (!found.length) return NextResponse.json({ error: "Couldn't find good ideas this time — try again." }, { status: 422 });
    const { error } = await sb.from("suggestions").insert(found.map((s) => ({ ...s, week_start: week })));
    if (error) throw new Error(error.message);
    return NextResponse.json({ added: found.length });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}
