export type Unit =
  | "g" | "kg"
  | "ml" | "dl" | "l"
  | "tsp" | "tbsp"
  | "pinch" | "pc" | "clove" | "bunch" | "can" | "pack" | "jar"
  | "slice" | "sprig" | "handful" | "head" | "stalk" | "cup_metric";

export interface Ingredient {
  id: string;
  raw: string;           // original line as imported / typed
  qty: number | null;
  unit: Unit | null;
  name: string;
  note: string | null;
  category: Category;
  group?: string | null; // e.g. "For the sauce"
}

export interface Recipe {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  source_url: string | null;
  servings: number;
  prep_minutes: number | null;
  cook_minutes: number | null;
  total_minutes: number | null;
  ingredients: Ingredient[];
  steps: string[];
  tags: string[];
  notes: string | null;
  favorite: boolean;
  rating: number | null;
  created_at: string;
  updated_at: string;
}

export type RecipeDraft = Omit<Recipe, "id" | "created_at" | "updated_at">;

export type Meal = "breakfast" | "lunch" | "dinner";

export interface MealPlanEntry {
  id: string;
  date: string; // YYYY-MM-DD
  meal: Meal;
  recipe_id: string | null;
  title: string | null;
  servings: number;
  cooked: boolean;
  position: number;
  recipe?: Pick<Recipe, "id" | "title" | "image_url" | "total_minutes" | "servings" | "ingredients"> | null;
}

export interface ShoppingItem {
  id: string;
  week_start: string;
  key: string | null;
  name: string;
  qty: number | null;
  unit: string | null;
  amount_text: string | null;
  category: Category;
  checked: boolean;
  manual: boolean;
  staple: boolean;
  sources: string[];
  created_at: string;
  updated_at: string;
}

export type StoreId = "migros" | "coop" | "lidl" | "aldi" | "denner";

export interface Settings {
  id: 1;
  default_store: StoreId;
  default_servings: number;
  store_orders: Partial<Record<StoreId, Category[]>>;
}

export const CATEGORIES = [
  "produce",
  "bakery",
  "meat_fish",
  "dairy_eggs",
  "cheese",
  "chilled",
  "pasta_rice_grains",
  "baking",
  "canned_jars",
  "spices_condiments",
  "oils_vinegar",
  "international",
  "breakfast",
  "snacks_sweets",
  "drinks",
  "frozen",
  "household",
  "baby",
  "other",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  produce: "Fruit & Vegetables",
  bakery: "Bakery",
  meat_fish: "Meat & Fish",
  dairy_eggs: "Dairy & Eggs",
  cheese: "Cheese",
  chilled: "Chilled & Deli",
  pasta_rice_grains: "Pasta, Rice & Grains",
  baking: "Baking",
  canned_jars: "Cans & Jars",
  spices_condiments: "Spices & Sauces",
  oils_vinegar: "Oil & Vinegar",
  international: "International",
  breakfast: "Breakfast & Cereals",
  snacks_sweets: "Snacks & Sweets",
  drinks: "Drinks",
  frozen: "Frozen",
  household: "Household",
  baby: "Baby & Kids",
  other: "Other",
};

export const CATEGORY_EMOJI: Record<Category, string> = {
  produce: "🥦",
  bakery: "🥖",
  meat_fish: "🥩",
  dairy_eggs: "🥛",
  cheese: "🧀",
  chilled: "🥓",
  pasta_rice_grains: "🍝",
  baking: "🧁",
  canned_jars: "🥫",
  spices_condiments: "🧂",
  oils_vinegar: "🫒",
  international: "🌏",
  breakfast: "🥣",
  snacks_sweets: "🍫",
  drinks: "🧃",
  frozen: "🧊",
  household: "🧻",
  baby: "🍼",
  other: "🛒",
};

export interface Suggestion {
  id: string;
  week_start: string;
  title: string;
  url: string;
  source: string | null;
  why: string | null;
  minutes: number | null;
  tags: string[];
  image_url: string | null;
  status: "new" | "saved" | "dismissed";
  recipe_id: string | null;
  created_at: string;
}
