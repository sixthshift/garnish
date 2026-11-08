import { cook, type DevRecipe, fixedId, ing, item, step, tag } from "../build";

const RISOTTO = {
  recipe: fixedId("mushroom-risotto"),
  porcini: fixedId("mushroom-risotto-porcini"),
  water: fixedId("mushroom-risotto-water"),
  stock: fixedId("mushroom-risotto-stock"),
  butter: fixedId("mushroom-risotto-butter"),
  oil: fixedId("mushroom-risotto-oil"),
  mushrooms: fixedId("mushroom-risotto-mushrooms"),
  thyme: fixedId("mushroom-risotto-thyme"),
  shallot: fixedId("mushroom-risotto-shallot"),
  garlic: fixedId("mushroom-risotto-garlic"),
  rice: fixedId("mushroom-risotto-rice"),
  wine: fixedId("mushroom-risotto-wine"),
  parmesan: fixedId("mushroom-risotto-parmesan"),
  parsley: fixedId("mushroom-risotto-parsley"),
  salt: fixedId("mushroom-risotto-salt"),
  soak: fixedId("mushroom-risotto-step-soak"),
  brown: fixedId("mushroom-risotto-step-brown"),
  toast: fixedId("mushroom-risotto-step-toast"),
  stir: fixedId("mushroom-risotto-step-stir"),
  finish: fixedId("mushroom-risotto-step-finish"),
};

const input: DevRecipe["input"] = {
  id: RISOTTO.recipe,
  name: "Mushroom Risotto",
  description: "A creamy risotto with browned swiss browns and the deep savour of dried porcini. Twenty-five minutes of stirring, worth every one.",
  rating: 4,
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
    meal: ["dinner"],
    cuisine: ["italian"],
    diet: ["vegetarian", "gluten-free"],
    mainIngredient: ["rice"],
    method: ["stovetop"],
    season: ["autumn", "winter"],
  },
  tags: [tag("Weeknight")],
  notes: [
    { title: "Parmesan", text: "Traditional parmesan is made with animal rennet. For a strictly vegetarian risotto, use a vegetarian hard cheese." },
    { title: "Leftovers", text: "Roll cold leftover risotto into balls around a cube of mozzarella, crumb and fry for arancini." },
  ],
  parts: [
    {
      name: "",
      ingredients: [
        ing(RISOTTO.porcini, 20, "gram", "dried porcini mushrooms"),
        ing(RISOTTO.water, 250, "millilitre", "water", { note: "boiling" }),
        ing(RISOTTO.stock, 1, "litre", "vegetable stock", {
          alternatives: [{ note: "not vegetarian", items: [item("chicken stock")] }],
        }),
        ing(RISOTTO.butter, 60, "gram", "butter", { note: "cubed" }),
        ing(RISOTTO.oil, 1, "tablespoon", "olive oil"),
        ing(RISOTTO.mushrooms, 400, "gram", "swiss brown mushroom", {
          note: "sliced",
          alternatives: [{ items: [item("mixed mushrooms")] }],
        }),
        ing(RISOTTO.thyme, 4, null, "thyme", { note: "sprigs, leaves picked" }),
        ing(RISOTTO.shallot, 2, null, "shallot", { note: "finely diced" }),
        ing(RISOTTO.garlic, 2, "clove", "garlic", { note: "finely chopped" }),
        ing(RISOTTO.rice, 1.5, "cup", "arborio rice"),
        ing(RISOTTO.wine, 125, "millilitre", "white wine"),
        ing(RISOTTO.parmesan, 60, "gram", "parmesan", { note: "finely grated, plus extra to serve" }),
        ing(RISOTTO.parsley, 2, "tablespoon", "flat-leaf parsley", { note: "chopped" }),
        ing(RISOTTO.salt, null, null, "salt"),
      ],
      steps: [
        step(
          RISOTTO.soak,
          "Soak the porcini",
          "Cover the dried porcini mushrooms with the water and soak until soft, 15 minutes. Lift them out, squeeze dry and chop finely. Pour the soaking water into a saucepan with the vegetable stock, leaving the last spoonful of grit behind, and keep at a bare simmer.",
          "The soaking water carries most of the porcini's flavour, so it goes into the stock. Warm stock keeps the rice at a steady simmer; cold stock stalls it.",
          [RISOTTO.porcini, RISOTTO.water, RISOTTO.stock]
        ),
        step(
          RISOTTO.brown,
          "Brown the mushrooms",
          "Heat 20 g of the butter and the olive oil in a large heavy saucepan over high heat. Add the swiss brown mushroom and thyme and cook without stirring for 2 minutes, then toss until golden and any liquid has evaporated, 5–6 minutes more. Season with salt and tip onto a plate.",
          "Leaving the mushrooms alone at first lets them brown instead of stew. If the pan is small, brown them in two batches.",
          [RISOTTO.butter, RISOTTO.oil, RISOTTO.mushrooms, RISOTTO.thyme, RISOTTO.salt]
        ),
        step(
          RISOTTO.toast,
          "Toast the rice",
          "Reduce the heat to medium and melt another 20 g of the butter in the pan. Sauté the shallot until soft and translucent, 3–4 minutes, then add the garlic, chopped porcini and arborio rice and stir until the grains turn glassy at the edges, about 2 minutes. Pour in the white wine and stir until absorbed.",
          "",
          [RISOTTO.butter, RISOTTO.shallot, RISOTTO.garlic, RISOTTO.porcini, RISOTTO.rice, RISOTTO.wine]
        ),
        step(
          RISOTTO.stir,
          "Add the stock gradually",
          "Add the hot stock a ladle at a time, stirring often and letting each ladle be almost absorbed before the next, until the rice is tender with a slight bite and the risotto is loose and creamy, 18–22 minutes.",
          "You may not need all the stock, or you may need a splash of boiling water at the end. The stirring rubs starch from the rice, which is what makes it creamy without any cream.",
          [RISOTTO.stock]
        ),
        step(
          RISOTTO.finish,
          "Beat in the butter",
          "Take the pan off the heat and stir in the mushrooms, the remaining 20 g of butter and the parmesan. Cover and rest for 2 minutes, then stir in the flat-leaf parsley, season with salt and serve with extra parmesan.",
          "The risotto should flow slowly across the plate. It thickens fast on standing, so loosen it with a splash of stock if it sets before serving.",
          [RISOTTO.mushrooms, RISOTTO.butter, RISOTTO.parmesan, RISOTTO.parsley, RISOTTO.salt]
        ),
      ],
    },
  ],
};

export const mushroomRisotto: DevRecipe = {
  input,
  createdDaysAgo: 540,
  updatedDaysAgo: 300,
  cooks: [cook(500, "Bit soupy. Less stock next time.", 4), cook(300, "Mixed mushrooms from the market, and chicken stock. Rich."), cook(25, "")],
  image: "mushroomRisotto.jpg",
  stepImages: [{ stepId: RISOTTO.brown, file: "mushroomRisotto-brown.jpg" }],
};
