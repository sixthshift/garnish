import { cn } from "@sixthshift/design-system/utils";
import { Link } from "@tanstack/react-router";
import { Fragment } from "react";
import { useHydrated } from "../../../lib/useHydrated";

// Home is the day as it stands (tonight, the week, the list); Recipes is the
// library, reached when choosing rather than every time the app opens.
// "New" is not here: creating a recipe is an action on the recipes page, not a
// place to navigate to, so it lives as a button in that page's header.
// `end` items sit at the far end of a desktop's top bar (Settings is chrome, not
// a sibling of Recipes); a phone's tab bar leaves them out and reaches Settings
// by Home's gear or the sprig's sheet (decisions.md rows 208, 218).
export const navItems = [
  { to: "/", label: "Home", exact: true, end: false },
  { to: "/plan", label: "Plan", exact: false, end: false },
  { to: "/shopping", label: "Shopping", exact: false, end: false },
  { to: "/recipes", label: "Recipes", exact: false, end: false },
  { to: "/settings", label: "Settings", exact: false, end: true },
] as const;

export type NavItem = (typeof navItems)[number];

/** Where the nav is drawn: a desktop's top bar, each place its own width. A phone's tab bar draws its places itself, with `PlaceLink`. */
export type NavPlacement = "top";

// The colours live in the two states, not here: `cn` cannot tell `text-fg-subtle`
// from `text-fg-normal` apart as one property, so a base colour would fight the
// active one on stylesheet order.
const itemClass: Record<NavPlacement, string> = {
  top: "flex items-center rounded-md px-3 py-2 text-sm font-medium",
};
const inactiveClass = "text-fg-subtle hover:bg-bg-subtle-hovered hover:text-fg-normal";
// The current place takes the toggles' selected fill (ToggleGroup's `on` state:
// the neutral tint's pressed step and its text partner), not brand: brand is the
// primary action's alone (design-language rule 5), and every "this one is chosen"
// in the app reads the same way.
const activeClass = "bg-bg-subtle-pressed text-fg-normal";

/**
 * One place's link, a desktop's top bar's or a phone's tab bar's. Until the
 * page is hydrated it is a plain link with no place marked: the shell must
 * read the same for every address, since offline one cached copy answers
 * them all (decisions.md row 169). A router `Link` marks itself
 * `aria-current` (and `data-status="active"`) as it renders, and React would
 * leave a stale one in place.
 */
export function PlaceLink({
  item,
  className,
  activeClassName,
  inactiveClassName,
  children,
}: {
  item: NavItem;
  className?: string;
  activeClassName?: string;
  inactiveClassName?: string;
  children: React.ReactNode;
}) {
  const hydrated = useHydrated();
  return !hydrated ? (
    <a href={item.to} className={cn(className, inactiveClassName)}>
      {children}
    </a>
  ) : (
    <Link
      to={item.to}
      activeOptions={{ exact: item.exact }}
      className={className}
      activeProps={{ className: activeClassName }}
      inactiveProps={{ className: inactiveClassName }}
    >
      {children}
    </Link>
  );
}

/** A desktop's four places and Settings, in the order a phone's tab bar keeps. */
export function Nav({ placement, className, children, ...props }: React.HTMLAttributes<HTMLElement> & { placement: NavPlacement }) {
  // `children` sit between the places and the `end` ones (a desktop's command
  // bar) and take the free width themselves; without them the end is pushed over.
  const firstEnd = navItems.findIndex((item) => item.end);
  return (
    <nav aria-label="Main" className={className} {...props}>
      {navItems.map((item, index) => (
        <Fragment key={item.to}>
          {index === firstEnd && children}
          <PlaceLink
            item={item}
            className={cn(itemClass[placement], placement === "top" && item.end && children == null && "ml-auto")}
            activeClassName={activeClass}
            inactiveClassName={inactiveClass}
          >
            {item.label}
          </PlaceLink>
        </Fragment>
      ))}
    </nav>
  );
}
