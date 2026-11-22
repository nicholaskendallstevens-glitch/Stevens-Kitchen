import { test } from "node:test";
import assert from "node:assert/strict";
import { parseIngredient } from "../src/lib/ingredients";
import { formatAmount, fahrenheitToCelsiusInText } from "../src/lib/units";
import { guessCategory, nameKey } from "../src/lib/categories";
import { aggregate } from "../src/lib/shopping";
import { extractJsonLdRecipe, parseDuration } from "../src/lib/import/jsonld";
import { weekStart, defaultPlanningWeek } from "../src/lib/dates";

const p = (s: string) => {
  const i = parseIngredient(s);
  return { qty: i.qty, unit: i.unit, name: i.name, note: i.note, cat: i.category };
};

test("parses Swiss German lines", () => {
  assert.deepEqual(p("2½ dl Vollrahm"), { qty: 2.5, unit: "dl", name: "Vollrahm", note: null, cat: "dairy_eggs" });
  assert.deepEqual(p("1 Zwiebel, fein gehackt"), { qty: 1, unit: null, name: "Zwiebel", note: "fein gehackt", cat: "produce" });
  assert.deepEqual(p("2 EL Olivenöl"), { qty: 2, unit: "tbsp", name: "Olivenöl", note: null, cat: "oils_vinegar" });
  assert.deepEqual(p("250g Spaghetti"), { qty: 250, unit: "g", name: "Spaghetti", note: null, cat: "pasta_rice_grains" });
  assert.equal(p("1 Dose gehackte Tomaten (400 g)").unit, "can");
  assert.equal(p("1 Dose gehackte Tomaten (400 g)").note, "400 g");
  assert.equal(p("1 Dose gehackte Tomaten (400 g)").cat, "canned_jars");
  assert.deepEqual(p("1-2 Knoblauchzehen").qty, 2);
  assert.equal(p("1 Bund Petersilie").unit, "bunch");
  assert.equal(p("Salz, Pfeffer").name, "Salz, Pfeffer");
  assert.equal(p("Salz, Pfeffer").qty, null);
  assert.equal(p("1 Prise Muskat").unit, "pinch");
  assert.equal(p("1,5 kg Kartoffeln").qty, 1.5);
  assert.equal(p("400 g Rindshackfleisch").cat, "meat_fish");
  assert.equal(p("200 g Erdbeerjoghurt").cat, "dairy_eggs");
  assert.equal(p("4 dl Kokosmilch").cat, "canned_jars");
  assert.equal(p("150 g Reis").cat, "pasta_rice_grains");
  assert.equal(p("3 Eier").cat, "dairy_eggs");
  assert.equal(p("1 Peperoni, rot").cat, "produce");
  assert.equal(p("1 TL Paprika").cat, "spices_condiments");
  assert.equal(p("1 Blätterteig, ausgewallt").cat, "chilled");
  assert.equal(p("100 g Gruyère, gerieben").cat, "cheese");
  assert.equal(p("2 Rüebli").cat, "produce");
});

test("parses English lines and converts to metric", () => {
  const flour = p("2 cups all-purpose flour");
  assert.equal(flour.unit, "g");
  assert.equal(flour.qty, 250);
  const milk = p("1 cup milk");
  assert.equal(milk.unit, "ml");
  assert.equal(milk.qty, 240);
  assert.equal(formatAmount(milk.qty, milk.unit), "2.5 dl");
  const beef = p("1 lb ground beef");
  assert.equal(beef.unit, "g");
  assert.equal(Math.round(beef.qty!), 454);
  assert.equal(beef.cat, "meat_fish");
  assert.deepEqual(p("3 large eggs"), { qty: 3, unit: null, name: "Eggs", note: "large", cat: "dairy_eggs" });
  assert.equal(p("a pinch of salt").unit, "pinch");
  assert.equal(p("a pinch of salt").name, "Salt");
  assert.equal(p("1/2 tsp ground cumin").qty, 0.5);
  assert.equal(p("1 1/2 tbsp soy sauce").qty, 1.5);
  const can = p("1 (14 oz) can diced tomatoes");
  assert.equal(can.unit, "can");
  assert.equal(can.note, "14 oz");
  assert.equal(p("2 tbsp olive oil").cat, "oils_vinegar");
  assert.equal(p("1 red bell pepper").cat, "produce");
  assert.equal(p("1 tsp black pepper").cat, "spices_condiments");
  assert.equal(p("2 cups cherry tomatoes").cat, "produce");
  assert.equal(p("2 tbsp peanut butter").cat, "breakfast");
  assert.equal(p("1 pint double cream").qty, 568);
  assert.equal(p("1 pint double cream").cat, "dairy_eggs");
});

test("Swiss formatting", () => {
  assert.equal(formatAmount(1500, "g"), "1.5 kg");
  assert.equal(formatAmount(250, "ml"), "2.5 dl");
  assert.equal(formatAmount(1200, "ml"), "1.2 l");
  assert.equal(formatAmount(1.5, "tbsp"), "1½ tbsp");
  assert.equal(formatAmount(0.5, "tsp"), "½ tsp");
  assert.equal(formatAmount(2, "pc"), "2");
  assert.equal(formatAmount(2, "clove"), "2 cloves");
  assert.equal(fahrenheitToCelsiusInText("Bake at 350°F for 20 min"), "Bake at 175 °C for 20 min");
  assert.equal(fahrenheitToCelsiusInText("Heat oven to gas mark 6."), "Heat oven to 200 °C (gas 6).");
  assert.equal(fahrenheitToCelsiusInText("Heat oven to 200C/180C fan/gas 6."), "Heat oven to 200C/180C fan/gas 6.");
});

test("name keys merge singular/plural", () => {
  assert.equal(nameKey("Zwiebeln"), nameKey("Zwiebel"));
  assert.equal(nameKey("Tomaten"), nameKey("Tomate"));
  assert.equal(nameKey("Kartoffeln"), nameKey("Kartoffel"));
  assert.equal(nameKey("Eier"), nameKey("Ei"));
  assert.equal(nameKey("eggs"), nameKey("egg"));
  assert.equal(nameKey("frische Petersilie"), nameKey("Petersilie"));
  assert.equal(nameKey("Rüebli"), nameKey("Karotten"));
  assert.notEqual(nameKey("Reis"), nameKey("Ei"));
});

test("aggregates the week", () => {
  const ing = (s: string) => parseIngredient(s);
  const list = aggregate(
    [
      { title: "Risotto", recipeServings: 4, plannedServings: 2, ingredients: [ing("2 Zwiebeln"), ing("2 dl Weisswein"), ing("300 g Risottoreis"), ing("Salz")] },
      { title: "Chili", recipeServings: 4, plannedServings: 4, ingredients: [ing("1 Zwiebel, gehackt"), ing("100 g Zwiebeln"), ing("1 EL Olivenöl"), ing("500 g Rindshackfleisch")] },
      { title: "Pasta", recipeServings: 2, plannedServings: 4, ingredients: [ing("2 EL Olivenöl"), ing("250 g Hackfleisch vom Rind")] },
    ],
    ["salz", "olivenöl"],
  );
  const by = Object.fromEntries(list.map((i) => [i.key, i]));
  assert.equal(by[nameKey("Zwiebel")].amount_text, "100 g + 2"); // 1 (risotto, halved) + 1 + 100 g
  assert.equal(by[nameKey("Risottoreis")].amount_text, "150 g");
  assert.equal(by[nameKey("Weisswein")].amount_text, "1 dl");
  assert.equal(by[nameKey("Olivenöl")].amount_text, "5 tbsp");
  assert.equal(by[nameKey("Olivenöl")].staple, true);
  assert.equal(by[nameKey("Salz")].staple, true);
  assert.equal(by[nameKey("Salz")].amount_text, null);
  assert.deepEqual(by[nameKey("Zwiebel")].sources.sort(), ["Chili", "Risotto"]);
});

test("JSON-LD extraction (graph + HowToSection)", () => {
  const html = `<html><head><script type="application/ld+json">
  {"@context":"https://schema.org","@graph":[{"@type":"WebPage","name":"x"},
   {"@type":"Recipe","name":"Älplermagronen","recipeYield":"4 Personen","totalTime":"PT45M",
    "image":[{"url":"https://img/s.jpg","width":100},{"url":"https://img/l.jpg","width":1200}],
    "recipeIngredient":["300 g Hörnli","2 dl Rahm","1 Zwiebel"],
    "recipeInstructions":[{"@type":"HowToSection","name":"Zubereitung","itemListElement":[
      {"@type":"HowToStep","text":"Kartoffeln kochen."},{"@type":"HowToStep","text":"Hörnli beigeben."}]}],
    "keywords":"Schweiz, vegetarisch"}]}
  </script></head></html>`;
  const r = extractJsonLdRecipe(html)!;
  assert.equal(r.title, "Älplermagronen");
  assert.equal(r.servings, 4);
  assert.equal(r.total_minutes, 45);
  assert.equal(r.image_url, "https://img/l.jpg");
  assert.equal(r.ingredientLines.length, 3);
  assert.deepEqual(r.steps, ["— Zubereitung —", "Kartoffeln kochen.", "Hörnli beigeben."]);
  assert.ok(r.tags.includes("vegetarisch"));
  assert.equal(parseDuration("PT1H30M"), 90);
});

test("dates", () => {
  assert.equal(weekStart("2026-11-22"), "2026-11-16"); // Sunday -> Monday before
  assert.equal(weekStart("2026-11-23"), "2026-11-23");
  assert.ok(defaultPlanningWeek());
});
