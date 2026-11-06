import { createContext, useContext, useSyncExternalStore } from "react";
import { DESKTOP_MEDIA, type Layout, layoutNow } from "./layout";

function follow(onChange: () => void): () => void {
  if (typeof window.matchMedia !== "function") return () => {};
  const media = window.matchMedia(DESKTOP_MEDIA);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

/**
 * A layout fixed for what is drawn inside it, whatever the screen: a test
 * rendering a desktop's markup with no window to resize (`renderToString`).
 */
export const LayoutContext = createContext<Layout | null>(null);

/**
 * The layout this screen gets (`mobile` or `desktop`, decisions.md row 206),
 * followed as the window is resized across the line, so a part that is
 * different in each draws the one that fits: `layout === "desktop" ? <X /> :
 * <Y />`, never both with one hidden. A small change of the same structure (a
 * gap, a size) is the `desktop:` or `mobile:` variant instead, which follows
 * the same line from `<html data-layout>`. The server only draws the shell
 * (SPA mode, row 169), so its answer, a phone's, is never what is shown once
 * the page is the browser's.
 */
export function useLayout(): Layout {
  const fixed = useContext(LayoutContext);
  const followed = useSyncExternalStore(follow, layoutNow, () => "mobile" as const);
  return fixed ?? followed;
}
