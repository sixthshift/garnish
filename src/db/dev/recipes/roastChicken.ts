import { cook, type DevRecipe, fixedId, ing, item, step, tag, unit } from "../build";

const CHICKEN = {
  recipe: fixedId("buttermilk-roast-chicken-with-salsa-verde"),
  thigh: fixedId("buttermilk-roast-chicken-with-salsa-verde-thigh"),
  buttermilk: fixedId("buttermilk-roast-chicken-with-salsa-verde-buttermilk"),
  garlic: fixedId("buttermilk-roast-chicken-with-salsa-verde-garlic"),
  salt: fixedId("buttermilk-roast-chicken-with-salsa-verde-salt"),
  potato: fixedId("buttermilk-roast-chicken-with-salsa-verde-potato"),
  oil: fixedId("buttermilk-roast-chicken-with-salsa-verde-oil"),
  lemon: fixedId("buttermilk-roast-chicken-with-salsa-verde-lemon"),
  thyme: fixedId("buttermilk-roast-chicken-with-salsa-verde-thyme"),
  stock: fixedId("buttermilk-roast-chicken-with-salsa-verde-stock"),
  marinate: fixedId("buttermilk-roast-chicken-with-salsa-verde-step-marinate"),
  potatoes: fixedId("buttermilk-roast-chicken-with-salsa-verde-step-potatoes"),
  roast: fixedId("buttermilk-roast-chicken-with-salsa-verde-step-roast"),
  rest: fixedId("buttermilk-roast-chicken-with-salsa-verde-step-rest"),
  parsley: fixedId("buttermilk-roast-chicken-with-salsa-verde-verde-parsley"),
  mint: fixedId("buttermilk-roast-chicken-with-salsa-verde-verde-mint"),
  capers: fixedId("buttermilk-roast-chicken-with-salsa-verde-verde-capers"),
  anchovy: fixedId("buttermilk-roast-chicken-with-salsa-verde-verde-anchovy"),
  verdeGarlic: fixedId("buttermilk-roast-chicken-with-salsa-verde-verde-garlic"),
  vinegar: fixedId("buttermilk-roast-chicken-with-salsa-verde-verde-vinegar"),
  verdeOil: fixedId("buttermilk-roast-chicken-with-salsa-verde-verde-oil"),
  chop: fixedId("buttermilk-roast-chicken-with-salsa-verde-step-chop"),
  loosen: fixedId("buttermilk-roast-chicken-with-salsa-verde-step-loosen"),
};

const input: DevRecipe["input"] = {
  id: CHICKEN.recipe,
  name: "Buttermilk Roast Chicken with Salsa Verde",
  description:
    "Thighs marinated in buttermilk and roasted over potatoes until the skin is deep gold, with a bright herb sauce cut through it. One tin, a weeknight regular.",
  rating: 4,
  recipeServings: 4,
  recipeYieldQuantity: 4,
  yieldUnit: null,
  recipeYield: "servings",
  prepTime: 20,
  performTime: 55,
  sourceUrl: "https://www.taste.com.au/recipes/example-recipe",
  favourite: true,
  kind: "rotation",
  facets: {
    course: ["main"],
    meal: ["dinner"],
    cuisine: ["australian"],
    diet: ["gluten-free"],
    mainIngredient: ["chicken"],
    method: ["oven", "air-fryer"],
    season: ["spring", "summer"],
  },
  tags: [tag("Weeknight"), tag("One tin")],
  notes: [
    { title: "Make ahead", text: "Marinate the chicken the night before and make the salsa verde in the morning; dinner is then 45 minutes of oven time." },
    { title: "The cut", text: "The plan rotates thighs, drumsticks and marylands. Breast dries out at this heat and time." },
  ],
  parts: [
    {
      name: "",
      ingredients: [
        ing(CHICKEN.thigh, 1.2, "kilogram", "chicken thigh", {
          note: "bone-in, skin on",
          alternatives: [
            { planPicks: true, items: [item("chicken drumstick")] },
            { planPicks: true, note: "cut through the joint", items: [item("chicken maryland")] },
          ],
        }),
        ing(CHICKEN.buttermilk, 1, "cup", "buttermilk", {
          alternatives: [
            {
              basisQuantity: 1,
              basisUnit: unit("cup"),
              note: "stir together and stand 5 minutes until it curdles",
              items: [item("milk", 1, "cup"), item("lemon juice", 1, "tablespoon")],
            },
          ],
        }),
        ing(CHICKEN.garlic, 3, "clove", "garlic", { note: "finely grated" }),
        ing(CHICKEN.salt, 2, "teaspoon", "sea salt flakes"),
        ing(CHICKEN.potato, 1, "kilogram", "baby potato", { note: "halved" }),
        ing(CHICKEN.oil, 2, "tablespoon", "olive oil"),
        ing(CHICKEN.lemon, 1, null, "lemon", { note: "cut into wedges" }),
        ing(CHICKEN.thyme, 6, null, "thyme", { note: "sprigs" }),
        ing(CHICKEN.stock, 125, "millilitre", "chicken stock"),
      ],
      steps: [
        step(
          CHICKEN.marinate,
          "Marinate the chicken",
          "Mix the buttermilk, garlic and sea salt flakes in a large bowl. Add the chicken thigh and turn to coat, then cover and refrigerate for at least 2 hours.",
          "Overnight is better: the buttermilk's acid and the salt tenderise the meat. Past 24 hours the texture turns mealy.",
          [CHICKEN.buttermilk, CHICKEN.garlic, CHICKEN.salt, CHICKEN.thigh]
        ),
        step(
          CHICKEN.potatoes,
          "Start the potatoes",
          "Preheat the oven to 200°C fan (220°C conventional). Toss the baby potato with the olive oil in a large roasting tin and roast until the cut sides start to colour, about 15 minutes.",
          "",
          [CHICKEN.potato, CHICKEN.oil]
        ),
        step(
          CHICKEN.roast,
          "Roast the chicken",
          "Lift the chicken from the marinade, letting the excess drip off, and nestle it skin side up among the potatoes with the lemon and thyme. Pour the chicken stock into the tin and roast until the skin is deep golden and the juices run clear, 35–40 minutes.",
          "The buttermilk's sugars brown fast; if the skin darkens before the chicken is cooked, cover it loosely with foil. The thickest piece should read 75°C. In an air fryer, cook at 190°C until golden, 20–25 minutes, turning once.",
          [CHICKEN.thigh, CHICKEN.lemon, CHICKEN.thyme, CHICKEN.stock]
        ),
        step(
          CHICKEN.rest,
          "Rest and serve",
          "Rest the chicken for 5 minutes, then serve with the potatoes, the roasted lemon squeezed over and the salsa verde alongside.",
          "",
          [CHICKEN.lemon]
        ),
      ],
    },
    {
      name: "Salsa verde",
      ingredients: [
        ing(CHICKEN.parsley, 1, "bunch", "flat-leaf parsley", { note: "leaves picked" }),
        ing(CHICKEN.mint, 0.5, "bunch", "mint", { note: "leaves picked" }),
        ing(CHICKEN.capers, 1, "tablespoon", "capers", { note: "drained" }),
        ing(CHICKEN.anchovy, 2, null, "anchovy fillet", { note: "optional" }),
        ing(CHICKEN.verdeGarlic, 1, "clove", "garlic"),
        ing(CHICKEN.vinegar, 1, "tablespoon", "red wine vinegar"),
        ing(CHICKEN.verdeOil, 125, "millilitre", "extra virgin olive oil"),
      ],
      steps: [
        step(
          CHICKEN.chop,
          "Chop the herbs",
          "Finely chop the flat-leaf parsley, mint, capers, anchovy fillet and garlic together on a board and scrape into a bowl.",
          "Chopping by hand keeps the herbs bright and the texture loose. A food processor works if you pulse rather than blend, or it turns to paste.",
          [CHICKEN.parsley, CHICKEN.mint, CHICKEN.capers, CHICKEN.anchovy, CHICKEN.verdeGarlic]
        ),
        step(
          CHICKEN.loosen,
          "Loosen with oil",
          "Stir in the red wine vinegar and extra virgin olive oil until the sauce is spoonable, then season to taste.",
          "Keeps 3 days in the fridge under a film of oil; the colour dulls but the flavour holds.",
          [CHICKEN.vinegar, CHICKEN.verdeOil]
        ),
      ],
    },
  ],
};

export const roastChicken: DevRecipe = {
  input,
  createdDaysAgo: 30,
  updatedDaysAgo: 2,
  cooks: [cook(21, "Drumsticks this week; same timing.", 4), cook(9, "Air fryer, 22 minutes. Skin even crisper."), cook(2, "", 2)],
  image: "roastChicken.jpg",
  stepImages: [{ stepId: CHICKEN.roast, file: "roastChicken-roast.jpg" }],
};
