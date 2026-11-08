import { cook, type DevRecipe, fixedId, ing, item, step, tag } from "../build";

const SALAD = {
  recipe: fixedId("roast-pumpkin-fetta-and-rocket-salad"),
  pumpkin: fixedId("roast-pumpkin-fetta-and-rocket-salad-pumpkin"),
  oil: fixedId("roast-pumpkin-fetta-and-rocket-salad-oil"),
  cumin: fixedId("roast-pumpkin-fetta-and-rocket-salad-cumin"),
  salt: fixedId("roast-pumpkin-fetta-and-rocket-salad-salt"),
  onion: fixedId("roast-pumpkin-fetta-and-rocket-salad-onion"),
  pepitas: fixedId("roast-pumpkin-fetta-and-rocket-salad-pepitas"),
  rocket: fixedId("roast-pumpkin-fetta-and-rocket-salad-rocket"),
  feta: fixedId("roast-pumpkin-fetta-and-rocket-salad-feta"),
  roast: fixedId("roast-pumpkin-fetta-and-rocket-salad-step-roast"),
  toast: fixedId("roast-pumpkin-fetta-and-rocket-salad-step-toast"),
  assemble: fixedId("roast-pumpkin-fetta-and-rocket-salad-step-assemble"),
  dressOil: fixedId("roast-pumpkin-fetta-and-rocket-salad-dressing-oil"),
  vinegar: fixedId("roast-pumpkin-fetta-and-rocket-salad-dressing-vinegar"),
  honey: fixedId("roast-pumpkin-fetta-and-rocket-salad-dressing-honey"),
  mustard: fixedId("roast-pumpkin-fetta-and-rocket-salad-dressing-mustard"),
  shake: fixedId("roast-pumpkin-fetta-and-rocket-salad-step-shake"),
};

const input: DevRecipe["input"] = {
  id: SALAD.recipe,
  name: "Roast Pumpkin, Fetta and Rocket Salad",
  description:
    "Cumin-roasted pumpkin and red onion over peppery rocket, with salty fetta, toasted pepitas and a honey-mustard dressing. A lunch on its own or a side to a roast.",
  rating: 4,
  recipeServings: 4,
  recipeYieldQuantity: 4,
  yieldUnit: null,
  recipeYield: "servings",
  prepTime: 15,
  performTime: 35,
  sourceUrl: "https://www.taste.com.au/recipes/example-recipe",
  favourite: false,
  facets: {
    course: ["salad", "side"],
    meal: ["lunch"],
    cuisine: ["australian"],
    diet: ["vegetarian", "gluten-free", "nut-free"],
    mainIngredient: ["vegetables"],
    method: ["oven"],
    season: ["autumn"],
  },
  tags: [tag("Lunchbox"), tag("Make ahead")],
  notes: [
    {
      title: "Leftovers",
      text: "Keep the rocket and dressing apart from the pumpkin; dressed rocket wilts within the hour. The roast pumpkin keeps 3 days in the fridge.",
    },
  ],
  parts: [
    {
      name: "",
      ingredients: [
        ing(SALAD.pumpkin, 1, "kilogram", "butternut pumpkin", {
          note: "peeled, cut into 3 cm pieces",
          alternatives: [{ note: "skin on; it softens in the oven", items: [item("kent pumpkin")] }],
        }),
        ing(SALAD.oil, 2, "tablespoon", "olive oil"),
        ing(SALAD.cumin, 1, "teaspoon", "ground cumin"),
        ing(SALAD.salt, 1, "teaspoon", "sea salt flakes"),
        ing(SALAD.onion, 1, null, "red onion", { note: "cut into thin wedges" }),
        ing(SALAD.pepitas, 40, "gram", "pepitas"),
        ing(SALAD.rocket, 100, "gram", "rocket"),
        ing(SALAD.feta, 150, "gram", "feta", { note: "crumbled" }),
      ],
      steps: [
        step(
          SALAD.roast,
          "Roast the pumpkin",
          "Preheat the oven to 200°C fan (220°C conventional). Toss the butternut pumpkin and red onion with the olive oil, ground cumin and sea salt flakes on a large lined tray. Spread out in one layer and roast, turning once, until the pumpkin is tender and caramelised at the edges, 30–35 minutes.",
          "Use two trays if one is crowded: pumpkin packed close steams and never browns. Leave it to cool for 10 minutes before assembling, or it wilts the rocket.",
          [SALAD.pumpkin, SALAD.onion, SALAD.oil, SALAD.cumin, SALAD.salt]
        ),
        step(
          SALAD.toast,
          "Toast the pepitas",
          "Toast the pepitas in a dry frying pan over medium heat, shaking the pan, until they puff and pop, 2–3 minutes. Tip onto a plate.",
          "They burn quickly once they start popping, so take them off the heat straight away.",
          [SALAD.pepitas]
        ),
        step(
          SALAD.assemble,
          "Assemble the salad",
          "Scatter the rocket over a large platter and top with the roast pumpkin and red onion. Crumble over the feta, scatter with the pepitas and drizzle with the dressing just before serving.",
          "",
          [SALAD.rocket, SALAD.pumpkin, SALAD.onion, SALAD.feta, SALAD.pepitas]
        ),
      ],
    },
    {
      name: "Dressing",
      ingredients: [
        ing(SALAD.dressOil, 60, "millilitre", "extra virgin olive oil"),
        ing(SALAD.vinegar, 2, "tablespoon", "balsamic vinegar", { alternatives: [{ items: [item("red wine vinegar")] }] }),
        ing(SALAD.honey, 2, "teaspoon", "honey", { alternatives: [{ note: "for a vegan dressing", items: [item("maple syrup")] }] }),
        ing(SALAD.mustard, 1, "teaspoon", "dijon mustard"),
      ],
      steps: [
        step(
          SALAD.shake,
          "Shake the dressing",
          "Put the extra virgin olive oil, balsamic vinegar, honey and dijon mustard in a jar, seal and shake until thick and combined.",
          "Keeps a week in the fridge; the oil sets when cold, so stand it at room temperature for 10 minutes and shake again.",
          [SALAD.dressOil, SALAD.vinegar, SALAD.honey, SALAD.mustard]
        ),
      ],
    },
  ],
};

export const pumpkinSalad: DevRecipe = {
  input,
  createdDaysAgo: 220,
  updatedDaysAgo: 140,
  cooks: [cook(150, "Took it to the Easter lunch. Doubled it.", 8), cook(50, "")],
  image: "pumpkinSalad.jpg",
  stepImages: [{ stepId: SALAD.roast, file: "pumpkinSalad-roast.jpg" }],
};
