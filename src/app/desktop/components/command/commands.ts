// The command bar's reading of what was typed (decisions.md row 207): the
// words, a day at the end of them, and the options that follow. Pure, so the
// parsing and the choosing are tested without a palette; the palette brings
// the recipes it found and the plan it read.

import { addDays, dayName, dayParts, type PlanRecipe } from "../../../../domain/plan/plan";
import type { RecipeSummary } from "../../../../domain/recipes/recipe";
import { navItems } from "../../../components/layout/Nav";

/** A weekday's short name as `dayParts` writes it, for each word that names it. */
const WEEKDAY_WORDS: Record<string, string> = {
  mon: "Mon",
  monday: "Mon",
  tue: "Tue",
  tues: "Tue",
  tuesday: "Tue",
  wed: "Wed",
  weds: "Wed",
  wednesday: "Wed",
  thu: "Thu",
  thur: "Thu",
  thurs: "Thu",
  thursday: "Thu",
  fri: "Fri",
  friday: "Fri",
  sat: "Sat",
  saturday: "Sat",
  sun: "Sun",
  sunday: "Sun",
};

/** Days counted from today rather than named by weekday. */
const RELATIVE_WORDS: Record<string, number> = { today: 0, tonight: 0, tomorrow: 1 };

/** Whether `word` names a day: a weekday, short or whole, or today, tonight or tomorrow. Case-insensitive. */
export function isDayWord(word: string): boolean {
  const lower = word.toLowerCase();
  return lower in WEEKDAY_WORDS || lower in RELATIVE_WORDS;
}

/**
 * The date a day word names, seen from `today`: the next such day that is
 * today or later, so "tue" on a Tuesday is today and on a Wednesday is next
 * week's. Null for a word that is not a day.
 */
export function resolveDay(word: string, today: string): string | null {
  const lower = word.toLowerCase();
  const offset = RELATIVE_WORDS[lower];
  if (offset !== undefined) return addDays(today, offset);
  const weekday = WEEKDAY_WORDS[lower];
  if (weekday === undefined) return null;
  for (let ahead = 0; ahead < 7; ahead++) {
    const date = addDays(today, ahead);
    if (dayParts(date).weekday === weekday) return date;
  }
  return null;
}

export type ParsedQuery = {
  /** Every word, lower-cased, in order. */
  words: string[];
  /** The words that are not the trailing day: what a recipe is matched on. */
  terms: string[];
  /** The date the last word names, or null when it names none. */
  date: string | null;
};

/** Split what was typed into words, and take a trailing day off the end as a date. */
export function parseQuery(query: string, today: string): ParsedQuery {
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const last = words.at(-1);
  const date = last === undefined ? null : resolveDay(last, today);
  return { words, terms: date === null ? words : words.slice(0, -1), date };
}

/**
 * What to ask the recipe search for: the longest term, the one that narrows
 * most. The search matches one run of the name, so the terms' order is not
 * asked of it; `matchRecipes` asks for every term after. Null with no terms.
 */
export function searchTermOf(terms: readonly string[]): string | null {
  return terms.reduce<string | null>((longest, term) => (longest === null || term.length > longest.length ? term : longest), null);
}

/** The recipes whose name holds every term, in the order given. */
export function matchRecipes<T extends Pick<RecipeSummary, "name">>(recipes: readonly T[], terms: readonly string[]): T[] {
  if (terms.length === 0) return [];
  return recipes.filter((recipe) => {
    const name = recipe.name.toLowerCase();
    return terms.every((term) => name.includes(term));
  });
}

/** The recipe an option opens or plans: what its row shows. */
export type CommandRecipe = Pick<PlanRecipe, "id" | "slug" | "name" | "image">;

export type CommandGroup = "Tonight" | "Do" | "Plan" | "Recipes" | "Go to" | "Shopping";

/** Somewhere the router can go: a path and, for the plan's fill, its search. */
export type CommandTarget = { to: string; search?: Record<string, string> };

export type CommandOption =
  | { kind: "open"; group: CommandGroup; label: string; hint?: string; recipe: CommandRecipe }
  | { kind: "plan"; group: "Plan"; label: string; recipe: CommandRecipe; date: string }
  | { kind: "go"; group: CommandGroup; label: string; hint?: string; target: CommandTarget }
  | { kind: "shop"; group: "Shopping"; label: string; text: string };

export type CommandContext = {
  query: string;
  today: string;
  /** What the recipe search last brought back; filtered here by every term. */
  recipes: readonly CommandRecipe[];
  /** The recipes on tonight, for the empty bar. */
  tonight?: readonly CommandRecipe[];
  /** The Monday of next week, and how many of its nights have nothing planned, when the plan was read. */
  nextWeek?: { monday: string; emptyNights: number } | null;
};

const PLAN_HITS = 4;
const RECIPE_HITS = 6;

const goTo = navItems.map((item) => ({ label: item.label, target: { to: item.to } }));

/**
 * The options for what was typed, grouped and in the order shown. Empty: what
 * is on tonight, planning next week, importing, and the places. Otherwise:
 * with a trailing day, the top recipes put on that day; the recipes that
 * match; the places the first word starts; and, without a day, the whole
 * line added to the shopping list, last, so a recipe or a place is what
 * Enter takes first when there is one.
 */
export function buildOptions({ query, today, recipes, tonight = [], nextWeek = null }: CommandContext): CommandOption[] {
  const { words, terms, date } = parseQuery(query, today);
  const options: CommandOption[] = [];
  if (words.length === 0) {
    for (const recipe of tonight) options.push({ kind: "open", group: "Tonight", label: recipe.name, hint: "On tonight", recipe });
    options.push({
      kind: "go",
      group: "Do",
      label: "Plan next week",
      ...(nextWeek && nextWeek.emptyNights > 0 && { hint: nightsHint(nextWeek.emptyNights) }),
      target: { to: "/plan/fill", ...(nextWeek && { search: { week: nextWeek.monday } }) },
    });
    options.push({ kind: "go", group: "Do", label: "Import a recipe", target: { to: "/recipes/new" } });
    for (const place of goTo) options.push({ kind: "go", group: "Go to", ...place });
    return options;
  }
  const hits = matchRecipes(recipes, terms);
  if (date !== null) {
    for (const recipe of hits.slice(0, PLAN_HITS)) {
      options.push({ kind: "plan", group: "Plan", label: `Put ${recipe.name} on ${dayName(date)}`, recipe, date });
    }
  }
  for (const recipe of hits.slice(0, RECIPE_HITS)) options.push({ kind: "open", group: "Recipes", label: recipe.name, recipe });
  const first = words[0] ?? "";
  for (const place of goTo) if (place.label.toLowerCase().startsWith(first)) options.push({ kind: "go", group: "Go to", ...place });
  if (date === null) {
    const text = query.trim();
    options.push({ kind: "shop", group: "Shopping", label: `Add “${text}” to the shopping list`, text });
  }
  return options;
}

function nightsHint(count: number): string {
  return count === 1 ? "1 empty night" : `${count} empty nights`;
}

/** A run of a label, marked when it is one of the words typed. */
export type LabelPart = { text: string; match: boolean };

/**
 * The label split around the words typed, so each can be marked. Words of one
 * letter and a trailing day are left unmarked: they would light up half of
 * every label.
 */
export function highlight(label: string, query: string, today: string): LabelPart[] {
  const terms = parseQuery(query, today).terms.filter((term) => term.length > 1);
  if (terms.length === 0) return [{ text: label, match: false }];
  const pattern = new RegExp(`(${terms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  return label
    .split(pattern)
    .filter((text) => text !== "")
    .map((text) => ({ text, match: terms.includes(text.toLowerCase()) }));
}
