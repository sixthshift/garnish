import { z } from "zod";

// A desktop's side panel (decisions.md row 206): what is open in it lives in
// the address, on the root's search, so Back closes it, a link to it opens it,
// and the page beside it does not move. One thing at a time: opening the next
// takes its place.

/** A recipe opened in the panel, with the plan entry's choices and servings when it came from one. */
export const RecipePanelTarget = z.object({
  slug: z.string().min(1),
  choices: z.record(z.string(), z.string()).optional(),
  servings: z.number().positive().finite().optional(),
});

export type RecipePanelTarget = z.infer<typeof RecipePanelTarget>;

/** The root route's search: `panel`, dropped (not an error) when it is not a recipe the panel can open. */
export const PanelSearch = z.object({
  panel: RecipePanelTarget.optional().catch(undefined),
});
