import { type Course, type Facets, isBuildingBlock } from "../../recipes/recipe";
import type { Meal } from "./schema";

// Which recipes a slot of the plan may be filled from, by what the household
// said a recipe is (decisions.md row 209). A dinner is a meal on its own, so
// it comes from a main, a soup or a salad, or from a recipe whose course
// nobody has said yet, so an unmarked library still plans; never from a sauce
// or a stock on its own, nor from a side, a starter, a dessert, a drink, a
// snack or baking. A breakfast or a lunch prefers a recipe said to suit it.
// The weeknight and weekend rules (rows 191, 219) apply after this, to what is left.

/** The courses a dinner can be on its own. */
export const DINNER_COURSES: readonly Course[] = ["main", "soup", "salad"];

/** What the rule reads of a recipe: its course and the meals it suits. */
type Faceted = { facets: Pick<Facets, "course" | "meal"> };

/**
 * Whether `recipe` suits a `meal` slot on its own. A dinner: no course said,
 * or a main, a soup or a salad among its courses. A breakfast or a lunch: its
 * meals include that one, and it is not only a building block. Pure.
 */
export function suitsSlot(recipe: Faceted, meal: Meal): boolean {
  const { course, meal: meals } = recipe.facets;
  if (meal === "dinner") return course.length === 0 || course.some((value) => DINNER_COURSES.includes(value));
  return meals.includes(meal) && !isBuildingBlock(recipe.facets);
}

/**
 * The recipes a `meal` slot is filled from, in the order given. A dinner takes
 * those that suit it. A breakfast or a lunch takes those said to suit it, and
 * when none are, every recipe that is not only a building block, as before
 * any recipe said what meal it suits. Pure.
 */
export function slotPool<T extends Faceted>(recipes: readonly T[], meal: Meal): T[] {
  const suited = recipes.filter((recipe) => suitsSlot(recipe, meal));
  if (meal === "dinner" || suited.length > 0) return suited;
  return recipes.filter((recipe) => !isBuildingBlock(recipe.facets));
}
