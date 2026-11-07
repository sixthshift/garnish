import { cook, type DevRecipe, fixedId, ing, item, step, tag } from "../build";

const SLUG = "thai-green-chicken-curry";
const id = (label: string) => fixedId(`${SLUG}-${label}`);

const CURRY = {
  recipe: fixedId(SLUG),
  oil: id("oil"),
  paste: id("paste"),
  chicken: id("chicken"),
  coconut: id("coconut-milk"),
  stock: id("stock"),
  limeLeaf: id("lime-leaf"),
  beans: id("beans"),
  fishSauce: id("fish-sauce"),
  palmSugar: id("palm-sugar"),
  limeJuice: id("lime-juice"),
  basil: id("basil"),
  chilli: id("chilli"),
  fry: id("step-fry"),
  seal: id("step-seal"),
  simmer: id("step-simmer"),
  addBeans: id("step-beans"),
  season: id("step-season"),
  rice: id("rice"),
  water: id("rice-water"),
  rinse: id("step-rinse"),
  steam: id("step-steam"),
};

const input: DevRecipe["input"] = {
  id: CURRY.recipe,
  name: "Thai Green Chicken Curry",
  description:
    "A fragrant, medium-hot green curry with chicken thigh and green beans, balanced with fish sauce, palm sugar and lime. On the table in 35 minutes.",
  rating: 4,
  recipeServings: 4,
  recipeYieldQuantity: 4,
  yieldUnit: null,
  recipeYield: "servings",
  prepTime: 10,
  performTime: 25,
  sourceUrl: "https://www.recipetineats.com/example-recipe/",
  favourite: true,
  kind: "rotation",
  facets: {
    course: ["main"],
    meal: ["dinner"],
    cuisine: ["thai"],
    diet: ["dairy-free", "gluten-free"],
    mainIngredient: ["chicken"],
    method: ["stovetop"],
  },
  tags: [tag("Weeknight"), tag("Curry")],
  notes: [
    { title: "Curry paste", text: "Brands vary a lot in heat. Start with 3 tbsp, taste the sauce once it simmers, and add the rest if it needs it." },
    { title: "The protein", text: "The plan rotates chicken thigh, prawns and firm tofu. Prawns go in with the beans; tofu goes in with the coconut milk." },
  ],
  parts: [
    {
      name: "",
      ingredients: [
        ing(CURRY.oil, 2, "tablespoon", "vegetable oil"),
        ing(CURRY.paste, 4, "tablespoon", "thai green curry paste"),
        ing(CURRY.chicken, 800, "gram", "chicken thigh", {
          note: "boneless, skinless, cut into bite-sized pieces",
          alternatives: [
            { planPicks: true, note: "peeled and deveined", items: [item("prawn")] },
            { planPicks: true, note: "cut into 2 cm cubes", items: [item("firm tofu")] },
          ],
        }),
        ing(CURRY.coconut, 1, "can", "coconut milk"),
        ing(CURRY.stock, 250, "millilitre", "chicken stock"),
        ing(CURRY.limeLeaf, 4, null, "makrut lime leaf", { note: "torn", fixed: true }),
        ing(CURRY.beans, 200, "gram", "green bean", { note: "trimmed and halved" }),
        ing(CURRY.fishSauce, 1, "tablespoon", "fish sauce"),
        ing(CURRY.palmSugar, 2, "teaspoon", "palm sugar", { note: "grated", alternatives: [{ items: [item("brown sugar")] }] }),
        ing(CURRY.limeJuice, 1, "tablespoon", "lime juice"),
        ing(CURRY.basil, 1, "cup", "thai basil", { note: "leaves picked" }),
        ing(CURRY.chilli, 1, null, "long red chilli", { note: "thinly sliced, to serve" }),
      ],
      steps: [
        step(
          CURRY.fry,
          "Fry the curry paste",
          "Heat the vegetable oil in a wok or large saucepan over medium heat. Add the Thai green curry paste and fry, stirring, until fragrant and the oil starts to separate, 2–3 minutes.",
          "Frying the paste cooks out its raw edge; it should smell sharp and aromatic. Lower the heat if it starts to catch.",
          [CURRY.oil, CURRY.paste]
        ),
        step(
          CURRY.seal,
          "Seal the chicken",
          "Add the chicken thigh and stir to coat it in the paste. Cook until the chicken is sealed all over, 3–4 minutes.",
          "",
          [CURRY.chicken]
        ),
        step(
          CURRY.simmer,
          "Simmer the curry",
          "Pour in the coconut milk and chicken stock, add the makrut lime leaf and bring to a gentle simmer. Cook uncovered until the chicken is cooked through and the sauce has thickened slightly, 10–12 minutes.",
          "Keep it at a gentle simmer: a hard boil splits the coconut milk and leaves the sauce grainy.",
          [CURRY.coconut, CURRY.stock, CURRY.limeLeaf, CURRY.chicken]
        ),
        step(
          CURRY.addBeans,
          "Add the beans",
          "Add the green bean and simmer until just tender but still bright green, 3–4 minutes.",
          "Prawns go in now with the beans; they are done when they turn pink and curl.",
          [CURRY.beans]
        ),
        step(
          CURRY.season,
          "Season and serve",
          "Stir in the fish sauce, palm sugar and lime juice. Taste and adjust until salty, sweet and sour sit in balance. Take the pan off the heat, stir through the Thai basil and scatter with the long red chilli.",
          "Keeps 3 days in the fridge. The basil darkens on standing, so add a fresh handful when reheating.",
          [CURRY.fishSauce, CURRY.palmSugar, CURRY.limeJuice, CURRY.basil, CURRY.chilli]
        ),
      ],
    },
    {
      name: "Rice",
      ingredients: [ing(CURRY.rice, 2, "cup", "jasmine rice"), ing(CURRY.water, 2.5, "cup", "water")],
      steps: [
        step(
          CURRY.rinse,
          "Rinse the rice",
          "Rinse the jasmine rice in a sieve under cold running water until the water runs almost clear.",
          "Rinsing washes off loose starch, which is what makes rice gluey.",
          [CURRY.rice]
        ),
        step(
          CURRY.steam,
          "Steam the rice",
          "Put the jasmine rice and water in a saucepan with a tight-fitting lid and bring to the boil. Reduce the heat to low, cover and cook until the water is absorbed, 12 minutes. Rest off the heat, still covered, for 10 minutes, then fluff with a fork.",
          "A rice cooker does the same with the same amount of water.",
          [CURRY.rice, CURRY.water]
        ),
      ],
    },
  ],
};

export const thaiGreenCurry: DevRecipe = {
  input,
  createdDaysAgo: 400,
  updatedDaysAgo: 40,
  cooks: [
    cook(300, "First go. Bit mild; used the whole jar of paste next time.", 4),
    cook(220, "Prawns instead of chicken. Kids picked them out."),
    cook(120, ""),
    cook(40, "Added snow peas with the beans. Good.", 4),
    cook(6, "Tofu week. Pressed it first and it held up."),
  ],
  image: "thaiGreenCurry.jpg",
};
