import "server-only";

export interface FoundSuggestion {
  title: string;
  url: string;
  source: string;
  why: string;
  minutes: number | null;
  tags: string[];
  image_url: string | null;
}

const API = "https://api.anthropic.com/v1/messages";

const SAVE_TOOL = {
  name: "save_suggestions",
  description: "Save the final list of recipe suggestions.",
  input_schema: {
    type: "object",
    properties: {
      suggestions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string", description: "Recipe title in English" },
            url: { type: "string", description: "Direct URL of the recipe page, exactly as found in search results" },
            source: { type: "string", description: "Site name, e.g. Fooby, BBC Good Food" },
            why: { type: "string", description: "One short sentence: why it's popular right now / what makes it good" },
            minutes: { type: "integer", description: "Approximate total time in minutes" },
            tags: { type: "array", items: { type: "string" }, description: "2-3 short lowercase tags" },
          },
          required: ["title", "url", "source", "why"],
        },
      },
    },
    required: ["suggestions"],
  },
};

type Block = { type: string; name?: string; input?: unknown; content?: unknown };

async function call(body: object): Promise<{ content: Block[]; stop_reason: string }> {
  const res = await fetch(API, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(50000),
  });
  if (!res.ok) throw new Error(`Claude API error ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

function collectUrls(blocks: Block[], into: Set<string>) {
  for (const b of blocks) {
    if (b.type === "web_search_tool_result" && Array.isArray(b.content)) {
      for (const r of b.content as { url?: string }[]) if (r.url) into.add(r.url.split("#")[0]);
    }
  }
}

export async function findSuggestions(opts: { count: number; avoid: string[]; month: string }): Promise<FoundSuggestion[]> {
  const model = process.env.ANTHROPIC_MODEL || "claude-haiku-5-5";
  const system =
    "You are the recipe scout for a young family in Zurich, Switzerland (two adults, a toddler, a baby on the way). " +
    "Every week you find new dinner ideas that are currently trending or seasonal AND realistically easy on a weeknight: " +
    "about 45 minutes or less, roughly 12 ingredients or fewer, everything available at Migros, Coop or Lidl. " +
    "Use web search to find real recipe pages. Only return URLs that appeared in your search results and point directly " +
    "to a single recipe (not a list/roundup or category page). Prefer sites with good recipe pages: fooby.ch, swissmilk.ch, " +
    "bettybossi.ch, migusto.migros.ch, bbcgoodfood.com, recipetineats.com, bonappetit.com, seriouseats.com, " +
    "budgetbytes.com, delicious.com.au, jamieoliver.com, ottolenghi.co.uk. Mix cuisines and proteins, include vegetarian options. " +
    "Avoid paywalled sites (e.g. NYT Cooking).";
  const user =
    `It's ${opts.month}. Find ${opts.count} recipe ideas for this week: roughly a third from Swiss sites, the rest international ` +
    `and currently popular/trending. Do not suggest any of these (already known): ${opts.avoid.slice(0, 80).join("; ") || "none"}. ` +
    `Search a few times, then call save_suggestions once with the final list.`;

  const tools = [{ type: "web_search_20250305", name: "web_search", max_uses: 4 }, SAVE_TOOL];
  const messages: { role: string; content: unknown }[] = [{ role: "user", content: user }];
  const seen = new Set<string>();

  for (let round = 0; round < 4; round++) {
    const forceSave = round === 3;
    const res = await call({
      model,
      max_tokens: 4096,
      system,
      tools,
      tool_choice: forceSave ? { type: "tool", name: "save_suggestions" } : { type: "auto" },
      messages,
    });
    collectUrls(res.content, seen);
    const save = res.content.find((b) => b.type === "tool_use" && b.name === "save_suggestions");
    if (save) {
      const items = ((save.input as { suggestions?: FoundSuggestion[] })?.suggestions ?? []).slice(0, opts.count + 2);
      return await verify(items, seen);
    }
    messages.push({ role: "assistant", content: res.content });
    if (res.stop_reason !== "pause_turn") {
      messages.push({ role: "user", content: "Now call save_suggestions with your final list." });
      round = 2; // next round forces the tool
    }
  }
  return [];
}

const UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

async function probe(url: string): Promise<{ ok: boolean; image: string | null }> {
  try {
    const res = await fetch(url, { headers: { "user-agent": UA, accept: "text/html" }, signal: AbortSignal.timeout(6000), redirect: "follow" });
    if (res.status === 404 || res.status === 410) return { ok: false, image: null };
    if (!res.ok) return { ok: true, image: null }; // blocked but exists
    const html = (await res.text()).slice(0, 300000);
    const img =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1] ??
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)?.[1] ??
      null;
    return { ok: true, image: img ? img.replace(/&amp;/g, "&") : null };
  } catch {
    return { ok: true, image: null };
  }
}

async function verify(items: FoundSuggestion[], seen: Set<string>): Promise<FoundSuggestion[]> {
  const clean = items
    .filter((i) => /^https?:\/\//.test(i.url ?? ""))
    .map((i) => ({ ...i, url: i.url.split("#")[0] }));
  const results = await Promise.all(
    clean.map(async (i) => {
      const p = await probe(i.url);
      // keep if Claude really found it, or the page demonstrably exists
      if (!p.ok && !seen.has(i.url)) return null;
      if (!p.ok) return null;
      return {
        title: i.title.trim(),
        url: i.url,
        source: i.source?.trim() || new URL(i.url).hostname.replace(/^www\./, ""),
        why: i.why?.trim() ?? "",
        minutes: typeof i.minutes === "number" ? i.minutes : null,
        tags: (i.tags ?? []).map((t) => t.toLowerCase()).slice(0, 3),
        image_url: p.image,
      } satisfies FoundSuggestion;
    }),
  );
  return results.filter(Boolean) as FoundSuggestion[];
}
