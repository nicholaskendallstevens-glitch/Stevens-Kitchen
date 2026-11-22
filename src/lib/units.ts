import type { Unit } from "./types";

/* ------------------------------------------------------------------------ */
/* Unit aliases (German, English, a bit of French — Swiss recipe sites)     */
/* ------------------------------------------------------------------------ */

type Conversion = { unit: Unit; factor: number };

// Alias -> canonical unit (+ factor when converting imperial to metric)
const UNIT_ALIASES: Record<string, Conversion> = {};
function alias(unit: Unit, factor: number, ...names: string[]) {
  for (const n of names) UNIT_ALIASES[n] = { unit, factor };
}

alias("g", 1, "g", "gr", "gram", "grams", "gramm", "grammes", "gramme");
alias("kg", 1, "kg", "kilo", "kilos", "kilogram", "kilograms", "kilogramm");
alias("ml", 1, "ml", "milliliter", "milliliters", "millilitre", "millilitres");
alias("ml", 10, "cl", "centiliter", "centilitre");
alias("dl", 1, "dl", "deziliter", "deciliter", "decilitre");
alias("l", 1, "l", "lt", "liter", "liters", "litre", "litres");
alias("tsp", 1, "tl", "teelöffel", "tsp", "tsps", "teaspoon", "teaspoons", "cc", "c.c.", "kl", "kaffeelöffel");
alias("tbsp", 1, "el", "esslöffel", "tbsp", "tbsps", "tbs", "tablespoon", "tablespoons", "cs", "c.s.");
alias("pinch", 1, "prise", "prisen", "pinch", "pinches", "msp", "msp.", "messerspitze", "dash", "pincée");
alias("pc", 1, "stk", "stk.", "stück", "stueck", "pc", "pcs", "piece", "pieces", "pce", "pièce", "pièces");
alias("clove", 1, "zehe", "zehen", "clove", "cloves", "gousse", "gousses");
alias("bunch", 1, "bund", "bunch", "bunches", "bouquet");
alias("can", 1, "dose", "dosen", "büchse", "büchsen", "can", "cans", "tin", "tins", "boîte");
alias("pack", 1, "packung", "packungen", "pack", "packs", "päckchen", "pkg", "pkg.", "package", "packages",
  "beutel", "btl", "btl.", "sachet", "sachets", "becher", "tub", "tubs", "paket", "pck", "pck.");
alias("jar", 1, "glas", "gläser", "jar", "jars", "bocal");
alias("slice", 1, "scheibe", "scheiben", "slice", "slices", "tranche", "tranches");
alias("sprig", 1, "zweig", "zweige", "zweiglein", "sprig", "sprigs", "brin", "brins");
alias("handful", 1, "handvoll", "handful", "handfuls", "poignée");
alias("head", 1, "kopf", "köpfe", "head", "heads");
alias("stalk", 1, "stange", "stangen", "stängel", "stalk", "stalks", "stick_celery");

// Imperial / US -> metric (converted on import so everything is Swiss units)
alias("ml", 240, "cup", "cups", "tasse", "tassen", "c.");
alias("g", 28.35, "oz", "ounce", "ounces");
alias("ml", 29.57, "floz", "fl.oz", "fl oz", "fl. oz.");
alias("g", 453.6, "lb", "lbs", "pound", "pounds");
alias("ml", 568, "pint", "pints", "pt"); // UK pint (US: 473 ml)
alias("ml", 946, "quart", "quarts", "qt");
alias("g", 113, "stick", "sticks"); // stick of butter

export const UNIT_LABEL: Record<Unit, [string, string]> = {
  g: ["g", "g"],
  kg: ["kg", "kg"],
  ml: ["ml", "ml"],
  dl: ["dl", "dl"],
  l: ["l", "l"],
  tsp: ["tsp", "tsp"],
  tbsp: ["tbsp", "tbsp"],
  pinch: ["pinch", "pinches"],
  pc: ["", ""],
  clove: ["clove", "cloves"],
  bunch: ["bunch", "bunches"],
  can: ["can", "cans"],
  pack: ["pack", "packs"],
  jar: ["jar", "jars"],
  slice: ["slice", "slices"],
  sprig: ["sprig", "sprigs"],
  handful: ["handful", "handfuls"],
  head: ["head", "heads"],
  stalk: ["stalk", "stalks"],
  cup_metric: ["cup", "cups"],
};

export const UNIT_OPTIONS: Unit[] = [
  "g", "kg", "ml", "dl", "l", "tsp", "tbsp", "pinch", "pc", "clove", "bunch",
  "can", "pack", "jar", "slice", "sprig", "handful", "head", "stalk",
];

export function lookupUnit(token: string): Conversion | null {
  const t = token.toLowerCase().replace(/\.$/, "");
  return UNIT_ALIASES[t] ?? UNIT_ALIASES[token.toLowerCase()] ?? null;
}

/* ------------------------------------------------------------------------ */
/* Quantities                                                               */
/* ------------------------------------------------------------------------ */

const UNICODE_FRACTIONS: Record<string, number> = {
  "½": 0.5, "⅓": 1 / 3, "⅔": 2 / 3, "¼": 0.25, "¾": 0.75, "⅕": 0.2,
  "⅖": 0.4, "⅗": 0.6, "⅘": 0.8, "⅙": 1 / 6, "⅚": 5 / 6, "⅛": 0.125,
  "⅜": 0.375, "⅝": 0.625, "⅞": 0.875,
};

const NUMBER_WORDS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, eight: 8,
  ten: 10, twelve: 12, dozen: 12, half: 0.5,
  ein: 1, eine: 1, einen: 1, einem: 1, zwei: 2, drei: 3, vier: 4, fünf: 5,
  sechs: 6, acht: 8, zehn: 10, halbe: 0.5, halber: 0.5, halbes: 0.5,
  un: 1, une: 1, deux: 2, trois: 3,
};

/** Normalise unicode fractions and decimal commas so the regex can handle them. */
function normaliseNumbers(s: string): string {
  let out = s.replace(/(\d)\s*([½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])/g, (_, d, f) => `${d}+${UNICODE_FRACTIONS[f]}`);
  out = out.replace(/[½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]/g, (f) => String(UNICODE_FRACTIONS[f]));
  out = out.replace(/⁄/g, "/");
  out = out.replace(/(\d),(\d)/g, "$1.$2");
  return out;
}

const NUM = String.raw`\d+(?:\.\d+)?(?:\+\d*\.?\d+)?(?:\s+\d+\/\d+|\/\d+)?`;
const QTY_RE = new RegExp(
  String.raw`^\s*(${NUM})(?:\s*(?:-|–|—|bis|to|à|or|oder)\s*(${NUM}))?`,
  "i",
);

function evalNum(s: string): number {
  s = s.trim();
  if (s.includes("+")) return s.split("+").reduce((a, b) => a + evalNum(b), 0);
  const mixed = s.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  const frac = s.match(/^(\d+)\/(\d+)$/);
  if (frac) return Number(frac[1]) / Number(frac[2]);
  return Number(s);
}

export interface ParsedQty {
  qty: number | null;
  rest: string;
}

/** Parse a leading quantity. Ranges ("1-2") use the upper bound — safer for shopping. */
export function parseLeadingQty(input: string): ParsedQty {
  const s = normaliseNumbers(input);
  const m = s.match(QTY_RE);
  if (m) {
    const a = evalNum(m[1]);
    const b = m[2] ? evalNum(m[2]) : null;
    return { qty: b && b > a ? b : a, rest: s.slice(m[0].length) };
  }
  const word = s.match(/^\s*([a-zäöüéè]+)\b\s*/i);
  if (word) {
    const w = word[1].toLowerCase();
    if (w in NUMBER_WORDS) {
      // "a pinch", "an onion", "ein Bund" — only treat as number if followed by something
      return { qty: NUMBER_WORDS[w], rest: s.slice(word[0].length) };
    }
  }
  return { qty: null, rest: s };
}

/* ------------------------------------------------------------------------ */
/* Swiss formatting                                                         */
/* ------------------------------------------------------------------------ */

const NICE_FRACTIONS: [number, string][] = [
  [0.25, "¼"], [1 / 3, "⅓"], [0.5, "½"], [2 / 3, "⅔"], [0.75, "¾"],
];

function roundTo(n: number, step: number) {
  return Math.round(n / step) * step;
}

function trimNum(n: number, decimals = 2): string {
  return String(Number(n.toFixed(decimals)));
}

/** "1.5" -> "1½" for spoon/piece units; decimals for metric. */
export function formatCount(n: number): string {
  const whole = Math.floor(n + 1e-9);
  const frac = n - whole;
  if (frac < 0.06) return String(whole);
  if (frac > 0.94) return String(whole + 1);
  for (const [v, sym] of NICE_FRACTIONS) {
    if (Math.abs(frac - v) < 0.06) return whole ? `${whole}${sym}` : sym;
  }
  return trimNum(n, 1);
}

/**
 * Convert metric amounts into the unit a Swiss recipe would use:
 * 1500 g -> 1.5 kg, 250 ml -> 2.5 dl, 1200 ml -> 1.2 l
 */
export function normaliseMetric(qty: number, unit: Unit): { qty: number; unit: Unit } {
  if (unit === "kg") return normaliseMetric(qty * 1000, "g");
  if (unit === "dl") return normaliseMetric(qty * 100, "ml");
  if (unit === "l") return normaliseMetric(qty * 1000, "ml");
  if (unit === "g") {
    if (qty >= 1000) return { qty: roundTo(qty / 1000, 0.05), unit: "kg" };
    if (qty >= 100) return { qty: roundTo(qty, 5), unit: "g" };
    if (qty >= 10) return { qty: Math.round(qty), unit: "g" };
    return { qty: Number(qty.toFixed(1)), unit: "g" };
  }
  if (unit === "ml") {
    if (qty >= 1000) return { qty: roundTo(qty / 1000, 0.05), unit: "l" };
    if (qty >= 100) return { qty: roundTo(qty / 100, 0.25), unit: "dl" };
    if (qty >= 10) return { qty: roundTo(qty, 5), unit: "ml" };
    return { qty: Number(qty.toFixed(1)), unit: "ml" };
  }
  return { qty, unit };
}

export function formatAmount(qty: number | null, unit: Unit | null): string {
  if (qty == null || Number.isNaN(qty)) return unit && unit !== "pc" ? UNIT_LABEL[unit][0] : "";
  if (!unit || unit === "pc") return formatCount(qty);
  if (["g", "kg", "ml", "dl", "l"].includes(unit)) {
    const n = normaliseMetric(qty, unit);
    return `${trimNum(n.qty)} ${n.unit}`;
  }
  const [one, many] = UNIT_LABEL[unit];
  return `${formatCount(qty)} ${qty > 1.01 ? many : one}`;
}

/** Scale an amount for a different number of servings. */
export function scaleQty(qty: number | null, from: number, to: number): number | null {
  if (qty == null || !from || from === to) return qty;
  return (qty * to) / from;
}

/* ------------------------------------------------------------------------ */
/* Oven temperatures in step text: 350°F -> 175 °C                           */
/* ------------------------------------------------------------------------ */

const GAS_MARK: Record<number, number> = { 1: 140, 2: 150, 3: 170, 4: 180, 5: 190, 6: 200, 7: 220, 8: 230, 9: 240 };

export function fahrenheitToCelsiusInText(text: string): string {
  // UK: "gas mark 6" / "gas 6" -> "200 °C (gas 6)"; skip if °C is already given right before
  text = text.replace(/(\d{2,3}\s*°?\s*C[^.;]{0,25}?)?\bgas(?:\s*mark)?\s*(\d)\b/gi, (m, before, g) =>
    before ? m : `${GAS_MARK[Number(g)] ?? ""} °C (gas ${g})`,
  );
  return text.replace(
    /(\d{3})\s*(?:°|º|degrees?)\s*F(?:ahrenheit)?\b/gi,
    (_, f) => `${roundTo(((Number(f) - 32) * 5) / 9, 5)} °C`,
  );
}

/* ------------------------------------------------------------------------ */
/* Unit families for aggregation                                            */
/* ------------------------------------------------------------------------ */

export type Family = "mass" | "volume" | `count:${string}`;

export function toBase(qty: number, unit: Unit | null): { family: Family; base: number; spoon: boolean } {
  switch (unit) {
    case "g": return { family: "mass", base: qty, spoon: false };
    case "kg": return { family: "mass", base: qty * 1000, spoon: false };
    case "ml": return { family: "volume", base: qty, spoon: false };
    case "dl": return { family: "volume", base: qty * 100, spoon: false };
    case "l": return { family: "volume", base: qty * 1000, spoon: false };
    case "tsp": return { family: "volume", base: qty * 5, spoon: true };
    case "tbsp": return { family: "volume", base: qty * 15, spoon: true };
    case "cup_metric": return { family: "volume", base: qty * 240, spoon: false };
    default: return { family: `count:${unit ?? "pc"}`, base: qty, spoon: false };
  }
}

export function formatFamily(family: Family, base: number, spoonOnly: boolean): string {
  if (family === "mass") return formatAmount(base, "g");
  if (family === "volume") {
    if (spoonOnly && base < 100) {
      if (base >= 15) return formatAmount(roundTo(base / 15, 0.5), "tbsp");
      return formatAmount(roundTo(base / 5, 0.25), "tsp");
    }
    return formatAmount(base, "ml");
  }
  const unit = family.slice(6) as Unit;
  return formatAmount(base, unit);
}
