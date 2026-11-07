import { cook, type DevRecipe, fixedId, ing, item, step, tag } from "../build";

const SOUVLAKI = {
  recipe: fixedId("lamb-souvlaki-with-tzatziki"),
  lamb: fixedId("lamb-souvlaki-with-tzatziki-lamb"),
  oil: fixedId("lamb-souvlaki-with-tzatziki-oil"),
  lemon: fixedId("lamb-souvlaki-with-tzatziki-lemon"),
  garlic: fixedId("lamb-souvlaki-with-tzatziki-garlic"),
  oregano: fixedId("lamb-souvlaki-with-tzatziki-oregano"),
  salt: fixedId("lamb-souvlaki-with-tzatziki-salt"),
  pepper: fixedId("lamb-souvlaki-with-tzatziki-pepper"),
  marinate: fixedId("lamb-souvlaki-with-tzatziki-step-marinate"),
  thread: fixedId("lamb-souvlaki-with-tzatziki-step-thread"),
  grill: fixedId("lamb-souvlaki-with-tzatziki-step-grill"),
  cucumber: fixedId("lamb-souvlaki-with-tzatziki-tz-cucumber"),
  tzSalt: fixedId("lamb-souvlaki-with-tzatziki-tz-salt"),
  yoghurt: fixedId("lamb-souvlaki-with-tzatziki-tz-yoghurt"),
  tzGarlic: fixedId("lamb-souvlaki-with-tzatziki-tz-garlic"),
  dill: fixedId("lamb-souvlaki-with-tzatziki-tz-dill"),
  tzLemon: fixedId("lamb-souvlaki-with-tzatziki-tz-lemon"),
  tzOil: fixedId("lamb-souvlaki-with-tzatziki-tz-oil"),
  drain: fixedId("lamb-souvlaki-with-tzatziki-step-drain"),
  mix: fixedId("lamb-souvlaki-with-tzatziki-step-mix"),
  pita: fixedId("lamb-souvlaki-with-tzatziki-serve-pita"),
  tomato: fixedId("lamb-souvlaki-with-tzatziki-serve-tomato"),
  onion: fixedId("lamb-souvlaki-with-tzatziki-serve-onion"),
  lettuce: fixedId("lamb-souvlaki-with-tzatziki-serve-lettuce"),
  warm: fixedId("lamb-souvlaki-with-tzatziki-step-warm"),
  wrap: fixedId("lamb-souvlaki-with-tzatziki-step-wrap"),
};

const input: DevRecipe["input"] = {
  id: SOUVLAKI.recipe,
  name: "Lamb Souvlaki with Tzatziki",
  description: "Lemon and oregano lamb skewers charred on the barbecue, wrapped in warm pita with a thick garlicky tzatziki. Summer's most-requested dinner.",
  rating: 5,
  recipeServings: 4,
  recipeYieldQuantity: 8,
  yieldUnit: null,
  recipeYield: "skewers",
  prepTime: 25,
  performTime: 12,
  sourceUrl: "https://www.sbs.com.au/food/recipe/example-recipe",
  favourite: true,
  kind: "rotation",
  facets: {
    course: ["main"],
    meal: ["dinner"],
    cuisine: ["greek"],
    mainIngredient: ["lamb"],
    method: ["bbq"],
    season: ["summer"],
  },
  tags: [tag("Weeknight"), tag("Entertaining")],
  notes: [
    {
      title: "Skewers",
      text: "Soak bamboo skewers in water for 30 minutes before threading, or they burn through on the grill. Metal skewers need no soaking.",
    },
    { title: "Make ahead", text: "Marinate the lamb in the morning and make the tzatziki at the same time; both are better for the wait." },
  ],
  parts: [
    {
      name: "",
      ingredients: [
        ing(SOUVLAKI.lamb, 800, "gram", "lamb leg", {
          note: "boneless, cut into 3 cm pieces",
          alternatives: [{ note: "a little fattier; grill 1–2 minutes longer", items: [item("lamb shoulder")] }],
        }),
        ing(SOUVLAKI.oil, 60, "millilitre", "extra virgin olive oil"),
        ing(SOUVLAKI.lemon, 1, null, "lemon", { note: "zested and juiced" }),
        ing(SOUVLAKI.garlic, 3, "clove", "garlic", { note: "crushed" }),
        ing(SOUVLAKI.oregano, 2, "teaspoon", "dried oregano"),
        ing(SOUVLAKI.salt, 1, "teaspoon", "sea salt flakes"),
        ing(SOUVLAKI.pepper, null, null, "black pepper"),
      ],
      steps: [
        step(
          SOUVLAKI.marinate,
          "Marinate the lamb",
          "Whisk the extra virgin olive oil, lemon zest and juice, garlic, dried oregano, sea salt flakes and a good grind of black pepper in a large bowl. Add the lamb leg, toss to coat, then cover and refrigerate for at least 1 hour.",
          "Up to 12 hours is fine. Much longer and the lemon juice starts to turn the surface of the lamb mealy.",
          [SOUVLAKI.oil, SOUVLAKI.lemon, SOUVLAKI.garlic, SOUVLAKI.oregano, SOUVLAKI.salt, SOUVLAKI.pepper, SOUVLAKI.lamb]
        ),
        step(
          SOUVLAKI.thread,
          "Thread the skewers",
          "Thread the lamb onto 8 skewers, packing the pieces snugly. Reserve the marinade left in the bowl.",
          "Packed close, the pieces stay juicy in the middle while the outsides char.",
          [SOUVLAKI.lamb]
        ),
        step(
          SOUVLAKI.grill,
          "Grill the skewers",
          "Heat the barbecue to high. Grill the skewers, turning every couple of minutes and brushing with the reserved marinade for the first half of the cooking, until charred at the edges and still a little pink inside, 8–10 minutes. Rest for 5 minutes.",
          "Stop brushing once the lamb is half cooked, so the raw marinade cooks through. A ridged grill pan over high heat does the same job indoors; open a window, as it smokes.",
          [SOUVLAKI.lamb]
        ),
      ],
    },
    {
      name: "Tzatziki",
      ingredients: [
        ing(SOUVLAKI.cucumber, 1, null, "lebanese cucumber", { note: "coarsely grated" }),
        ing(SOUVLAKI.tzSalt, 0.5, "teaspoon", "salt"),
        ing(SOUVLAKI.yoghurt, 500, "gram", "greek yoghurt"),
        ing(SOUVLAKI.tzGarlic, 1, "clove", "garlic", { note: "finely grated" }),
        ing(SOUVLAKI.dill, 2, "tablespoon", "dill", { note: "chopped", alternatives: [{ items: [item("mint")] }] }),
        ing(SOUVLAKI.tzLemon, 1, "tablespoon", "lemon juice"),
        ing(SOUVLAKI.tzOil, 1, "tablespoon", "extra virgin olive oil"),
      ],
      steps: [
        step(
          SOUVLAKI.drain,
          "Drain the cucumber",
          "Toss the lebanese cucumber with the salt in a sieve and leave to drain for 10 minutes, then squeeze out as much liquid as you can.",
          "Skipping this leaves a watery tzatziki that runs off the pita.",
          [SOUVLAKI.cucumber, SOUVLAKI.tzSalt]
        ),
        step(
          SOUVLAKI.mix,
          "Mix the tzatziki",
          "Stir the cucumber into the greek yoghurt with the garlic, dill and lemon juice. Spoon into a bowl and drizzle with the extra virgin olive oil.",
          "Keeps 3 days in the fridge; the garlic gets stronger as it sits.",
          [SOUVLAKI.cucumber, SOUVLAKI.yoghurt, SOUVLAKI.tzGarlic, SOUVLAKI.dill, SOUVLAKI.tzLemon, SOUVLAKI.tzOil]
        ),
      ],
    },
    {
      name: "To serve",
      ingredients: [
        ing(SOUVLAKI.pita, 4, null, "pita bread", { alternatives: [{ items: [item("flatbread")] }] }),
        ing(SOUVLAKI.tomato, 2, null, "tomato", { note: "sliced" }),
        ing(SOUVLAKI.onion, 0.5, null, "red onion", { note: "thinly sliced" }),
        ing(SOUVLAKI.lettuce, 0.5, null, "cos lettuce", { note: "shredded" }),
      ],
      steps: [
        step(
          SOUVLAKI.warm,
          "Warm the pita",
          "Warm the pita bread on the barbecue while the lamb rests, until soft and lightly marked, about 30 seconds a side.",
          "",
          [SOUVLAKI.pita]
        ),
        step(
          SOUVLAKI.wrap,
          "Fill and wrap",
          "Spread each pita with tzatziki, slide the lamb off two skewers onto it and top with the tomato, red onion and cos lettuce. Roll up and wrap the base in baking paper.",
          "The paper holds the wrap together and catches the drips.",
          [SOUVLAKI.pita, SOUVLAKI.tomato, SOUVLAKI.onion, SOUVLAKI.lettuce]
        ),
      ],
    },
  ],
};

export const lambSouvlaki: DevRecipe = {
  input,
  createdDaysAgo: 420,
  updatedDaysAgo: 95,
  cooks: [
    cook(380, "First go. Leg from the butcher, cut it myself.", 4),
    cook(290, "Grill pan in winter. Smoky but worked."),
    cook(64, "Doubled for the Christmas barbecue.", 8),
    cook(15, ""),
  ],
  image: "lambSouvlaki.jpg",
  stepImages: [{ stepId: SOUVLAKI.grill, file: "lambSouvlaki-grill.jpg" }],
};
