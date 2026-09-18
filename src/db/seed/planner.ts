import type { SeededStatement } from "./statements";

/**
 * The starting planner guide, in reading order: five on, two off. Each is a
 * sentence about what a good week looks like, read out to the model that
 * proposes one — repetition, season, the shape of a weeknight, variety, and
 * what to lean on — then two the household may want and many will not.
 *
 * What is not here: the date, the hemisphere and the week's open slots. Those
 * are facts of a run rather than preferences, so they are fixed lines of the
 * prompt (M39.3), the way "temperatures, times and quantities are never
 * changed" is in the restyle. A statement is something you may switch off; a
 * fact is not.
 */
export const DEFAULT_PLANNER_RULES: readonly SeededStatement[] = [
  { text: "Nothing we ate in the last three weeks, unless it is a favourite.", enabled: true },
  { text: "Favour produce in season in Australia this month.", enabled: true },
  { text: "Weeknights are quick: Monday to Thursday, prefer recipes under 45 minutes; longer cooks belong on the weekend.", enabled: true },
  { text: "Vary the week: no two dinners with the same main protein or the same cuisine back to back.", enabled: true },
  { text: "Lean on favourites and high ratings, but bring back one recipe not made in a long while.", enabled: true },
  { text: "Two vegetarian dinners a week.", enabled: false },
  { text: "A big-batch dinner may be the next day's lunch as leftovers.", enabled: false },
];
