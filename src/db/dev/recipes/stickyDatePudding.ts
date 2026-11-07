import { type DevRecipe, fixedId, ing, item, step, tag } from "../build";

const PUDDING = {
  recipe: fixedId("sticky-date-pudding-with-butterscotch-sauce"),
  dates: fixedId("sticky-date-pudding-with-butterscotch-sauce-dates"),
  water: fixedId("sticky-date-pudding-with-butterscotch-sauce-water"),
  bicarb: fixedId("sticky-date-pudding-with-butterscotch-sauce-bicarb"),
  butter: fixedId("sticky-date-pudding-with-butterscotch-sauce-butter"),
  sugar: fixedId("sticky-date-pudding-with-butterscotch-sauce-sugar"),
  egg: fixedId("sticky-date-pudding-with-butterscotch-sauce-egg"),
  vanilla: fixedId("sticky-date-pudding-with-butterscotch-sauce-vanilla"),
  flour: fixedId("sticky-date-pudding-with-butterscotch-sauce-flour"),
  iceCream: fixedId("sticky-date-pudding-with-butterscotch-sauce-ice-cream"),
  soak: fixedId("sticky-date-pudding-with-butterscotch-sauce-step-soak"),
  cream: fixedId("sticky-date-pudding-with-butterscotch-sauce-step-cream"),
  fold: fixedId("sticky-date-pudding-with-butterscotch-sauce-step-fold"),
  bake: fixedId("sticky-date-pudding-with-butterscotch-sauce-step-bake"),
  serve: fixedId("sticky-date-pudding-with-butterscotch-sauce-step-serve"),
  sauceSugar: fixedId("sticky-date-pudding-with-butterscotch-sauce-sauce-sugar"),
  sauceButter: fixedId("sticky-date-pudding-with-butterscotch-sauce-sauce-butter"),
  sauceCream: fixedId("sticky-date-pudding-with-butterscotch-sauce-sauce-cream"),
  sauceSalt: fixedId("sticky-date-pudding-with-butterscotch-sauce-sauce-salt"),
  melt: fixedId("sticky-date-pudding-with-butterscotch-sauce-step-melt"),
  simmer: fixedId("sticky-date-pudding-with-butterscotch-sauce-step-simmer"),
};

const input: DevRecipe["input"] = {
  id: PUDDING.recipe,
  name: "Sticky Date Pudding with Butterscotch Sauce",
  description: "A soft, dark date sponge soaked in hot butterscotch sauce. The winter dinner-party dessert that can be baked a day ahead.",
  rating: null,
  recipeServings: 8,
  recipeYieldQuantity: 8,
  yieldUnit: null,
  recipeYield: "servings",
  prepTime: 25,
  performTime: 40,
  sourceUrl: "https://www.abc.net.au/everyday/example-recipe/12345678",
  favourite: false,
  kind: "weekend",
  facets: {
    course: ["dessert"],
    meal: ["dinner"],
    cuisine: ["australian"],
    diet: ["vegetarian", "nut-free"],
    method: ["oven", "stovetop"],
    season: ["winter"],
  },
  tags: [tag("Entertaining"), tag("Make ahead")],
  notes: [
    {
      title: "Make ahead",
      text: "Bake the pudding and make the sauce up to 2 days ahead and keep both in the fridge. Reheat the pudding, covered, in a low oven with a third of the sauce poured over.",
    },
  ],
  parts: [
    {
      name: "",
      ingredients: [
        ing(PUDDING.dates, 250, "gram", "dates", { note: "pitted, chopped" }),
        ing(PUDDING.water, 300, "millilitre", "water"),
        ing(PUDDING.bicarb, 1, "teaspoon", "bicarbonate of soda"),
        ing(PUDDING.butter, 75, "gram", "unsalted butter", { note: "softened" }),
        ing(PUDDING.sugar, 150, "gram", "brown sugar"),
        ing(PUDDING.egg, 2, null, "egg"),
        ing(PUDDING.vanilla, 1, "teaspoon", "vanilla extract", { fixed: true }),
        ing(PUDDING.flour, 175, "gram", "self-raising flour"),
        ing(PUDDING.iceCream, null, null, "vanilla ice cream", { note: "to serve", alternatives: [{ items: [item("thickened cream")] }] }),
      ],
      steps: [
        step(
          PUDDING.soak,
          "Soften the dates",
          "Preheat the oven to 160°C fan (180°C conventional) and grease and line a 20 cm square cake tin. Bring the dates and water to the boil in a small saucepan, then remove from the heat and stir in the bicarbonate of soda. Set aside to cool for 15 minutes.",
          "The mixture foams up when the bicarb goes in; that is what breaks the dates down. Use a pan with room to spare.",
          [PUDDING.dates, PUDDING.water, PUDDING.bicarb]
        ),
        step(
          PUDDING.cream,
          "Cream the butter",
          "Beat the unsalted butter and brown sugar with electric beaters until pale and fluffy, 3–4 minutes. Beat in the egg one at a time, then the vanilla extract.",
          "",
          [PUDDING.butter, PUDDING.sugar, PUDDING.egg, PUDDING.vanilla]
        ),
        step(
          PUDDING.fold,
          "Fold the batter",
          "Fold the self-raising flour into the butter mixture, then stir in the dates and their liquid until combined.",
          "The batter will be very runny. That is right, and it is why the pudding stays moist.",
          [PUDDING.flour, PUDDING.dates]
        ),
        step(
          PUDDING.bake,
          "Bake the pudding",
          "Pour the batter into the tin and bake until risen and a skewer inserted in the centre comes out clean, 35–40 minutes.",
          "Do not open the oven for the first 25 minutes, or the centre may sink.",
          []
        ),
        step(
          PUDDING.serve,
          "Soak and serve",
          "Prick the warm pudding all over with a skewer and pour over a third of the butterscotch sauce. Stand for 5 minutes, then cut into squares and serve with the remaining sauce and the vanilla ice cream.",
          "",
          [PUDDING.iceCream]
        ),
      ],
    },
    {
      name: "Butterscotch sauce",
      ingredients: [
        ing(PUDDING.sauceSugar, 200, "gram", "brown sugar"),
        ing(PUDDING.sauceButter, 100, "gram", "unsalted butter", { note: "chopped" }),
        ing(PUDDING.sauceCream, 300, "millilitre", "thickened cream"),
        ing(PUDDING.sauceSalt, 1, "pinch", "sea salt flakes", { fixed: true }),
      ],
      steps: [
        step(
          PUDDING.melt,
          "Melt the sugar",
          "Stir the brown sugar and unsalted butter in a saucepan over medium heat until the butter melts and the sugar dissolves, 2–3 minutes.",
          "",
          [PUDDING.sauceSugar, PUDDING.sauceButter]
        ),
        step(
          PUDDING.simmer,
          "Simmer the sauce",
          "Pour in the thickened cream, bring to the boil and simmer, stirring, until glossy and slightly thickened, 3–4 minutes. Stir in the sea salt flakes.",
          "The sauce thickens further as it cools. Keeps a week in the fridge; warm it gently before serving.",
          [PUDDING.sauceCream, PUDDING.sauceSalt]
        ),
      ],
    },
  ],
};

export const stickyDatePudding: DevRecipe = {
  input,
  createdDaysAgo: 12,
  updatedDaysAgo: 12,
  cooks: [],
  image: "stickyDatePudding.jpg",
};
