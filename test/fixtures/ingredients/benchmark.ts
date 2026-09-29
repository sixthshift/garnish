// Ingredient lines from real recipes, each with what the parser should read
// it as against the seeded vocabulary (DEFAULT_UNITS and STARTER_FOODS).
// Drawn from the corpus the starter foods were built from (decisions.md row
// 121); test/domain/ingredient/benchmark.test.ts runs them.
//
// Only quantity, unit and food are labelled. The note is left to the review
// step, where a reader sees it next to the line it came from.
//
// The labels are decisions, and these are the ones taken:
// - **Two amounts** ("30g / 2 tbsp butter"): the metric one, and the first
//   when both are (a cup is metric here). The twin is the note's.
// - **A pack of a size** ("2 x 400g tins tomatoes"): the count and the pack as
//   the unit (2 can), since that is what goes in the trolley and what scales.
//   A pack the unit table has no word for (packet, jar) leaves the unit empty.
// - **"a" or "an"** is one; "a few" and "some" are no amount at all.
// - **A measure with no unit row** (sprig, handful, knob) leaves the unit
//   empty and keeps the amount: the review offers to make the unit.
// - **Zest or juice of a fruit** is the fruit: a lemon is what is bought.
// - **Alternatives** ("butter or margarine") are the first; "onion or garlic
//   powder" is onion powder, the shared noun read back onto the first.
// - **Prep words** before the food ("finely chopped parsley") are not the
//   food's name.
//
// `known` marks a line the parser gets wrong today, with why. The test holds
// both ways: an unmarked line must read as labelled, and a marked one must
// still be wrong, so a fix that mends it fails until its mark is taken off.

export type Category = "plain" | "of" | "dual" | "pack" | "article" | "measure" | "prep" | "citrus" | "or";

export type BenchmarkLine = {
  line: string;
  category: Category;
  quantity: number | null;
  /** A DEFAULT_UNITS name, or null for none. */
  unit: string | null;
  /** A STARTER_FOODS name, or null for a line that is text only. */
  food: string | null;
  /** Why the parser reads it wrong today. */
  known?: string;
};

const line = (category: Category, text: string, quantity: number | null, unit: string | null, food: string | null, known?: string): BenchmarkLine => ({
  line: text,
  category,
  quantity,
  unit,
  food,
  known,
});

const plain = (text: string, quantity: number | null, unit: string | null, food: string | null, known?: string) =>
  line("plain", text, quantity, unit, food, known);
const of = (text: string, quantity: number | null, unit: string | null, food: string | null, known?: string) => line("of", text, quantity, unit, food, known);
const dual = (text: string, quantity: number | null, unit: string | null, food: string | null, known?: string) =>
  line("dual", text, quantity, unit, food, known);
const pack = (text: string, quantity: number | null, unit: string | null, food: string | null, known?: string) =>
  line("pack", text, quantity, unit, food, known);
const article = (text: string, quantity: number | null, unit: string | null, food: string | null, known?: string) =>
  line("article", text, quantity, unit, food, known);
const measure = (text: string, quantity: number | null, unit: string | null, food: string | null, known?: string) =>
  line("measure", text, quantity, unit, food, known);
const prep = (text: string, quantity: number | null, unit: string | null, food: string | null, known?: string) =>
  line("prep", text, quantity, unit, food, known);
const citrus = (text: string, quantity: number | null, unit: string | null, food: string | null, known?: string) =>
  line("citrus", text, quantity, unit, food, known);
const or = (text: string, quantity: number | null, unit: string | null, food: string | null, known?: string) => line("or", text, quantity, unit, food, known);

export const BENCHMARK: readonly BenchmarkLine[] = [
  // ── plain: the shape the parser was written for
  plain("2 tbsp olive oil", 2, "tablespoon", "olive oil"),
  plain("1 onion, diced", 1, null, "onion"),
  plain("3 cloves garlic, minced", 3, "clove", "garlic"),
  plain("2 garlic cloves, crushed", 2, null, "garlic"),
  plain("1 cup carrots, diced", 1, "cup", "carrot"),
  plain("500g beef mince", 500, "gram", "beef mince"),
  plain("1/2 tsp black pepper", 0.5, "teaspoon", "black pepper"),
  plain("3 bay leaves", 3, null, "bay leaf"),
  plain("1 1/2 cups water", 1.5, "cup", "water"),
  plain("2 large eggs", 2, null, "egg"),
  plain("250ml thickened cream", 250, "millilitre", "thickened cream"),
  plain("1 tbsp soy sauce", 1, "tablespoon", "soy sauce"),
  plain("200g dark chocolate, chopped", 200, "gram", "dark chocolate"),
  plain("1 tsp vanilla extract", 1, "teaspoon", "vanilla extract"),
  plain("2 cups plain flour", 2, "cup", "plain flour"),
  plain("1 brown onion, finely chopped", 1, null, "onion"),
  plain("4 chicken thigh fillets", 4, null, "chicken thigh"),
  plain("1 red capsicum, sliced", 1, null, "red capsicum"),
  plain("2 tbsp lemon juice", 2, "tablespoon", "lemon juice"),
  plain("1 tsp ground cumin", 1, "teaspoon", "ground cumin"),
  plain("100g butter, softened", 100, "gram", "butter"),
  plain("1 bunch coriander", 1, "bunch", "coriander"),
  plain("400g can diced tomatoes", 400, "gram", "canned tomatoes", "a second unit after the first (can) stops the food being found"),
  plain("Salt and pepper", null, null, "salt and pepper"),
  plain("Salt, to taste", null, null, "salt"),
  plain("1 kg potatoes, peeled", 1, "kilogram", "potato"),
  plain("3 spring onions, sliced", 3, null, "spring onion"),
  plain("1/4 cup fish sauce", 0.25, "cup", "fish sauce"),
  plain("2 tsp sesame oil", 2, "teaspoon", "sesame oil"),
  plain("1 cup basmati rice", 1, "cup", "basmati rice"),
  plain("1 tbsp extra virgin olive oil", 1, "tablespoon", "extra virgin olive oil"),
  plain("600g pumpkin, peeled and cubed", 600, "gram", "pumpkin"),
  plain("2 cups chicken stock", 2, "cup", "chicken stock"),
  plain("1/2 cup grated parmesan", 0.5, "cup", "parmesan"),
  plain("1 cup frozen peas", 1, "cup", "peas"),
  plain("Fresh parsley, finely chopped", null, null, "flat-leaf parsley"),

  // ── of: a unit, then "of", then the food
  of("2 cloves of garlic", 2, "clove", "garlic"),
  of("1 cup of flour", 1, "cup", "plain flour"),
  of("1 pinch of ground cloves", 1, "pinch", "ground cloves"),
  of("1 bunch of radishes, topped and tailed", 1, "bunch", "radish"),
  of("2 tbsp of honey", 2, "tablespoon", "honey"),
  of("1 tsp of salt", 1, "teaspoon", "salt"),
  of("2 slices of bread", 2, "slice", "bread"),
  of("1 can of coconut milk", 1, "can", "coconut milk"),
  of("2-4 cloves of garlic", 2, "clove", "garlic"),

  // ── dual: two amounts for one ingredient
  dual("30g / 2 tbsp unsalted butter", 30, "gram", "unsalted butter", "the second amount is read as the food"),
  dual("1/3 cup / 75 g sour cream", 1 / 3, "cup", "sour cream", "the second amount is read as the food"),
  dual("1 kg / 2 lb beef mince", 1, "kilogram", "beef mince", "the second amount is read as the food"),
  dual("500 g / 1 lb squid tubes", 500, "gram", "squid", "the second amount is read as the food"),
  dual("700g / 24oz tomato passata", 700, "gram", "passata", "the second amount is read as the food"),
  dual("150g/5oz plain flour", 150, "gram", "plain flour", "the second amount is read as the food"),
  dual("3.5 oz / 100g salted butter", 100, "gram", "butter", "the imperial amount is kept and the metric one read as the food"),
  dual("1 lb / 500g dried pappardelle", 500, "gram", "pappardelle", "the imperial amount is kept and the metric one read as the food"),
  dual("1 cup / 155g cornflour / cornstarch", 1, "cup", "cornflour", "the second amount is read as the food"),
  dual("1.25kg / 2.5 lb chuck beef", 1.25, "kilogram", "beef chuck", "the second amount is read as the food, and chuck beef names it back to front"),

  // ── pack: a count of packs of a size
  pack("400g can black beans, drained and rinsed", 1, "can", "black beans", "the size is read as the amount and the pack stops the food being found"),
  pack("400 g tin coconut milk", 1, "can", "coconut milk", "the size is read as the amount and tin is not a unit word"),
  pack("2 x 395 g cans condensed milk", 2, "can", "sweetened condensed milk", "the size and the x are not read"),
  pack("1 x 400g tin of black beans", 1, "can", "black beans", "the size, the x and the of are not read"),
  pack(
    "2 x 400g tins of plum tomatoes",
    2,
    "can",
    "canned tomatoes",
    "the size, the x and the of are not read, and plum tomatoes alone are the fresh roma tomato"
  ),
  pack("2 x 250g packs halloumi", 2, null, "haloumi", "the size and the x are not read"),
  pack("2 250g packets cream cheese, chopped", 2, null, "cream cheese", "the size is read as a second number"),

  // ── article: a or an for the amount
  article("a pinch of dried chilli", 1, "pinch", "dried chilli"),
  article("a pinch of salt", 1, "pinch", "salt"),
  article("a small bunch of flat-leaf parsley", 1, "bunch", "flat-leaf parsley", '"small" stands between the amount and the unit'),
  article("a splash of brandy", 1, null, "brandy", "splash is not a unit, and the food is looked for after it"),
  article("a few sprigs of fresh rosemary", null, null, "rosemary", '"a few" is read as one, and "sprigs of fresh" stands in front of the food'),
  article("a handful of rocket", 1, null, "rocket", "handful is not a unit, and the food is looked for after it"),

  // ── measure: a unit the unit table does not have
  measure("3 sprigs of thyme", 3, null, "thyme", "sprig is not a unit, and the food is looked for after it"),
  measure("1 sprig of fresh rosemary", 1, null, "rosemary", "sprig is not a unit, and the food is looked for after it"),
  measure("2 handfuls of rocket", 2, null, "rocket", "handful is not a unit, and the food is looked for after it"),
  measure("1 knob of butter", 1, null, "butter", "knob is not a unit, and the food is looked for after it"),
  measure("2cm piece ginger, grated", 2, null, "ginger", 'cm is not a unit, so "cm piece" stands in front of the food'),
  measure("4 rashers bacon", 4, null, "bacon"),
  measure("2 sticks celery", 2, null, "celery"),

  // ── prep: preparation words in front of the food
  prep("1 tbsp finely chopped parsley", 1, "tablespoon", "flat-leaf parsley", "the preparation words stand in front of the food"),
  prep("1/4 cup firmly packed brown sugar", 0.25, "cup", "brown sugar"),
  prep("1/2 cup freshly grated parmesan cheese", 0.5, "cup", "parmesan"),
  prep("1/4 cup roughly chopped fresh basil leaves", 0.25, "cup", "basil", "the preparation words stand in front of the food"),
  prep("250 g thinly sliced roast beef", 250, "gram", "roast beef", "the preparation words stand in front of the food"),
  prep("1 cup finely diced celery", 1, "cup", "celery", "the preparation words stand in front of the food"),
  prep("2 tbsp thinly sliced spring onions", 2, "tablespoon", "spring onion", "the preparation words stand in front of the food"),
  prep("5 tbsp finely grated parmesan", 5, "tablespoon", "parmesan"),
  prep("1 tsp freshly ground white pepper", 1, "teaspoon", "white pepper", "the preparation words stand in front of the food"),
  prep("2 cup finely shredded chinese cabbage", 2, "cup", "wombok", "the preparation words stand in front of the food"),

  // ── citrus: the part of a fruit, then the fruit
  citrus("Zest of 1 lemon", 1, null, "lemon", "the amount comes after the words it measures"),
  citrus("juice of 1 lime", 1, null, "lime", "the amount comes after the words it measures"),
  citrus("Juice of 3 oranges", 3, null, "orange", "the amount comes after the words it measures"),
  citrus("zest and juice of 1 lime", 1, null, "lime", "the amount comes after the words it measures"),
  citrus("finely grated zest of 2 lemons", 2, null, "lemon", "the amount comes after the words it measures"),
  citrus("juice of ½ lime", 0.5, null, "lime", "the amount comes after the words it measures"),

  // ── or: alternatives, the first one kept
  or("2 tbsp butter or margarine", 2, "tablespoon", "butter"),
  or("150g fresh or frozen peas", 150, "gram", "peas", '"fresh or frozen" stands in front of the food'),
  or("1 chicken or beef stock cube", 1, null, "chicken stock cube", 'the "chicken or beef stock" alias matches first and leaves "cube"'),
  or("1/4 tsp onion or garlic powder", 0.25, "teaspoon", "onion powder", "the shared noun belongs to both, so the first reads as onion"),
  or("3 tbsp coconut or sunflower oil", 3, "tablespoon", "coconut oil", "the shared noun belongs to both, so the first reads as coconut"),
  or(
    "1.3 litres turkey or chicken stock",
    1.3,
    "litre",
    "chicken stock",
    "turkey is a food, so the first alternative reads as the meat; turkey stock is not one"
  ),
  or("2 tbsp vegetable oil or other neutral flavoured oil", 2, "tablespoon", "vegetable oil"),
  or("250g camembert or brie", 250, "gram", "brie"),
];
