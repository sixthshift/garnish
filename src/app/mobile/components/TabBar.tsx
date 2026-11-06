import { cn } from "@sixthshift/design-system/utils";
import { Nav } from "../../components/layout/Nav";

// The tab bar's real height, so `--app-bar` means what it says: its top rule,
// its `p-2`, one `py-2` `text-sm` item (2.25rem) and the bottom padding that
// grows into the home indicator. Change it with the bar's item or padding.
export const APP_BAR_HEIGHT = "[--app-bar:calc(2.75rem_+_1px_+_max(0.5rem,env(safe-area-inset-bottom)))]";

/**
 * A phone's places, under the thumb. `z-app-bar` lifts the bar over page
 * content (a card's heart is positioned too, and would otherwise paint on top
 * of it) and keeps it under sheets, popovers and modals, which take the design
 * system's higher layers.
 */
export function TabBar({ className }: { className?: string }) {
  return (
    <Nav
      placement="bar"
      className={cn(
        "fixed inset-x-0 bottom-0 z-app-bar flex gap-1 border-t border-border-normal bg-bg-normal p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]",
        className
      )}
    />
  );
}
