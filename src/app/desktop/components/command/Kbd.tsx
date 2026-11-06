import type { ReactNode } from "react";

/** A key, drawn as a keycap. The design system has none; the command bar is the one place keys are named. */
export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-block rounded-[0.3rem] border border-b-2 border-border-normal bg-bg-normal px-1.5 font-sans text-[0.6875rem] leading-4 font-medium text-fg-subtle">
      {children}
    </kbd>
  );
}

/** A magnifying glass, the search pill's and the palette box's. */
export function SearchIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" />
      <path d="m11 11 3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
