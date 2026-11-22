import type { Category, RecipeDraft } from "../types";
import type { ScrapedRecipe } from "./jsonld";
import { parseIngredientBlock } from "../ingredients";
import { fahrenheitToCelsiusInText } from "../units";

export function scrapedToDraft(
  s: ScrapedRecipe,
  sourceUrl: string | null,
  defaultServings: number,
  overrides?: Record<string, Category>,
): RecipeDraft {
  const ingredients = parseIngredientBlock(s.ingredientLines.join("\n"), overrides);
  const total =
    s.total_minutes ?? (s.prep_minutes || s.cook_minutes ? (s.prep_minutes ?? 0) + (s.cook_minutes ?? 0) : null);
  const tags = [...s.tags];
  if (total && total <= 30 && !tags.includes("quick")) tags.push("quick");
  return {
    title: s.title.trim(),
    description: s.description,
    image_url: s.image_url,
    source_url: sourceUrl,
    servings: s.servings && s.servings < 50 ? s.servings : defaultServings,
    prep_minutes: s.prep_minutes,
    cook_minutes: s.cook_minutes,
    total_minutes: total,
    ingredients,
    steps: s.steps.map(fahrenheitToCelsiusInText),
    tags: tags.slice(0, 8),
    notes: null,
    favorite: false,
    rating: null,
  };
}
