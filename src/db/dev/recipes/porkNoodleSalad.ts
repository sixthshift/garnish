import { cook, type DevRecipe, fixedId, ing, item, step, tag } from "../build";

const SLUG = "vietnamese-lemongrass-pork-noodle-salad";
const id = (label: string) => fixedId(`${SLUG}-${label}`);

const PORK = {
  recipe: fixedId(SLUG),
  pork: id("pork"),
  lemongrass: id("lemongrass"),
  garlic: id("garlic"),
  shallot: id("shallot"),
  fishSauce: id("fish-sauce"),
  palmSugar: id("palm-sugar"),
  oil: id("oil"),
  pepper: id("pepper"),
  marinate: id("step-marinate"),
  grill: id("step-grill"),
  nFishSauce: id("nuoc-fish-sauce"),
  nLime: id("nuoc-lime"),
  nSugar: id("nuoc-sugar"),
  nWater: id("nuoc-water"),
  nGarlic: id("nuoc-garlic"),
  nChilli: id("nuoc-chilli"),
  mix: id("step-nuoc-cham"),
  noodles: id("salad-noodles"),
  lettuce: id("salad-lettuce"),
  cucumber: id("salad-cucumber"),
  carrot: id("salad-carrot"),
  sprouts: id("salad-sprouts"),
  mint: id("salad-mint"),
  coriander: id("salad-coriander"),
  peanuts: id("salad-peanuts"),
  shallots: id("salad-fried-shallots"),
  soak: id("step-soak"),
  assemble: id("step-assemble"),
};

const input: DevRecipe["input"] = {
  id: PORK.recipe,
  name: "Vietnamese Lemongrass Pork Noodle Salad",
  description:
    "Charred lemongrass pork over cold rice noodles with a pile of herbs, crunchy vegetables and a sharp, sweet nuoc cham to pour over. A summer dinner off the barbecue.",
  rating: 4,
  recipeServings: 4,
  recipeYieldQuantity: 4,
  yieldUnit: null,
  recipeYield: "servings",
  prepTime: 30,
  performTime: 15,
  sourceUrl: "https://www.sbs.com.au/food/recipe/example-recipe",
  favourite: false,
  kind: "rotation",
  facets: {
    course: ["main", "salad"],
    meal: ["lunch", "dinner"],
    cuisine: ["vietnamese"],
    diet: ["dairy-free", "gluten-free"],
    mainIngredient: ["pork"],
    method: ["bbq"],
    season: ["summer"],
  },
  tags: [tag("Entertaining")],
  notes: [
    {
      title: "Make ahead",
      text: "The nuoc cham, the vegetables and the marinade can all be done in the morning. The noodles and the pork take 15 minutes at dinner.",
    },
  ],
  parts: [
    {
      name: "",
      ingredients: [
        ing(PORK.pork, 600, "gram", "pork shoulder", {
          note: "thinly sliced",
          alternatives: [{ note: "shaped into small flat patties", items: [item("pork mince")] }],
        }),
        ing(PORK.lemongrass, 2, null, "lemongrass", { note: "stalks, white part only, finely chopped" }),
        ing(PORK.garlic, 3, "clove", "garlic"),
        ing(PORK.shallot, 2, null, "red asian shallot", { note: "chopped" }),
        ing(PORK.fishSauce, 2, "tablespoon", "fish sauce"),
        ing(PORK.palmSugar, 1, "tablespoon", "palm sugar", { note: "grated" }),
        ing(PORK.oil, 1, "tablespoon", "vegetable oil"),
        ing(PORK.pepper, 0.5, "teaspoon", "black pepper"),
      ],
      steps: [
        step(
          PORK.marinate,
          "Marinate the pork",
          "Pound the lemongrass, garlic and red Asian shallot to a rough paste in a mortar and pestle. Mix in the fish sauce, palm sugar, vegetable oil and black pepper, then add the pork shoulder, toss to coat and marinate for at least 1 hour.",
          "A small food processor makes the paste just as well. Overnight in the fridge is better still.",
          [PORK.lemongrass, PORK.garlic, PORK.shallot, PORK.fishSauce, PORK.palmSugar, PORK.oil, PORK.pepper, PORK.pork]
        ),
        step(
          PORK.grill,
          "Char the pork",
          "Heat a barbecue grill to high. Cook the pork shoulder until charred at the edges and cooked through, 2–3 minutes each side.",
          "The sugar in the marinade chars quickly; that char is the flavour, but move the pork to a cooler part of the grill if it starts to blacken. A grill pan over high heat on the stovetop works the same way, in batches.",
          [PORK.pork]
        ),
      ],
    },
    {
      name: "Nuoc cham",
      ingredients: [
        ing(PORK.nFishSauce, 3, "tablespoon", "fish sauce"),
        ing(PORK.nLime, 3, "tablespoon", "lime juice"),
        ing(PORK.nSugar, 2, "tablespoon", "caster sugar"),
        ing(PORK.nWater, 125, "millilitre", "water", { note: "warm" }),
        ing(PORK.nGarlic, 1, "clove", "garlic", { note: "finely chopped" }),
        ing(PORK.nChilli, 1, null, "bird's eye chilli", { note: "finely chopped" }),
      ],
      steps: [
        step(
          PORK.mix,
          "Mix the nuoc cham",
          "Stir the caster sugar into the water until dissolved, then add the fish sauce, lime juice, garlic and bird's eye chilli.",
          "Taste it: sour, salty and sweet should sit in balance, so adjust with more lime juice or sugar. Keeps a week in the fridge.",
          [PORK.nSugar, PORK.nWater, PORK.nFishSauce, PORK.nLime, PORK.nGarlic, PORK.nChilli]
        ),
      ],
    },
    {
      name: "Salad",
      ingredients: [
        ing(PORK.noodles, 200, "gram", "rice vermicelli"),
        ing(PORK.lettuce, 0.5, null, "cos lettuce", { note: "shredded" }),
        ing(PORK.cucumber, 1, null, "lebanese cucumber", { note: "cut into matchsticks" }),
        ing(PORK.carrot, 1, null, "carrot", { note: "cut into matchsticks" }),
        ing(PORK.sprouts, 1, "cup", "bean sprouts"),
        ing(PORK.mint, 1, "bunch", "mint", { note: "leaves picked" }),
        ing(PORK.coriander, 1, "bunch", "coriander", { note: "leaves picked" }),
        ing(PORK.peanuts, 50, "gram", "peanuts", { note: "roasted and chopped" }),
        ing(PORK.shallots, 2, "tablespoon", "crispy fried shallots"),
      ],
      steps: [
        step(
          PORK.soak,
          "Soak the noodles",
          "Cover the rice vermicelli with boiling water and stand until soft, 3–4 minutes. Drain, rinse under cold water and drain well.",
          "Rinsing stops them cooking and washes off the starch that glues them together.",
          [PORK.noodles]
        ),
        step(
          PORK.assemble,
          "Assemble the bowls",
          "Divide the rice vermicelli among bowls and pile the cos lettuce, Lebanese cucumber, carrot, bean sprouts, mint and coriander alongside. Top with the pork, scatter with the peanuts and crispy fried shallots, and serve the nuoc cham to pour over.",
          "",
          [PORK.noodles, PORK.lettuce, PORK.cucumber, PORK.carrot, PORK.sprouts, PORK.mint, PORK.coriander, PORK.peanuts, PORK.shallots]
        ),
      ],
    },
  ],
};

export const porkNoodleSalad: DevRecipe = {
  input,
  createdDaysAgo: 140,
  updatedDaysAgo: 110,
  cooks: [cook(110, "On the barbecue for friends. Doubled the nuoc cham and it all went.", 8), cook(45, "Grill pan, two batches. Still good.")],
  image: "porkNoodleSalad.jpg",
  stepImages: [{ stepId: PORK.grill, file: "porkNoodleSalad-char.jpg" }],
};
