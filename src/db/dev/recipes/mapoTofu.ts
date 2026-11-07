import { type DevRecipe, fixedId, ing, item, raw, step } from "../build";

const SLUG = "mapo-tofu";
const id = (label: string) => fixedId(`${SLUG}-${label}`);

const MAPO = {
  recipe: fixedId(SLUG),
  tofu: id("tofu"),
  salt: id("salt"),
  pepper: id("sichuan-pepper"),
  oil: id("oil"),
  pork: id("pork"),
  paste: id("chilli-bean-paste"),
  ginger: id("ginger"),
  garlic: id("garlic"),
  wine: id("wine"),
  soy: id("soy"),
  stock: id("stock"),
  cornflour: id("cornflour"),
  water: id("water"),
  springOnion: id("spring-onion"),
  chilliOil: id("chilli-oil"),
  rice: id("rice"),
  blanch: id("step-blanch"),
  toast: id("step-toast"),
  brown: id("step-brown"),
  fry: id("step-fry"),
  simmer: id("step-simmer"),
  thicken: id("step-thicken"),
};

const input: DevRecipe["input"] = {
  id: MAPO.recipe,
  name: "Mapo Tofu",
  description: "Soft tofu and crisp pork mince in a fiery, numbing sauce of chilli bean paste and Sichuan pepper. Fast, loud and best over plenty of rice.",
  rating: null,
  recipeServings: 4,
  recipeYieldQuantity: 4,
  yieldUnit: null,
  recipeYield: "servings",
  prepTime: 10,
  performTime: 20,
  sourceUrl: "https://www.abc.net.au/everyday/example-recipe/12345678",
  favourite: false,
  kind: null,
  facets: {
    course: ["main"],
    meal: ["dinner"],
    cuisine: ["chinese"],
    diet: ["dairy-free", "nut-free"],
    mainIngredient: ["tofu", "pork"],
    method: ["stovetop"],
  },
  tags: [],
  notes: [
    {
      title: "Heat",
      text: "Pixian chilli bean paste is the real thing, and saltier and hotter than most. Start with 1 tbsp, taste the sauce, and add the rest if it wants it.",
    },
  ],
  parts: [
    {
      name: "",
      ingredients: [
        ing(MAPO.tofu, 600, "gram", "silken tofu", { note: "cut into 2 cm cubes" }),
        ing(MAPO.salt, null, null, "salt"),
        ing(MAPO.pepper, 2, "teaspoon", "sichuan pepper", { fixed: true }),
        ing(MAPO.oil, 2, "tablespoon", "vegetable oil"),
        ing(MAPO.pork, 250, "gram", "pork mince", {
          alternatives: [{ note: "finely chopped, for a vegetarian version", items: [item("shiitake mushroom")] }],
        }),
        ing(MAPO.paste, 2, "tablespoon", "chilli bean paste"),
        ing(MAPO.ginger, 1, "tablespoon", "ginger", { note: "finely chopped" }),
        ing(MAPO.garlic, 3, "clove", "garlic", { note: "finely chopped" }),
        ing(MAPO.wine, 1, "tablespoon", "chinese cooking wine"),
        ing(MAPO.soy, 1, "tablespoon", "soy sauce"),
        ing(MAPO.stock, 250, "millilitre", "chicken stock", { alternatives: [{ items: [item("vegetable stock")] }] }),
        ing(MAPO.cornflour, 1, "tablespoon", "cornflour"),
        ing(MAPO.water, 2, "tablespoon", "water"),
        ing(MAPO.springOnion, 2, null, "spring onion", { note: "thinly sliced" }),
        ing(MAPO.chilliOil, null, null, "chilli oil", { note: "to serve" }),
        raw(MAPO.rice, "steamed rice, to serve"),
      ],
      steps: [
        step(
          MAPO.blanch,
          "Blanch the tofu",
          "Bring a saucepan of lightly salted water to a simmer, slide in the silken tofu and simmer gently for 2 minutes, then drain carefully.",
          "Blanching firms the tofu so it holds together in the sauce, and seasons it through.",
          [MAPO.salt, MAPO.tofu]
        ),
        step(
          MAPO.toast,
          "Toast the Sichuan pepper",
          "Toast the Sichuan pepper in a dry wok over medium heat until fragrant, about 1 minute, then grind it to a powder.",
          "",
          [MAPO.pepper]
        ),
        step(
          MAPO.brown,
          "Brown the pork",
          "Heat the vegetable oil in the wok over high heat and stir-fry the pork mince, breaking it up, until browned and crisp at the edges, 4–5 minutes.",
          "Crisp pork gives the sauce its texture. Mushrooms need longer: cook them until they have given up their water and browned.",
          [MAPO.oil, MAPO.pork]
        ),
        step(
          MAPO.fry,
          "Fry the aromatics",
          "Reduce the heat to medium, add the chilli bean paste and fry until the oil turns red, about 1 minute. Add the ginger and garlic and fry until fragrant, 30 seconds.",
          "Chilli bean paste scorches easily, so keep it moving.",
          [MAPO.paste, MAPO.ginger, MAPO.garlic]
        ),
        step(
          MAPO.simmer,
          "Simmer with the tofu",
          "Add the Chinese cooking wine, soy sauce and chicken stock and bring to a simmer. Slide in the silken tofu and simmer gently, nudging rather than stirring, until the tofu is heated through, 3–4 minutes.",
          "Push the tofu with the back of a spatula; stirring breaks it up.",
          [MAPO.wine, MAPO.soy, MAPO.stock, MAPO.tofu]
        ),
        step(
          MAPO.thicken,
          "Thicken and finish",
          "Stir the cornflour into the water, pour it in around the edge of the wok and simmer until the sauce is glossy and clings to the tofu, about 1 minute. Scatter with the ground Sichuan pepper and spring onion, drizzle with chilli oil and serve with the steamed rice.",
          "Add the slurry in two goes if the sauce is already thick: it should coat the tofu, not set around it.",
          [MAPO.cornflour, MAPO.water, MAPO.pepper, MAPO.springOnion, MAPO.chilliOil, MAPO.rice]
        ),
      ],
    },
  ],
};

export const mapoTofu: DevRecipe = {
  input,
  createdDaysAgo: 8,
  updatedDaysAgo: 8,
  cooks: [],
  image: "mapoTofu.jpg",
  stepImages: [{ stepId: MAPO.simmer, file: "mapoTofu-simmer.jpg" }],
};
