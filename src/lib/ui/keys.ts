// Page-wide keys (a desktop's side panel's Esc, the library's flipping, the command bar's "/"): when
// a key pressed anywhere on the page is the page's, and when it belongs to
// whatever has focus. Pure over the DOM.

/** Whether a key press belongs to something else: a field being typed in, or a dialog over the page. */
export function busyElsewhere(target: EventTarget | null): boolean {
  if (document.querySelector('[role="dialog"]') !== null) return true;
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

/** Controls that already do something with Enter: a link follows, a button presses. */
const TAKES_ENTER =
  'a[href], button, summary, [role="button"], [role="checkbox"], [role="switch"], [role="radio"], [role="menuitem"], [role="option"], [role="tab"]';

/** Whether the focused element would act on Enter itself, so the page should not. */
export function focusTakesEnter(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(TAKES_ENTER) !== null;
}
