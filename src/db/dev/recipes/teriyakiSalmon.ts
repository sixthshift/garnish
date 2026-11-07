import { cook, type DevRecipe, fixedId, ing, item, raw, step, tag } from "../build";

const SLUG = "teriyaki-salmon-with-sesame-greens";
const id = (label: string) => fixedId(`${SLUG}-${label}`);

const SALMON = {
  recipe: fixedId(SLUG),
  soy: id("sauce-soy"),
  mirin: id("sauce-mirin"),
  sake: id("sauce-sake"),
  sugar: id("sauce-sugar"),
  ginger: id("sauce-ginger"),
  cornflour: id("sauce-cornflour"),
  water: id("sauce-water"),
  sauce: id("step-sauce"),
  salmon: id("salmon"),
  oil: id("oil"),
  salt: id("salt"),
  broccolini: id("broccolini"),
  bokChoy: id("bok-choy"),
  sesameOil: id("sesame-oil"),
  seeds: id("sesame-seeds"),
  springOnion: id("spring-onion"),
  rice: id("rice"),
  sear: id("step-sear"),
  glaze: id("step-glaze"),
  greens: id("step-greens"),
  serve: id("step-serve"),
};

const input: DevRecipe["input"] = {
  id: SALMON.recipe,
  name: "Teriyaki Salmon with Sesame Greens",
  description: "Crisp-skinned salmon glazed in a quick homemade teriyaki, with steamed broccolini and bok choy. Twenty minutes from fridge to table.",
  rating: 4,
  recipeServings: 4,
  recipeYieldQuantity: 4,
  yieldUnit: null,
  recipeYield: "servings",
  prepTime: 10,
  performTime: 15,
  sourceUrl: "https://www.taste.com.au/recipes/example-recipe",
  favourite: false,
  kind: "rotation",
  facets: {
    course: ["main"],
    meal: ["dinner"],
    cuisine: ["japanese"],
    diet: ["pescatarian", "dairy-free", "nut-free"],
    mainIngredient: ["fish"],
    method: ["stovetop"],
  },
  tags: [tag("Weeknight"), tag("Quick")],
  notes: [
    {
      title: "In the oven",
      text: "Bake the fillets skin side down at 200°C fan (220°C conventional) until just cooked, 10–12 minutes, brushing with the sauce halfway. The skin will not crisp.",
    },
  ],
  parts: [
    {
      name: "Teriyaki sauce",
      ingredients: [
        ing(SALMON.soy, 80, "millilitre", "soy sauce"),
        ing(SALMON.mirin, 60, "millilitre", "mirin"),
        ing(SALMON.sake, 2, "tablespoon", "sake", { alternatives: [{ items: [item("chinese cooking wine")] }] }),
        ing(SALMON.sugar, 1, "tablespoon", "brown sugar", { alternatives: [{ items: [item("honey")] }] }),
        ing(SALMON.ginger, 1, "teaspoon", "ginger", { note: "finely grated" }),
        ing(SALMON.cornflour, 1, "teaspoon", "cornflour"),
        ing(SALMON.water, 1, "tablespoon", "water"),
      ],
      steps: [
        step(
          SALMON.sauce,
          "Simmer the sauce",
          "Combine the soy sauce, mirin, sake, brown sugar and ginger in a small saucepan and bring to a simmer. Stir the cornflour into the water, add it to the pan and simmer, stirring, until the sauce is glossy and coats a spoon, 1–2 minutes.",
          "It thickens further as it cools. Keeps a week in a jar in the fridge, so a double batch is worth making.",
          [SALMON.soy, SALMON.mirin, SALMON.sake, SALMON.sugar, SALMON.ginger, SALMON.cornflour, SALMON.water]
        ),
      ],
    },
    {
      name: "",
      ingredients: [
        ing(SALMON.salmon, 4, null, "salmon fillet", { note: "skin on, about 180 g each" }),
        ing(SALMON.oil, 1, "tablespoon", "vegetable oil"),
        ing(SALMON.salt, null, null, "salt"),
        ing(SALMON.broccolini, 1, "bunch", "broccolini", { note: "trimmed" }),
        ing(SALMON.bokChoy, 2, null, "bok choy", { note: "halved lengthways" }),
        ing(SALMON.sesameOil, 1, "teaspoon", "sesame oil"),
        ing(SALMON.seeds, 1, "tablespoon", "sesame seeds", { note: "toasted" }),
        ing(SALMON.springOnion, 2, null, "spring onion", { note: "thinly sliced" }),
        raw(SALMON.rice, "steamed rice, to serve"),
      ],
      steps: [
        step(
          SALMON.sear,
          "Crisp the skin",
          "Pat the salmon fillet dry and season with salt. Heat the vegetable oil in a large non-stick frying pan over medium-high heat and cook the salmon skin side down, pressing gently for the first 30 seconds, until the skin is crisp and the flesh is opaque two-thirds of the way up, 4–5 minutes.",
          "Pressing stops the skin curling away from the pan. Dry skin crisps; wet skin steams.",
          [SALMON.salmon, SALMON.salt, SALMON.oil]
        ),
        step(
          SALMON.glaze,
          "Glaze the salmon",
          "Turn the salmon, pour in the teriyaki sauce and cook, spooning the sauce over, until the salmon is glazed and just cooked in the centre, 1–2 minutes.",
          "Salmon keeps cooking off the heat, so take it off while the centre is still slightly translucent. If the sauce reduces too far and starts to catch, loosen it with a splash of water.",
          [SALMON.salmon]
        ),
        step(
          SALMON.greens,
          "Steam the greens",
          "Meanwhile, steam the broccolini and bok choy until bright green and just tender, 3–4 minutes. Toss with the sesame oil.",
          "",
          [SALMON.broccolini, SALMON.bokChoy, SALMON.sesameOil]
        ),
        step(
          SALMON.serve,
          "Plate and garnish",
          "Serve the salmon on the steamed rice with the greens alongside, scattered with the sesame seeds and spring onion.",
          "",
          [SALMON.rice, SALMON.seeds, SALMON.springOnion]
        ),
      ],
    },
  ],
};

export const teriyakiSalmon: DevRecipe = {
  input,
  createdDaysAgo: 180,
  updatedDaysAgo: 75,
  cooks: [cook(150, "Sauce was too thin; let it reduce longer."), cook(75, "Added honey instead of sugar. Stickier, better."), cook(20, "", 2)],
  image: "teriyakiSalmon.jpg",
  stepImages: [{ stepId: SALMON.glaze, file: "teriyakiSalmon-glaze.jpg" }],
};
