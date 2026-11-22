"use client";
import { supabase } from "./supabase/client";
import type { Category, Meal, MealPlanEntry, Recipe, RecipeDraft, Settings, ShoppingItem } from "./types";
import { aggregate } from "./shopping";
import { addDays, today as todayISO } from "./dates";
import { nameKey } from "./categories";

function check<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

/* ------------------------------- recipes -------------------------------- */

export async function listRecipes(): Promise<Recipe[]> {
  return check(await supabase().from("recipes").select("*").order("title"));
}

export async function getRecipe(id: string): Promise<Recipe | null> {
  return check(await supabase().from("recipes").select("*").eq("id", id).maybeSingle());
}

export async function createRecipe(d: RecipeDraft): Promise<Recipe> {
  return check(await supabase().from("recipes").insert(d).select().single());
}

export async function updateRecipe(id: string, d: Partial<RecipeDraft>): Promise<Recipe> {
  return check(await supabase().from("recipes").update(d).eq("id", id).select().single());
}

export async function deleteRecipe(id: string) {
  check(await supabase().from("recipes").delete().eq("id", id));
}

export async function uploadRecipeImage(file: Blob): Promise<string> {
  const path = `${crypto.randomUUID()}.jpg`;
  const { error } = await supabase().storage.from("recipe-images").upload(path, file, {
    contentType: "image/jpeg",
    upsert: false,
  });
  if (error) throw new Error(error.message);
  return supabase().storage.from("recipe-images").getPublicUrl(path).data.publicUrl;
}

/** date each recipe was last on the plan (in the past) */
export async function lastCookedMap(): Promise<Record<string, string>> {
  const today = todayISO();
  const rows = check(
    await supabase().from("meal_plan").select("recipe_id, date").not("recipe_id", "is", null).lte("date", today).order("date", { ascending: false }),
  ) as { recipe_id: string; date: string }[];
  const out: Record<string, string> = {};
  for (const r of rows) if (!out[r.recipe_id]) out[r.recipe_id] = r.date;
  return out;
}

export async function cookCounts(): Promise<Record<string, number>> {
  const today = todayISO();
  const rows = check(
    await supabase().from("meal_plan").select("recipe_id").not("recipe_id", "is", null).lte("date", today),
  ) as { recipe_id: string }[];
  const out: Record<string, number> = {};
  for (const r of rows) out[r.recipe_id] = (out[r.recipe_id] ?? 0) + 1;
  return out;
}

/* ------------------------------- meal plan ------------------------------ */

const PLAN_SELECT = "*, recipe:recipes(id, title, image_url, total_minutes, servings, ingredients)";

export async function listPlan(from: string, to: string): Promise<MealPlanEntry[]> {
  return check(
    await supabase().from("meal_plan").select(PLAN_SELECT).gte("date", from).lte("date", to).order("date").order("position"),
  );
}

export async function addPlanEntry(e: {
  date: string;
  meal: Meal;
  recipe_id?: string | null;
  title?: string | null;
  servings: number;
}): Promise<MealPlanEntry> {
  return check(
    await supabase()
      .from("meal_plan")
      .insert({ ...e, position: Date.now() % 1_000_000 })
      .select(PLAN_SELECT)
      .single(),
  );
}

export async function updatePlanEntry(id: string, patch: Partial<Pick<MealPlanEntry, "date" | "meal" | "servings" | "cooked" | "title">>) {
  check(await supabase().from("meal_plan").update(patch).eq("id", id));
}

export async function deletePlanEntry(id: string) {
  check(await supabase().from("meal_plan").delete().eq("id", id));
}

export async function copyWeek(fromStart: string, toStart: string) {
  const src = await listPlan(fromStart, addDays(fromStart, 6));
  if (!src.length) return 0;
  const rows = src.map((e) => {
    const offset = Math.round((new Date(e.date).valueOf() - new Date(fromStart).valueOf()) / 86400000);
    return {
      date: addDays(toStart, offset),
      meal: e.meal,
      recipe_id: e.recipe_id,
      title: e.title,
      servings: e.servings,
      position: e.position,
    };
  });
  check(await supabase().from("meal_plan").insert(rows));
  return rows.length;
}

/* -------------------------------- settings ------------------------------ */

export async function getSettings(): Promise<Settings> {
  const s = check(await supabase().from("settings").select("*").eq("id", 1).maybeSingle()) as Settings | null;
  return s ?? { id: 1, default_store: "migros", default_servings: 4, store_orders: {} };
}

export async function saveSettings(patch: Partial<Omit<Settings, "id">>) {
  check(await supabase().from("settings").upsert({ id: 1, ...patch, updated_at: new Date().toISOString() }));
}

export async function listStaples(): Promise<{ id: string; name: string }[]> {
  return check(await supabase().from("pantry_staples").select("*").order("name"));
}
export async function addStaple(name: string) {
  check(await supabase().from("pantry_staples").upsert({ name: name.trim().toLowerCase() }, { onConflict: "name" }));
}
export async function removeStaple(id: string) {
  check(await supabase().from("pantry_staples").delete().eq("id", id));
}

export async function getOverrides(): Promise<Record<string, Category>> {
  const rows = check(await supabase().from("category_overrides").select("*")) as { name_key: string; category: Category }[];
  return Object.fromEntries(rows.map((r) => [r.name_key, r.category]));
}

export async function setOverride(name: string, category: Category) {
  check(await supabase().from("category_overrides").upsert({ name_key: nameKey(name), category }));
}

/* ------------------------------ shopping list --------------------------- */

export async function listShopping(weekStart: string): Promise<ShoppingItem[]> {
  return check(await supabase().from("shopping_items").select("*").eq("week_start", weekStart).order("name"));
}

export async function addShoppingItem(item: Partial<ShoppingItem> & { week_start: string; name: string }) {
  return check(await supabase().from("shopping_items").insert({ manual: true, ...item }).select().single()) as ShoppingItem;
}

export async function updateShoppingItem(id: string, patch: Partial<ShoppingItem>) {
  check(await supabase().from("shopping_items").update(patch).eq("id", id));
}

export async function deleteShoppingItem(id: string) {
  check(await supabase().from("shopping_items").delete().eq("id", id));
}

export async function deleteCheckedItems(weekStart: string) {
  check(await supabase().from("shopping_items").delete().eq("week_start", weekStart).eq("checked", true));
}

/**
 * Rebuild the generated part of a week's list from the plan.
 * Manual items stay; items already ticked off stay ticked if still needed.
 * `fromDate` lets you skip days already shopped for (e.g. regenerate from Wednesday).
 */
export async function generateShoppingList(weekStart: string, fromDate?: string) {
  const start = fromDate ?? weekStart;
  const [plan, staples, overrides, existing] = await Promise.all([
    listPlan(start, addDays(weekStart, 6)),
    listStaples(),
    getOverrides(),
    listShopping(weekStart),
  ]);

  const recipes = plan
    .filter((e) => e.recipe)
    .map((e) => ({
      title: e.recipe!.title,
      recipeServings: e.recipe!.servings || 4,
      plannedServings: e.servings || e.recipe!.servings || 4,
      ingredients: e.recipe!.ingredients ?? [],
    }));

  const items = aggregate(recipes, staples.map((s) => s.name), overrides);
  // keep what you already ticked off or marked as "have it"
  const prev = new Map(existing.filter((i) => !i.manual && i.key).map((i) => [i.key!, i]));

  const sb = supabase();
  check(await sb.from("shopping_items").delete().eq("week_start", weekStart).eq("manual", false));
  if (items.length) {
    check(
      await sb.from("shopping_items").insert(
        items.map((i) => ({
          week_start: weekStart,
          key: i.key,
          name: i.name,
          qty: i.qty,
          unit: i.unit,
          amount_text: i.amount_text,
          category: i.category,
          staple: prev.get(i.key)?.staple ?? i.staple,
          sources: i.sources,
          manual: false,
          checked: prev.get(i.key)?.checked ?? false,
        })),
      ),
    );
  }
  return { count: items.length, recipes: recipes.length };
}
