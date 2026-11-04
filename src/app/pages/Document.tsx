import { toast } from "@sixthshift/design-system/overlay";
import { HeadContent, Scripts } from "@tanstack/react-router";
import { type ReactNode, useEffect } from "react";
import { registerServiceWorker, updateNotice } from "../../lib/sw";
import { installErrorReporting } from "../model/reportError";

// PWA manifest colours are literal hex because a manifest cannot read CSS.
// They mirror the Garnish theme's tokens (src/styles/theme.css):
// light --bg-brand = teal-600 #2c666c light --bg-normal = earth-50 #fefcfb
// dark --bg-brand = teal-400 #4ba5a9 dark --bg-normal = earth-925 #2f2520
// public/manifest.webmanifest carries the light pair. The theme-color metas
// carry both and live here, not in the root route's head(): HeadContent keeps
// one meta per name, which would drop one of the two media-scoped entries.
const themeColorLight = "#2c666c";
const themeColorDark = "#4ba5a9";

/** The HTML document every page is drawn in: the root route's shell component. */
export function Document({ children }: { children: ReactNode }) {
  // Client-only, production-only: public/sw.js exists only in a build, and a
  // worker in dev would serve stale modules over Vite's. A deploy that lands
  // while the app is open offers itself as a notice rather than taking over.
  // An error no boundary catches is sent to the server's diagnostics all the same.
  useEffect(() => installErrorReporting(window), []);
  useEffect(() => {
    registerServiceWorker(typeof navigator === "undefined" ? undefined : navigator, import.meta.env.PROD, {
      onUpdateReady: (waiting) => void toast(updateNotice(waiting)),
    });
  }, []);
  return (
    <html lang="en-AU" suppressHydrationWarning>
      <head>
        <HeadContent />
        <meta name="theme-color" content={themeColorLight} media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content={themeColorDark} media="(prefers-color-scheme: dark)" />
      </head>
      {/* The theme's colours on the body, not only the shell: sheets, dialogs and toasts portal here, outside the shell's box. */}
      <body className="bg-bg-subtle text-fg-normal">
        {children}
        <Scripts />
      </body>
    </html>
  );
}
