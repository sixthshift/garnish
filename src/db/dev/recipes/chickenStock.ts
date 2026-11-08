import { cook, type DevRecipe, fixedId, ing, step, tag, unit } from "../build";

const STOCK = {
  recipe: fixedId("chicken-stock"),
  wings: fixedId("chicken-stock-wings"),
  onion: fixedId("chicken-stock-onion"),
  carrot: fixedId("chicken-stock-carrot"),
  celery: fixedId("chicken-stock-celery"),
  peppercorns: fixedId("chicken-stock-peppercorns"),
  bay: fixedId("chicken-stock-bay"),
  thyme: fixedId("chicken-stock-thyme"),
  water: fixedId("chicken-stock-water"),
  blanch: fixedId("chicken-stock-step-blanch"),
  start: fixedId("chicken-stock-step-start"),
  simmer: fixedId("chicken-stock-step-simmer"),
  strain: fixedId("chicken-stock-step-strain"),
};

const input: DevRecipe["input"] = {
  id: STOCK.recipe,
  name: "Chicken Stock",
  description:
    "A clear, gelatinous stock from chicken wings. The base the ragu and the weeknight braises start from; it freezes in the 500 ml a recipe asks for.",
  rating: 5,
  recipeServings: 8,
  recipeYieldQuantity: 2,
  yieldUnit: unit("litre"),
  recipeYield: "",
  prepTime: 15,
  performTime: 240,
  favourite: false,
  facets: { course: ["stock"], diet: ["gluten-free", "dairy-free"], mainIngredient: ["chicken"], method: ["stovetop", "pressure-cooker"] },
  tags: [tag("Basics"), tag("Freezer")],
  notes: [
    {
      title: "Why wings",
      text: "Wings are mostly skin and joint, which is where the gelatine is. Frames or necks work as well; avoid breast meat, which gives flavour but no body.",
    },
  ],
  parts: [
    {
      name: "",
      ingredients: [
        ing(STOCK.wings, 1.5, "kilogram", "chicken wing"),
        ing(STOCK.onion, 1, null, "onion", { note: "halved, skin on" }),
        ing(STOCK.carrot, 2, null, "carrot", { note: "roughly chopped" }),
        ing(STOCK.celery, 2, null, "celery", { note: "stalks, roughly chopped" }),
        ing(STOCK.peppercorns, 1, "teaspoon", "black peppercorns", { fixed: true }),
        ing(STOCK.bay, 2, null, "bay leaf", { fixed: true }),
        ing(STOCK.thyme, 4, null, "thyme", { note: "sprigs" }),
        ing(STOCK.water, 3, "litre", "water", { note: "cold" }),
      ],
      steps: [
        step(
          STOCK.blanch,
          "Blanch the wings",
          "Put the chicken wings in a large stockpot, cover with cold water and bring to the boil. Drain, then rinse the wings and the pot.",
          "Blanching lifts off the grey scum that clouds a stock. Skip it if clarity does not matter, and skim more often instead.",
          [STOCK.wings]
        ),
        step(
          STOCK.start,
          "Start the stock",
          "Return the chicken wings to the pot with the onion, carrot, celery, black peppercorns, bay leaf and thyme. Pour in the water and bring to a bare simmer over medium heat.",
          "Cold water and a slow start draw more out of the bones than a fast boil.",
          [STOCK.wings, STOCK.onion, STOCK.carrot, STOCK.celery, STOCK.peppercorns, STOCK.bay, STOCK.thyme, STOCK.water]
        ),
        step(
          STOCK.simmer,
          "Simmer gently",
          "Simmer uncovered, skimming now and then, until the stock tastes rich and the meat falls from the wings, 3–4 hours. Top up with boiling water if the wings poke out.",
          "Keep it below a boil: bubbles that break hard emulsify the fat and turn the stock cloudy. In a pressure cooker, 1½ hours at high pressure does the same work.",
          []
        ),
        step(
          STOCK.strain,
          "Strain and chill",
          "Strain the stock through a fine sieve into a large bowl and discard the solids. Cool, refrigerate overnight, then lift off the fat.",
          "It sets to a jelly when cold; that is the gelatine, and the sign of a good stock. Keeps 4 days in the fridge or 6 months frozen.",
          []
        ),
      ],
    },
  ],
};

export const chickenStock: DevRecipe = {
  input,
  createdDaysAgo: 40,
  updatedDaysAgo: 12,
  cooks: [cook(30, "Doubled it and froze eight tubs."), cook(12, "Frames from the butcher instead of wings; just as much body.")],
  image: "chickenStock.jpg",
  makesFood: "chicken stock",
  stepImages: [{ stepId: STOCK.strain, file: "chickenStock-strain.jpg" }],
};
