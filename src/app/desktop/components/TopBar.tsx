import { cn } from "@sixthshift/design-system/utils";
import { Link } from "@tanstack/react-router";
import { Logo } from "../../components/Logo";
import { Nav } from "../../components/layout/Nav";

/**
 * A desktop's top bar (decisions.md row 206): the logo, the four places, and
 * Settings at the far end, the same on every page. A bar rather than a
 * sidebar: five places sit in a row, and the width a sidebar takes from every
 * page is what side-by-side pages want. Its height is `--top-bar`
 * (src/styles.css), so what sticks while a page scrolls sticks under it.
 */
export function TopBar({ className }: { className?: string }) {
  return (
    <header
      data-print="hide"
      className={cn("sticky top-0 z-app-bar flex h-(--top-bar) shrink-0 items-center gap-6 border-b border-border-normal bg-bg-normal px-6", className)}
    >
      <Link to="/" className="text-fg-brand">
        <Logo size={22} />
      </Link>
      <Nav placement="top" className="flex flex-1 items-center gap-1" />
    </header>
  );
}
