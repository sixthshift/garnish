import { cn } from "@sixthshift/design-system/utils";
import { Link } from "@tanstack/react-router";
import { Fragment } from "react";
import { useHydrated } from "../../../lib/useHydrated";

// Home is the day as it stands (tonight, the week, the list); Recipes is the
// library, reached when choosing rather than every time the app opens.
// "New" is not here: creating a recipe is an action on the recipes page, not a
// place to navigate to, so it lives as a button in that page's header.
// `end` items sit at the far end of a desktop's top bar (Settings is chrome, not
// a sibling of Recipes); the phone's bar is one row, so it ignores the flag.
export const navItems = [
  { to: "/", label: "Home", exact: true, end: false },
  { to: "/plan", label: "Plan", exact: false, end: false },
  { to: "/shopping", label: "Shopping", exact: false, end: false },
  { to: "/recipes", label: "Recipes", exact: false, end: false },
  { to: "/settings", label: "Settings", exact: false, end: true },
] as const;

/** Where the nav is drawn: the phone's tab bar, each place an equal share, or a desktop's top bar, each its own width. */
export type NavPlacement = "bar" | "top";

// The colours live in the two states, not here: `cn` cannot tell `text-fg-subtle`
// from `text-fg-normal` apart as one property, so a base colour would fight the
// active one on stylesheet order.
const itemClass: Record<NavPlacement, string> = {
  bar: "flex flex-1 items-center justify-center rounded-md px-3 py-2 text-sm font-medium",
  top: "flex items-center rounded-md px-3 py-2 text-sm font-medium",
};
const inactiveClass = "text-fg-subtle hover:bg-bg-subtle-hovered hover:text-fg-normal";
// The current place takes the toggles' selected fill (ToggleGroup's `on` state:
// the neutral tint's pressed step and its text partner), not brand: brand is the
// primary action's alone (design-language rule 5), and every "this one is chosen"
// in the app reads the same way.
const activeClass = "bg-bg-subtle-pressed text-fg-normal";

/**
 * The four places and Settings, in one order on a phone and a desktop.
 * Until the page is hydrated the items are plain links with no place marked:
 * the shell must read the same for every address, since offline one cached
 * copy answers them all (decisions.md row 169). A router `Link` marks itself
 * `aria-current` as it renders, and React would leave a stale one in place.
 */
export function Nav({ placement, className, children, ...props }: React.HTMLAttributes<HTMLElement> & { placement: NavPlacement }) {
  const hydrated = useHydrated();
  // `children` sit between the places and the `end` ones (a desktop's command
  // bar) and take the free width themselves; without them the end is pushed over.
  const firstEnd = navItems.findIndex((item) => item.end);
  return (
    <nav aria-label="Main" className={className} {...props}>
      {navItems.map((item, index) => {
        const base = cn(itemClass[placement], placement === "top" && item.end && children == null && "ml-auto");
        const link = !hydrated ? (
          <a href={item.to} className={cn(base, inactiveClass)}>
            {item.label}
          </a>
        ) : (
          <Link
            to={item.to}
            activeOptions={{ exact: item.exact }}
            className={base}
            activeProps={{ className: activeClass }}
            inactiveProps={{ className: inactiveClass }}
          >
            {item.label}
          </Link>
        );
        return (
          <Fragment key={item.to}>
            {index === firstEnd && children}
            {link}
          </Fragment>
        );
      })}
    </nav>
  );
}
