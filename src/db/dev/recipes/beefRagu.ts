import { cook, type DevRecipe, fixedId, ing, item, raw, step, tag, unit } from "../build";

const RAGU = {
  recipe: fixedId("slow-cooked-beef-ragu"),
  beef: fixedId("slow-cooked-beef-ragu-beef"),
  oil: fixedId("slow-cooked-beef-ragu-oil"),
  salt: fixedId("slow-cooked-beef-ragu-salt"),
  pepper: fixedId("slow-cooked-beef-ragu-pepper"),
  onion: fixedId("slow-cooked-beef-ragu-onion"),
  carrot: fixedId("slow-cooked-beef-ragu-carrot"),
  celery: fixedId("slow-cooked-beef-ragu-celery"),
  garlic: fixedId("slow-cooked-beef-ragu-garlic"),
  paste: fixedId("slow-cooked-beef-ragu-paste"),
  wine: fixedId("slow-cooked-beef-ragu-wine"),
  tomatoes: fixedId("slow-cooked-beef-ragu-tomatoes"),
  stock: fixedId("slow-cooked-beef-ragu-stock"),
  bay: fixedId("slow-cooked-beef-ragu-bay"),
  thyme: fixedId("slow-cooked-beef-ragu-thyme"),
  rind: fixedId("slow-cooked-beef-ragu-rind"),
  sear: fixedId("slow-cooked-beef-ragu-step-sear"),
  soften: fixedId("slow-cooked-beef-ragu-step-soften"),
  deglaze: fixedId("slow-cooked-beef-ragu-step-deglaze"),
  braise: fixedId("slow-cooked-beef-ragu-step-braise"),
  shred: fixedId("slow-cooked-beef-ragu-step-shred"),
  parsley: fixedId("slow-cooked-beef-ragu-gremolata-parsley"),
  lemon: fixedId("slow-cooked-beef-ragu-gremolata-lemon"),
  gremGarlic: fixedId("slow-cooked-beef-ragu-gremolata-garlic"),
  gremOil: fixedId("slow-cooked-beef-ragu-gremolata-oil"),
  gremolata: fixedId("slow-cooked-beef-ragu-step-gremolata"),
  pasta: fixedId("slow-cooked-beef-ragu-serve-pasta"),
  pastaSalt: fixedId("slow-cooked-beef-ragu-serve-salt"),
  parmesan: fixedId("slow-cooked-beef-ragu-serve-parmesan"),
  boil: fixedId("slow-cooked-beef-ragu-step-boil"),
  toss: fixedId("slow-cooked-beef-ragu-step-toss"),
};

const input: DevRecipe["input"] = {
  id: RAGU.recipe,
  name: "Slow-Cooked Beef Ragu",
  description:
    "Chuck braised in wine and tomato until it falls apart, tossed through pappardelle and finished with a sharp gremolata. A Sunday job that feeds the week.",
  rating: 5,
  recipeServings: 6,
  recipeYieldQuantity: 6,
  yieldUnit: null,
  recipeYield: "servings",
  prepTime: 30,
  performTime: 210,
  sourceUrl: "https://www.recipetineats.com/example-recipe/",
  favourite: true,
  facets: {
    week: ["weekend"],
    course: ["main"],
    meal: ["dinner"],
    cuisine: ["italian"],
    mainIngredient: ["beef"],
    method: ["oven", "stovetop", "slow-cooker"],
    season: ["autumn", "winter"],
  },
  tags: [tag("Freezer"), tag("Make ahead"), tag("Pasta")],
  notes: [
    { title: "The cut", text: "Chuck or cheek: any cut with plenty of connective tissue. Lean cuts like round dry out over a long braise." },
    {
      title: "Freezing",
      text: "Freeze the ragu without the pasta, in portions, for up to 3 months. Thaw overnight in the fridge and reheat gently with a splash of water.",
    },
  ],
  parts: [
    {
      name: "",
      ingredients: [
        ing(RAGU.beef, 1.2, "kilogram", "beef chuck", {
          note: "cut into 4 cm pieces",
          alternatives: [{ note: "add an hour to the braise", items: [item("beef cheek")] }],
        }),
        ing(RAGU.oil, 2, "tablespoon", "olive oil"),
        ing(RAGU.salt, null, null, "salt"),
        ing(RAGU.pepper, null, null, "black pepper"),
        ing(RAGU.onion, 1, null, "onion", { note: "finely diced" }),
        ing(RAGU.carrot, 2, null, "carrot", { note: "finely diced" }),
        ing(RAGU.celery, 2, null, "celery", { note: "stalks, finely diced" }),
        ing(RAGU.garlic, 4, "clove", "garlic", { note: "finely chopped" }),
        ing(RAGU.paste, 2, "tablespoon", "tomato paste"),
        ing(RAGU.wine, 250, "millilitre", "red wine", {
          alternatives: [
            {
              basisQuantity: 250,
              basisUnit: unit("millilitre"),
              note: "for an alcohol-free ragu; the vinegar stands in for the wine's acidity",
              items: [item("beef stock", 250, "millilitre"), item("red wine vinegar", 1, "tablespoon")],
            },
          ],
        }),
        ing(RAGU.tomatoes, 2, "can", "canned tomatoes"),
        ing(RAGU.stock, 500, "millilitre", "chicken stock", { alternatives: [{ items: [item("beef stock")] }] }),
        ing(RAGU.bay, 2, null, "bay leaf", { fixed: true }),
        ing(RAGU.thyme, 4, null, "thyme", { note: "sprigs" }),
        raw(RAGU.rind, "a parmesan rind, if you have one"),
      ],
      steps: [
        step(
          RAGU.sear,
          "Sear the beef",
          "Preheat the oven to 150°C fan (170°C conventional). Season the beef chuck with salt and black pepper. Heat 1 tbsp of the olive oil in a large flameproof casserole over high heat and sear the beef in two batches until very browned on all sides, 3–5 minutes a batch. Transfer to a plate.",
          "Crowding the pot steams the beef rather than browning it, so work in batches. The brown crust is most of the ragu's depth.",
          [RAGU.beef, RAGU.salt, RAGU.pepper, RAGU.oil]
        ),
        step(
          RAGU.soften,
          "Soften the vegetables",
          "Reduce the heat to medium and add the remaining 1 tbsp of olive oil, then the onion, carrot and celery. Sauté until soft and golden, 8–10 minutes, scraping up the browned bits as the vegetables release their water. Add the garlic and tomato paste and cook until the paste darkens, about 2 minutes.",
          "Take the full time: vegetables that go into the braise raw-tasting never cook out.",
          [RAGU.oil, RAGU.onion, RAGU.carrot, RAGU.celery, RAGU.garlic, RAGU.paste]
        ),
        step(
          RAGU.deglaze,
          "Deglaze with the wine",
          "Pour in the red wine and simmer, scraping the base of the pot, until reduced by half, about 3 minutes.",
          "",
          [RAGU.wine]
        ),
        step(
          RAGU.braise,
          "Braise slowly",
          "Return the beef and its juices to the pot with the canned tomatoes, chicken stock, bay leaf, thyme and the parmesan rind. Bring to a simmer, cover and transfer to the oven. Braise until the beef falls apart when pressed with a spoon, 2½–3 hours.",
          "It will look thin at first; the sauce thickens as the beef breaks down. Stir once at the halfway mark and add a splash of water if it is catching. In a slow cooker, cook on low for 8 hours.",
          [RAGU.beef, RAGU.tomatoes, RAGU.stock, RAGU.bay, RAGU.thyme, RAGU.rind]
        ),
        step(
          RAGU.shred,
          "Shred and reduce",
          "Remove the bay leaf, thyme stalks and rind. Shred the beef in the pot with two forks, then simmer uncovered on the stovetop until the sauce coats the back of a spoon, 10–15 minutes. Taste and season with salt and black pepper.",
          "The ragu is better the next day and keeps 4 days in the fridge.",
          [RAGU.beef, RAGU.salt, RAGU.pepper]
        ),
      ],
    },
    {
      name: "Gremolata",
      ingredients: [
        ing(RAGU.parsley, 1, "bunch", "flat-leaf parsley", { note: "leaves picked" }),
        ing(RAGU.lemon, 1, null, "lemon", { note: "zested" }),
        ing(RAGU.gremGarlic, 1, "clove", "garlic"),
        ing(RAGU.gremOil, 1, "tablespoon", "extra virgin olive oil"),
      ],
      steps: [
        step(
          RAGU.gremolata,
          "Make the gremolata",
          "Finely chop the flat-leaf parsley and garlic together, then mix with the lemon zest and extra virgin olive oil.",
          "Make it within the hour of serving; the parsley darkens as it sits.",
          [RAGU.parsley, RAGU.gremGarlic, RAGU.lemon, RAGU.gremOil]
        ),
      ],
    },
    {
      name: "To serve",
      ingredients: [
        ing(RAGU.pasta, 500, "gram", "pasta", {
          note: "pappardelle",
          alternatives: [{ note: "soft, for a gluten-free plate", items: [item("polenta", 250, "gram")] }],
        }),
        ing(RAGU.pastaSalt, null, null, "salt", { note: "for the pasta water" }),
        ing(RAGU.parmesan, 50, "gram", "parmesan", { note: "finely grated" }),
      ],
      steps: [
        step(
          RAGU.boil,
          "Cook the pappardelle",
          "Cook the pasta in a large pot of well-salted boiling water until al dente, 1 minute less than the packet says. Reserve 1 cup of the cooking water, then drain.",
          "The pasta finishes cooking in the sauce, so it comes out a little firm.",
          [RAGU.pasta, RAGU.pastaSalt]
        ),
        step(
          RAGU.toss,
          "Toss and serve",
          "Toss the pasta through the ragu over low heat with a splash of the reserved water until glossy, 1–2 minutes. Serve topped with the parmesan and the gremolata.",
          "Two pairs of tongs make the tossing easier. Add more of the water if the sauce tightens on standing.",
          [RAGU.pasta, RAGU.parmesan]
        ),
      ],
    },
  ],
};

export const beefRagu: DevRecipe = {
  input,
  createdDaysAgo: 35,
  updatedDaysAgo: 3,
  cooks: [
    cook(28, "Cheek instead of chuck, with the extra hour. Silky.", 6),
    cook(14, "Doubled for the freezer.", 12),
    cook(3, "Polenta for the gluten-free plates; worked well."),
  ],
  image: "beefRagu.jpg",
  stepImages: [
    { stepId: RAGU.sear, file: "beefRagu-sear.jpg" },
    { stepId: RAGU.braise, file: "beefRagu-braise.jpg" },
    { stepId: RAGU.toss, file: "beefRagu-toss.jpg" },
  ],
};
