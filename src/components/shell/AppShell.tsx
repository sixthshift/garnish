import { bootstrapTheme } from "@sixthshift/design-system/hooks";
import { cn } from "@sixthshift/design-system/utils";
import { Link, Outlet, useMatches } from "@tanstack/react-router";
import { useEffect } from "react";
import { Logo } from "./Logo";

// Routes opt out of the nav with `staticData: { fullscreen: true }` (cook mode).
// `hideNav` drops only the phone's tab bar, for a task finished with Save or
// Cancel (the editor, Style, the new-recipe stages): the desktop sidebar stays.
// A function decides from the route's search, for a route whose first screen
// is a place and the rest a task (`/recipes/new`'s chooser keeps the bar).
declare module "@tanstack/react-router" {
  interface StaticDataRouteOption {
    fullscreen?: boolean;
    hideNav?: boolean | ((search: Record<string, unknown>) => boolean);
  }
}

// "New" is not here: creating a recipe is an action on the recipes page, not a
// place to navigate to, so it lives as a button in that page's header.
// `footer` items sink to the bottom of the side nav (Settings is chrome, not a
// sibling of Recipes); the phone bar is one row, so it ignores the flag.
export const navItems = [
  { to: "/", label: "Recipes", exact: true, footer: false },
  { to: "/plan", label: "Plan", exact: false, footer: false },
  { to: "/shopping", label: "Shopping", exact: false, footer: false },
  { to: "/settings", label: "Settings", exact: false, footer: true },
] as const;

// The colours live in the two states, not here: `cn` cannot tell `text-fg-subtle`
// from `text-fg-normal` apart as one property, so a base colour would fight the
// active one on stylesheet order.
const itemClass = "flex flex-1 items-center justify-center rounded-md px-3 py-2 text-sm font-medium md:flex-none md:justify-start";
const inactiveClass = "text-fg-subtle hover:bg-bg-subtle-hovered hover:text-fg-normal";
// The current place takes the toggles' selected fill (ToggleGroup's `on` state:
// the neutral tint's pressed step and its text partner), not brand: brand is the
// primary action's alone (design-language rule 5), and every "this one is chosen"
// in the app reads the same way.
const activeClass = "bg-bg-subtle-pressed text-fg-normal";

/** `stacked` is the side nav, where a `footer` item is pushed to the bottom. */
function Nav({ stacked = false, className, ...props }: React.HTMLAttributes<HTMLElement> & { stacked?: boolean }) {
  return (
    <nav aria-label="Main" className={className} {...props}>
      {navItems.map((item) => {
        const base = cn(itemClass, stacked && item.footer && "mt-auto");
        return (
          <Link
            key={item.to}
            to={item.to}
            activeOptions={{ exact: item.exact }}
            className={base}
            activeProps={{ className: activeClass }}
            inactiveProps={{ className: inactiveClass }}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell() {
  useEffect(() => bootstrapTheme(), []);
  const fullscreen = useMatches({ select: (matches) => matches.some((match) => match.staticData.fullscreen === true) });
  const hideNav = useMatches({
    select: (matches) =>
      matches.some(({ staticData: { hideNav }, search }) => hideNav === true || (typeof hideNav === "function" && hideNav(search as Record<string, unknown>))),
  });
  if (fullscreen) {
    return (
      <div className="min-h-dvh bg-bg-subtle text-fg-normal">
        <Outlet />
      </div>
    );
  }
  return (
    // `--app-bar` is how much of the screen's foot the tab bar takes: the page's
    // bottom padding, and where a sticky save bar stops. None from `md`, or
    // where the route hides the bar; then a save bar sits at the very bottom.
    <div className={cn("flex min-h-dvh flex-col bg-bg-subtle text-fg-normal md:flex-row md:[--app-bar:0px]", hideNav ? "[--app-bar:0px]" : "[--app-bar:5rem]")}>
      {/* Sticky and exactly one screen tall: as a plain flex child the aside
          stretches to the content's height, so `mt-auto` would push Settings
          past the fold on a long page. */}
      <aside className="hidden w-56 shrink-0 flex-col gap-1 border-r border-border-normal p-4 md:sticky md:top-0 md:flex md:h-dvh md:overflow-y-auto">
        <Link to="/" className="mb-4 px-3 text-fg-brand">
          <Logo size={22} />
        </Link>
        <Nav stacked className="flex flex-1 flex-col gap-1" />
      </aside>
      {/* `min-w-0`: as a flex child its minimum width is otherwise its content's, so one wide child (a
          scrolling tab strip, a table) widens the page instead of scrolling or wrapping (design-language rule 6). */}
      <main className="min-w-0 flex-1 pb-(--app-bar)">
        <Outlet />
      </main>
      {/* `z-app-bar` lifts the bar over page content (a card's heart is positioned
          too, and would otherwise paint on top of it) and keeps it under sheets,
          popovers and modals, which take the design system's higher layers. */}
      {!hideNav && (
        <Nav className="fixed inset-x-0 bottom-0 z-app-bar flex gap-1 border-t border-border-normal bg-bg-normal p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:hidden" />
      )}
    </div>
  );
}
