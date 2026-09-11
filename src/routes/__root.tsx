import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
import { ErrorBoundary } from "@sixthshift/design-system/error-boundary";
import { createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { type ReactNode, useEffect } from "react";
import { AppShell } from "../components/AppShell";
import { GlobalSearch } from "../components/GlobalSearch";
import { AppErrorFallback } from "../components/RouteStates";
import { Toaster } from "../components/Toaster";
import { registerServiceWorker } from "../lib/sw";
import appCss from "../styles.css?url";

// PWA manifest colours are literal hex because a manifest cannot read CSS.
// They mirror the design system's tokens (node_modules/@sixthshift/design-system/src/theme/tokens.css):
//   light --bg-brand  = ocean-600 #355a8c   light --bg-normal = white   #ffffff
//   dark  --bg-brand  = ocean-500 #4573ae   dark  --bg-normal = slate-900 #0f172a
// public/manifest.webmanifest carries the light pair. The theme-color metas
// carry both and live in RootDocument, not head(): HeadContent keeps one meta
// per name, which would drop one of the two media-scoped entries.
const themeColorLight = "#355a8c";
const themeColorDark = "#4573ae";

// Paint the theme attribute before first render so the shell does not flash
// light in a dark OS. Mirrors bootstrapTheme's storage key and resolution.
const themeScript = `try{var t=JSON.parse(localStorage.getItem("theme")||'"system"');document.documentElement.dataset.theme=t==="light"||t==="dark"?t:(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light")}catch(e){}`;

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "garnish" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "garnish" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", href: "/icons/icon.svg", type: "image/svg+xml" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png", sizes: "180x180" },
    ],
    scripts: [{ children: themeScript }],
  }),
  shellComponent: RootDocument,
  component: RootComponent,
});

// Last line of defence: a render error that escapes every route boundary
// (the shell itself, or a route without an errorComponent) shows a message and
// a Retry instead of a blank page. Route loader errors never get this far;
// the router's defaultErrorComponent renders those inside the shell.
function RootComponent() {
  return (
    <>
      <ErrorBoundary fallback={(props) => <AppErrorFallback {...props} />}>
        <AppShell />
      </ErrorBoundary>
      {/* Outside the boundary: a render error in the shell should not take the notice with it. */}
      <Toaster />
      <GlobalSearch />
    </>
  );
}

function RootDocument({ children }: { children: ReactNode }) {
  // Client-only, production-only: public/sw.js exists only in a build, and a
  // worker in dev would serve stale modules over Vite's.
  useEffect(() => {
    registerServiceWorker(typeof navigator === "undefined" ? undefined : navigator, import.meta.env.PROD);
  }, []);
  return (
    <html lang="en-AU">
      <head>
        <HeadContent />
        <meta name="theme-color" content={themeColorLight} media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content={themeColorDark} media="(prefers-color-scheme: dark)" />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
