import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { extractJsonLdRecipe, extractMeta, htmlToText, type ScrapedRecipe } from "@/lib/import/jsonld";
import { aiEnabled, recipeFromImages, recipeFromPageText, recipeFromText, translateRecipe } from "@/lib/import/claude";
import { scrapedToDraft } from "@/lib/import/pipeline";
import type { Category } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

type Body =
  | { mode: "url"; url: string; translate?: boolean }
  | { mode: "text"; text: string; translate?: boolean }
  | { mode: "image"; images: { media_type: string; data: string }[]; translate?: boolean };

const UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

export async function POST(req: Request) {
  const { sb, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as Body;
  const translate = Boolean(body.translate) && aiEnabled();

  const [{ data: settings }, { data: ov }] = await Promise.all([
    sb.from("settings").select("default_servings").eq("id", 1).maybeSingle(),
    sb.from("category_overrides").select("name_key, category"),
  ]);
  const defaultServings = settings?.default_servings ?? 4;
  const overrides = Object.fromEntries((ov ?? []).map((o) => [o.name_key, o.category as Category]));

  try {
    let scraped: ScrapedRecipe;
    let source: string | null = null;
    let method: "structured" | "ai" = "structured";

    if (body.mode === "url") {
      const url = new URL(body.url.trim());
      if (!/^https?:$/.test(url.protocol)) throw new Error("Only http(s) links are supported");
      source = url.toString();
      const res = await fetch(source, {
        headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml", "accept-language": "de-CH,de;q=0.9,en;q=0.8" },
        redirect: "follow",
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) throw new Error(`The site answered ${res.status}. Try copying the recipe text instead.`);
      const html = await res.text();
      const structured = extractJsonLdRecipe(html);
      if (structured && structured.ingredientLines.length) {
        scraped = structured;
        if (!scraped.image_url) scraped.image_url = extractMeta(html).image;
        if (translate) scraped = await translateRecipe(scraped);
      } else {
        if (!aiEnabled())
          throw new Error("This page has no structured recipe data. Add an ANTHROPIC_API_KEY to enable AI import, or paste the text.");
        method = "ai";
        scraped = await recipeFromPageText(htmlToText(html), source, translate);
        const meta = extractMeta(html);
        scraped.image_url = meta.image;
      }
    } else if (body.mode === "text") {
      if (!aiEnabled()) throw new Error("Text import needs an ANTHROPIC_API_KEY.");
      method = "ai";
      const urlInText = body.text.match(/https?:\/\/\S+/)?.[0] ?? null;
      source = urlInText;
      scraped = await recipeFromText(body.text.slice(0, 30000), translate);
    } else if (body.mode === "image") {
      if (!aiEnabled()) throw new Error("Photo import needs an ANTHROPIC_API_KEY.");
      if (!body.images?.length) throw new Error("No photo received");
      method = "ai";
      scraped = await recipeFromImages(body.images.slice(0, 4), translate);
    } else {
      throw new Error("Unknown import mode");
    }

    const draft = scrapedToDraft(scraped, source, defaultServings, overrides);
    return NextResponse.json({ draft, method });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Import failed";
    return NextResponse.json({ error: msg }, { status: 422 });
  }
}

export async function GET() {
  return NextResponse.json({ ai: aiEnabled() });
}
