import { createRoute, lazyRouteComponent } from "@tanstack/react-router";
import { aiAvailable } from "../../../api/rpc/ai";
import { getCooking } from "../../../api/rpc/cooking";
import { getRecipe } from "../../../api/rpc/recipes";
import { type CookSession, type Suggestion, sessionSuggestions } from "../cooking";
import type { Recipe } from "../recipe";
import { recipe } from "./recipe";

/** What the review reads: the recipe, its cooking session (null when there is none), and the changes it suggests. */
export type ReviewData = { recipe: Recipe; session: CookSession | null; suggestions: Suggestion[]; aiAvailable: boolean };

/**
 * The end of cooking (decisions.md row 214): Made this, and tonight's changes
 * as suggestions to keep in the recipe or leave as tonight's. A task finished
 * with Save, so a phone's tab bar steps aside.
 */
export const recipeReview = createRoute({
  getParentRoute: () => recipe,
  path: "review",
  staticData: { hideNav: true },
  loader: async ({ params }): Promise<ReviewData> => {
    const recipe = await getRecipe({ data: { slug: params.slug } });
    const [session, ai] = await Promise.all([getCooking({ data: { recipeId: recipe.id } }), aiAvailable().catch(() => ({ available: false }))]);
    // Tonight's changes at once; the page asks the model for its suggestions after (suggestCooking), so it is not held up by one.
    return { recipe, session, suggestions: session === null ? [] : sessionSuggestions(session), aiAvailable: ai.available };
  },
  head: ({ loaderData }) => (loaderData === undefined ? {} : { meta: [{ title: `How did it go? · ${loaderData.recipe.name}` }] }),
  component: lazyRouteComponent(() => import("../pages/ReviewPage"), "ReviewPage"),
});
