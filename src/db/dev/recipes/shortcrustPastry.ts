import { cook, type DevRecipe, fixedId, ing, step, tag, unit } from "../build";

const PASTRY = {
  recipe: fixedId("shortcrust-pastry"),
  flour: fixedId("shortcrust-pastry-flour"),
  butter: fixedId("shortcrust-pastry-butter"),
  salt: fixedId("shortcrust-pastry-salt"),
  yolk: fixedId("shortcrust-pastry-yolk"),
  water: fixedId("shortcrust-pastry-water"),
  rub: fixedId("shortcrust-pastry-step-rub"),
  bind: fixedId("shortcrust-pastry-step-bind"),
  rest: fixedId("shortcrust-pastry-step-rest"),
  roll: fixedId("shortcrust-pastry-step-roll"),
};

const input: DevRecipe["input"] = {
  id: PASTRY.recipe,
  name: "Shortcrust Pastry",
  description: "A short, buttery savoury pastry for one 24 cm tart case. Made in a food processor in 5 minutes; the rest is chilling.",
  rating: 4,
  recipeServings: 1,
  recipeYieldQuantity: 400,
  yieldUnit: unit("gram"),
  recipeYield: "",
  prepTime: 15,
  performTime: 0,
  sourceUrl: null,
  favourite: false,
  facets: {
    course: ["dough"],
    cuisine: ["french"],
    diet: ["vegetarian", "nut-free"],
    method: ["no-cook"],
  },
  tags: [tag("Basics"), tag("Freezer")],
  notes: [
    { title: "Sweet pastry", text: "For a sweet tart, add 2 tbsp icing sugar with the flour and leave out the salt." },
    { title: "Freezing", text: "Wrapped well, the disc keeps 3 months frozen. Thaw overnight in the fridge before rolling." },
  ],
  parts: [
    {
      name: "",
      ingredients: [
        ing(PASTRY.flour, 250, "gram", "plain flour"),
        ing(PASTRY.butter, 125, "gram", "unsalted butter", { note: "cold, cut into 1 cm cubes" }),
        ing(PASTRY.salt, 1, "pinch", "salt", { fixed: true }),
        ing(PASTRY.yolk, 1, null, "egg yolk"),
        ing(PASTRY.water, 2, "tablespoon", "water", { note: "iced" }),
      ],
      steps: [
        step(
          PASTRY.rub,
          "Rub in the butter",
          "Pulse the plain flour, unsalted butter and salt in a food processor until the mixture looks like fine breadcrumbs, 10–15 seconds.",
          "By hand, rub the butter into the flour with your fingertips, lifting it as you go to keep it cool. Work quickly: butter that melts now makes a tough pastry.",
          [PASTRY.flour, PASTRY.butter, PASTRY.salt]
        ),
        step(
          PASTRY.bind,
          "Bring it together",
          "Add the egg yolk and 1 tbsp of the water and pulse until the dough just starts to clump. Add the remaining 1 tbsp of water only if it is still dry when pinched.",
          "Stop before it forms a ball in the bowl; the dough comes together as it rests.",
          [PASTRY.yolk, PASTRY.water]
        ),
        step(
          PASTRY.rest,
          "Rest the dough",
          "Tip onto a lightly floured bench, press into a smooth disc about 2 cm thick, wrap and refrigerate for 30 minutes.",
          "Resting relaxes the gluten so the pastry does not shrink in the oven. Keeps 3 days in the fridge.",
          []
        ),
        step(
          PASTRY.roll,
          "Roll and line the tin",
          "Roll the pastry between two sheets of baking paper until 3 mm thick. Ease it into a 24 cm loose-based tart tin, press into the edges and trim the overhang. Chill for 15 minutes before baking.",
          "If it cracks, press the edges back together or patch it with an offcut. Too soft to handle? Return it to the fridge for 10 minutes.",
          []
        ),
      ],
    },
  ],
};

export const shortcrustPastry: DevRecipe = {
  input,
  createdDaysAgo: 160,
  updatedDaysAgo: 160,
  cooks: [cook(120, "Made two discs, froze one."), cook(40, "")],
  image: "shortcrustPastry.jpg",
  makesFood: "shortcrust pastry",
};
