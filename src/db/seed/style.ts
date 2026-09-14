// The house style guide every database starts with: fourteen statements in four
// groups — structure, voice, quantities, timing — with the four most opinionated
// off by default. Data only; `seed.ts` inserts them, matching an existing row by
// text case-insensitively so an edited statement survives a re-seed.
//
// Each string is the whole instruction sentence, because the text is exactly
// what the restyle prompt reads out to the model (M37.4); nothing in the code
// switches on a statement, so a household may rewrite any of them into its own
// words and the pass simply says the new thing.
//
// What is *not* here: "never change a temperature, a time or a quantity". That
// is not a statement anyone should be able to switch off, so it is a fixed line
// in every restyle prompt and is enforced mechanically by the facts check
// (M37.3) rather than asked for politely.
//
// The last four are off because each of them moves or drops content rather than
// rewording it, which is a bigger claim than the rest of the guide makes. The
// metric one carries a note in `styleRuleNote` (src/domain/style/style.ts): until the
// facts check understands paired figures it will flag the imperial numbers the
// statement asks to drop.
import type { StyleRuleInput } from "../models/style/repo";

/** The starting guide, in reading order: the first ten on, the last four off. */
export const DEFAULT_STYLE_RULES: readonly StyleRuleInput[] = [
  // Structure
  { text: "One action per step: split a paragraph that does several things.", enabled: true },
  { text: 'Merge steps that are one action: "Add the onion." "Stir." "Cook 5 minutes." become one step.', enabled: true },
  { text: "Keep the order of work: steps stay in the order the author gave them.", enabled: true },
  // Voice
  { text: 'Imperative voice, starting with the verb: "Add the garlic", not "You then add the garlic".', enabled: true },
  { text: 'Plain words: "fry" not "sauté", "stir" not "agitate", unless the technique word matters ("fold", "deglaze").', enabled: true },
  { text: "No chatter: drop asides, encouragement and references to the blog.", enabled: true },
  // Quantities
  { text: 'Name the quantity where the ingredient is used: "Add 2 tbsp of the oil".', enabled: true },
  { text: 'Call ingredients by their list name: "beef" or "chuck beef", never "the meat".', enabled: true },
  // Timing
  { text: "End with what to look for: when the author gives a time and a cue, the cue comes last.", enabled: true },
  { text: 'Flag parallel work with "Meanwhile".', enabled: true },
  // Off by default
  { text: 'Move plating and garnish steps to a part named "To serve".', enabled: false },
  { text: "Drop the author's alternative methods: keep only the first where a slow cooker and an oven method are both given.", enabled: false },
  { text: "Prefer metric: where a step gives both, keep only metric.", enabled: false },
  { text: "Short steps: no step longer than two sentences.", enabled: false },
];
