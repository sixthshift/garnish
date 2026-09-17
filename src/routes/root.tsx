import { ErrorBoundary } from "@sixthshift/design-system/error-boundary";
import { createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { type ReactNode, useEffect } from "react";
import { AppShell } from "../components/shell/AppShell";
import { GlobalSearch } from "../components/shell/GlobalSearch";
import { AppErrorFallback } from "../components/shell/RouteStates";
import { Toaster } from "../components/shell/Toaster";
import { notify } from "../lib/notify";
import { registerServiceWorker, updateNotice } from "../lib/sw";
import appCss from "../styles.css?url";

// PWA manifest colours are literal hex because a manifest cannot read CSS.
// They mirror the Garnish theme's tokens (src/styles/theme.css):
// light --bg-brand = emerald-600 #2c666c light --bg-normal = earth-50 #fefcfb
// dark --bg-brand = emerald-400 #4ba5a9 dark --bg-normal = earth-950 #211916
// public/manifest.webmanifest carries the light pair. The theme-color metas
// carry both and live in RootDocument, not head(): HeadContent keeps one meta
// per name, which would drop one of the two media-scoped entries.
const themeColorLight = "#2c666c";
const themeColorDark = "#4ba5a9";

// Paint the theme attribute before first render so the shell does not flash
// light in a dark OS. Mirrors bootstrapTheme's storage key and resolution.
const themeScript = `try{var t=JSON.parse(localStorage.getItem("theme")||'"system"');document.documentElement.dataset.theme=t==="light"||t==="dark"?t:(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light")}catch(e){}`;

export const Route = createRootRoute({
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
  // worker in dev would serve stale modules over Vite's. A deploy that lands
  // while the app is open offers itself as a notice rather than taking over.
  useEffect(() => {
    registerServiceWorker(typeof navigator === "undefined" ? undefined : navigator, import.meta.env.PROD, {
      onUpdateReady: (waiting) => void notify(updateNotice(waiting)),
    });
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
