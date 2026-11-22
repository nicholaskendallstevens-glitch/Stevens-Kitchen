import type { Category, Ingredient, Unit } from "./types";
import { lookupUnit, parseLeadingQty } from "./units";
import { guessCategory } from "./categories";

export function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const SIZE_WORDS = /^(large|big|small|medium|extra-large|grosse?[rsn]?|kleine?[rsn]?|mittelgrosse?[rsn]?)\s+/i;

function clean(s: string): string {
  return s
    .replace(/ /g, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .replace(/^[-•*·▢☐□]\s*/, "")
    .trim();
}

/**
 * Parse a free-text ingredient line into structured data, converting imperial
 * units to metric.
 *   "2½ dl Vollrahm"              -> 2.5 dl, "Vollrahm"
 *   "1 Zwiebel, fein gehackt"     -> 1, "Zwiebel", note "fein gehackt"
 *   "2 cups all-purpose flour"    -> 480 ml (cups are volume), "all-purpose flour"
 *   "1 (400 g) can tomatoes"      -> 1 can, "tomatoes", note "400 g"
 *   "Salz, Pfeffer"               -> no qty, "Salz, Pfeffer"
 */
export function parseIngredient(rawInput: string, overrides?: Record<string, Category>): Ingredient {
  const raw = clean(rawInput);
  let s = raw;

  // French spoon notations before generic aliases
  s = s.replace(/\bc\.?\s*à\s*(?:s\.?|soupe)\b/i, "cs").replace(/\bc\.?\s*à\s*(?:c\.?|café)\b/i, "cc");
  s = s.replace(/\bfl\.?\s*oz\.?\b/i, "floz");

  const { qty: q, rest: afterQty } = parseLeadingQty(s);
  let qty = q;
  let rest = afterQty.trim();
  let unit: Unit | null = null;
  const notes: string[] = [];
  let fromCup = false;

  // "1 (14 oz) can tomatoes" / "1 Dose (400 g) Tomaten"
  const paren = rest.match(/^\(([^)]*)\)\s*/);
  if (paren) {
    notes.push(paren[1]);
    rest = rest.slice(paren[0].length);
  }

  if (qty != null || /^[a-zäöü.]+\s/i.test(rest)) {
    // unit directly attached ("250g") or as next token
    const m = rest.match(/^([a-zäöüéèà.]+'?)(?=\s|$|\()/i);
    if (m) {
      const conv = lookupUnit(m[1]);
      // a bare "l"/"g"/"c." without a quantity is probably not a unit ("Lauch")
      if (conv && (qty != null || m[1].length > 2)) {
        unit = conv.unit;
        if (qty != null) qty = qty * conv.factor;
        if (conv.factor === 240) fromCup = true;
        rest = rest.slice(m[0].length).trim();
      }
    }
  }

  // second parenthesis after the unit: "1 Dose (400 g) Tomaten"
  const paren2 = rest.match(/^\(([^)]*)\)\s*/);
  if (paren2) {
    notes.push(paren2[1]);
    rest = rest.slice(paren2[0].length);
  }

  rest = rest.replace(/^(of|de|d'|von)\s+/i, "");
  // trailing / inline parentheses -> note
  rest = rest.replace(/\s*\(([^)]*)\)\s*/g, (_, n) => {
    notes.push(n);
    return " ";
  }).trim();

  // split "Zwiebel, fein gehackt" (only if there is a quantity — "Salz, Pfeffer" stays intact)
  let name = rest;
  if (qty != null || unit) {
    const comma = rest.indexOf(",");
    if (comma > 0) {
      name = rest.slice(0, comma).trim();
      notes.push(rest.slice(comma + 1).trim());
    }
  }
  // move size adjectives to the note ("3 large eggs" -> "eggs", note "large")
  const size = name.match(SIZE_WORDS);
  if (size && name.length > size[0].length) {
    notes.unshift(size[1].toLowerCase());
    name = name.slice(size[0].length);
  }
  name = name.replace(/\s+/g, " ").trim();
  if (!name) name = raw;
  name = name.charAt(0).toUpperCase() + name.slice(1);

  // US cups of dry goods -> grams (Swiss recipes weigh flour & sugar)
  if (fromCup && qty != null) {
    const density = cupDensity(name);
    if (density) {
      qty = (qty / 240) * density;
      unit = "g";
    }
  }

  if (qty != null) qty = Math.round(qty * 1000) / 1000;

  return {
    id: uid(),
    raw,
    qty,
    unit,
    name,
    note: notes.filter(Boolean).join(", ") || null,
    category: guessCategory(name, overrides),
    group: null,
  };
}

/** Parse a block of lines; lines ending with ":" become group headings. */
export function parseIngredientBlock(text: string, overrides?: Record<string, Category>): Ingredient[] {
  const out: Ingredient[] = [];
  let group: string | null = null;
  for (const line of text.split(/\r?\n/)) {
    const l = clean(line);
    if (!l) continue;
    if (/:$/.test(l) && l.length < 60 && !/^\d/.test(l)) {
      group = l.replace(/:$/, "");
      continue;
    }
    out.push({ ...parseIngredient(l, overrides), group });
  }
  return out;
}

// grams per US cup
const CUP_DENSITIES: [RegExp, number][] = [
  [/powdered sugar|icing sugar|confectioners/i, 120],
  [/brown sugar/i, 220],
  [/sugar|zucker/i, 200],
  [/flour|mehl/i, 125],
  [/butter/i, 227],
  [/oats|haferflocken/i, 90],
  [/cocoa|kakao/i, 85],
  [/rice|reis/i, 185],
  [/cheese|käse|parmesan/i, 100],
  [/chocolate chips|schokolade/i, 170],
  [/nuts|nüsse|almonds|mandeln|walnuts|pecans/i, 120],
  [/breadcrumbs|panko|paniermehl/i, 110],
  [/quinoa|couscous|lentils|linsen/i, 180],
];

function cupDensity(name: string): number | null {
  for (const [re, d] of CUP_DENSITIES) if (re.test(name)) return d;
  return null;
}

export function ingredientToLine(i: Ingredient): string {
  return i.raw || i.name;
}
