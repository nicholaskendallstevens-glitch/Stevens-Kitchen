// Extract a schema.org/Recipe from a web page's HTML.
// Works for Fooby, Swissmilk, Betty Bossi, Migusto, Chefkoch, BBC Good Food,
// NYT Cooking, most WordPress food blogs (WP Recipe Maker, Tasty Recipes) ...

export interface ScrapedRecipe {
  title: string;
  description: string | null;
  image_url: string | null;
  servings: number | null;
  prep_minutes: number | null;
  cook_minutes: number | null;
  total_minutes: number | null;
  ingredientLines: string[];
  steps: string[];
  tags: string[];
}

export function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&frac12;/g, "½")
    .replace(/&frac14;/g, "¼")
    .replace(/&frac34;/g, "¾")
    .replace(/&amp;/g, "&");
}

function text(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return decodeEntities(v).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (typeof v === "number") return String(v);
  if (Array.isArray(v)) return v.map(text).filter(Boolean).join(", ");
  if (typeof v === "object" && v && "name" in v) return text((v as { name: unknown }).name);
  if (typeof v === "object" && v && "text" in v) return text((v as { text: unknown }).text);
  return "";
}

/** ISO 8601 duration "PT1H30M" -> 90 */
export function parseDuration(v: unknown): number | null {
  if (typeof v !== "string") return null;
  const m = v.match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/i);
  if (!m) return null;
  const mins = (Number(m[1] ?? 0) * 24 + Number(m[2] ?? 0)) * 60 + Number(m[3] ?? 0) + Math.round(Number(m[4] ?? 0) / 60);
  return mins > 0 ? mins : null;
}

function parseYield(v: unknown): number | null {
  const s = Array.isArray(v) ? v.map(String).join(" ") : String(v ?? "");
  const m = s.match(/\d+/);
  return m ? Number(m[0]) : null;
}

function image(v: unknown): string | null {
  if (!v) return null;
  if (typeof v === "string") return v;
  if (Array.isArray(v)) {
    // pick the largest if objects carry width
    const imgs = v.map((x) => (typeof x === "string" ? { url: x, w: 0 } : { url: (x as { url?: string }).url, w: Number((x as { width?: number }).width ?? 0) }));
    imgs.sort((a, b) => b.w - a.w);
    return imgs.find((i) => i.url)?.url ?? null;
  }
  if (typeof v === "object" && "url" in (v as object)) return String((v as { url: string }).url);
  return null;
}

function instructions(v: unknown): string[] {
  const out: string[] = [];
  const walk = (x: unknown) => {
    if (!x) return;
    if (typeof x === "string") {
      // some sites put all steps in one string separated by newlines or numbers
      const parts = decodeEntities(x)
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p>/gi, "\n")
        .replace(/<[^>]+>/g, "")
        .split(/\n+|(?:^|\s)(?=\d+\.\s)/)
        .map((p) => p.replace(/^\d+\.\s*/, "").trim())
        .filter((p) => p.length > 1);
      out.push(...parts);
      return;
    }
    if (Array.isArray(x)) return x.forEach(walk);
    if (typeof x === "object") {
      const o = x as Record<string, unknown>;
      const type = String(o["@type"] ?? "");
      if (type.includes("HowToSection")) {
        if (o.name) out.push(`— ${text(o.name)} —`);
        walk(o.itemListElement);
        return;
      }
      if (o.text) return walk(String(o.text));
      if (o.name) return walk(String(o.name));
      if (o.itemListElement) return walk(o.itemListElement);
    }
  };
  walk(v);
  return out;
}

function isRecipe(o: unknown): o is Record<string, unknown> {
  if (!o || typeof o !== "object") return false;
  const t = (o as Record<string, unknown>)["@type"];
  return t === "Recipe" || (Array.isArray(t) && t.includes("Recipe"));
}

function findRecipe(node: unknown): Record<string, unknown> | null {
  if (!node) return null;
  if (Array.isArray(node)) {
    for (const n of node) {
      const r = findRecipe(n);
      if (r) return r;
    }
    return null;
  }
  if (typeof node !== "object") return null;
  if (isRecipe(node)) return node as Record<string, unknown>;
  const o = node as Record<string, unknown>;
  for (const k of ["@graph", "mainEntity", "mainEntityOfPage", "itemListElement", "item"]) {
    const r = findRecipe(o[k]);
    if (r) return r;
  }
  return null;
}

export function extractJsonLdRecipe(html: string): ScrapedRecipe | null {
  const scripts = [...html.matchAll(/<script[^>]*type=["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi)];
  for (const s of scripts) {
    let data: unknown;
    const raw = s[1].trim().replace(/^<!\[CDATA\[|\]\]>$/g, "");
    try {
      data = JSON.parse(raw);
    } catch {
      try {
        // some sites have trailing commas or raw newlines inside strings
        data = JSON.parse(raw.replace(/,\s*([}\]])/g, "$1").replace(/[\r\n\t]+/g, " "));
      } catch {
        continue;
      }
    }
    const r = findRecipe(data);
    if (!r) continue;

    const ingredientLines = (Array.isArray(r.recipeIngredient) ? r.recipeIngredient : Array.isArray(r.ingredients) ? r.ingredients : [])
      .map((x: unknown) => text(x))
      .filter(Boolean);

    const keywords = typeof r.keywords === "string" ? r.keywords.split(",") : Array.isArray(r.keywords) ? r.keywords.map(String) : [];
    const cats = [r.recipeCategory, r.recipeCuisine].flatMap((c) => (Array.isArray(c) ? c : c ? [c] : [])).map(text);
    const tags = [...new Set([...cats, ...keywords].map((t) => t.trim().toLowerCase()).filter((t) => t && t.length < 25))].slice(0, 6);

    return {
      title: text(r.name) || "Untitled recipe",
      description: text(r.description) || null,
      image_url: image(r.image),
      servings: parseYield(r.recipeYield),
      prep_minutes: parseDuration(r.prepTime),
      cook_minutes: parseDuration(r.cookTime),
      total_minutes: parseDuration(r.totalTime),
      ingredientLines,
      steps: instructions(r.recipeInstructions),
      tags,
    };
  }
  return null;
}

/** Fallback metadata when there's no structured recipe (for the AI step). */
export function extractMeta(html: string): { title: string | null; image: string | null } {
  const og = (p: string) =>
    html.match(new RegExp(`<meta[^>]+property=["']og:${p}["'][^>]+content=["']([^"']+)["']`, "i"))?.[1] ??
    html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:${p}["']`, "i"))?.[1] ??
    null;
  const title = og("title") ?? html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? null;
  return { title: title ? decodeEntities(title).trim() : null, image: og("image") };
}

/** Readable text of a page for the AI fallback (scripts/styles/nav stripped). */
export function htmlToText(html: string, maxChars = 40000): string {
  return decodeEntities(
    html
      .replace(/<(script|style|noscript|svg|nav|footer|header|iframe)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<(br|p|div|li|h\d|tr)[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim()
    .slice(0, maxChars);
}
