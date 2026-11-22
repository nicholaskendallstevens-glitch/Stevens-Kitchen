import { CATEGORIES, type Category, type StoreId } from "./types";

export const STORES: { id: StoreId; name: string; color: string }[] = [
  { id: "migros", name: "Migros", color: "#ff6600" },
  { id: "coop", name: "Coop", color: "#e2001a" },
  { id: "lidl", name: "Lidl", color: "#0050aa" },
  { id: "aldi", name: "Aldi", color: "#00005f" },
  { id: "denner", name: "Denner", color: "#c8102e" },
];

// Typical walking order through a mid-size Swiss branch. Every branch differs,
// so these are only defaults. Reorder them in Settings to match your store.
export const DEFAULT_STORE_ORDERS: Record<StoreId, Category[]> = {
  migros: [
    "produce", "bakery", "dairy_eggs", "cheese", "chilled", "meat_fish",
    "pasta_rice_grains", "canned_jars", "international", "spices_condiments",
    "oils_vinegar", "baking", "breakfast", "snacks_sweets", "drinks", "frozen",
    "baby", "household", "other",
  ],
  coop: [
    "produce", "bakery", "meat_fish", "cheese", "dairy_eggs", "chilled",
    "pasta_rice_grains", "international", "canned_jars", "oils_vinegar",
    "spices_condiments", "baking", "breakfast", "snacks_sweets", "frozen",
    "drinks", "baby", "household", "other",
  ],
  lidl: [
    "produce", "bakery", "chilled", "meat_fish", "pasta_rice_grains",
    "canned_jars", "international", "spices_condiments", "oils_vinegar",
    "baking", "breakfast", "snacks_sweets", "drinks", "household", "baby",
    "frozen", "dairy_eggs", "cheese", "other",
  ],
  aldi: [
    "produce", "bakery", "pasta_rice_grains", "canned_jars", "spices_condiments",
    "oils_vinegar", "baking", "breakfast", "snacks_sweets", "drinks",
    "household", "baby", "frozen", "chilled", "meat_fish", "dairy_eggs",
    "cheese", "international", "other",
  ],
  denner: [
    "produce", "bakery", "drinks", "snacks_sweets", "pasta_rice_grains",
    "canned_jars", "spices_condiments", "oils_vinegar", "baking", "breakfast",
    "international", "household", "baby", "chilled", "meat_fish", "dairy_eggs",
    "cheese", "frozen", "other",
  ],
};

export function storeOrder(
  store: StoreId,
  overrides?: Partial<Record<StoreId, Category[]>>,
): Category[] {
  const base = overrides?.[store]?.length ? overrides[store]! : DEFAULT_STORE_ORDERS[store];
  // make sure newly added categories always appear
  const missing = CATEGORIES.filter((c) => !base.includes(c));
  return [...base.filter((c) => (CATEGORIES as readonly string[]).includes(c)), ...missing];
}
