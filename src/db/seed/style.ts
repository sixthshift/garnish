import type { SeededStatement } from "./statements";

/**
 * The starting guide, in reading order, all eight on: one statement per theme
 * — step size, voice, chatter, ingredients, timing — then three that move or
 * drop content rather than reword it, which the facts check flags so the part
 * starts unticked in the sheet. A step is a stage rather than an action
 * because models read "one action" as one verb; quantities stay in the
 * ingredient row a step links to rather than in its text. Try a change here
 * with `bun run restyle` on two models before it lands.
 */
export const DEFAULT_STYLE_RULES: readonly SeededStatement[] = [
  {
    text: 'One stage per step, in the author\'s order: a step is everything done at one pan or bowl until the next wait or the next pan. The author\'s paragraph is usually one stage, so keep it whole; fragments of one stage ("Add the onion." "Stir." "Cook 5 minutes.") become one step.',
    enabled: true,
    was: [
      "One stage per step: everything done at one pan or bowl until the next wait or the next pan. The author's paragraph is usually already one stage; do not split it into sentences.",
      "One action per step: split a paragraph that does several things.",
      'One action per step: one thing done to the food, with the wait or cue that follows it. "Add the garlic and onion and fry for 2 minutes" is one step; "Add the garlic and onion." and "Fry for 2 minutes." are half a step each. Never a step of a single verb.',
      'Merge steps that are one action: "Add the onion." "Stir." "Cook 5 minutes." become one step.',
      "Keep the order of work: steps stay in the order the author gave them.",
      "Short steps: no step longer than two sentences.",
    ],
  },
  {
    text: 'Imperative, verb first: "Add the garlic", not "You then add the garlic" or "Now it is time to add the garlic". Keep the author\'s cooking verbs (sauté, deglaze, fold, blanch, sear): they are the method, not the voice.',
    enabled: true,
    was: [
      'Plain imperative: start with the verb ("Add the garlic", not "You then add the garlic") and use the everyday word ("fry" not "sauté") unless the technique word matters ("fold", "deglaze").',
      'Imperative voice, starting with the verb: "Add the garlic", not "You then add the garlic".',
      'Plain words: "fry" not "sauté", "stir" not "agitate", unless the technique word matters ("fold", "deglaze").',
    ],
  },
  {
    text: 'No chatter: drop asides, encouragement, blog references, the author\'s step titles and "to your taste". Keep storage and make-ahead advice.',
    enabled: true,
    was: [
      "No chatter: drop asides, encouragement and references to the blog.",
      'No chatter: drop asides, encouragement, references to the blog and "to your taste". Keep storage and make-ahead advice.',
    ],
  },
  {
    text: 'Ingredients by their food name, as marked (food: …) after each ingredient line: "beef", never "the meat" and never the whole line. Quantities stay in the list; a step carries one only where the author wrote it or where part of an ingredient is used ("1 tbsp of the oil", then "the remaining 2 tbsp").',
    enabled: true,
    was: [
      'Call ingredients by their list name: "beef" or "chuck beef", never "the meat".',
      'Call an ingredient by its food name, marked (food: …) after each ingredient line: "beef", never "the meat" and never the whole line with its quantity.',
      'Name the quantity where the ingredient is used: "Add 2 tbsp of the oil".',
      'Quantities stay in the ingredient list: a step names the food and carries a quantity only where the author wrote one, or where only part of an ingredient is used ("1 tbsp of the oil", then "the remaining 2 tbsp"). Never copy an ingredient line into a step.',
    ],
  },
  {
    text: 'Timing: when the author gives a time and a cue, the cue comes last ("fry for 5 minutes until soft"); flag parallel work with "Meanwhile".',
    enabled: true,
    was: ["End with what to look for: when the author gives a time and a cue, the cue comes last.", 'Flag parallel work with "Meanwhile".'],
  },
  { text: 'Move plating and garnish steps to a part named "To serve".', enabled: true },
  { text: "Drop the author's alternative methods: keep only the first where a slow cooker and an oven method are both given.", enabled: true },
  { text: "Prefer metric: where a step gives both, keep only metric.", enabled: true },
];
