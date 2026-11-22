import type { Category, Ingredient } from "./types";
import { formatFamily, toBase, type Family } from "./units";
import { guessCategory, nameKey } from "./categories";

export interface PlannedRecipe {
  title: string;
  recipeServings: number;
  plannedServings: number;
  ingredients: Ingredient[];
}

export interface AggregatedItem {
  key: string;
  name: string;
  amount_text: string | null;
  qty: number | null;      // only set if exactly one family (for sorting/editing)
  unit: string | null;
  category: Category;
  staple: boolean;
  sources: string[];
}

/**
 * Turn the week's planned recipes into one shopping list:
 * - scales every recipe to the planned servings
 * - merges the same ingredient across recipes ("Zwiebeln" + "Zwiebel")
 * - adds compatible units (2 dl + 150 ml = 3.5 dl; 1 kg + 200 g = 1.2 kg)
 * - keeps incompatible amounts side by side ("2 + 100 g")
 * - flags pantry staples instead of dropping them
 */
export function aggregate(
  recipes: PlannedRecipe[],
  staples: string[],
  overrides: Record<string, Category> = {},
): AggregatedItem[] {
  const stapleKeys = new Set(staples.map((s) => nameKey(s)));
  const map = new Map<
    string,
    {
      name: string;
      category: Category | null;
      families: Map<Family, { base: number; spoonOnly: boolean }>;
      noQty: boolean;
      sources: Set<string>;
    }
  >();

  for (const r of recipes) {
    const factor = r.recipeServings > 0 ? r.plannedServings / r.recipeServings : 1;
    for (const ing of r.ingredients) {
      if (!ing.name?.trim()) continue;
      const key = nameKey(ing.name);
      if (!key) continue;
      let entry = map.get(key);
      if (!entry) {
        entry = { name: ing.name.trim(), category: ing.category ?? null, families: new Map(), noQty: false, sources: new Set() };
        map.set(key, entry);
      }
      entry.sources.add(r.title);
      if (!entry.category || entry.category === "other") entry.category = ing.category ?? null;
      if (ing.qty == null || Number.isNaN(ing.qty)) {
        entry.noQty = true;
        continue;
      }
      const { family, base, spoon } = toBase(ing.qty * factor, ing.unit);
      const f = entry.families.get(family) ?? { base: 0, spoonOnly: true };
      f.base += base;
      f.spoonOnly = f.spoonOnly && spoon;
      entry.families.set(family, f);
    }
  }

  const out: AggregatedItem[] = [];
  for (const [key, e] of map) {
    // order: mass, volume, then counts
    const fams = [...e.families.entries()].sort(([a], [b]) => famRank(a) - famRank(b));
    const parts = fams.map(([fam, v]) => formatFamily(fam, v.base, v.spoonOnly)).filter(Boolean);
    const category = overrides[key] ?? (e.category && e.category !== "other" ? e.category : guessCategory(e.name, overrides));
    let qty: number | null = null;
    let unit: string | null = null;
    if (fams.length === 1) {
      qty = Number(fams[0][1].base.toFixed(2));
      unit = fams[0][0];
    }
    out.push({
      key,
      name: e.name,
      amount_text: parts.join(" + ") || null,
      qty,
      unit,
      category,
      staple: stapleKeys.has(key) || [...stapleKeys].some((s) => s && key === s),
      sources: [...e.sources],
    });
  }
  out.sort((a, b) => a.name.localeCompare(b.name, "de"));
  return out;
}

function famRank(f: Family): number {
  if (f === "mass") return 0;
  if (f === "volume") return 1;
  return 2;
}

export function shareText(
  title: string,
  groups: { label: string; items: { name: string; amount_text: string | null; checked: boolean }[] }[],
): string {
  const lines = [title, ""];
  for (const g of groups) {
    const open = g.items.filter((i) => !i.checked);
    if (!open.length) continue;
    lines.push(g.label.toUpperCase());
    for (const i of open) lines.push(`• ${i.amount_text ? i.amount_text + " " : ""}${i.name}`);
    lines.push("");
  }
  return lines.join("\n").trim();
}
