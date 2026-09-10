import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
import { createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { AppShell } from "../components/AppShell";
import appCss from "../styles.css?url";

// Paint the theme attribute before first render so the shell does not flash
// light in a dark OS. Mirrors bootstrapTheme's storage key and resolution.
const themeScript = `try{var t=JSON.parse(localStorage.getItem("theme")||'"system"');document.documentElement.dataset.theme=t==="light"||t==="dark"?t:(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light")}catch(e){}`;

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "garnish" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
    scripts: [{ children: themeScript }],
  }),
  shellComponent: RootDocument,
  component: AppShell,
});

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en-AU">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
