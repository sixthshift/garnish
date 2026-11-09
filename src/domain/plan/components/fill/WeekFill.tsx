import type { CSSProperties } from "react";

/** One element's turn in styles.css's cycle (`--i`). */
const turn = (i: number) => ({ "--i": i }) as CSSProperties;

/** A four-pointed sparkle at (x, y), `r` from its centre to a point. */
const sparkle = (x: number, y: number, r: number) =>
  `M${x} ${y - r}Q${x} ${y} ${x + r} ${y}Q${x} ${y} ${x} ${y + r}Q${x} ${y} ${x - r} ${y}Q${x} ${y} ${x} ${y - r}z`;

const DAYS = ["M", "T", "W", "T", "F", "S", "S"] as const;
/** Each day's column: its left edge, 24 wide with 4 between. */
const left = (i: number) => 24 + i * 28;

/**
 * The planner's wait, drawn: a week on a wall calendar filling itself in, a
 * plate dropping onto each day in turn and landing with a sparkle, then
 * lifted away for the next pass, round the week again. The weekend's days are
 * shaded as the plan shades them. Motion is in styles.css (`.week-*`);
 * without motion the week stands full.
 */
export function WeekFill({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 160" className={`overflow-visible ${className ?? ""}`} aria-hidden="true">
      <ellipse cx="120" cy="152" rx="92" ry="6" className="fill-fg-subtle opacity-15" />
      {/* The calendar: its page, its header band, the rings it hangs by. */}
      <rect x="14" y="22" width="212" height="124" rx="12" className="fill-bg-normal stroke-fg-subtle" strokeWidth="3" />
      <path d="M15.5 48V34a10.5 10.5 0 0 1 10.5-10.5h188a10.5 10.5 0 0 1 10.5 10.5v14z" className="fill-bg-subtle-pressed" />
      <path d="M14 48h212" className="stroke-fg-subtle" strokeWidth="3" />
      <path d="M32 36h64" className="stroke-fg-normal" strokeWidth="5" strokeLinecap="round" />
      <path d="M182 36h26" className="stroke-fg-brand" strokeWidth="5" strokeLinecap="round" />
      {[64, 176].map((x) => (
        <rect key={x} x={x - 4} y="12" width="8" height="20" rx="4" className="fill-bg-normal stroke-fg-subtle" strokeWidth="3" />
      ))}

      {DAYS.map((day, i) => (
        <g key={`${day}${left(i)}`}>
          <text x={left(i) + 12} y="64" textAnchor="middle" className="fill-fg-subtle text-[9px] font-medium">
            {day}
          </text>
          <rect
            x={left(i)}
            y="70"
            width="24"
            height="62"
            rx="6"
            className={i >= 5 ? "fill-bg-subtle-pressed stroke-border-normal" : "fill-bg-subtle stroke-border-normal"}
            strokeWidth="1.5"
          />
          {/* The day's dinner: a plate, its food, a leaf on top. */}
          <g className="week-plate" style={turn(i)}>
            <circle cx={left(i) + 12} cy="104" r="9.5" className="fill-bg-normal stroke-fg-subtle" strokeWidth="2" />
            <circle cx={left(i) + 12} cy="104" r="5" className="fill-bg-subtle-pressed" />
            <path
              d={`M${left(i) + 12} 103c-4 0-6-3-6-6 4 0 6 3 6 6z`}
              className="fill-fg-brand"
              transform={`rotate(${(i % 3) * 40 - 20} ${left(i) + 12} 103)`}
            />
          </g>
          <path className="week-done fill-fg-brand" style={turn(i)} d={sparkle(left(i) + 20, 90, 4)} />
        </g>
      ))}

      {/* Sparkles about the calendar. */}
      <g className="fill-fg-brand">
        <path className="pen-sparkle" style={turn(0)} d={sparkle(6, 70, 5)} />
        <path className="pen-sparkle" style={turn(2)} d={sparkle(236, 110, 4)} />
      </g>
      <g className="fill-(--color-amber-400)">
        <path className="pen-sparkle" style={turn(1)} d={sparkle(230, 14, 6)} />
      </g>
    </svg>
  );
}
