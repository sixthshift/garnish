/**
 * A desktop column a screen tall that scrolls on its own: the cooking spread's,
 * the editor's. Relative, so an absolutely placed descendant (an `sr-only`
 * label) is placed and clipped inside it; static, it would be placed against
 * the page and stretch the document past the screen. RecipeSpread's OWN_SCROLL
 * is the same, scrolling only from a width.
 */
export const SCROLL_COLUMN = "relative min-h-0 overflow-y-auto";
