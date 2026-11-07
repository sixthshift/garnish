import { z } from "zod";

/**
 * What a recipe is, layer by layer (decisions.md row 209): what it is in a
 * meal, when in the day it is eaten, where it is from, who can eat it, what
 * is at its heart, how it is cooked and when it is best. Each layer is a
 * fixed list the app knows, not free text: the planner, the library's filters,
 * the import and the MCP connector all rely on a value meaning one thing.
 * Every layer holds a set (a salad is a main or a side; a dish can be Thai and
 * Vietnamese), empty until the household or an import says. How the household
 * cooks a recipe, rotation or weekend, is a layer too, but older and single,
 * and stays `kind` (row 191). Tags remain for whatever fits no layer.
 */

/** What it is in a meal: a meal on its own, a part of one, or something made to go into or onto another. */
export const COURSES = [
  "main",
  "soup",
  "salad",
  "side",
  "starter",
  "dessert",
  "baking",
  "snack",
  "drink",
  "sauce",
  "condiment",
  "spice-mix",
  "stock",
  "dough",
] as const;

/** When in the day it suits. The same three a plan entry is labelled with (row 100). */
export const MEAL_TIMES = ["breakfast", "lunch", "dinner"] as const;

/** Where it is from. Broad on purpose: a region where the household would not split it finer. */
export const CUISINES = [
  "australian",
  "british",
  "french",
  "italian",
  "spanish",
  "greek",
  "eastern-european",
  "middle-eastern",
  "north-african",
  "american",
  "latin-american",
  "indian",
  "sri-lankan",
  "chinese",
  "japanese",
  "korean",
  "thai",
  "vietnamese",
  "southeast-asian",
] as const;

/** Who can eat it. Said of the recipe as written, not of what it could be swapped into. */
export const DIETS = ["vegetarian", "vegan", "pescatarian", "gluten-free", "dairy-free", "nut-free"] as const;

/** What is at its heart: the protein, or the vegetable or grain a meatless dish is built on. */
export const MAIN_INGREDIENTS = [
  "chicken",
  "beef",
  "lamb",
  "pork",
  "fish",
  "seafood",
  "eggs",
  "tofu",
  "legumes",
  "cheese",
  "vegetables",
  "pasta",
  "rice",
] as const;

/** How it is cooked. */
export const METHODS = ["oven", "stovetop", "bbq", "slow-cooker", "pressure-cooker", "air-fryer", "no-cook"] as const;

/** When it is best. None said is any time of year. */
export const SEASONS = ["summer", "autumn", "winter", "spring"] as const;

export const courseSchema = z.enum(COURSES);
export const mealTimeSchema = z.enum(MEAL_TIMES);
export const cuisineSchema = z.enum(CUISINES);
export const dietSchema = z.enum(DIETS);
export const mainIngredientSchema = z.enum(MAIN_INGREDIENTS);
export const methodSchema = z.enum(METHODS);
export const seasonSchema = z.enum(SEASONS);

export type Course = z.infer<typeof courseSchema>;
export type MealTime = z.infer<typeof mealTimeSchema>;
export type Cuisine = z.infer<typeof cuisineSchema>;
export type Diet = z.infer<typeof dietSchema>;
export type MainIngredient = z.infer<typeof mainIngredientSchema>;
export type Method = z.infer<typeof methodSchema>;
export type Season = z.infer<typeof seasonSchema>;

/** A set of one layer's values: each at most once, in the list's own order whatever order they came in. */
function layerSet<const T extends readonly [string, ...string[]]>(values: T) {
  return z
    .array(z.enum(values))
    .default([])
    .transform((given): T[number][] => values.filter((value) => (given as readonly string[]).includes(value)));
}

/** Every layer, in the order a screen lists them. */
export const facetsSchema = z.object({
  course: layerSet(COURSES),
  meal: layerSet(MEAL_TIMES),
  cuisine: layerSet(CUISINES),
  diet: layerSet(DIETS),
  mainIngredient: layerSet(MAIN_INGREDIENTS),
  method: layerSet(METHODS),
  season: layerSet(SEASONS),
});

export type Facets = z.infer<typeof facetsSchema>;
export type FacetLayer = keyof Facets;

/** The layers in the order a screen lists them. */
export const FACET_LAYERS = ["course", "meal", "cuisine", "diet", "mainIngredient", "method", "season"] as const satisfies readonly FacetLayer[];

/** Each layer's values, by layer. */
export const FACET_VALUES: { readonly [L in FacetLayer]: readonly Facets[L][number][] } = {
  course: COURSES,
  meal: MEAL_TIMES,
  cuisine: CUISINES,
  diet: DIETS,
  mainIngredient: MAIN_INGREDIENTS,
  method: METHODS,
  season: SEASONS,
};

/** A recipe nothing has been said about yet. */
export function noFacets(): Facets {
  return { course: [], meal: [], cuisine: [], diet: [], mainIngredient: [], method: [], season: [] };
}

/** Whether nothing has been said on any layer. */
export function facetsEmpty(facets: Facets): boolean {
  return FACET_LAYERS.every((layer) => facets[layer].length === 0);
}

/** The courses that are a meal, or part of one, rather than something made to go into another dish. */
export const BUILDING_BLOCKS: readonly Course[] = ["sauce", "condiment", "spice-mix", "stock", "dough"];

/** Whether a recipe is only ever made to go into or onto another: every course it has is a building block. */
export function isBuildingBlock(facets: Pick<Facets, "course">): boolean {
  return facets.course.length > 0 && facets.course.every((course) => BUILDING_BLOCKS.includes(course));
}

/** What each layer is called on a screen. */
export const LAYER_NAMES: { readonly [L in FacetLayer]: string } = {
  course: "Course",
  meal: "Meal",
  cuisine: "Cuisine",
  diet: "Diet",
  mainIngredient: "Main ingredient",
  method: "Method",
  season: "Season",
};

/** What each value is called on a screen, en-AU. "Starter", not "entrée", which means the main in an American recipe. */
export const FACET_LABELS: { readonly [L in FacetLayer]: { readonly [V in Facets[L][number]]: string } } = {
  course: {
    main: "Main",
    soup: "Soup",
    salad: "Salad",
    side: "Side",
    starter: "Starter",
    dessert: "Dessert",
    baking: "Baking",
    snack: "Snack",
    drink: "Drink",
    sauce: "Sauce or dressing",
    condiment: "Condiment or preserve",
    "spice-mix": "Spice mix or marinade",
    stock: "Stock or base",
    dough: "Dough or pastry",
  },
  meal: { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner" },
  cuisine: {
    australian: "Australian",
    british: "British",
    french: "French",
    italian: "Italian",
    spanish: "Spanish",
    greek: "Greek",
    "eastern-european": "Eastern European",
    "middle-eastern": "Middle Eastern",
    "north-african": "North African",
    american: "American",
    "latin-american": "Latin American",
    indian: "Indian",
    "sri-lankan": "Sri Lankan",
    chinese: "Chinese",
    japanese: "Japanese",
    korean: "Korean",
    thai: "Thai",
    vietnamese: "Vietnamese",
    "southeast-asian": "Southeast Asian",
  },
  diet: {
    vegetarian: "Vegetarian",
    vegan: "Vegan",
    pescatarian: "Pescatarian",
    "gluten-free": "Gluten-free",
    "dairy-free": "Dairy-free",
    "nut-free": "Nut-free",
  },
  mainIngredient: {
    chicken: "Chicken",
    beef: "Beef",
    lamb: "Lamb",
    pork: "Pork",
    fish: "Fish",
    seafood: "Seafood",
    eggs: "Eggs",
    tofu: "Tofu",
    legumes: "Beans and lentils",
    cheese: "Cheese",
    vegetables: "Vegetables",
    pasta: "Pasta and noodles",
    rice: "Rice and grains",
  },
  method: {
    oven: "Oven",
    stovetop: "Stovetop",
    bbq: "Barbecue",
    "slow-cooker": "Slow cooker",
    "pressure-cooker": "Pressure cooker",
    "air-fryer": "Air fryer",
    "no-cook": "No cook",
  },
  season: { summer: "Summer", autumn: "Autumn", winter: "Winter", spring: "Spring" },
};

/** One value's label, for a caller holding a layer and a value it has not narrowed. */
export function facetLabel(layer: FacetLayer, value: string): string {
  return (FACET_LABELS[layer] as Record<string, string>)[value] ?? value;
}
