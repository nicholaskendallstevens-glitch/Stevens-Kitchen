import "server-only";
import type { ScrapedRecipe } from "./jsonld";

const API = "https://api.anthropic.com/v1/messages";

export function aiEnabled() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

const RECIPE_TOOL = {
  name: "save_recipe",
  description: "Save the extracted recipe.",
  input_schema: {
    type: "object",
    properties: {
      found: { type: "boolean", description: "false if the content does not contain a recipe" },
      title: { type: "string" },
      description: { type: "string", description: "One or two sentences, optional" },
      servings: { type: "integer" },
      prep_minutes: { type: "integer" },
      cook_minutes: { type: "integer" },
      total_minutes: { type: "integer" },
      ingredients: {
        type: "array",
        items: { type: "string" },
        description:
          "One ingredient per line exactly like a recipe card: quantity, unit, name, then note after a comma. " +
          "Use metric Swiss units (g, kg, ml, dl, l, tsp, tbsp, pinch). Convert cups/oz/lb to metric. " +
          'Example: "2.5 dl cream", "1 onion, finely chopped". ' +
          'Group headings end with a colon on their own line, e.g. "For the sauce:".',
      },
      steps: { type: "array", items: { type: "string" }, description: "Method steps; temperatures in °C" },
      tags: {
        type: "array",
        items: { type: "string" },
        description: "Up to 4 short lowercase tags, e.g. vegetarian, pasta, quick, kid-friendly, soup",
      },
    },
    required: ["found", "title", "ingredients", "steps"],
  },
} as const;

type ToolOut = {
  found: boolean;
  title: string;
  description?: string;
  servings?: number;
  prep_minutes?: number;
  cook_minutes?: number;
  total_minutes?: number;
  ingredients: string[];
  steps: string[];
  tags?: string[];
};

type Content =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: string; data: string } };

async function callClaude(content: Content[], system: string): Promise<ToolOut> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY is not set");
  const res = await fetch(API, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || "claude-haiku-5-5",
      max_tokens: 4096,
      system,
      tools: [RECIPE_TOOL],
      tool_choice: { type: "tool", name: "save_recipe" },
      messages: [{ role: "user", content }],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Claude API error ${res.status}: ${body.slice(0, 300)}`);
  }
  const json = (await res.json()) as { content: { type: string; input?: ToolOut }[] };
  const tool = json.content.find((c) => c.type === "tool_use");
  if (!tool?.input) throw new Error("No recipe returned");
  return tool.input;
}

function toScraped(o: ToolOut): ScrapedRecipe {
  return {
    title: o.title || "Untitled recipe",
    description: o.description || null,
    image_url: null,
    servings: o.servings ?? null,
    prep_minutes: o.prep_minutes ?? null,
    cook_minutes: o.cook_minutes ?? null,
    total_minutes: o.total_minutes ?? null,
    ingredientLines: o.ingredients ?? [],
    steps: o.steps ?? [],
    tags: (o.tags ?? []).map((t) => t.toLowerCase()),
  };
}

const BASE_SYSTEM =
  "You extract cooking recipes for a Swiss household's recipe app. Be faithful to the source: " +
  "never invent ingredients or steps. Use metric Swiss units (g, kg, ml, dl, l, tsp, tbsp). " +
  "Oven temperatures in °C. Write numbers with a decimal point (2.5 not 2,5).";

function langRule(translate: boolean) {
  return translate
    ? " Translate everything into natural British English (keep Swiss product names like Halbrahm → 'half cream (Halbrahm)' the first time)."
    : " Keep the recipe's original language.";
}

export async function recipeFromPageText(pageText: string, url: string, translate: boolean) {
  const out = await callClaude(
    [{ type: "text", text: `Source URL: ${url}\n\nPage content:\n${pageText}` }],
    BASE_SYSTEM + langRule(translate),
  );
  if (!out.found) throw new Error("No recipe found on that page");
  return toScraped(out);
}

export async function recipeFromText(text: string, translate: boolean) {
  const out = await callClaude([{ type: "text", text }], BASE_SYSTEM + langRule(translate));
  if (!out.found) throw new Error("That text doesn't look like a recipe");
  return toScraped(out);
}

export async function recipeFromImages(images: { media_type: string; data: string }[], translate: boolean) {
  const content: Content[] = images.map((img) => ({
    type: "image",
    source: { type: "base64", media_type: img.media_type, data: img.data },
  }));
  content.push({
    type: "text",
    text: "These are photos of a recipe (cookbook page, handwritten card or screenshot). Extract it. If several photos, they are consecutive pages of the same recipe.",
  });
  const out = await callClaude(content, BASE_SYSTEM + langRule(translate));
  if (!out.found) throw new Error("Couldn't find a recipe in the photo");
  return toScraped(out);
}

export async function translateRecipe(r: ScrapedRecipe): Promise<ScrapedRecipe> {
  const payload = JSON.stringify({
    title: r.title,
    description: r.description,
    ingredients: r.ingredientLines,
    steps: r.steps,
    tags: r.tags,
  });
  const out = await callClaude(
    [{ type: "text", text: `Translate this recipe JSON to English. Keep quantities and units exactly.\n${payload}` }],
    BASE_SYSTEM + langRule(true),
  );
  return {
    ...r,
    title: out.title || r.title,
    description: out.description ?? r.description,
    ingredientLines: out.ingredients?.length ? out.ingredients : r.ingredientLines,
    steps: out.steps?.length ? out.steps : r.steps,
    tags: out.tags?.length ? out.tags.map((t) => t.toLowerCase()) : r.tags,
  };
}
