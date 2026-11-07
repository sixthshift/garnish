import { cn } from "@sixthshift/design-system/utils";
import { Fragment, type ReactNode, useState } from "react";
import { type NavItem, navItems, PlaceLink } from "../../components/layout/Nav";
import { CommandSheet } from "./command/CommandSheet";

// The tab bar's real height, so `--app-bar` means what it says: its top rule,
// its `pt-1.5`, one item (a 1.75rem icon, a 0.125rem gap and a 1rem label) and
// the bottom padding that grows into the home indicator. The + rises above the
// bar and adds nothing to it. Change it with the bar's items or padding.
export const APP_BAR_HEIGHT = "[--app-bar:calc(3.25rem_+_1px_+_max(0.375rem,env(safe-area-inset-bottom)))]";

/** A phone's places: the four, without the `end` ones (Settings is a gear on Home, decisions.md row 208). */
const places = navItems.filter((item) => !item.end);

/** Where the + sits: in the middle, under the thumb. */
const middle = Math.floor(places.length / 2);

const icon = (path: ReactNode) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className="size-6"
  >
    {path}
  </svg>
);

const icons: Record<NavItem["to"], ReactNode> = {
  "/": icon(<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />),
  "/plan": icon(
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  "/shopping": icon(
    <>
      <path d="M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h9.2a1 1 0 0 0 1-.8L21 8H6.2" />
      <circle cx="9" cy="20" r="1.4" />
      <circle cx="18" cy="20" r="1.4" />
    </>
  ),
  "/recipes": icon(<path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H20v16H5.5A1.5 1.5 0 0 0 4 20.5zM4 20.5A1.5 1.5 0 0 0 5.5 22H20M8 7h8" />),
  "/settings": null,
};

/**
 * A phone's places, under the thumb (decisions.md row 208): Home, Plan, the +
 * that opens the command sheet, Shopping and Recipes. `z-app-bar` lifts the
 * bar over page content (a card's heart is positioned too, and would
 * otherwise paint on top of it) and keeps it under sheets, popovers and
 * modals, which take the design system's higher layers.
 *
 * The current place takes the toggles' selected fill behind its icon, as a
 * desktop's top bar marks its place, not brand: the + is the bar's one
 * primary action and has brand to itself (design-language rule 5). The mark
 * reads the router `Link`'s `data-status`, which the shell before hydration
 * never has, so it marks nothing (row 169). The + does nothing until then.
 */
export function TabBar({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {/* Wider than a phone the bar still spans the screen, but its five places keep together in the middle. */}
      <nav
        aria-label="Main"
        className={cn(
          "fixed inset-x-0 bottom-0 z-app-bar grid grid-cols-5 items-start justify-center border-t border-border-normal sm:grid-cols-[repeat(5,minmax(0,7.5rem))] bg-bg-normal px-2 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))]",
          className
        )}
      >
        {places.map((item, index) => (
          <Fragment key={item.to}>
            {index === middle && (
              <button
                type="button"
                aria-label="Plan, add or find"
                aria-haspopup="dialog"
                onClick={() => setOpen(true)}
                className="-mt-5 grid size-14 place-items-center justify-self-center rounded-[1.2rem] bg-bg-brand text-fg-on-brand shadow-lg outline-offset-2 active:scale-95"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true" className="size-6.5">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </button>
            )}
            <PlaceLink
              item={item}
              className="group flex min-w-0 flex-col items-center gap-0.5 rounded-md text-[0.6875rem] leading-4 font-medium text-fg-subtle data-[status=active]:text-fg-normal"
            >
              <span className="grid h-7 w-12 place-items-center rounded-full group-data-[status=active]:bg-bg-subtle-pressed">{icons[item.to]}</span>
              {item.label}
            </PlaceLink>
          </Fragment>
        ))}
      </nav>
      {open && <CommandSheet onClose={() => setOpen(false)} />}
    </>
  );
}
