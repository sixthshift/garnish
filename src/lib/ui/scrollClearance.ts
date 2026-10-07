/**
 * Keep focus out from under a footer stuck to the screen's foot. A callback
 * ref (`ref={scrollClearance}`; React 19 runs the returned cleanup on
 * unmount), so a component tested by calling it as a function needs no hook:
 * while the element is `position: sticky`, the document's
 * `scroll-padding-bottom` is its height plus its offset (the tab bar's, where
 * one shows) plus a small gap, so Tab and `scrollIntoView` stop above it
 * rather than behind it. Measured, not a constant: the bar wraps when its
 * note or a warning is long. Cleared when the footer goes inline (from `md`)
 * or unmounts.
 */
export function scrollClearance(element: HTMLElement | null): (() => void) | undefined {
  if (element === null || typeof ResizeObserver === "undefined") return undefined;
  const root = document.documentElement;
  const update = () => {
    const style = getComputedStyle(element);
    root.style.scrollPaddingBottom = style.position === "sticky" ? `${element.offsetHeight + (Number.parseFloat(style.bottom) || 0) + GAP}px` : "";
  };
  update();
  const observer = new ResizeObserver(update);
  observer.observe(element);
  window.addEventListener("resize", update);
  return () => {
    observer.disconnect();
    window.removeEventListener("resize", update);
    root.style.scrollPaddingBottom = "";
  };
}

/** Room between the footer's top and whatever focus lands on. */
const GAP = 8;
