import { cn } from "@sixthshift/design-system/utils";
import { Outlet } from "@tanstack/react-router";
import { APP_BAR_HEIGHT, TabBar } from "./TabBar";

/**
 * A phone's layout (decisions.md row 206): the page, one thing at a time, and
 * the tab bar under the thumb. A task finished with Save or Cancel hides the
 * bar (`hideNav`, row 143). `--app-bar` is how much of the screen's foot the
 * bar takes: the page's bottom padding, and where a sticky save bar stops.
 */
export function MobileLayout({ hideNav }: { hideNav: boolean }) {
  return (
    <div className={cn("flex min-h-dvh flex-col bg-bg-subtle text-fg-normal", hideNav ? "[--app-bar:0px]" : APP_BAR_HEIGHT)}>
      {/* `min-w-0`: as a flex child its minimum width is otherwise its content's, so one wide child (a
          scrolling tab strip, a table) widens the page instead of scrolling or wrapping (design-language rule 6). */}
      {/* The + rises 1.25rem above the bar (`-mt-5`), so the page's foot clears it too. */}
      <main className={cn("min-w-0 flex-1", hideNav ? "pb-(--app-bar)" : "pb-[calc(var(--app-bar)+1.25rem)]")}>
        <Outlet />
      </main>
      {!hideNav && <TabBar />}
    </div>
  );
}
