import type { ReactNode } from "react";
import type { StatKey } from "./timeStats";

const ICON_PATHS: Record<StatKey, ReactNode> = {
  // Knife: preparation.
  prep: <path d="M4 20 14.5 9.5M18 3l3 3-6.5 6.5L11 9z" />,
  // Flame: time on the heat.
  cook: <path d="M12 3s5 4 5 8a5 5 0 0 1-10 0c0-1.5.8-2.8 1.5-3.5.3 1.2 1 2 1.8 2C11.7 9.5 12 6 12 3Z" />,
  // Clock: the whole thing, end to end.
  total: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
};

export function StatIcon({ stat }: { stat: StatKey }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      data-icon={stat}
      className="shrink-0 text-fg-subtle"
    >
      {ICON_PATHS[stat]}
    </svg>
  );
}
