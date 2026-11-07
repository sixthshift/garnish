import { cook, type DevRecipe, fixedId, ing, item, step, tag } from "../build";

const SLUG = "beef-bulgogi-rice-bowls";
const id = (label: string) => fixedId(`${SLUG}-${label}`);

const BULGOGI = {
  recipe: fixedId(SLUG),
  beef: id("beef"),
  soy: id("soy"),
  sugar: id("sugar"),
  pear: id("pear"),
  garlic: id("garlic"),
  ginger: id("ginger"),
  sesameOil: id("sesame-oil"),
  gochujang: id("gochujang"),
  oil: id("oil"),
  springOnion: id("spring-onion"),
  slice: id("step-slice"),
  marinate: id("step-marinate"),
  sear: id("step-sear"),
  cucumber: id("pickle-cucumber"),
  vinegar: id("pickle-vinegar"),
  caster: id("pickle-sugar"),
  salt: id("pickle-salt"),
  pickle: id("step-pickle"),
  rice: id("serve-rice"),
  water: id("serve-water"),
  egg: id("serve-egg"),
  eggOil: id("serve-egg-oil"),
  kimchi: id("serve-kimchi"),
  seeds: id("serve-seeds"),
  cookRice: id("step-rice"),
  fryEggs: id("step-eggs"),
  build: id("step-build"),
};

const input: DevRecipe["input"] = {
  id: BULGOGI.recipe,
  name: "Beef Bulgogi Rice Bowls",
  description: "Thin-sliced beef in a sweet soy, pear and garlic marinade, seared hard and piled on rice with quick-pickled cucumber, kimchi and a fried egg.",
  rating: 5,
  recipeServings: 4,
  recipeYieldQuantity: 4,
  yieldUnit: null,
  recipeYield: "servings",
  prepTime: 25,
  performTime: 20,
  sourceUrl: "https://www.sbs.com.au/food/recipe/example-recipe",
  favourite: true,
  kind: "rotation",
  facets: {
    course: ["main"],
    meal: ["dinner"],
    cuisine: ["korean"],
    diet: ["dairy-free"],
    mainIngredient: ["beef"],
    method: ["stovetop"],
  },
  tags: [tag("Weeknight"), tag("Make ahead"), tag("Kids")],
  notes: [
    { title: "For the kids", text: "Leave the gochujang out of the marinade and serve it at the table; without it the beef is sweet and mild." },
    { title: "Make ahead", text: "Marinate the beef and pickle the cucumber the night before, and dinner is 15 minutes of cooking." },
  ],
  parts: [
    {
      name: "",
      ingredients: [
        ing(BULGOGI.beef, 600, "gram", "scotch fillet", {
          alternatives: [{ note: "already sliced, so skip the freezing", items: [item("beef stir-fry strips")] }],
        }),
        ing(BULGOGI.soy, 60, "millilitre", "soy sauce"),
        ing(BULGOGI.sugar, 2, "tablespoon", "brown sugar"),
        ing(BULGOGI.pear, 1, null, "pear", { note: "peeled and grated", alternatives: [{ items: [item("apple")] }] }),
        ing(BULGOGI.garlic, 4, "clove", "garlic", { note: "finely grated" }),
        ing(BULGOGI.ginger, 1, "tablespoon", "ginger", { note: "finely grated" }),
        ing(BULGOGI.sesameOil, 1, "tablespoon", "sesame oil"),
        ing(BULGOGI.gochujang, 1, "tablespoon", "gochujang", { note: "optional, for heat" }),
        ing(BULGOGI.oil, 1, "tablespoon", "vegetable oil"),
        ing(BULGOGI.springOnion, 3, null, "spring onion", { note: "cut into 4 cm lengths" }),
      ],
      steps: [
        step(
          BULGOGI.slice,
          "Slice the beef thinly",
          "Freeze the scotch fillet until firm but not frozen through, about 30 minutes, then slice it across the grain as thinly as possible.",
          "Half-frozen beef slices far thinner and more evenly. A butcher will slice it if asked.",
          [BULGOGI.beef]
        ),
        step(
          BULGOGI.marinate,
          "Marinate the beef",
          "Mix the soy sauce, brown sugar, pear, garlic, ginger, sesame oil and gochujang in a bowl. Add the scotch fillet, toss to coat and marinate for at least 30 minutes.",
          "The pear's enzymes tenderise the beef. Up to 24 hours in the fridge, so it can be done the night before; much longer and the texture turns soft. Marinated raw beef freezes for 3 months, flat in a bag.",
          [BULGOGI.soy, BULGOGI.sugar, BULGOGI.pear, BULGOGI.garlic, BULGOGI.ginger, BULGOGI.sesameOil, BULGOGI.gochujang, BULGOGI.beef]
        ),
        step(
          BULGOGI.sear,
          "Sear in batches",
          "Heat half the vegetable oil in a large frying pan over high heat. Lift half the beef from the marinade, spread it in one layer and cook until caramelised at the edges, 2–3 minutes. Repeat with the remaining oil and beef, adding the spring onion to the second batch.",
          "A crowded pan stews the beef in its marinade; small batches keep the heat high enough to caramelise. The sugar catches fast, so keep the beef moving once it has coloured.",
          [BULGOGI.oil, BULGOGI.beef, BULGOGI.springOnion]
        ),
      ],
    },
    {
      name: "Pickled cucumber",
      ingredients: [
        ing(BULGOGI.cucumber, 2, null, "lebanese cucumber", { note: "thinly sliced" }),
        ing(BULGOGI.vinegar, 60, "millilitre", "rice vinegar"),
        ing(BULGOGI.caster, 1, "tablespoon", "caster sugar"),
        ing(BULGOGI.salt, 0.5, "teaspoon", "salt"),
      ],
      steps: [
        step(
          BULGOGI.pickle,
          "Quick-pickle the cucumber",
          "Toss the Lebanese cucumber with the rice vinegar, caster sugar and salt and leave to stand for at least 15 minutes.",
          "Do this while the beef marinates. Keeps 3 days in the fridge, softening as it sits.",
          [BULGOGI.cucumber, BULGOGI.vinegar, BULGOGI.caster, BULGOGI.salt]
        ),
      ],
    },
    {
      name: "To serve",
      ingredients: [
        ing(BULGOGI.rice, 2, "cup", "jasmine rice"),
        ing(BULGOGI.water, 2.5, "cup", "water"),
        ing(BULGOGI.egg, 4, null, "egg"),
        ing(BULGOGI.eggOil, 1, "tablespoon", "vegetable oil"),
        ing(BULGOGI.kimchi, 1, "cup", "kimchi"),
        ing(BULGOGI.seeds, 1, "tablespoon", "sesame seeds", { note: "toasted" }),
      ],
      steps: [
        step(
          BULGOGI.cookRice,
          "Cook the rice",
          "Rinse the jasmine rice until the water runs almost clear, then bring it to the boil with the water in a covered saucepan. Reduce the heat to low and cook until the water is absorbed, 12 minutes, then rest, covered, for 10 minutes.",
          "",
          [BULGOGI.rice, BULGOGI.water]
        ),
        step(
          BULGOGI.fryEggs,
          "Fry the eggs",
          "Heat the vegetable oil in a frying pan over medium-high heat and fry the egg until the whites are set and the edges crisp but the yolks are still runny, 2–3 minutes.",
          "",
          [BULGOGI.eggOil, BULGOGI.egg]
        ),
        step(
          BULGOGI.build,
          "Build the bowls",
          "Divide the rice among bowls and top with the beef, the pickled cucumber, the kimchi and a fried egg. Scatter with the sesame seeds.",
          "Leftover beef keeps 3 days in the fridge and makes a good lunch cold over rice.",
          [BULGOGI.rice, BULGOGI.kimchi, BULGOGI.egg, BULGOGI.seeds]
        ),
      ],
    },
  ],
};

export const bulgogiBowls: DevRecipe = {
  input,
  createdDaysAgo: 300,
  updatedDaysAgo: 70,
  cooks: [
    cook(240, "Big hit. Everyone went back for seconds.", 4),
    cook(150, "Stir-fry strips from the shops; fine but thicker."),
    cook(70, "Marinated overnight. Noticeably more tender.", 6),
    cook(3, ""),
  ],
  image: "bulgogiBowls.jpg",
  stepImages: [{ stepId: BULGOGI.sear, file: "bulgogiBowls-sear.jpg" }],
};
