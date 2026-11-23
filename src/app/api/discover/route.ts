import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { findSuggestions, pickThemes } from "@/lib/discover";
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
    const norm = (u: string) => u.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "").toLowerCase();
    const known = new Set([...knownUrls].map((u) => norm(String(u))));
    const knownTitles = new Set(avoid.map((t) => t.toLowerCase()));
    const fresh = (list: Awaited<ReturnType<typeof findSuggestions>>) =>
      list.filter((s) => !known.has(norm(s.url)) && !knownTitles.has(s.title.toLowerCase()));
    const avoidUrls = [...knownUrls].map(String);

    // "more": search in new directions so we don't just find last time's results again
    const t0 = Date.now();
    let found = fresh(await findSuggestions({ count: 8, avoid, avoidUrls, month, themes: more ? pickThemes(2) : undefined }));
    // second attempt only if there's time left (Vercel stops functions after 60 s)
    if (found.length < 5 && Date.now() - t0 < 25000) {
      found = [...found, ...fresh(await findSuggestions({ count: 6, avoid, avoidUrls, month, themes: pickThemes(2) }))];
    }
    // de-duplicate within this batch
    found = found.filter((s, i) => found.findIndex((x) => norm(x.url) === norm(s.url)) === i);
    if (!found.length) return NextResponse.json({ error: "Only found ideas you already have — try again in a moment." }, { status: 422 });
    const { error } = await sb.from("suggestions").insert(found.map((s) => ({ ...s, week_start: week })));
    if (error) throw new Error(error.message);
    return NextResponse.json({ added: found.length });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}
