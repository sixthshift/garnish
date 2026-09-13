// "Made this" entries for the timeline demo. Data only — `seed.ts` applies them.
import type { TimelineEventInput } from "../../domain/recipe";

/**
 * "Made this" entries for the timeline demo, keyed by recipe name. Applied
 * only to a recipe this run creates for the first time (see seedSample), so
 * a re-seed never adds a duplicate and a same-named recipe of the user's own
 * is never touched.
 */
export const SAMPLE_TIMELINE: Readonly<Record<string, readonly TimelineEventInput[]>> = {
  "Lemon Tart": [
    { occurredOn: "2026-08-16", message: "Made for Dad's birthday. Chilled overnight and it sliced cleanly.", image: null, servings: 8 },
    { occurredOn: "2026-09-06", message: "Quick weeknight version with bottled lemon juice, still good.", image: null, servings: null },
  ],
};
