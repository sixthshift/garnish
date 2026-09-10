// Server-only. Demo recipes for `bun run seed --sample`: three en-AU metric
// recipes written as RecipeInput documents and saved through the recipe
// repository, so they take exactly the path the editor does. Idempotent by
// slug: a recipe whose slug already exists is skipped, so a re-run adds nothing.
import type { Database } from "bun:sqlite";
import { type ingredientInputSchema, recipeInputSchema, type Food, type Recipe, type RecipeInput, type Tag, type Unit } from "../domain/recipe";
import type { z } from "zod";
import { slugify } from "./names";
import { recipes } from "./recipes";
import { DEFAULT_UNITS } from "./seed";

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
  return { id: NEW, name, pluralName, aliases: [], aisle: null, recipeId: null, skipShopping: false };
}

function tag(name: string): Tag {
  return { id: NEW, name, slug: slugify(name) };
}

type Ing = z.input<typeof ingredientInputSchema>;

/** `quantity unit food, note`. Unit and note optional. */
function ing(quantity: number | null, unitName: string | null, foodName: string, opts: { plural?: string; note?: string; fixed?: boolean } = {}): Ing {
  return {
    quantity,
    unit: unitName ? unit(unitName) : null,
    food: food(foodName, opts.plural ?? null),
    note: opts.note ?? "",
    fixed: opts.fixed ?? false,
  };
}

/** A line kept verbatim: no food, no amount, only the original text. */
function raw(originalText: string): Ing {
  return { quantity: null, unit: null, food: null, note: "", originalText, fixed: false };
}

const step = (text: string) => ({ text });

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
    tags: [tag("Baking"), tag("Biscuits")],
    notes: [
      { title: "Chewy or crisp", text: "Bake 12 minutes for chewy biscuits, 15 for crisp ones. They firm up as they cool." },
      { title: "Storage", text: "Airtight tin, room temperature, up to a week." },
    ],
    components: [
      {
        name: "",
        ingredients: [
          ing(1, "cup", "rolled oats"),
          ing(1, "cup", "plain flour"),
          ing(1, "cup", "desiccated coconut"),
          ing(150, "gram", "brown sugar"),
          ing(125, "gram", "butter", { note: "chopped" }),
          ing(2, "tablespoon", "golden syrup"),
          ing(1, "teaspoon", "bicarbonate of soda"),
          ing(2, "tablespoon", "boiling water"),
        ],
        steps: [
          step("Preheat the oven to 160°C fan-forced. Line two trays with baking paper."),
          step("Mix the oats, flour, coconut and sugar in a large bowl."),
          step("Melt the butter and golden syrup in a small saucepan over low heat."),
          step("Dissolve the bicarb in the boiling water, stir into the butter mixture, then pour over the dry ingredients and mix well."),
          step("Roll tablespoons of mixture into balls, place 5 cm apart and flatten slightly."),
          step("Bake 12 to 15 minutes until golden. Cool on the trays for 5 minutes before moving to a rack."),
        ],
      },
    ],
  },

  // Two components with their own steps, and recipe-level steps for the assembly.
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
    sourceUrl: null,
    tags: [tag("Soup"), tag("Vegetarian"), tag("Weeknight")],
    notes: [{ title: "Make ahead", text: "The soup keeps 4 days in the fridge and freezes well. Make the croutons on the day." }],
    components: [
      {
        name: "Soup",
        ingredients: [
          ing(1.2, "kilogram", "Kent pumpkin", { note: "peeled, seeded and cut into 3 cm chunks" }),
          ing(1, null, "brown onion", { plural: "brown onions", note: "roughly chopped" }),
          ing(3, "clove", "garlic", { note: "unpeeled" }),
          ing(2, "tablespoon", "olive oil"),
          ing(1, null, "bay leaf", { plural: "bay leaves", fixed: true }),
          ing(1, "litre", "vegetable stock"),
          ing(100, "millilitre", "thickened cream"),
          ing(null, null, "salt", { note: "to taste" }),
          ing(null, null, "black pepper", { note: "freshly ground" }),
        ],
        steps: [
          step("Preheat the oven to 200°C. Toss the pumpkin, onion and garlic with the oil on a large tray, season, and roast 35 minutes until soft and browned at the edges."),
          step("Squeeze the garlic from its skins into a large saucepan with the roasted vegetables, bay leaf and stock. Simmer 10 minutes."),
          step("Discard the bay leaf. Blend until smooth, stir in the cream and season."),
        ],
      },
      {
        name: "Garlic croutons",
        ingredients: [
          ing(2, "slice", "sourdough", { note: "day-old, cut into 2 cm cubes" }),
          ing(1, "tablespoon", "olive oil"),
          ing(1, "clove", "garlic", { note: "crushed" }),
        ],
        steps: [step("Toss the bread with the oil and garlic. Bake at 200°C for 8 to 10 minutes, turning once, until golden.")],
      },
    ],
    steps: [step("Ladle the soup into warm bowls and top with the croutons and a grind of pepper.")],
  },

  // Three components, in order.
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
    components: [
      {
        name: "Pastry",
        ingredients: [
          ing(200, "gram", "plain flour"),
          ing(100, "gram", "butter", { note: "cold, cubed" }),
          ing(50, "gram", "icing sugar"),
          ing(1, null, "egg yolk", { plural: "egg yolks" }),
          ing(1, "pinch", "salt", { fixed: true }),
          ing(1, "tablespoon", "cold water", { note: "if needed" }),
        ],
        steps: [
          step("Rub the butter into the flour, icing sugar and salt until it looks like breadcrumbs. Add the yolk and enough water to bring it together."),
          step("Wrap and chill 30 minutes. Roll out to line a 23 cm tart tin, trim, and chill again."),
          step("Blind bake at 180°C for 20 minutes with baking paper and weights, then 5 minutes without, until pale gold."),
        ],
      },
      {
        name: "Filling",
        ingredients: [
          ing(4, null, "egg", { plural: "eggs" }),
          ing(150, "gram", "caster sugar"),
          ing(150, "millilitre", "lemon juice", { note: "about 4 lemons" }),
          raw("Finely grated zest of 2 lemons"),
          ing(150, "millilitre", "thickened cream"),
        ],
        steps: [
          step("Turn the oven down to 150°C."),
          step("Whisk the eggs and sugar until just combined, then whisk in the lemon juice, zest and cream."),
          step("Pour into the warm pastry case and bake 25 minutes, until set at the edges with a slight wobble in the centre."),
        ],
      },
      {
        name: "To finish",
        ingredients: [raw("Icing sugar, for dusting"), ing(150, "millilitre", "double cream", { note: "to serve" })],
        steps: [step("Cool completely in the tin, then chill at least 2 hours."), step("Dust with icing sugar and serve with cream.")],
      },
    ],
  },
];

export type SampleResult = { recipes: Recipe[] };

/**
 * Insert every sample recipe whose slug is not already taken, through the
 * recipe repository, in one transaction. Returns only the recipes created on
 * this run. Units, foods and tags the samples name are matched to existing
 * rows case-insensitively and created when missing, so this works with or
 * without the units seed (the CLI runs that first).
 */
export function seedSample(db: Database): SampleResult {
  const repo = recipes(db);
  const run = db.transaction((): Recipe[] => {
    const created: Recipe[] = [];
    for (const doc of SAMPLE_RECIPES) {
      if (repo.get(slugify(doc.name)) !== null) continue;
      created.push(repo.create(recipeInputSchema.parse(doc)));
    }
    return created;
  });
  return { recipes: run() };
}
