import { cook, type DevRecipe, fixedId, ing, item, step, tag, unit } from "../build";

const LAMB = {
  recipe: fixedId("slow-roasted-lamb-shoulder-with-lemon-potatoes"),
  shoulder: fixedId("slow-roasted-lamb-shoulder-with-lemon-potatoes-shoulder"),
  garlic: fixedId("slow-roasted-lamb-shoulder-with-lemon-potatoes-garlic"),
  oregano: fixedId("slow-roasted-lamb-shoulder-with-lemon-potatoes-oregano"),
  rosemary: fixedId("slow-roasted-lamb-shoulder-with-lemon-potatoes-rosemary"),
  oil: fixedId("slow-roasted-lamb-shoulder-with-lemon-potatoes-oil"),
  salt: fixedId("slow-roasted-lamb-shoulder-with-lemon-potatoes-salt"),
  pepper: fixedId("slow-roasted-lamb-shoulder-with-lemon-potatoes-pepper"),
  onion: fixedId("slow-roasted-lamb-shoulder-with-lemon-potatoes-onion"),
  wine: fixedId("slow-roasted-lamb-shoulder-with-lemon-potatoes-wine"),
  water: fixedId("slow-roasted-lamb-shoulder-with-lemon-potatoes-water"),
  season: fixedId("slow-roasted-lamb-shoulder-with-lemon-potatoes-step-season"),
  roast: fixedId("slow-roasted-lamb-shoulder-with-lemon-potatoes-step-roast"),
  rest: fixedId("slow-roasted-lamb-shoulder-with-lemon-potatoes-step-rest"),
  potato: fixedId("slow-roasted-lamb-shoulder-with-lemon-potatoes-pot-potato"),
  lemonJuice: fixedId("slow-roasted-lamb-shoulder-with-lemon-potatoes-pot-lemon-juice"),
  stock: fixedId("slow-roasted-lamb-shoulder-with-lemon-potatoes-pot-stock"),
  potOil: fixedId("slow-roasted-lamb-shoulder-with-lemon-potatoes-pot-oil"),
  potOregano: fixedId("slow-roasted-lamb-shoulder-with-lemon-potatoes-pot-oregano"),
  potGarlic: fixedId("slow-roasted-lamb-shoulder-with-lemon-potatoes-pot-garlic"),
  potSalt: fixedId("slow-roasted-lamb-shoulder-with-lemon-potatoes-pot-salt"),
  potRoast: fixedId("slow-roasted-lamb-shoulder-with-lemon-potatoes-step-potatoes"),
  crisp: fixedId("slow-roasted-lamb-shoulder-with-lemon-potatoes-step-crisp"),
};

const input: DevRecipe["input"] = {
  id: LAMB.recipe,
  name: "Slow-Roasted Lamb Shoulder with Lemon Potatoes",
  description:
    "A whole lamb shoulder roasted low with garlic, oregano and wine until it pulls apart with a spoon, beside potatoes that soak up lemon, stock and lamb fat.",
  rating: 5,
  recipeServings: 6,
  recipeYieldQuantity: 6,
  yieldUnit: null,
  recipeYield: "servings",
  prepTime: 25,
  performTime: 300,
  sourceUrl: "https://www.recipetineats.com/example-recipe/",
  favourite: true,
  facets: {
    week: ["weekend"],
    course: ["main"],
    meal: ["lunch", "dinner"],
    cuisine: ["greek"],
    diet: ["gluten-free", "dairy-free"],
    mainIngredient: ["lamb"],
    method: ["oven"],
    season: ["autumn", "winter"],
  },
  tags: [tag("Entertaining"), tag("Sunday")],
  notes: [
    {
      title: "Timing",
      text: "The lamb is forgiving: an extra 30 minutes covered does no harm. Plan backwards from lunch and give the potatoes the oven to themselves for the last hour.",
    },
    { title: "Leftovers", text: "Shred the leftover lamb into its juices; it makes the next day's wraps or a quick ragu." },
  ],
  parts: [
    {
      name: "",
      ingredients: [
        ing(LAMB.shoulder, 2, "kilogram", "lamb shoulder", { note: "bone-in" }),
        ing(LAMB.garlic, 8, "clove", "garlic", { note: "halved" }),
        ing(LAMB.oregano, 2, "teaspoon", "dried oregano"),
        ing(LAMB.rosemary, 3, null, "rosemary", { note: "sprigs" }),
        ing(LAMB.oil, 2, "tablespoon", "olive oil"),
        ing(LAMB.salt, 2, "teaspoon", "sea salt flakes"),
        ing(LAMB.pepper, null, null, "black pepper"),
        ing(LAMB.onion, 2, null, "onion", { note: "thickly sliced" }),
        ing(LAMB.wine, 250, "millilitre", "white wine", {
          alternatives: [
            {
              basisQuantity: 250,
              basisUnit: unit("millilitre"),
              note: "for no alcohol",
              items: [item("chicken stock", 250, "millilitre"), item("lemon juice", 1, "tablespoon")],
            },
          ],
        }),
        ing(LAMB.water, 250, "millilitre", "water"),
      ],
      steps: [
        step(
          LAMB.season,
          "Season the lamb",
          "Preheat the oven to 160°C fan (180°C conventional). Cut deep slits all over the lamb shoulder and push a piece of garlic into each. Rub with the olive oil, dried oregano, sea salt flakes and plenty of black pepper.",
          "Season the lamb the night before if you can, and bring it out of the fridge an hour before roasting.",
          [LAMB.shoulder, LAMB.garlic, LAMB.oil, LAMB.oregano, LAMB.salt, LAMB.pepper]
        ),
        step(
          LAMB.roast,
          "Roast low and slow",
          "Scatter the onion and rosemary over the base of a roasting tin and sit the lamb on top. Pour the white wine and water around it, cover tightly with foil and roast until the meat pulls away from the bone with a spoon, 4–4½ hours.",
          "Check at the halfway mark and add a splash of water if the tin is dry, or the onions burn. Wrapped tightly, the shoulder steams in its own juices, which is what makes it so tender.",
          [LAMB.onion, LAMB.rosemary, LAMB.shoulder, LAMB.wine, LAMB.water]
        ),
        step(
          LAMB.rest,
          "Brown and rest",
          "Uncover the lamb, increase the oven to 200°C fan (220°C conventional) and roast until the skin is browned and crisp, about 20 minutes. Rest under loose foil for 20 minutes, then pull apart and spoon the pan juices over.",
          "",
          [LAMB.shoulder]
        ),
      ],
    },
    {
      name: "Lemon potatoes",
      ingredients: [
        ing(LAMB.potato, 1.5, "kilogram", "potato", { note: "peeled, cut into wedges" }),
        ing(LAMB.lemonJuice, 80, "millilitre", "lemon juice"),
        ing(LAMB.stock, 250, "millilitre", "chicken stock"),
        ing(LAMB.potOil, 60, "millilitre", "olive oil"),
        ing(LAMB.potOregano, 1, "teaspoon", "dried oregano"),
        ing(LAMB.potGarlic, 3, "clove", "garlic", { note: "crushed" }),
        ing(LAMB.potSalt, 1, "teaspoon", "salt"),
      ],
      steps: [
        step(
          LAMB.potRoast,
          "Roast the potatoes",
          "For the last 1½ hours of the lamb, toss the potato with the lemon juice, chicken stock, olive oil, dried oregano, garlic and salt in a second roasting tin in one layer. Roast on the shelf below the lamb, turning once, until tender and most of the liquid is absorbed, about 1¼ hours.",
          "The potatoes will look swamped at first; the liquid is what makes them soft inside.",
          [LAMB.potato, LAMB.lemonJuice, LAMB.stock, LAMB.potOil, LAMB.potOregano, LAMB.potGarlic, LAMB.potSalt]
        ),
        step(
          LAMB.crisp,
          "Crisp the edges",
          "Move the potatoes to the top shelf while the lamb rests and roast at the higher heat until the edges are golden and crisp, 15–20 minutes.",
          "If they catch before they crisp, add 2 tablespoons of water and turn them once more.",
          [LAMB.potato]
        ),
      ],
    },
  ],
};

export const slowRoastLamb: DevRecipe = {
  input,
  createdDaysAgo: 690,
  updatedDaysAgo: 400,
  cooks: [cook(650, "Easter lunch. Went 5 hours, perfect.", 8), cook(400, "Wine swapped for stock and lemon; no one noticed."), cook(33, "", 6)],
  image: "slowRoastLamb.jpg",
  stepImages: [
    { stepId: LAMB.roast, file: "slowRoastLamb-roast.jpg" },
    { stepId: LAMB.crisp, file: "slowRoastLamb-potatoes.jpg" },
  ],
};
