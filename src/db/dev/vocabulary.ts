/**
 * The recipe content dev recipes are made from: dish shapes, tags, step
 * sentences, notes, descriptions and sources. Recipes are the only dev-only
 * data; the units and foods they use are the seed's (`references.ts`).
 */

/**
 * Tags, heaviest first../generate.ts weights its picks towards the front of
 * this list, so the leading tags land on many recipes and the trailing ones on
 * one or two — which is what makes the tag list and the any/all filter switch
 * worth testing.
 */
export const TAGS: readonly string[] = [
  "Weeknight",
  "Vegetarian",
  "One Pot",
  "Slow Cooked",
  "Baking",
  "Salad",
  "Soup",
  "Pasta",
  "Curry",
  "Roast",
  "BBQ",
  "Seafood",
  "Dessert",
  "Breakfast",
  "Snack",
  "Freezer Friendly",
  "Kid Approved",
  "Gluten Free",
  "Spicy",
  "Make Ahead",
  "Party",
  "Christmas",
  "Picnic",
  "Leftovers",
  "Camping",
];

/**
 * Dish shapes: the name pattern, the parts a recipe of that shape gets,
 * and the headline ingredients that actually make sense with it. Pairing
 * headlines per shape rather than crossing every headline with every shape is
 * the difference between "Lamb Rogan Josh" and "Barramundi Biscuits".
 */
export type Shape = {
  /** `{food}` is replaced with one of this shape's headlines. */
  pattern: string;
  /** Part names. A single `""` is the flat recipe with no named part. */
  parts: readonly string[];
  tags: readonly string[];
  servings: number;
  yieldUnit: string;
  headlines: readonly string[];
};

export const SHAPES: readonly Shape[] = [
  {
    pattern: "{food} Curry",
    parts: ["Curry paste", "Curry"],
    tags: ["Curry", "Weeknight"],
    servings: 4,
    yieldUnit: "bowls",
    headlines: ["Chickpea", "Lamb", "Pumpkin", "Prawn", "Cauliflower", "Beef", "Red Lentil"],
  },
  {
    pattern: "Slow-Cooked {food}",
    parts: [""],
    tags: ["Slow Cooked"],
    servings: 6,
    yieldUnit: "serves",
    headlines: ["Lamb Shoulder", "Beef Cheeks", "Pork Belly", "Lamb Shanks", "Beef Brisket"],
  },
  {
    pattern: "{food} Soup",
    parts: [""],
    tags: ["Soup", "Freezer Friendly"],
    servings: 4,
    yieldUnit: "bowls",
    headlines: ["Roast Pumpkin", "Red Lentil", "Cauliflower", "Minestrone", "Chicken and Sweetcorn", "Pea and Ham"],
  },
  {
    pattern: "Roast {food}",
    parts: ["The roast", "Gravy"],
    tags: ["Roast"],
    servings: 6,
    yieldUnit: "serves",
    headlines: ["Chicken", "Lamb", "Pork", "Beef", "Winter Vegetables"],
  },
  {
    pattern: "{food} Salad",
    parts: [""],
    tags: ["Salad", "Weeknight"],
    servings: 4,
    yieldUnit: "serves",
    headlines: ["Roast Pumpkin and Fetta", "Greek", "Rocket and Parmesan", "Green Bean", "Chickpea and Herb", "Cucumber and Mint"],
  },
  {
    pattern: "{food} Pasta",
    parts: ["Sauce", "To serve"],
    tags: ["Pasta", "Weeknight"],
    servings: 4,
    yieldUnit: "serves",
    headlines: ["Tomato and Basil", "Bolognese", "Prawn and Chilli", "Mushroom", "Carbonara", "Zucchini and Lemon"],
  },
  {
    pattern: "{food} Tray Bake",
    parts: [""],
    tags: ["One Pot", "Weeknight"],
    servings: 4,
    yieldUnit: "serves",
    headlines: ["Chicken and Potato", "Sausage and Onion", "Harissa Cauliflower", "Lemon Chicken", "Chorizo and Capsicum"],
  },
  {
    pattern: "{food} Tart",
    parts: ["Pastry", "Filling", "To finish"],
    tags: ["Baking", "Dessert"],
    servings: 8,
    yieldUnit: "slices",
    headlines: ["Lemon", "Chocolate", "Apple", "Caramelised Onion", "Bakewell"],
  },
  {
    pattern: "{food} Biscuits",
    parts: [""],
    tags: ["Baking", "Snack"],
    servings: 24,
    yieldUnit: "biscuits",
    headlines: ["Anzac", "Chocolate Chip", "Ginger", "Shortbread", "Oat and Sultana"],
  },
  {
    pattern: "{food} Cake",
    parts: ["Cake", "Icing"],
    tags: ["Baking", "Dessert"],
    servings: 10,
    yieldUnit: "slices",
    headlines: ["Banana", "Carrot", "Chocolate", "Lemon Yoghurt", "Coffee and Walnut"],
  },
  {
    pattern: "{food} Stir-Fry",
    parts: ["Sauce", "Stir-fry"],
    tags: ["Weeknight"],
    servings: 4,
    yieldUnit: "serves",
    headlines: ["Beef and Broccoli", "Chicken and Cashew", "Prawn and Ginger", "Tofu and Greens", "Pork and Snow Pea"],
  },
  {
    pattern: "{food} Risotto",
    parts: [""],
    tags: ["One Pot"],
    servings: 4,
    yieldUnit: "serves",
    headlines: ["Mushroom", "Pumpkin and Sage", "Pea and Lemon", "Prawn", "Chicken and Leek"],
  },
  {
    pattern: "{food} Burgers",
    parts: ["Patties", "To assemble"],
    tags: ["BBQ", "Kid Approved"],
    servings: 4,
    yieldUnit: "burgers",
    headlines: ["Beef", "Chicken Schnitzel", "Lamb and Fetta", "Black Bean", "Pork and Fennel"],
  },
  {
    pattern: "{food} Tacos",
    parts: ["Filling", "Slaw", "To serve"],
    tags: ["Party"],
    servings: 4,
    yieldUnit: "tacos",
    headlines: ["Fish", "Pulled Pork", "Black Bean", "Chipotle Chicken", "Prawn"],
  },
  {
    pattern: "{food} Pie",
    parts: ["Filling", "Pastry"],
    tags: ["Baking"],
    servings: 6,
    yieldUnit: "serves",
    headlines: ["Steak and Mushroom", "Chicken and Leek", "Shepherd's", "Apple", "Curried Vegetable"],
  },
];

/** Step sentences. `{food}` and `{unit}` are filled from the recipe's own ingredients. */
/**
 * Templates naming two of a part's rows in one line, so `suggestLinks` always
 * has at least one step to link to two rows at once (see./generate.ts).
 */
export const DOUBLE_STEPS: readonly string[] = [
  "Combine the {food} and the {food} in a large bowl.",
  "Toss the {food} through the {food} until well coated.",
  "Stir the {food} into the {food} and bring back to a simmer.",
  "Layer the {food} over the {food} in the dish.",
];

export const STEPS: readonly string[] = [
  "Preheat the oven to 180°C fan-forced and line a tray with baking paper.",
  "Heat the oil in a large heavy-based pan over medium-high heat.",
  "Cook the {food} until softened, about 5 minutes, stirring now and then.",
  "Add the {food} and cook for another minute, until fragrant.",
  "Season generously with salt and pepper, then taste and adjust.",
  "Pour in the stock, bring to a simmer and reduce the heat to low.",
  "Cover and cook for 40 minutes, until everything is tender.",
  "Stir through the {food} and cook for a further 2 minutes.",
  "Blend until smooth with a stick blender, or leave it chunky if you prefer.",
  "Transfer to the oven and roast for 25 to 30 minutes, turning once halfway.",
  "Rest for 10 minutes before slicing — it will carve far more cleanly.",
  "Scatter over the {food} and serve straight away.",
  "Whisk the dry ingredients together in a large bowl.",
  "Fold the wet into the dry until *just* combined; a few lumps are fine.",
  "Chill in the fridge for at least an hour before rolling out.",
  "Bake for 20 minutes, until golden and firm to the touch.",
  "Cool on the tray for 5 minutes, then move to a rack to cool completely.",
  "Toss everything together with the dressing and season to taste.",
  "Bring a large pot of well-salted water to the boil.",
  "Drain, reserving a cup of the cooking water for the sauce.",
];

/** Note titles and bodies attached to some recipes. */
export const NOTES: readonly { title: string; text: string }[] = [
  { title: "Make ahead", text: "Keeps in the fridge for three days. The flavour is better on the second day." },
  { title: "Freezing", text: "Freezes well for up to three months. Thaw overnight in the fridge before reheating." },
  { title: "Swaps", text: "Any firm white fish works here. Use vegetable stock to keep it vegetarian." },
  { title: "Storage", text: "Airtight container, room temperature, up to a week." },
  { title: "Kid version", text: "Leave the chilli out and serve it on the side for the adults." },
  { title: "Doubling", text: "Doubles cleanly, but use two trays — crowding one steams it instead of roasting." },
  { title: "Why it works", text: "Salting early draws out moisture, so it browns instead of stewing." },
];

/** Descriptions, one per recipe, cycled with the shape. */
export const DESCRIPTIONS: readonly string[] = [
  "A weeknight standby that comes together in one pan while the rice cooks.",
  "Slow and forgiving — the oven does the work while you get on with the day.",
  "Bright, sharp and fresh. Best assembled at the last minute.",
  "Deeply savoury and a little rich; a green salad on the side balances it out.",
  "The kind of thing that disappears before it reaches the table.",
  "Comfort food, unapologetically. Doubles easily for a crowd.",
  "Light enough for summer, substantial enough to be dinner.",
  "Crisp edges, soft middle. The resting time is not optional.",
  "Store-cupboard ingredients, almost no chopping, ready in half an hour.",
  "Worth the effort for a weekend, and the leftovers are better than the first serve.",
];

/** Source URLs for the recipes that carry one. */
export const SOURCES: readonly string[] = [
  "https://www.taste.com.au/recipes/example-recipe",
  "https://www.recipetineats.com/example-recipe/",
  "https://www.sbs.com.au/food/recipe/example-recipe",
  "https://www.abc.net.au/everyday/example-recipe/12345678",
];
