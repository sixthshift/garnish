import { cook, type DevRecipe, fixedId, ing, item, step, tag, unit } from "../build";

const BREAD = {
  recipe: fixedId("banana-bread"),
  butter: fixedId("banana-bread-butter"),
  sugar: fixedId("banana-bread-sugar"),
  egg: fixedId("banana-bread-egg"),
  vanilla: fixedId("banana-bread-vanilla"),
  banana: fixedId("banana-bread-banana"),
  milk: fixedId("banana-bread-milk"),
  flour: fixedId("banana-bread-flour"),
  cinnamon: fixedId("banana-bread-cinnamon"),
  salt: fixedId("banana-bread-salt"),
  walnuts: fixedId("banana-bread-walnuts"),
  prepare: fixedId("banana-bread-step-prepare"),
  cream: fixedId("banana-bread-step-cream"),
  mix: fixedId("banana-bread-step-mix"),
  bake: fixedId("banana-bread-step-bake"),
  cool: fixedId("banana-bread-step-cool"),
};

const input: DevRecipe["input"] = {
  id: BREAD.recipe,
  name: "Banana Bread",
  description:
    "A moist, cinnamon-scented loaf that uses up the blackest bananas in the bowl. Toasted with butter for breakfast, or sliced into the lunchboxes.",
  rating: 5,
  recipeServings: 10,
  recipeYieldQuantity: 1,
  yieldUnit: null,
  recipeYield: "loaf",
  prepTime: 15,
  performTime: 60,
  sourceUrl: null,
  favourite: true,
  facets: {
    course: ["baking"],
    meal: ["breakfast"],
    cuisine: ["australian"],
    diet: ["vegetarian"],
    method: ["oven"],
  },
  tags: [tag("Baking"), tag("Lunchbox"), tag("Freezer")],
  notes: [
    {
      title: "The bananas",
      text: "The blacker the better: spotty, soft bananas are sweeter and mash smoothly. Frozen bananas work once thawed; add the liquid they release too.",
    },
    { title: "Nut-free", text: "Leave out the walnuts for school lunchboxes; nothing else changes." },
  ],
  parts: [
    {
      name: "",
      ingredients: [
        ing(BREAD.butter, 125, "gram", "unsalted butter", { note: "softened" }),
        ing(BREAD.sugar, 150, "gram", "brown sugar"),
        ing(BREAD.egg, 2, null, "egg", { note: "at room temperature" }),
        ing(BREAD.vanilla, 1, "teaspoon", "vanilla extract", { fixed: true }),
        ing(BREAD.banana, 3, null, "banana", { note: "very ripe, mashed (about 1 cup)" }),
        ing(BREAD.milk, 60, "millilitre", "milk"),
        ing(BREAD.flour, 2, "cup", "self-raising flour", {
          alternatives: [
            {
              basisQuantity: 1,
              basisUnit: unit("cup"),
              note: "sift together twice",
              items: [item("plain flour", 1, "cup"), item("baking powder", 2, "teaspoon")],
            },
          ],
        }),
        ing(BREAD.cinnamon, 1, "teaspoon", "ground cinnamon"),
        ing(BREAD.salt, 1, "pinch", "salt", { fixed: true }),
        ing(BREAD.walnuts, 60, "gram", "walnuts", { note: "roughly chopped, optional" }),
      ],
      steps: [
        step(
          BREAD.prepare,
          "Prepare the tin",
          "Preheat the oven to 160°C fan (180°C conventional). Grease a 21 cm × 11 cm loaf tin and line the base and long sides with baking paper, leaving the paper overhanging.",
          "The overhang works as handles to lift the loaf out. A smaller tin gives a taller loaf that needs 10 minutes longer.",
          []
        ),
        step(
          BREAD.cream,
          "Cream the butter",
          "Beat the unsalted butter and brown sugar with electric beaters until pale and creamy, 3–4 minutes. Beat in the egg one at a time, then the vanilla extract.",
          "If the mixture looks curdled after the eggs, beat in 1 tbsp of the flour and it will come back together.",
          [BREAD.butter, BREAD.sugar, BREAD.egg, BREAD.vanilla]
        ),
        step(
          BREAD.mix,
          "Fold in the banana",
          "Stir in the banana and milk. Sift over the self-raising flour, ground cinnamon and salt, then fold with a large spoon until just combined, with no dry pockets left. Fold through the walnuts.",
          "Stop as soon as the flour disappears; overmixing makes a tough, tunnelled loaf.",
          [BREAD.banana, BREAD.milk, BREAD.flour, BREAD.cinnamon, BREAD.salt, BREAD.walnuts]
        ),
        step(
          BREAD.bake,
          "Bake the loaf",
          "Spoon the batter into the tin and smooth the top. Bake until risen, deep golden and a skewer inserted in the centre comes out clean, 55–60 minutes.",
          "If the top browns before the centre is cooked, cover it loosely with foil for the last 15 minutes. A few moist crumbs on the skewer are fine; wet batter is not.",
          []
        ),
        step(
          BREAD.cool,
          "Cool and store",
          "Cool in the tin for 10 minutes, then lift out onto a wire rack to cool completely before slicing.",
          "Keeps 4 days wrapped at room temperature. To freeze, slice it first and wrap the slices in pairs; they keep 3 months and toast straight from frozen.",
          []
        ),
      ],
    },
  ],
};

export const bananaBread: DevRecipe = {
  input,
  createdDaysAgo: 610,
  updatedDaysAgo: 240,
  cooks: [
    cook(500, "First go. Took 65 minutes in our oven."),
    cook(410, "", 10),
    cook(300, "Swapped half the flour for wholemeal; a bit dense but fine."),
    cook(240, "Plain flour and baking powder instead of self-raising. No difference."),
    cook(90, "Doubled, one for the freezer.", 20),
    cook(18, ""),
  ],
  image: "bananaBread.jpg",
  stepImages: [{ stepId: BREAD.bake, file: "bananaBread-bake.jpg" }],
};
