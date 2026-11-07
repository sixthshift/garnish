import { cook, type DevRecipe, fixedId, ing, item, step, tag } from "../build";

const SHAKSHUKA = {
  recipe: fixedId("shakshuka"),
  oil: fixedId("shakshuka-oil"),
  onion: fixedId("shakshuka-onion"),
  capsicum: fixedId("shakshuka-capsicum"),
  garlic: fixedId("shakshuka-garlic"),
  cumin: fixedId("shakshuka-cumin"),
  paprika: fixedId("shakshuka-paprika"),
  harissa: fixedId("shakshuka-harissa"),
  tomatoes: fixedId("shakshuka-tomatoes"),
  sugar: fixedId("shakshuka-sugar"),
  salt: fixedId("shakshuka-salt"),
  eggs: fixedId("shakshuka-eggs"),
  feta: fixedId("shakshuka-feta"),
  coriander: fixedId("shakshuka-coriander"),
  bread: fixedId("shakshuka-bread"),
  soften: fixedId("shakshuka-step-soften"),
  spice: fixedId("shakshuka-step-spice"),
  simmer: fixedId("shakshuka-step-simmer"),
  eggStep: fixedId("shakshuka-step-eggs"),
  finish: fixedId("shakshuka-step-finish"),
};

const input: DevRecipe["input"] = {
  id: SHAKSHUKA.recipe,
  name: "Shakshuka",
  description: "Eggs poached in a spiced tomato and capsicum sauce, finished with feta and coriander. Weekend brunch from one pan, with bread to mop it up.",
  rating: 4,
  recipeServings: 4,
  recipeYieldQuantity: 4,
  yieldUnit: null,
  recipeYield: "servings",
  prepTime: 10,
  performTime: 30,
  sourceUrl: null,
  favourite: false,
  kind: "rotation",
  facets: {
    course: ["main"],
    meal: ["breakfast", "lunch"],
    cuisine: ["middle-eastern", "north-african"],
    diet: ["vegetarian"],
    mainIngredient: ["eggs"],
    method: ["stovetop"],
  },
  tags: [tag("Quick"), tag("Brunch")],
  notes: [{ title: "Heat", text: "Harissa varies a lot between brands. Start with 1 tablespoon and add more at the tasting step." }],
  parts: [
    {
      name: "",
      ingredients: [
        ing(SHAKSHUKA.oil, 2, "tablespoon", "olive oil"),
        ing(SHAKSHUKA.onion, 1, null, "onion", { note: "thinly sliced" }),
        ing(SHAKSHUKA.capsicum, 2, null, "red capsicum", {
          note: "thinly sliced",
          alternatives: [{ note: "drained; skip the softening time", items: [item("roasted capsicum", 200, "gram")] }],
        }),
        ing(SHAKSHUKA.garlic, 3, "clove", "garlic", { note: "thinly sliced" }),
        ing(SHAKSHUKA.cumin, 1, "teaspoon", "ground cumin"),
        ing(SHAKSHUKA.paprika, 1, "teaspoon", "smoked paprika"),
        ing(SHAKSHUKA.harissa, 1, "tablespoon", "harissa"),
        ing(SHAKSHUKA.tomatoes, 2, "can", "canned tomatoes"),
        ing(SHAKSHUKA.sugar, 1, "teaspoon", "brown sugar"),
        ing(SHAKSHUKA.salt, null, null, "salt"),
        ing(SHAKSHUKA.eggs, 6, null, "egg"),
        ing(SHAKSHUKA.feta, 80, "gram", "feta", { note: "crumbled" }),
        ing(SHAKSHUKA.coriander, 0.5, "bunch", "coriander", { note: "leaves picked" }),
        ing(SHAKSHUKA.bread, null, null, "crusty bread", { note: "to serve" }),
      ],
      steps: [
        step(
          SHAKSHUKA.soften,
          "Soften the capsicum",
          "Heat the olive oil in a large deep frying pan over medium heat. Add the onion and red capsicum and cook, stirring now and then, until soft and sweet, 10–12 minutes.",
          "Take the full time: undercooked capsicum stays crunchy and sharp in the finished sauce.",
          [SHAKSHUKA.oil, SHAKSHUKA.onion, SHAKSHUKA.capsicum]
        ),
        step(SHAKSHUKA.spice, "Toast the spices", "Add the garlic, ground cumin, smoked paprika and harissa and stir until fragrant, about 1 minute.", "", [
          SHAKSHUKA.garlic,
          SHAKSHUKA.cumin,
          SHAKSHUKA.paprika,
          SHAKSHUKA.harissa,
        ]),
        step(
          SHAKSHUKA.simmer,
          "Simmer the sauce",
          "Tip in the canned tomatoes and brown sugar, crushing the tomatoes against the pan. Simmer until thick enough that a spoon dragged through leaves a trail, 10–15 minutes. Taste and season with salt.",
          "A thin sauce lets the eggs spread and run together. The sauce can be made a day ahead and reheated before the eggs go in.",
          [SHAKSHUKA.tomatoes, SHAKSHUKA.sugar, SHAKSHUKA.salt]
        ),
        step(
          SHAKSHUKA.eggStep,
          "Poach the eggs",
          "Make 6 wells in the sauce with the back of a spoon and crack an egg into each. Cover and cook over low heat until the whites are set and the yolks still runny, 6–8 minutes.",
          "The whites near the yolk set last; spoon a little sauce over any that stay clear. Take the pan off while the yolks still wobble, as they keep cooking.",
          [SHAKSHUKA.eggs]
        ),
        step(SHAKSHUKA.finish, "Finish and serve", "Scatter the feta and coriander over the top and serve straight from the pan with the crusty bread.", "", [
          SHAKSHUKA.feta,
          SHAKSHUKA.coriander,
          SHAKSHUKA.bread,
        ]),
      ],
    },
  ],
};

export const shakshuka: DevRecipe = {
  input,
  createdDaysAgo: 210,
  updatedDaysAgo: 180,
  cooks: [cook(170, "Roasted capsicum from the jar. Fine, a bit less sweet."), cook(60, "", 2), cook(4, "Sunday brunch. Two harissa, which was right.")],
  image: "shakshuka.jpg",
  stepImages: [{ stepId: SHAKSHUKA.eggStep, file: "shakshuka-poach.jpg" }],
};
