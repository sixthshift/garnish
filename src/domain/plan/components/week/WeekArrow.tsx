import { Link } from "@tanstack/react-router";

/** One of the two week arrows: a link, so the browser's back button walks the weeks. 44px, a kitchen's finger. */
export function WeekArrow({ monday, label, glyph }: { monday: string; label: string; glyph: string }) {
  return (
    <Link
      to="/plan"
      search={{ week: monday }}
      aria-label={label}
      title={label}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-border-normal text-fg-normal text-lg hover:bg-bg-subtle-hovered"
    >
      <span aria-hidden="true">{glyph}</span>
    </Link>
  );
}
