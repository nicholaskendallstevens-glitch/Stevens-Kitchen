import type { Category } from "./types";

/**
 * Keyword dictionary (German incl. Swiss terms, English, some French) -> aisle.
 * Matching prefers the head noun (end of the word / last word), then the longest
 * keyword, so "Erdbeerjoghurt" -> dairy, "Olivenöl" -> oil, "Kokosmilch" -> international.
 */
const DICT: Record<Category, string[]> = {
  produce: [
    "zwiebel", "onion", "schalotte", "shallot", "frühlingszwiebel", "spring onion", "scallion", "green onion",
    "knoblauch", "chnoblauch", "garlic", "ingwer", "ginger", "kartoffel", "härdöpfel", "potato", "süsskartoffel",
    "sweet potato", "rüebli", "karotte", "möhre", "carrot", "lauch", "leek", "sellerie", "celery", "stangensellerie",
    "tomate", "tomato", "cherrytomate", "cherry tomato", "gurke", "cucumber", "zucchetti", "zucchini", "courgette",
    "aubergine", "eggplant", "peperoni", "bell pepper", "capsicum", "chili", "chilischote", "jalapeño", "jalapeno",
    "brokkoli", "broccoli", "blumenkohl", "cauliflower", "rosenkohl", "brussels sprout", "kohl", "cabbage",
    "rotkohl", "weisskohl", "federkohl", "kale", "wirz", "spinat", "spinach", "blattspinat", "mangold", "chard",
    "salat", "lettuce", "kopfsalat", "eisbergsalat", "rucola", "arugula", "rocket", "nüsslisalat", "lamb's lettuce",
    "endivie", "chicorée", "radieschen", "radish", "randen", "rande", "beetroot", "beet", "fenchel", "fennel",
    "spargel", "asparagus", "erbsen", "kefe", "zuckerschote", "snap pea", "pea", "bohne", "green bean",
    "pilz", "champignon", "mushroom", "steinpilz", "shiitake", "kürbis", "pumpkin", "butternut", "squash",
    "mais", "corn", "avocado", "zitrone", "lemon", "limette", "lime", "orange", "mandarine", "clementine",
    "apfel", "äpfel", "apple", "birne", "pear", "banane", "banana", "beere", "berry", "erdbeer", "strawberr",
    "himbeer", "raspberr", "heidelbeer", "blueberr", "brombeer", "blackberr", "trauben", "grape", "kiwi",
    "mango", "ananas", "pineapple", "melone", "melon", "pfirsich", "peach", "nektarine", "aprikose", "apricot",
    "kirsche", "cherry", "zwetschge", "pflaume", "plum", "granatapfel", "pomegranate", "feige", "fig",
    "petersilie", "parsley", "basilikum", "basil", "koriander", "coriander", "cilantro", "schnittlauch",
    "chives", "dill", "minze", "mint", "rosmarin", "rosemary", "thymian", "thyme", "salbei", "sage",
    "oregano frisch", "estragon", "tarragon", "kräuter", "herbs", "pak choi", "bok choy", "sprossen",
    "sprouts", "rhabarber", "rhubarb", "topinambur", "pastinake", "parsnip", "kohlrabi", "rettich",
    "frisch", "fresh herbs", "sellerieknolle", "knollensellerie", "celeriac",
  ],
  bakery: [
    "brot", "bread", "brötchen", "weggli", "bürli", "baguette", "zopf", "toast", "toastbrot", "ciabatta",
    "focaccia", "bun", "roll", "brioche", "gipfeli", "croissant", "tortilla", "wrap", "pita", "fladenbrot",
    "naan", "sauerteig", "sourdough", "laugenbrezel", "brezel", "pretzel",
  ],
  meat_fish: [
    "fleisch", "meat", "rind", "beef", "rindfleisch", "hackfleisch", "gehacktes", "minced", "mince",
    "ground beef", "ground meat", "steak", "entrecote", "filet", "schwein", "pork", "kalb", "veal", "lamm",
    "lamb", "poulet", "chicken", "huhn", "hähnchen", "pouletbrust", "chicken breast", "chicken thigh",
    "pouletschenkel", "truthahn", "trute", "turkey", "ente", "duck", "geschnetzeltes", "voressen",
    "plätzli", "schnitzel", "cordon bleu", "wurst", "bratwurst", "cervelat", "salsiccia", "sausage",
    "chorizo", "merguez", "fisch", "fish", "lachs", "salmon", "thunfisch steak", "forelle", "trout",
    "kabeljau", "dorsch", "cod", "egli", "perch", "zander", "pangasius", "dorade", "seabass", "wolfsbarsch",
    "crevetten", "garnelen", "shrimp", "prawn", "muscheln", "mussel", "tintenfisch", "calamari", "squid",
    "meeresfrüchte", "seafood", "rindsfilet", "schweinsfilet", "kalbsfilet", "rack", "ribs", "spareribs",
  ],
  dairy_eggs: [
    "milch", "milk", "vollmilch", "rahm", "cream", "vollrahm", "halbrahm", "saucenhalbrahm", "kochrahm",
    "sauerrahm", "sour cream", "crème fraîche", "creme fraiche", "crème fraiche", "doppelrahm", "butter",
    "joghurt", "jogurt", "yogurt", "yoghurt", "quark", "magerquark", "ei", "eier", "egg", "eigelb",
    "eiweiss", "egg yolk", "egg white", "buttermilch", "buttermilk", "kefir", "skyr", "margarine",
    "hafermilch", "oat milk", "sojamilch", "soy milk", "mandelmilch", "almond milk", "schlagrahm",
    "whipping cream", "heavy cream", "double cream", "half-and-half",
  ],
  cheese: [
    "käse", "cheese", "gruyère", "gruyere", "greyerzer", "emmentaler", "emmental", "appenzeller", "sbrinz",
    "parmesan", "parmigiano", "grana padano", "pecorino", "mozzarella", "burrata", "feta", "hüttenkäse",
    "cottage cheese", "ricotta", "mascarpone", "raclette", "raclettekäse", "fondue", "vacherin", "tilsiter",
    "tête de moine", "brie", "camembert", "cheddar", "gorgonzola", "halloumi", "frischkäse", "cream cheese",
    "philadelphia", "reibkäse", "gouda", "manchego", "ziegenkäse", "goat cheese",
  ],
  chilled: [
    "speck", "bacon", "schinken", "ham", "rohschinken", "prosciutto", "salami", "aufschnitt", "pancetta",
    "bündnerfleisch", "mostbröckli", "lardons", "tofu", "tempeh", "seitan", "blätterteig", "puff pastry",
    "kuchenteig", "pizzateig", "pizza dough", "mürbeteig", "shortcrust", "strudelteig", "filoteig", "filo",
    "frische pasta", "fresh pasta", "ravioli", "tortellini", "gnocchi", "spätzli", "spätzle", "hummus",
    "pesto", "rösti", "quorn", "plant based", "vegi", "falafel", "räuchertofu", "smoked salmon", "räucherlachs",
  ],
  pasta_rice_grains: [
    "pasta", "teigwaren", "spaghetti", "penne", "fusilli", "farfalle", "tagliatelle", "linguine", "lasagne",
    "lasagna", "makkaroni", "hörnli", "älplermagronen", "nudeln", "noodle", "eiernudeln", "reisnudeln",
    "rice noodle", "glasnudeln", "udon", "ramen", "soba", "reis", "rice", "risottoreis", "risotto",
    "basmati", "jasmin", "jasmine", "arborio", "carnaroli", "couscous", "bulgur", "quinoa", "polenta",
    "maisgriess", "hirse", "millet", "graupen", "rollgerste", "gerste", "barley", "linsen", "lentil",
    "kichererbsen", "chickpea", "dinkel", "spelt", "orzo", "griess", "semolina", "haferflocken", "oats",
    "paniermehl", "breadcrumbs", "panko", "cracker",
  ],
  baking: [
    "mehl", "flour", "weissmehl", "halbweissmehl", "ruchmehl", "vollkornmehl", "dinkelmehl", "maizena",
    "maisstärke", "cornstarch", "cornflour", "stärke", "zucker", "sugar", "puderzucker", "icing sugar",
    "powdered sugar", "rohzucker", "brauner zucker", "brown sugar", "vanillezucker", "vanilla sugar",
    "vanille", "vanilla", "backpulver", "baking powder", "natron", "baking soda", "bicarbonate", "hefe",
    "yeast", "trockenhefe", "gelatine", "gelatin", "kakao", "cocoa", "schokolade", "chocolate",
    "kuvertüre", "couverture", "schokoladenstückchen", "chocolate chips", "mandeln", "almond",
    "gemahlene mandeln", "haselnüsse", "haselnuss", "hazelnut", "baumnüsse", "baumnuss", "walnuss",
    "walnut", "pinienkerne", "pine nut", "nüsse", "nuts", "pecan", "cashew", "pistazie", "pistachio",
    "rosinen", "raisin", "sultaninen", "datteln", "dates", "getrocknete", "dried", "kokosraspel",
    "desiccated coconut", "honig", "honey", "ahornsirup", "maple syrup", "agavendicksaft", "agave",
    "sirup", "syrup", "marzipan", "streusel", "sprinkles", "lebensmittelfarbe", "food coloring",
    "sesam", "sesame", "leinsamen", "flaxseed", "chiasamen", "chia", "sonnenblumenkerne", "sunflower seed",
    "kürbiskerne", "pumpkin seed", "backoblaten",
  ],
  canned_jars: [
    "dose tomaten", "tomaten gehackt", "gehackte tomaten", "chopped tomatoes", "canned tomatoes",
    "pelati", "passata", "tomatenpüree", "tomatenmark", "tomato paste", "tomato puree", "pizzasauce",
    "kidney", "kidneybohnen", "kidney beans", "weisse bohnen", "white beans", "cannellini", "black beans",
    "schwarze bohnen", "baked beans", "thunfisch", "tuna", "sardinen", "sardine", "sardellen", "anchovy",
    "anchovies", "mais dose", "canned corn", "oliven", "olive", "kapern", "caper", "essiggurken",
    "gherkin", "pickles", "cornichons", "artischocken", "artichoke", "getrocknete tomaten",
    "sun-dried tomato", "sundried tomato", "konfitüre", "konfi", "jam", "marmelade", "apfelmus",
    "applesauce", "kokosmilch", "coconut milk", "kokosnussmilch", "bouillon im glas", "rotkraut glas",
    "sauerkraut", "jalapeños glas", "roasted pepper", "grillierte peperoni",
  ],
  spices_condiments: [
    "salz", "salt", "meersalz", "sea salt", "fleur de sel", "pfeffer", "pepper", "pfefferkörner",
    "peppercorn", "paprika", "paprikapulver", "smoked paprika", "rauchpaprika", "curry", "currypulver",
    "currypaste", "curry paste", "kurkuma", "turmeric", "kreuzkümmel", "cumin", "kümmel", "caraway",
    "zimt", "cinnamon", "muskat", "nutmeg", "nelken", "cloves spice", "kardamom", "cardamom", "piment",
    "allspice", "lorbeer", "bay leaf", "bay leaves", "oregano", "majoran", "marjoram", "getrocknet",
    "chiliflocken", "chili flakes", "red pepper flakes", "cayenne", "garam masala", "ras el hanout",
    "za'atar", "sumach", "sumac", "herbes de provence", "italienische kräuter", "italian seasoning",
    "bouillon", "gemüsebouillon", "hühnerbouillon", "rindsbouillon", "broth", "stock", "brühe",
    "fond", "stock cube", "bouillonwürfel", "aromat", "maggi", "senf", "mustard", "dijon", "ketchup",
    "mayonnaise", "mayo", "sauce", "sojasauce", "soy sauce", "tamari", "worcestershire", "worcester",
    "fischsauce", "fish sauce", "austernsauce", "oyster sauce", "hoisin", "sriracha", "tabasco",
    "sambal", "harissa", "miso", "tahini", "tahin", "bbq", "barbecue", "chutney", "meerrettich",
    "horseradish", "wasabi", "senfkörner", "mustard seed", "fenchelsamen", "fennel seed", "safran",
    "saffron", "vanilleschote",
  ],
  oils_vinegar: [
    "öl", "oil", "olivenöl", "olive oil", "rapsöl", "canola", "rapeseed oil", "sonnenblumenöl",
    "sunflower oil", "sesamöl", "sesame oil", "erdnussöl", "peanut oil", "kokosöl", "coconut oil",
    "bratbutter", "ghee", "essig", "vinegar", "balsamico", "balsamic", "weissweinessig", "rotweinessig",
    "apfelessig", "cider vinegar", "reisessig", "rice vinegar", "kräuteressig",
  ],
  international: [
    "kokosmilch", "coconut milk", "reispapier", "rice paper", "nori", "sushi", "wonton", "taco",
    "tacoschalen", "taco shells", "enchilada", "salsa", "guacamole", "nachos", "frühlingsrollen",
    "spring roll", "mirin", "sake", "gochujang", "kimchi", "zitronengras", "lemongrass", "galgant",
    "kaffirlimette", "kaffir lime", "tamarinde", "tamarind", "jackfruit", "tortilla chips",
  ],
  breakfast: [
    "müesli", "muesli", "granola", "cornflakes", "cereal", "flocken", "porridge", "nutella",
    "erdnussbutter", "peanut butter", "ovomaltine", "aufstrich", "spread", "kaffee", "coffee",
    "tee", "tea", "kaffeerahm",
  ],
  snacks_sweets: [
    "chips", "crisps", "salzstangen", "pretzel sticks", "popcorn", "guetzli", "biscuit", "cookie",
    "keks", "kekse", "löffelbiskuit", "ladyfinger", "savoiardi", "bonbon", "candy", "gummibärchen",
    "riegel", "bar", "glace", "ice cream", "meringue", "meringues",
  ],
  drinks: [
    "wein", "wine", "weisswein", "white wine", "rotwein", "red wine", "bier", "beer", "prosecco",
    "champagner", "mineral", "mineralwasser", "sprudel", "saft", "juice", "orangensaft", "orange juice",
    "apfelsaft", "süssmost", "cola", "limonade", "rivella", "sirup getränk", "kombucha", "cognac",
    "brandy", "rum", "kirsch", "grappa", "marsala", "portwein", "port", "weisswein trocken", "cidre",
  ],
  frozen: [
    "tiefkühl", "tk-", "tk ", "frozen", "gefroren", "tiefgefroren", "glace", "erbsen tk", "frozen peas",
    "spinat tk", "frozen spinach", "fischstäbchen", "fish fingers", "pommes", "french fries", "fries",
    "eiswürfel", "ice cubes", "frozen berries", "tk-beeren",
  ],
  household: [
    "abwaschmittel", "dish soap", "spülmittel", "waschmittel", "detergent", "wc-papier", "toilettenpapier",
    "toilet paper", "haushaltpapier", "kitchen roll", "paper towel", "alufolie", "aluminium foil",
    "frischhaltefolie", "cling film", "backpapier", "baking paper", "parchment", "kehrichtsack",
    "abfallsack", "bin bag", "trash bag", "schwamm", "sponge", "taschentücher", "tissues", "seife", "soap",
    "shampoo", "zahnpasta", "toothpaste", "batterien", "batteries", "duschgel", "deo",
  ],
  baby: [
    "windeln", "diapers", "nappies", "feuchttücher", "wet wipes", "baby wipes", "babybrei", "baby food",
    "säuglingsmilch", "formula", "quetschie", "pouch", "babynahrung", "zwieback",
  ],
  other: [],
};

// Pre-compute keyword list
const KEYWORDS: { kw: string; cat: Category }[] = [];
for (const [cat, list] of Object.entries(DICT) as [Category, string[]][]) {
  for (const kw of list) KEYWORDS.push({ kw: kw.toLowerCase(), cat });
}

const PLURAL_TAIL = /^(s|es|n|en|e|er|nen|ern|li)?$/;

export function guessCategory(name: string, overrides?: Record<string, Category>): Category {
  const key = nameKey(name);
  if (overrides && overrides[key]) return overrides[key];
  const s = name.toLowerCase().replace(/[()\[\],.;:]/g, " ").replace(/\s+/g, " ").trim();
  if (!s) return "other";
  const tokens = s.split(" ");
  const last = tokens[tokens.length - 1];
  const lastStart = s.length - last.length;

  let best: { score: number; cat: Category } | null = null;
  for (const { kw, cat } of KEYWORDS) {
    let idx = s.indexOf(kw);
    if (idx === -1) continue;
    // short keywords ("ei", "öl", "tee") must match a whole token (+ plural)
    // ("reis" must not count as "ei", but "Olivenöl" counts as "öl")
    if (kw.length <= 3) {
      const ok = tokens.some(
        (t) =>
          t === kw ||
          (t.startsWith(kw) && PLURAL_TAIL.test(t.slice(kw.length))) ||
          (t.endsWith(kw) && t.length >= kw.length + 3),
      );
      if (!ok) continue;
    }
    // find the right-most occurrence for head-noun scoring
    let last_idx = idx;
    while ((idx = s.indexOf(kw, idx + 1)) !== -1) last_idx = idx;
    const end = last_idx + kw.length;
    const headBonus = last_idx + kw.length > lastStart && PLURAL_TAIL.test(s.slice(end)) ? 100 : 0;
    const score = headBonus + kw.length;
    if (!best || score > best.score) best = { score, cat };
  }
  return best?.cat ?? "other";
}

/* ------------------------------------------------------------------------ */
/* Name normalisation for aggregation ("Zwiebeln" == "Zwiebel" == "onion")  */
/* ------------------------------------------------------------------------ */

const STOP_WORDS = new Set([
  "frisch", "frische", "frischer", "frisches", "fresh", "large", "big", "small", "medium", "gross", "grosse",
  "grosser", "grosses", "klein", "kleine", "kleiner", "kleines", "mittelgross", "mittelgrosse", "mittelgrosser",
  "reif", "reife", "ripe", "bio", "organic", "extra", "virgin", "nativ", "natives", "fein", "feine", "finely",
  "chopped", "gehackt", "gehackte", "diced", "gewürfelt", "sliced", "geschnitten", "minced", "grated",
  "gerieben", "geriebener", "geriebene", "optional", "evtl", "evtl.", "ca", "ca.", "etwa", "about", "of",
  "von", "some", "etwas", "wenig", "einige", "zum", "servieren", "garnieren", "for", "serving", "garnish",
  "to", "taste", "nach", "belieben", "geschmack", "boneless", "skinless", "unsalted", "salted", "ungesalzen",
  "weich", "weiche", "softened", "kalt", "kalte", "cold", "warm", "warme", "lauwarm", "room", "temperature",
  "zimmerwarm", "geschält", "peeled", "whole", "ganz", "ganze", "roh", "raw", "gekocht", "cooked",
]);

const IRREGULAR: Record<string, string> = {
  eier: "ei", eggs: "egg", äpfel: "apfel", tomatoes: "tomato", potatoes: "potato", leaves: "leaf",
  knives: "knife", cherries: "cherry", berries: "berry", rüebli: "karotte", möhren: "karotte",
  möhre: "karotte", karotten: "karotte", carrots: "carrot", härdöpfel: "kartoffel", chnoblauch: "knoblauch",
  knoblauchzehen: "knoblauch", knoblauchzehe: "knoblauch", zucchetti: "zucchini", courgettes: "zucchini",
  courgette: "zucchini", rahm: "rahm", vollrahm: "rahm", halbrahm: "halbrahm", nüsse: "nuss",
};

function singular(t: string): string {
  if (IRREGULAR[t]) return IRREGULAR[t];
  if (t.length <= 3) return t;
  if (t.endsWith("ies") && t.length > 4) return t.slice(0, -3) + "y";
  if (t.endsWith("oes")) return t.slice(0, -2);
  if (/(ss|us|is)$/.test(t)) return t;
  if (t.endsWith("eln") || t.endsWith("ern")) return t.slice(0, -1);
  if (t.endsWith("en") && t.length > 5) return t.slice(0, -1);
  if (t.endsWith("s") && t.length > 4) return t.slice(0, -1);
  return t;
}

export function nameKey(name: string): string {
  const s = name
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .split(/[,;]/)[0]
    .replace(/[^a-zäöüàâçéèêëîïôûùüÿñæœß' -]/g, " ")
    .replace(/-/g, " ");
  const tokens = s
    .split(/\s+/)
    .filter(Boolean)
    .filter((t) => !STOP_WORDS.has(t))
    .map(singular);
  return tokens.join(" ").trim() || name.toLowerCase().trim();
}
