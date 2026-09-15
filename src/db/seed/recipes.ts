// The demo recipe documents for `bun run seed --sample`, and the small builders
// that keep them readable. Data only — `seed.ts` inserts them through the recipe
// repository, so they take exactly the path the editor does.
//
// Three en-AU metric recipes: one flat (a single unnamed part), one with
// named parts, one carrying a source URL. One is favourited and one has
// timeline events (see ./timeline.ts), so every stage 2 screen has something to
// show without a person seeding it by hand.
import type { z } from "zod";
import { type ingredientInputSchema, type RecipeInput } from "../../domain/recipe";
import { type Food, type Tag, type Unit } from "../../domain/reference";
import { slugify } from "../../lib/names";
import { DEFAULT_UNITS } from "./units";

// Reference rows are resolved by name (case-insensitive) when this id is not
// found, and a name nobody has yet is inserted, so the documents carry no real
// ids of their own. The repository never keeps this id for a new row.
const NEW = "00000000-0000-4000-8000-000000000000";

/** A unit reference by name, copying the default unit's attributes when it is one. */
function unit(name: string): Unit {
  const known = DEFAULT_UNITS.find((u) => u.name === name);
  return {
    id: NEW,
    name,
    pluralName: known?.pluralName ?? null,
    abbreviation: known?.abbreviation ?? "",
    useAbbreviation: known?.useAbbreviation ?? false,
    fraction: known?.fraction ?? true,
    standardQuantity: null,
    standardUnitId: null,
  };
}

function food(name: string, pluralName: string | null = null): Food {
  return { id: NEW, name, pluralName, aliases: [], aisle: null, recipeId: null, skipShopping: false, conversions: [] };
}

function tag(name: string): Tag {
  return { id: NEW, name, slug: slugify(name) };
}

type Ing = z.input<typeof ingredientInputSchema>;

/** `quantity unit food, note`. Unit and note optional. */
function ing(
  quantity: number | null,
  unitName: string | null,
  foodName: string,
  opts: { plural?: string; note?: string; fixed?: boolean; id?: string } = {},
): Ing {
  return {
    id: opts.id,
    quantity,
    unit: unitName ? unit(unitName) : null,
    food: food(foodName, opts.plural ?? null),
    note: opts.note ?? "",
    fixed: opts.fixed ?? false,
  };
}

/** A line kept verbatim: no food, no amount, only the original text. */
function raw(originalText: string, id?: string): Ing {
  return { id, quantity: null, unit: null, food: null, note: "", originalText, fixed: false };
}

/** `text`, plus the ids of this part's rows the step uses, in link order. */
const step = (text: string, ingredientIds: string[] = []) => ({ text, ingredientIds });

/**
 * A fixed id for a row a step below wants to name, derived from a label
 * unique within this file. Not a real id — the repository keeps it as the
 * row's own id (`repo.ts`'s `line.id ?? crypto.randomUUID()`), the same way a
 * hand-written recipe from the editor would carry one. Only rows a step
 * links need one; the rest are left to get a fresh id on insert, as before.
 */
function rowId(label: string): string {
  let hash = 0;
  for (let i = 0; i < label.length; i += 1) hash = (hash * 31 + label.charCodeAt(i)) >>> 0;
  return `${hash.toString(16).padStart(8, "0")}-0000-4000-8000-000000000000`;
}

// --- Anzac Biscuits: the rows its steps name -------------------------------
const ANZAC_OATS = rowId("anzac-oats");
const ANZAC_FLOUR = rowId("anzac-flour");
const ANZAC_COCONUT = rowId("anzac-coconut");
const ANZAC_SUGAR = rowId("anzac-sugar");
const ANZAC_BUTTER = rowId("anzac-butter");
const ANZAC_SYRUP = rowId("anzac-golden-syrup");
const ANZAC_BICARB = rowId("anzac-bicarb");
const ANZAC_WATER = rowId("anzac-boiling-water");

// --- Roast Pumpkin Soup with Garlic Croutons -------------------------------
const SOUP_PUMPKIN = rowId("soup-pumpkin");
const SOUP_ONION = rowId("soup-onion");
const SOUP_GARLIC = rowId("soup-garlic");
const SOUP_OIL = rowId("soup-oil");
const SOUP_BAY_LEAF = rowId("soup-bay-leaf");
const SOUP_STOCK = rowId("soup-stock");
const SOUP_CREAM = rowId("soup-cream");
const CROUTON_BREAD = rowId("crouton-bread");
const CROUTON_OIL = rowId("crouton-oil");
const CROUTON_GARLIC = rowId("crouton-garlic");

// --- Lemon Tart -------------------------------------------------------------
const PASTRY_FLOUR = rowId("tart-pastry-flour");
const PASTRY_BUTTER = rowId("tart-pastry-butter");
const PASTRY_ICING_SUGAR = rowId("tart-pastry-icing-sugar");
const PASTRY_YOLK = rowId("tart-pastry-yolk");
const PASTRY_SALT = rowId("tart-pastry-salt");
const PASTRY_WATER = rowId("tart-pastry-water");
const FILLING_EGG = rowId("tart-filling-egg");
const FILLING_SUGAR = rowId("tart-filling-sugar");
const FILLING_LEMON_JUICE = rowId("tart-filling-lemon-juice");
const FILLING_ZEST = rowId("tart-filling-zest");
const FILLING_CREAM = rowId("tart-filling-cream");
const FINISH_ICING_SUGAR = rowId("tart-finish-icing-sugar");
const FINISH_CREAM = rowId("tart-finish-cream");

/** The demo documents, in the order they are inserted (the list shows newest first). */
export const SAMPLE_RECIPES: readonly RecipeInput[] = [
  // One unnamed component: the flat recipe.
  {
    name: "Anzac Biscuits",
    description: "Chewy oat and coconut biscuits bound with golden syrup. No eggs, so they keep for a week in a tin.",
    rating: 5,
    recipeServings: 24,
    recipeYieldQuantity: 24,
    recipeYield: "biscuits",
    prepTime: 15,
    performTime: 15,
    favourite: true,
    tags: [tag("Baking"), tag("Biscuits")],
    notes: [
      { title: "Chewy or crisp", text: "Bake 12 minutes for chewy biscuits, 15 for crisp ones. They firm up as they cool." },
      { title: "Storage", text: "Airtight tin, room temperature, up to a week." },
    ],
    parts: [
      {
        name: "",
        ingredients: [
          ing(1, "cup", "rolled oats", { id: ANZAC_OATS }),
          ing(1, "cup", "plain flour", { id: ANZAC_FLOUR }),
          ing(1, "cup", "desiccated coconut", { id: ANZAC_COCONUT }),
          ing(150, "gram", "brown sugar", { id: ANZAC_SUGAR }),
          ing(125, "gram", "butter", { note: "chopped", id: ANZAC_BUTTER }),
          ing(2, "tablespoon", "golden syrup", { id: ANZAC_SYRUP }),
          ing(1, "teaspoon", "bicarbonate of soda", { id: ANZAC_BICARB }),
          ing(2, "tablespoon", "boiling water", { id: ANZAC_WATER }),
        ],
        steps: [
          step("Preheat the oven to 160°C fan-forced. Line two trays with baking paper."),
          step("Mix the oats, flour, coconut and sugar in a large bowl.", [ANZAC_OATS, ANZAC_FLOUR, ANZAC_COCONUT, ANZAC_SUGAR]),
          step("Melt the butter and golden syrup in a small saucepan over low heat.", [ANZAC_BUTTER, ANZAC_SYRUP]),
          step("Dissolve the bicarb in the boiling water, stir into the butter mixture, then pour over the dry ingredients and mix well.", [
            ANZAC_BICARB,
            ANZAC_WATER,
            ANZAC_BUTTER,
          ]),
          step("Roll tablespoons of mixture into balls, place 5 cm apart and flatten slightly."),
          step("Bake 12 to 15 minutes until golden. Cool on the trays for 5 minutes before moving to a rack."),
        ],
      },
    ],
  },

  // Two named parts with their own steps, then the unnamed part for the assembly.
  {
    name: "Roast Pumpkin Soup with Garlic Croutons",
    description: "Kent pumpkin roasted until caramelised, blended with stock and finished with crunchy croutons.",
    rating: 4,
    recipeServings: 4,
    recipeYieldQuantity: 1.5,
    yieldUnit: unit("litre"),
    recipeYield: "",
    prepTime: 15,
    performTime: 45,
    sourceUrl: "https://www.homegrown-kitchen.example/recipes/roast-pumpkin-soup-with-garlic-croutons",
    tags: [tag("Soup"), tag("Vegetarian"), tag("Weeknight")],
    notes: [{ title: "Make ahead", text: "The soup keeps 4 days in the fridge and freezes well. Make the croutons on the day." }],
    parts: [
      {
        name: "Soup",
        ingredients: [
          ing(1.2, "kilogram", "Kent pumpkin", { note: "peeled, seeded and cut into 3 cm chunks", id: SOUP_PUMPKIN }),
          ing(1, null, "brown onion", { plural: "brown onions", note: "roughly chopped", id: SOUP_ONION }),
          ing(3, "clove", "garlic", { note: "unpeeled", id: SOUP_GARLIC }),
          ing(2, "tablespoon", "olive oil", { id: SOUP_OIL }),
          ing(1, null, "bay leaf", { plural: "bay leaves", fixed: true, id: SOUP_BAY_LEAF }),
          ing(1, "litre", "vegetable stock", { id: SOUP_STOCK }),
          ing(100, "millilitre", "thickened cream", { id: SOUP_CREAM }),
          ing(null, null, "salt", { note: "to taste" }),
          ing(null, null, "black pepper", { note: "freshly ground" }),
        ],
        steps: [
          step("Preheat the oven to 200°C. Toss the pumpkin, onion and garlic with the oil on a large tray, season, and roast 35 minutes until soft and browned at the edges.", [
            SOUP_PUMPKIN,
            SOUP_ONION,
            SOUP_GARLIC,
            SOUP_OIL,
          ]),
          step("Squeeze the garlic from its skins into a large saucepan with the roasted vegetables, bay leaf and stock. Simmer 10 minutes.", [
            SOUP_GARLIC,
            SOUP_BAY_LEAF,
            SOUP_STOCK,
          ]),
          step("Discard the bay leaf. Blend until smooth, stir in the cream and season.", [SOUP_BAY_LEAF, SOUP_CREAM]),
        ],
      },
      {
        name: "Garlic croutons",
        ingredients: [
          ing(2, "slice", "sourdough", { note: "day-old, cut into 2 cm cubes", id: CROUTON_BREAD }),
          ing(1, "tablespoon", "olive oil", { id: CROUTON_OIL }),
          ing(1, "clove", "garlic", { note: "crushed", id: CROUTON_GARLIC }),
        ],
        steps: [
          step("Toss the bread with the oil and garlic. Bake at 200°C for 8 to 10 minutes, turning once, until golden.", [
            CROUTON_BREAD,
            CROUTON_OIL,
            CROUTON_GARLIC,
          ]),
        ],
      },
      {
        name: "",
        ingredients: [],
        steps: [step("Ladle the soup into warm bowls and top with the croutons and a grind of pepper.")],
      },
    ],
  },

  // Three parts, in order.
  {
    name: "Lemon Tart",
    description: "Shortcrust pastry with a sharp, just-set lemon filling. Best made the day before serving.",
    rating: 4.5,
    recipeServings: 8,
    recipeYieldQuantity: 1,
    recipeYield: "23 cm tart",
    prepTime: 40,
    performTime: 50,
    tags: [tag("Baking"), tag("Dessert")],
    notes: [
      { title: "Blind baking", text: "Chill the lined tin for 30 minutes before baking so the pastry does not shrink." },
      { title: "Wobble", text: "The filling should still wobble in the centre when it comes out. It sets as it cools." },
    ],
    parts: [
      {
        name: "Pastry",
        ingredients: [
          ing(200, "gram", "plain flour", { id: PASTRY_FLOUR }),
          ing(100, "gram", "butter", { note: "cold, cubed", id: PASTRY_BUTTER }),
          ing(50, "gram", "icing sugar", { id: PASTRY_ICING_SUGAR }),
          ing(1, null, "egg yolk", { plural: "egg yolks", id: PASTRY_YOLK }),
          ing(1, "pinch", "salt", { fixed: true, id: PASTRY_SALT }),
          ing(1, "tablespoon", "cold water", { note: "if needed", id: PASTRY_WATER }),
        ],
        steps: [
          step("Rub the butter into the flour, icing sugar and salt until it looks like breadcrumbs. Add the yolk and enough water to bring it together.", [
            PASTRY_BUTTER,
            PASTRY_FLOUR,
            PASTRY_ICING_SUGAR,
            PASTRY_SALT,
            PASTRY_YOLK,
            PASTRY_WATER,
          ]),
          step("Wrap and chill 30 minutes. Roll out to line a 23 cm tart tin, trim, and chill again."),
          step("Blind bake at 180°C for 20 minutes with baking paper and weights, then 5 minutes without, until pale gold."),
        ],
      },
      {
        name: "Filling",
        ingredients: [
          ing(4, null, "egg", { plural: "eggs", id: FILLING_EGG }),
          ing(150, "gram", "caster sugar", { id: FILLING_SUGAR }),
          ing(150, "millilitre", "lemon juice", { note: "about 4 lemons", id: FILLING_LEMON_JUICE }),
          raw("Finely grated zest of 2 lemons", FILLING_ZEST),
          ing(150, "millilitre", "thickened cream", { id: FILLING_CREAM }),
        ],
        steps: [
          step("Turn the oven down to 150°C."),
          step("Whisk the eggs and sugar until just combined, then whisk in the lemon juice, zest and cream.", [
            FILLING_EGG,
            FILLING_SUGAR,
            FILLING_LEMON_JUICE,
            FILLING_ZEST,
            FILLING_CREAM,
          ]),
          step("Pour into the warm pastry case and bake 25 minutes, until set at the edges with a slight wobble in the centre."),
        ],
      },
      {
        name: "To finish",
        ingredients: [raw("Icing sugar, for dusting", FINISH_ICING_SUGAR), ing(150, "millilitre", "double cream", { note: "to serve", id: FINISH_CREAM })],
        steps: [
          step("Cool completely in the tin, then chill at least 2 hours."),
          step("Dust with icing sugar and serve with cream.", [FINISH_ICING_SUGAR, FINISH_CREAM]),
        ],
      },
    ],
  },
];
