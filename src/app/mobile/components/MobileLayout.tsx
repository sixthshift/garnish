import { cn } from "@sixthshift/design-system/utils";
import { Outlet } from "@tanstack/react-router";
import { APP_BAR_HEIGHT, TabBar } from "./TabBar";

/**
 * A phone's layout (decisions.md row 206): the page, one thing at a time, and
 * the tab bar under the thumb. A task finished with Save or Cancel hides the
 * bar (`hideNav`, row 143). `--app-bar` is how much of the screen's foot the
 * bar takes: the page's bottom padding, and where a sticky save bar stops.
 * The tab bar's + rises 1.25rem above it (row 208): `--app-bar-rise`, so the
 * page pads that much more and what floats above the bar (the trolley, Start
 * cooking, the search, the fill pill) clears the sprig too.
 */
export function MobileLayout({ hideNav }: { hideNav: boolean }) {
  return (
    <div className={cn("flex min-h-dvh flex-col bg-bg-subtle text-fg-normal", hideNav ? "[--app-bar:0px]" : cn(APP_BAR_HEIGHT, "[--app-bar-rise:1.25rem]"))}>
      {/* `min-w-0`: as a flex child its minimum width is otherwise its content's, so one wide child (a
          scrolling tab strip, a table) widens the page instead of scrolling or wrapping (design-language rule 6). */}
      {/* The sprig rises 1.25rem above the bar (`-mt-5`), so the page's foot clears it too. */}
      <main className={cn("min-w-0 flex-1", hideNav ? "pb-(--app-bar)" : "pb-[calc(var(--app-bar)+var(--app-bar-rise))]")}>
        <Outlet />
      </main>
      {!hideNav && <TabBar />}
    </div>
  );
}
