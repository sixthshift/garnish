import { cook, type DevRecipe, fixedId, ing, item, raw, step, tag } from "../build";

const MINESTRONE = {
  recipe: fixedId("minestrone"),
  oil: fixedId("minestrone-oil"),
  onion: fixedId("minestrone-onion"),
  carrot: fixedId("minestrone-carrot"),
  celery: fixedId("minestrone-celery"),
  garlic: fixedId("minestrone-garlic"),
  paste: fixedId("minestrone-paste"),
  tomatoes: fixedId("minestrone-tomatoes"),
  stock: fixedId("minestrone-stock"),
  rind: fixedId("minestrone-rind"),
  bay: fixedId("minestrone-bay"),
  zucchini: fixedId("minestrone-zucchini"),
  beans: fixedId("minestrone-beans"),
  pasta: fixedId("minestrone-pasta"),
  kale: fixedId("minestrone-kale"),
  salt: fixedId("minestrone-salt"),
  pepper: fixedId("minestrone-pepper"),
  parmesan: fixedId("minestrone-parmesan"),
  basil: fixedId("minestrone-basil"),
  soffritto: fixedId("minestrone-step-soffritto"),
  simmer: fixedId("minestrone-step-simmer"),
  pastaStep: fixedId("minestrone-step-pasta"),
  serve: fixedId("minestrone-step-serve"),
};

const input: DevRecipe["input"] = {
  id: MINESTRONE.recipe,
  name: "Minestrone",
  description: "A thick vegetable, bean and pasta soup built on a slow soffritto and a parmesan rind. Makes a big pot that freezes well.",
  rating: 4,
  recipeServings: 6,
  recipeYieldQuantity: 6,
  yieldUnit: null,
  recipeYield: "bowls",
  prepTime: 20,
  performTime: 50,
  sourceUrl: "https://www.abc.net.au/everyday/example-recipe/12345678",
  favourite: false,
  kind: "rotation",
  facets: {
    course: ["soup"],
    meal: ["lunch", "dinner"],
    cuisine: ["italian"],
    diet: ["vegetarian"],
    mainIngredient: ["vegetables", "legumes"],
    method: ["stovetop"],
    season: ["winter"],
  },
  tags: [tag("Freezer"), tag("Make ahead")],
  notes: [
    {
      title: "Whatever is in the fridge",
      text: "The vegetables are a guide: green beans, potato, cabbage or silverbeet all belong. Keep the soffritto and the beans; change the rest.",
    },
  ],
  parts: [
    {
      name: "",
      ingredients: [
        ing(MINESTRONE.oil, 3, "tablespoon", "extra virgin olive oil", { note: "plus extra to serve" }),
        ing(MINESTRONE.onion, 1, null, "onion", { note: "diced" }),
        ing(MINESTRONE.carrot, 2, null, "carrot", { note: "diced" }),
        ing(MINESTRONE.celery, 2, null, "celery", { note: "stalks, diced" }),
        ing(MINESTRONE.garlic, 3, "clove", "garlic", { note: "finely chopped" }),
        ing(MINESTRONE.paste, 2, "tablespoon", "tomato paste"),
        ing(MINESTRONE.tomatoes, 1, "can", "canned tomatoes"),
        ing(MINESTRONE.stock, 1.5, "litre", "vegetable stock"),
        raw(MINESTRONE.rind, "1 parmesan rind"),
        ing(MINESTRONE.bay, 2, null, "bay leaf", { fixed: true }),
        ing(MINESTRONE.zucchini, 2, null, "zucchini", { note: "diced" }),
        ing(MINESTRONE.beans, 1, "can", "cannellini beans", {
          note: "drained and rinsed",
          alternatives: [{ items: [item("borlotti beans")] }],
        }),
        ing(MINESTRONE.pasta, 100, "gram", "macaroni", { alternatives: [{ items: [item("pasta shells")] }] }),
        ing(MINESTRONE.kale, 2, "cup", "kale", { note: "stems removed, shredded", alternatives: [{ items: [item("baby spinach")] }] }),
        ing(MINESTRONE.salt, null, null, "salt"),
        ing(MINESTRONE.pepper, null, null, "black pepper"),
        ing(MINESTRONE.parmesan, 40, "gram", "parmesan", { note: "finely grated, to serve" }),
        ing(MINESTRONE.basil, null, null, "basil", { note: "leaves, to serve" }),
      ],
      steps: [
        step(
          MINESTRONE.soffritto,
          "Cook the soffritto",
          "Heat the extra virgin olive oil in a large heavy pot over medium–low heat. Add the onion, carrot and celery with a pinch of salt and cook, stirring now and then, until soft and sweet but not coloured, 12–15 minutes. Add the garlic and tomato paste and cook until the paste darkens, about 2 minutes.",
          "This slow start is where the soup's flavour comes from, so do not rush it on high heat.",
          [MINESTRONE.oil, MINESTRONE.onion, MINESTRONE.carrot, MINESTRONE.celery, MINESTRONE.salt, MINESTRONE.garlic, MINESTRONE.paste]
        ),
        step(
          MINESTRONE.simmer,
          "Simmer the soup",
          "Add the canned tomatoes, vegetable stock, parmesan rind, bay leaf, zucchini and cannellini beans. Bring to the boil, then cover partly and simmer until the vegetables are tender and the broth tastes rounded, 25–30 minutes.",
          "The rind softens and gives the broth body and a savoury depth; fish it out before serving. A slow cooker works too: everything on low for 6 hours, with the pasta added for the last 30 minutes on high.",
          [MINESTRONE.tomatoes, MINESTRONE.stock, MINESTRONE.rind, MINESTRONE.bay, MINESTRONE.zucchini, MINESTRONE.beans]
        ),
        step(
          MINESTRONE.pastaStep,
          "Cook the pasta",
          "Stir in the macaroni and simmer until just tender, 8–10 minutes, adding a cup of water if the soup gets too thick. Stir in the kale for the last 2 minutes. Season with salt and black pepper.",
          "To freeze, take out the portions for the freezer before the pasta goes in; pasta turns soft and swollen when frozen. Keeps 3 months frozen and 4 days in the fridge, where it thickens: loosen it with water when reheating.",
          [MINESTRONE.pasta, MINESTRONE.kale, MINESTRONE.salt, MINESTRONE.pepper]
        ),
        step(
          MINESTRONE.serve,
          "Serve with parmesan",
          "Remove the parmesan rind and bay leaf. Ladle the soup into bowls and finish each with the parmesan, a few basil leaves and a drizzle of extra virgin olive oil.",
          "",
          [MINESTRONE.rind, MINESTRONE.bay, MINESTRONE.parmesan, MINESTRONE.basil, MINESTRONE.oil]
        ),
      ],
    },
  ],
};

export const minestrone: DevRecipe = {
  input,
  createdDaysAgo: 610,
  updatedDaysAgo: 580,
  cooks: [cook(560, "Big pot, froze half without the pasta.", 6), cook(60, "")],
  image: "minestrone.jpg",
};
