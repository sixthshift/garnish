import { cook, type DevRecipe, fixedId, ing, item, step, tag } from "../build";

const SLUG = "dal-tadka-with-jeera-rice";
const id = (label: string) => fixedId(`${SLUG}-${label}`);

const DAL = {
  recipe: fixedId(SLUG),
  lentils: id("lentils"),
  water: id("water"),
  turmeric: id("turmeric"),
  salt: id("salt"),
  tomato: id("tomato"),
  ginger: id("ginger"),
  lemonJuice: id("lemon-juice"),
  simmer: id("step-simmer"),
  finish: id("step-finish"),
  tadkaOil: id("tadka-oil"),
  cumin: id("tadka-cumin"),
  mustard: id("tadka-mustard"),
  onion: id("tadka-onion"),
  garlic: id("tadka-garlic"),
  dried: id("tadka-dried-chilli"),
  chilliPowder: id("tadka-chilli-powder"),
  coriander: id("tadka-coriander"),
  tadka: id("step-tadka"),
  pour: id("step-pour"),
  rice: id("rice"),
  riceOil: id("rice-oil"),
  riceCumin: id("rice-cumin"),
  cinnamon: id("rice-cinnamon"),
  bay: id("rice-bay"),
  riceWater: id("rice-water"),
  riceSalt: id("rice-salt"),
  soak: id("step-soak"),
  toast: id("step-toast"),
  cookRice: id("step-cook-rice"),
};

const input: DevRecipe["input"] = {
  id: DAL.recipe,
  name: "Dal Tadka with Jeera Rice",
  description:
    "Red lentils simmered soft with turmeric and tomato, finished with a sizzling tadka of cumin, mustard seed and garlic. Served with cumin-scented basmati.",
  rating: 5,
  recipeServings: 4,
  recipeYieldQuantity: 4,
  yieldUnit: null,
  recipeYield: "servings",
  prepTime: 15,
  performTime: 35,
  sourceUrl: null,
  favourite: false,
  facets: {
    week: ["weeknight"],
    course: ["main"],
    meal: ["lunch", "dinner"],
    cuisine: ["indian"],
    diet: ["vegetarian", "vegan", "gluten-free", "dairy-free", "nut-free"],
    mainIngredient: ["legumes"],
    method: ["stovetop", "pressure-cooker"],
    season: ["autumn", "winter"],
  },
  tags: [tag("Weeknight"), tag("Freezer")],
  notes: [
    { title: "Lentils", text: "Red lentils need no soaking and cook down to a purée. Yellow split peas take twice as long but keep more texture." },
    { title: "Freezing", text: "The dal freezes for 3 months without the tadka. Make the tadka fresh on the night; it takes 5 minutes." },
  ],
  parts: [
    {
      name: "",
      ingredients: [
        ing(DAL.lentils, 1.5, "cup", "red lentils", { note: "rinsed" }),
        ing(DAL.water, 1, "litre", "water"),
        ing(DAL.turmeric, 0.5, "teaspoon", "ground turmeric"),
        ing(DAL.salt, 1, "teaspoon", "salt"),
        ing(DAL.tomato, 2, null, "tomato", { note: "chopped" }),
        ing(DAL.ginger, 1, "tablespoon", "ginger", { note: "finely grated" }),
        ing(DAL.lemonJuice, 1, "tablespoon", "lemon juice"),
      ],
      steps: [
        step(
          DAL.simmer,
          "Simmer the lentils",
          "Put the red lentils, water, ground turmeric and salt in a large saucepan and bring to the boil. Skim off the foam, then reduce the heat and simmer, partly covered and stirring now and then, until the lentils have collapsed into a thick purée, 20–25 minutes.",
          "Add a splash of boiling water if it thickens before the lentils are soft. In a pressure cooker, 6 minutes at high pressure with a natural release.",
          [DAL.lentils, DAL.water, DAL.turmeric, DAL.salt]
        ),
        step(
          DAL.finish,
          "Soften the tomato",
          "Stir in the tomato and ginger and simmer until the tomato breaks down, about 5 minutes. Add the lemon juice and taste for salt.",
          "The dal thickens as it stands; loosen it with hot water when reheating.",
          [DAL.tomato, DAL.ginger, DAL.lemonJuice]
        ),
      ],
    },
    {
      name: "Tadka",
      ingredients: [
        ing(DAL.tadkaOil, 3, "tablespoon", "vegetable oil", {
          alternatives: [{ note: "richer, but no longer vegan", items: [item("ghee")] }],
        }),
        ing(DAL.cumin, 1, "teaspoon", "cumin seeds"),
        ing(DAL.mustard, 1, "teaspoon", "black mustard seeds"),
        ing(DAL.onion, 1, null, "onion", { note: "finely chopped" }),
        ing(DAL.garlic, 4, "clove", "garlic", { note: "thinly sliced" }),
        ing(DAL.dried, 2, null, "dried chilli", { fixed: true }),
        ing(DAL.chilliPowder, 0.5, "teaspoon", "kashmiri chilli powder"),
        ing(DAL.coriander, 0.5, "bunch", "coriander", { note: "chopped, to serve" }),
      ],
      steps: [
        step(
          DAL.tadka,
          "Make the tadka",
          "Heat the vegetable oil in a small frying pan over medium-high heat. Add the cumin seeds and black mustard seeds and fry until the mustard seeds start to pop, about 30 seconds. Add the onion and fry until golden, 5–6 minutes, then add the garlic and dried chilli and fry until the garlic is pale gold, about 1 minute. Take the pan off the heat and stir in the Kashmiri chilli powder.",
          "Have everything ready before the oil goes in: it moves fast, and garlic that goes past golden turns bitter. The chilli powder goes in off the heat so it colours the oil without burning.",
          [DAL.tadkaOil, DAL.cumin, DAL.mustard, DAL.onion, DAL.garlic, DAL.dried, DAL.chilliPowder]
        ),
        step(
          DAL.pour,
          "Pour over the dal",
          "Pour the hot tadka over the dal, stir it through and scatter with the coriander.",
          "It should sizzle as it hits the dal; that is the point of a tadka.",
          [DAL.coriander]
        ),
      ],
    },
    {
      name: "Jeera rice",
      ingredients: [
        ing(DAL.rice, 1.5, "cup", "basmati rice"),
        ing(DAL.riceOil, 1, "tablespoon", "vegetable oil"),
        ing(DAL.riceCumin, 1, "teaspoon", "cumin seeds"),
        ing(DAL.cinnamon, 1, null, "cinnamon stick", { fixed: true }),
        ing(DAL.bay, 1, null, "bay leaf", { fixed: true }),
        ing(DAL.riceWater, 2.25, "cup", "water"),
        ing(DAL.riceSalt, 0.5, "teaspoon", "salt"),
      ],
      steps: [
        step(
          DAL.soak,
          "Soak the rice",
          "Rinse the basmati rice until the water runs clear, then soak it in cold water for 20 minutes and drain.",
          "Soaking gives long, separate grains that do not break as they cook.",
          [DAL.rice]
        ),
        step(
          DAL.toast,
          "Toast the spices",
          "Heat the vegetable oil in a saucepan over medium heat and fry the cumin seeds, cinnamon stick and bay leaf until the cumin seeds darken a shade and smell nutty, about 1 minute.",
          "",
          [DAL.riceOil, DAL.riceCumin, DAL.cinnamon, DAL.bay]
        ),
        step(
          DAL.cookRice,
          "Cook the rice",
          "Add the basmati rice and stir to coat it in the oil, then add the water and salt and bring to the boil. Cover, reduce the heat to the lowest setting and cook until the water is absorbed, 12 minutes. Rest, covered, for 5 minutes before fluffing with a fork.",
          "Leave the lid on while it cooks; the steam does the work.",
          [DAL.rice, DAL.riceWater, DAL.riceSalt]
        ),
      ],
    },
  ],
};

export const dalTadka: DevRecipe = {
  input,
  createdDaysAgo: 260,
  updatedDaysAgo: 60,
  cooks: [
    cook(200, "Better than the takeaway one.", 4),
    cook(130, "Doubled the dal and froze half."),
    cook(60, "Ghee in the tadka this time. Worth it."),
    cook(2, "Made double so there was dal for tomorrow.", 4),
  ],
  image: "dalTadka.jpg",
};
