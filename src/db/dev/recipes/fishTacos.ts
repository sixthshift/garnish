import { type DevRecipe, fixedId, ing, item, raw, step, tag } from "../build";

const TACOS = {
  recipe: fixedId("crispy-fish-tacos-with-pickled-onion"),
  fish: fixedId("crispy-fish-tacos-with-pickled-onion-fish"),
  flour: fixedId("crispy-fish-tacos-with-pickled-onion-flour"),
  paprika: fixedId("crispy-fish-tacos-with-pickled-onion-paprika"),
  salt: fixedId("crispy-fish-tacos-with-pickled-onion-salt"),
  egg: fixedId("crispy-fish-tacos-with-pickled-onion-egg"),
  panko: fixedId("crispy-fish-tacos-with-pickled-onion-panko"),
  oil: fixedId("crispy-fish-tacos-with-pickled-onion-oil"),
  tortillas: fixedId("crispy-fish-tacos-with-pickled-onion-tortillas"),
  cabbage: fixedId("crispy-fish-tacos-with-pickled-onion-cabbage"),
  avocado: fixedId("crispy-fish-tacos-with-pickled-onion-avocado"),
  coriander: fixedId("crispy-fish-tacos-with-pickled-onion-coriander"),
  hotSauce: fixedId("crispy-fish-tacos-with-pickled-onion-hot-sauce"),
  coat: fixedId("crispy-fish-tacos-with-pickled-onion-step-coat"),
  fry: fixedId("crispy-fish-tacos-with-pickled-onion-step-fry"),
  assemble: fixedId("crispy-fish-tacos-with-pickled-onion-step-assemble"),
  onion: fixedId("crispy-fish-tacos-with-pickled-onion-pickle-onion"),
  vinegar: fixedId("crispy-fish-tacos-with-pickled-onion-pickle-vinegar"),
  sugar: fixedId("crispy-fish-tacos-with-pickled-onion-pickle-sugar"),
  pickleSalt: fixedId("crispy-fish-tacos-with-pickled-onion-pickle-salt"),
  pickle: fixedId("crispy-fish-tacos-with-pickled-onion-step-pickle"),
  sourCream: fixedId("crispy-fish-tacos-with-pickled-onion-crema-sour-cream"),
  limeZest: fixedId("crispy-fish-tacos-with-pickled-onion-crema-lime-zest"),
  limeJuice: fixedId("crispy-fish-tacos-with-pickled-onion-crema-lime-juice"),
  crema: fixedId("crispy-fish-tacos-with-pickled-onion-step-crema"),
};

const input: DevRecipe["input"] = {
  id: TACOS.recipe,
  name: "Crispy Fish Tacos with Pickled Onion",
  description: "Panko-crusted white fish in warm corn tortillas with crunchy cabbage, quick-pickled onion and a sharp lime crema.",
  rating: null,
  recipeServings: 4,
  recipeYieldQuantity: 12,
  yieldUnit: null,
  recipeYield: "tacos",
  prepTime: 30,
  performTime: 15,
  sourceUrl: "https://www.taste.com.au/recipes/example-recipe",
  favourite: false,
  kind: null,
  facets: {
    course: ["main"],
    meal: ["dinner"],
    cuisine: ["latin-american"],
    diet: ["pescatarian"],
    mainIngredient: ["fish"],
    method: ["stovetop", "air-fryer"],
    season: ["summer"],
  },
  tags: [tag("Weeknight"), tag("Kids")],
  notes: [{ title: "The fish", text: "Any firm white fish holds together in the crumb. Avoid delicate fillets like whiting, which break up in the pan." }],
  parts: [
    {
      name: "",
      ingredients: [
        ing(TACOS.fish, 600, "gram", "white fish fillet", {
          note: "skinless, cut into fingers",
          alternatives: [
            { planPicks: true, items: [item("flathead fillet")] },
            { planPicks: true, items: [item("barramundi fillet")] },
            { planPicks: true, items: [item("snapper fillet")] },
          ],
        }),
        ing(TACOS.flour, 0.5, "cup", "plain flour"),
        ing(TACOS.paprika, 1, "teaspoon", "smoked paprika"),
        ing(TACOS.salt, 1, "teaspoon", "salt"),
        ing(TACOS.egg, 2, null, "egg", { note: "lightly beaten" }),
        ing(TACOS.panko, 2, "cup", "panko breadcrumbs"),
        ing(TACOS.oil, 125, "millilitre", "vegetable oil", { note: "for shallow frying" }),
        ing(TACOS.tortillas, 12, null, "corn tortilla", { note: "small", alternatives: [{ items: [item("flour tortilla")] }] }),
        ing(TACOS.cabbage, 0.25, null, "red cabbage", { note: "finely shredded" }),
        ing(TACOS.avocado, 1, null, "avocado", { note: "sliced" }),
        ing(TACOS.coriander, 0.5, "bunch", "coriander", { note: "leaves picked" }),
        raw(TACOS.hotSauce, "hot sauce, to serve"),
      ],
      steps: [
        step(
          TACOS.coat,
          "Crumb the fish",
          "Mix the plain flour, smoked paprika and salt on a plate. Put the egg in a shallow bowl and the panko breadcrumbs on a second plate. Dust each piece of white fish fillet in the flour, dip in the egg, then press into the panko to coat.",
          "One hand for the dry plates and one for the egg keeps your fingers from crumbing too. The fish can be crumbed an hour ahead and kept on a tray in the fridge.",
          [TACOS.flour, TACOS.paprika, TACOS.salt, TACOS.egg, TACOS.panko, TACOS.fish]
        ),
        step(
          TACOS.fry,
          "Fry the fish",
          "Heat the vegetable oil in a large frying pan over medium–high heat. Fry the fish in batches until golden and crisp, 2–3 minutes a side. Drain on paper towel.",
          "The oil is ready when a crumb sizzles hard on contact. In an air fryer, spray the crumbed fish with oil and cook at 200°C until golden, 8–10 minutes, turning once.",
          [TACOS.oil, TACOS.fish]
        ),
        step(
          TACOS.assemble,
          "Warm and fill",
          "Warm the corn tortilla in a dry frying pan until soft and blistered in spots, about 30 seconds a side. Fill with the red cabbage, fish, avocado, pickled onion and lime crema, and finish with the coriander and hot sauce.",
          "Stack the warm tortillas in a tea towel so they stay soft while you fill them.",
          [TACOS.tortillas, TACOS.cabbage, TACOS.fish, TACOS.avocado, TACOS.coriander, TACOS.hotSauce]
        ),
      ],
    },
    {
      name: "Pickled onion",
      ingredients: [
        ing(TACOS.onion, 1, null, "red onion", { note: "thinly sliced" }),
        ing(TACOS.vinegar, 125, "millilitre", "white wine vinegar", { alternatives: [{ items: [item("apple cider vinegar")] }] }),
        ing(TACOS.sugar, 1, "tablespoon", "white sugar"),
        ing(TACOS.pickleSalt, 1, "teaspoon", "salt", { fixed: true }),
      ],
      steps: [
        step(
          TACOS.pickle,
          "Pickle the onion",
          "Stir the white wine vinegar, white sugar and salt in a small bowl until dissolved. Add the red onion, press it under the liquid and stand until bright pink and softened, at least 20 minutes.",
          "Make it first so it is ready when the fish is. Keeps 2 weeks in a jar in the fridge.",
          [TACOS.vinegar, TACOS.sugar, TACOS.pickleSalt, TACOS.onion]
        ),
      ],
    },
    {
      name: "Lime crema",
      ingredients: [
        ing(TACOS.sourCream, 150, "gram", "sour cream", { alternatives: [{ items: [item("greek yoghurt")] }] }),
        ing(TACOS.limeZest, 1, "teaspoon", "lime zest"),
        ing(TACOS.limeJuice, 1, "tablespoon", "lime juice"),
      ],
      steps: [
        step(TACOS.crema, "Mix the crema", "Stir the sour cream, lime zest and lime juice together until smooth.", "", [
          TACOS.sourCream,
          TACOS.limeZest,
          TACOS.limeJuice,
        ]),
      ],
    },
  ],
};

export const fishTacos: DevRecipe = {
  input,
  createdDaysAgo: 5,
  updatedDaysAgo: 5,
  cooks: [],
  image: "fishTacos.jpg",
};
