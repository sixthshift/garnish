import { FACET_LAYERS, type FacetLayer, type Facets, facetsSchema, noFacets } from "../../recipe";

/**
 * What a source's free words say about the recipe's layers (decisions.md row
 * 209): a page's `recipeCategory`, `recipeCuisine`, `keywords` and
 * `suitableForDiet`, a Mealie recipe's categories and tags. A word is matched
 * whole, after case, accents and punctuation are set aside, against a short
 * table of the words sources actually use; anything else says nothing. The
 * table is small on purpose: a word that could mean two things ("Asian",
 * "baked", "eggs" on a cake) is left out rather than guessed, because a
 * facet the household did not say is worse than none.
 */

type Hit = readonly [FacetLayer, string];

/** Each value, and the words (already normalised by `wordKey`) that mean it. */
const SYNONYMS: { readonly [L in FacetLayer]?: { readonly [V in Facets[L][number]]?: readonly string[] } } = {
  course: {
    // "Entrée" is the main course on the American sites most schema.org data
    // comes from; the starter is "starter" or "appetiser" in both.
    main: ["main", "mains", "main course", "main courses", "main dish", "main dishes", "entree", "entrees"],
    soup: ["soup", "soups"],
    salad: ["salad", "salads"],
    side: ["side", "sides", "side dish", "side dishes"],
    starter: ["starter", "starters", "appetiser", "appetisers", "appetizer", "appetizers"],
    dessert: ["dessert", "desserts", "sweets"],
    baking: ["baking"],
    snack: ["snack", "snacks"],
    drink: ["drink", "drinks", "beverage", "beverages"],
    sauce: ["sauce", "sauces", "dressing", "dressings"],
    condiment: ["condiment", "condiments", "preserve", "preserves"],
    "spice-mix": ["spice mix", "spice blend", "marinade", "marinades"],
    stock: ["stock"],
  },
  meal: {
    breakfast: ["breakfast", "brunch"],
    lunch: ["lunch"],
    dinner: ["dinner", "supper"],
  },
  cuisine: {
    australian: ["australian", "australia"],
    british: ["british"],
    french: ["french", "france"],
    italian: ["italian", "italy"],
    spanish: ["spanish", "spain"],
    greek: ["greek", "greece"],
    "eastern-european": ["eastern european", "polish", "russian", "ukrainian", "hungarian"],
    "middle-eastern": ["middle eastern", "lebanese", "turkish", "persian"],
    "north-african": ["north african", "moroccan"],
    american: ["american"],
    "latin-american": ["latin american", "mexican", "mexico", "brazilian", "peruvian"],
    indian: ["indian", "india"],
    "sri-lankan": ["sri lankan", "sri lanka"],
    chinese: ["chinese", "china"],
    japanese: ["japanese", "japan"],
    korean: ["korean", "korea"],
    thai: ["thai", "thailand"],
    vietnamese: ["vietnamese", "vietnam"],
    "southeast-asian": ["southeast asian", "south east asian", "malaysian", "indonesian", "filipino"],
  },
  diet: {
    // schema.org's RestrictedDiet values arrive as `https://schema.org/VeganDiet`;
    // `wordKey` keeps the last path segment. Only the three that are one of
    // these layers' values exactly: LowLactoseDiet is not dairy-free.
    vegetarian: ["vegetarian", "vegetariandiet"],
    vegan: ["vegan", "vegandiet"],
    pescatarian: ["pescatarian", "pescetarian"],
    "gluten-free": ["gluten free", "glutenfreediet"],
    "dairy-free": ["dairy free"],
    "nut-free": ["nut free"],
  },
  mainIngredient: {
    chicken: ["chicken"],
    beef: ["beef"],
    lamb: ["lamb"],
    pork: ["pork"],
    fish: ["fish"],
    seafood: ["seafood"],
    tofu: ["tofu"],
    pasta: ["pasta", "noodles"],
  },
  method: {
    stovetop: ["stovetop", "stove top"],
    // Not "grill": an American page means the barbecue by it, an Australian or British one the oven's grill.
    bbq: ["bbq", "barbecue", "barbeque"],
    "slow-cooker": ["slow cooker", "crockpot", "crock pot"],
    "pressure-cooker": ["pressure cooker", "instant pot"],
    "air-fryer": ["air fryer", "airfryer"],
    "no-cook": ["no cook"],
  },
  season: {
    summer: ["summer"],
    autumn: ["autumn", "fall"],
    winter: ["winter"],
    spring: ["spring"],
  },
};

/** The table turned round: a normalised word to every value it means. */
const BY_WORD: ReadonlyMap<string, readonly Hit[]> = (() => {
  const map = new Map<string, Hit[]>();
  for (const layer of FACET_LAYERS) {
    for (const [value, words] of Object.entries(SYNONYMS[layer] ?? {}) as [string, readonly string[]][]) {
      for (const word of words) map.set(word, [...(map.get(word) ?? []), [layer, value]]);
    }
  }
  return map;
})();

/**
 * A word as the table keys it: a schema.org URL as its last segment,
 * lower case, accents dropped, and every run of anything but letters and
 * digits one space. "Main Course", "main-course" and "MAIN COURSE!" are one
 * key; "Entrée" is "entree". Pure.
 */
export function wordKey(word: string): string {
  const bare = word.trim().replace(/^(?:https?:\/\/)?(?:www\.)?schema\.org\//i, "");
  return bare
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** The layers a source's words say, each word matched whole (a comma-separated string is several words); words no row knows say nothing. Pure. */
export function facetsFromWords(words: Iterable<string>): Facets {
  const said = noFacets() as Record<FacetLayer, string[]>;
  for (const entry of words) {
    for (const word of entry.split(",")) {
      for (const [layer, value] of BY_WORD.get(wordKey(word)) ?? []) said[layer].push(value);
    }
  }
  return facetsSchema.parse(said);
}

/** Every value any of `sets` says, once each, in each layer's own order. Pure. */
export function mergeFacets(...sets: readonly Facets[]): Facets {
  const merged = noFacets() as Record<FacetLayer, string[]>;
  for (const facets of sets) for (const layer of FACET_LAYERS) merged[layer].push(...facets[layer]);
  return facetsSchema.parse(merged);
}
