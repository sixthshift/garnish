import { type DevRecipe, fixedId, ing, item, step, tag } from "../build";

const QUICHE = {
  recipe: fixedId("quiche-lorraine"),
  pastry: fixedId("quiche-lorraine-pastry"),
  bacon: fixedId("quiche-lorraine-bacon"),
  onion: fixedId("quiche-lorraine-onion"),
  egg: fixedId("quiche-lorraine-egg"),
  cream: fixedId("quiche-lorraine-cream"),
  milk: fixedId("quiche-lorraine-milk"),
  cheese: fixedId("quiche-lorraine-cheese"),
  nutmeg: fixedId("quiche-lorraine-nutmeg"),
  pepper: fixedId("quiche-lorraine-pepper"),
  chives: fixedId("quiche-lorraine-chives"),
  blind: fixedId("quiche-lorraine-step-blind"),
  fry: fixedId("quiche-lorraine-step-bacon"),
  custard: fixedId("quiche-lorraine-step-custard"),
  bake: fixedId("quiche-lorraine-step-bake"),
};

const input: DevRecipe["input"] = {
  id: QUICHE.recipe,
  name: "Quiche Lorraine",
  description: "Smoky bacon and gruyère set in a just-wobbling custard in a crisp, blind-baked case. Best warm or at room temperature with a green salad.",
  rating: null,
  recipeServings: 8,
  recipeYieldQuantity: 8,
  yieldUnit: null,
  recipeYield: "servings",
  prepTime: 30,
  performTime: 65,
  sourceUrl: "https://www.sbs.com.au/food/recipe/example-recipe",
  favourite: false,
  kind: "weekend",
  facets: {
    course: ["main"],
    meal: ["lunch"],
    cuisine: ["french"],
    diet: ["nut-free"],
    mainIngredient: ["eggs", "pork"],
    method: ["oven", "stovetop"],
  },
  tags: [tag("Entertaining"), tag("Make ahead")],
  notes: [
    {
      title: "A soggy base",
      text: "The blind bake is what keeps the base crisp. Do not skip the second bake without the weights; the base should look dry and sandy before the filling goes in.",
    },
  ],
  parts: [
    {
      name: "",
      ingredients: [
        ing(QUICHE.pastry, 400, "gram", "shortcrust pastry", {
          alternatives: [{ note: "2 store-bought sheets, joined to fit the tin", items: [item("shortcrust pastry")] }],
        }),
        ing(QUICHE.bacon, 200, "gram", "bacon", { note: "rind removed, cut into 1 cm strips" }),
        ing(QUICHE.onion, 1, null, "onion", { note: "finely sliced" }),
        ing(QUICHE.egg, 4, null, "egg"),
        ing(QUICHE.cream, 300, "millilitre", "pure cream"),
        ing(QUICHE.milk, 100, "millilitre", "milk"),
        ing(QUICHE.cheese, 100, "gram", "gruyère", { note: "grated", alternatives: [{ items: [item("cheddar")] }] }),
        ing(QUICHE.nutmeg, 1, "pinch", "ground nutmeg", { fixed: true }),
        ing(QUICHE.pepper, null, null, "black pepper"),
        ing(QUICHE.chives, 2, "tablespoon", "chives", { note: "finely chopped" }),
      ],
      steps: [
        step(
          QUICHE.blind,
          "Blind bake the case",
          "Preheat the oven to 180°C fan (200°C conventional). Line the chilled shortcrust pastry case with baking paper, fill with pastry weights and bake for 15 minutes. Remove the paper and weights and bake until the base looks dry and pale golden, 8–10 minutes more.",
          "Rice or dried beans work as weights. If the base puffs up, press it down gently with the back of a spoon. A small crack can be patched with a scrap of raw pastry.",
          [QUICHE.pastry]
        ),
        step(
          QUICHE.fry,
          "Fry the bacon",
          "Meanwhile, fry the bacon in a frying pan over medium heat until golden and the fat has rendered, 5–6 minutes. Add the onion and cook until soft, 5 minutes. Drain on paper towel.",
          "",
          [QUICHE.bacon, QUICHE.onion]
        ),
        step(
          QUICHE.custard,
          "Mix the custard",
          "Whisk the egg, pure cream, milk, ground nutmeg and a good grind of black pepper in a jug until smooth.",
          "No salt: the bacon and gruyère bring plenty.",
          [QUICHE.egg, QUICHE.cream, QUICHE.milk, QUICHE.nutmeg, QUICHE.pepper]
        ),
        step(
          QUICHE.bake,
          "Fill and bake",
          "Reduce the oven to 150°C fan (170°C conventional). Scatter the bacon, onion and gruyère over the base, then pour in the custard and scatter with the chives. Bake until the filling is just set with a slight wobble in the centre, 35–40 minutes. Cool for 20 minutes before slicing.",
          "Set the tin on a tray before filling it, so it can go into the oven without spilling. The centre firms as it cools; an overbaked quiche weeps. Keeps 3 days in the fridge.",
          [QUICHE.bacon, QUICHE.onion, QUICHE.cheese, QUICHE.chives]
        ),
      ],
    },
  ],
};

export const quicheLorraine: DevRecipe = {
  input,
  createdDaysAgo: 3,
  updatedDaysAgo: 3,
  cooks: [],
  image: "quicheLorraine.jpg",
};
