// Has an element scrolled out of view? The recipe page asks it of the
// ingredients aside (M24.6): once the lists are off the top of a phone screen,
// the fixed "Ingredients" button appears to bring them back in a sheet.
//
// Same shape as useOnline / useWakeLock: the decision is a pure function over
// what the observer hands back, and the hook is the thin wrapper that feeds it.
// Where `IntersectionObserver` does not exist — the server, and the test
// environment — the element counts as scrolled off, so the button and its
// sheet are still reachable rather than silently absent.
import { type RefObject, useEffect, useState } from "react";

/** The slice of `IntersectionObserverEntry` the decision uses. */
export type IntersectionLike = { isIntersecting: boolean };

/**
 * Whether the observed element is off screen: true when nothing reported is
 * intersecting. No entries at all (an observer that has not fired, an absent
 * observer) counts as off screen too. Pure.
 */
export function isScrolledOff(entries: ReadonlyArray<IntersectionLike>): boolean {
  return entries.every((entry) => !entry.isIntersecting);
}

/**
 * True once `ref`'s element is out of view. Starts true where
 * `IntersectionObserver` is missing and false where it is not, so a browser
 * does not flash the button before the first callback.
 */
export function useScrolledOff(ref: RefObject<Element | null>): boolean {
  const [off, setOff] = useState(() => typeof IntersectionObserver === "undefined");

  useEffect(() => {
    const target = ref.current;
    if (target === null || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => setOff(isScrolledOff(entries)));
    observer.observe(target);
    return () => observer.disconnect();
  }, [ref]);

  return off;
}
