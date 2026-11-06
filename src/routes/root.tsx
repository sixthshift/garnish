import { createRootRoute } from "@tanstack/react-router";
import { PanelSearch } from "../app/model/panel";
import { Document } from "../app/pages/Document";
import { Root } from "../app/pages/Root";
import { LAYOUT_BOOT_SCRIPT } from "../lib/layout";
import appCss from "../styles.css?url";

// Paint the theme attribute before first render so the shell does not flash
// light in a dark OS. Mirrors bootstrapTheme's storage key and resolution.
// It runs from <head>, before the body is parsed and long before hydration,
// so `data-theme` is on <html> when React arrives; the server cannot know
// the household's choice, so <html> says `suppressHydrationWarning` for that
// one attribute (React's flag covers the element's own attributes only, not
// its children). `bootstrapTheme()` in AppShell then only follows changes.
const themeScript = `try{var t=JSON.parse(localStorage.getItem("theme")||'"system"');document.documentElement.dataset.theme=t==="light"||t==="dark"?t:(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light")}catch(e){}`;

// Named `Route`, unlike the routes beside it: Start's route generator owns this
// one file (vite.config.ts), and the code its plugin adds in dev refers to `Route`.
export const Route = createRootRoute({
  // What a desktop's side panel shows, on every page (src/app/model/panel.ts).
  validateSearch: PanelSearch,
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "Garnish" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "Garnish" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", href: "/icons/icon.svg", type: "image/svg+xml" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png", sizes: "180x180" },
    ],
    // The layout beside the theme, for the same reason: `data-layout` is on
    // <html> before the first paint, so the `mobile:` and `desktop:` variants
    // never flash the other (decisions.md row 206).
    scripts: [{ children: themeScript }, { children: LAYOUT_BOOT_SCRIPT }],
  }),
  shellComponent: Document,
  component: Root,
});
