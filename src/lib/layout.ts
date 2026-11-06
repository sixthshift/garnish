// The two experiences (decisions.md row 206): a phone's and a desktop's, each
// designed on its own and still flowing with the width inside itself (`sm:`,
// `xl:`, `2xl:`). Expecting's line and its rules, carried over.

/**
 * Which of the two this screen gets: `mobile` (the tab bar under the thumb, one
 * thing at a time) or `desktop` (the top bar, things side by side).
 */
export type Layout = "mobile" | "desktop";

/** Where a phone's layout ends and a desktop's begins: 64rem, what was Tailwind's `lg`. An iPad held upright is a phone's. */
export const DESKTOP_MEDIA = "(min-width: 64rem)";

/** The layout right now, outside React: for code that asks once rather than follows it. A phone's with no screen to ask. */
export function layoutNow(): Layout {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return "mobile";
  return window.matchMedia(DESKTOP_MEDIA).matches ? "desktop" : "mobile";
}

/**
 * Puts the layout on `<html data-layout>` before the first paint and keeps it
 * there as the window is resized, so the `mobile:` and `desktop:` variants
 * (src/styles.css) follow the same line `useLayout()` does.
 */
export const LAYOUT_BOOT_SCRIPT = `try{var l=matchMedia(${JSON.stringify(DESKTOP_MEDIA)}),s=function(){document.documentElement.dataset.layout=l.matches?"desktop":"mobile"};s();l.addEventListener("change",s)}catch(e){}`;
