import type { CSSProperties } from "react";

/** Custom properties for one element's beat in styles.css. */
const beat = (vars: Record<string, number>) => Object.fromEntries(Object.entries(vars).map(([key, value]) => [`--${key}`, value])) as CSSProperties;

/** A four-pointed sparkle at (x, y), `r` from its centre to a point. */
const sparkle = (x: number, y: number, r: number) =>
  `M${x} ${y - r}Q${x} ${y} ${x + r} ${y}Q${x} ${y} ${x} ${y + r}Q${x} ${y} ${x - r} ${y}Q${x} ${y} ${x} ${y - r}z`;

/**
 * The card's lines: where each sits and where it ends, all from x 38. The
 * pen's path in styles.css (`pen-travel`) is written from these, so they move
 * together.
 */
const LINES: readonly { y: number; end: number }[] = [
  { y: 62, end: 162 },
  { y: 80, end: 136 },
  { y: 98, end: 168 },
  { y: 116, end: 150 },
  { y: 134, end: 114 },
];

/**
 * A restyle's wait, drawn: a recipe card rewritten a line at a time. Each line
 * in its turn is rubbed out and written in again by a pen gliding along it,
 * the author's faint words showing beneath, and a sparkle as it is finished;
 * then the next, round the card and back to the first. Motion is in styles.css
 * (`.pen-*`); without motion the card stands written, the pen at rest.
 */
export function PenCard({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 172" className={`pen-card overflow-visible ${className ?? ""}`} aria-hidden="true">
      {/* The card, a little askew, on its shadow. */}
      <ellipse cx="100" cy="164" rx="70" ry="6" className="fill-fg-subtle opacity-15" />
      <g transform="rotate(-3 100 90)">
        <rect x="22" y="18" width="156" height="136" rx="10" className="fill-bg-normal stroke-fg-subtle" strokeWidth="3" />
        {/* Its title: a sprig and a heading's bar. */}
        <path d="M40 44c1-6 3-10 7-13" className="fill-none stroke-fg-brand" strokeWidth="2" strokeLinecap="round" />
        <path d="M43 37c-4 0-7-3-7-7 4 0 7 3 7 7zM45 33c2-4 6-5 9-4-1 4-5 5-9 4z" className="fill-fg-brand" />
        <path d="M60 38h70" className="stroke-fg-normal" strokeWidth="5" strokeLinecap="round" />

        {/* The author's words beneath, faint; the house style's written over them in turn. */}
        <g className="fill-none stroke-border-normal" strokeWidth="3" strokeLinecap="round" strokeDasharray="6 5">
          {LINES.map((line) => (
            <path key={line.y} d={`M38 ${line.y}H${line.end}`} />
          ))}
        </g>
        <g className="fill-none stroke-fg-subtle" strokeWidth="3" strokeLinecap="round">
          {LINES.map((line, i) => (
            <path key={line.y} className="pen-line" style={beat({ i })} pathLength={1} d={`M38 ${line.y}H${line.end}`} />
          ))}
        </g>
        <g className="fill-fg-brand">
          {LINES.map((line, i) => (
            <path key={line.y} className="pen-done" style={beat({ i })} d={sparkle(line.end + 10, line.y - 4, 5)} />
          ))}
        </g>

        {/* The pen: its nib at its origin, carried along the lines and scribbling as it goes. */}
        <g className="pen-travel">
          <g className="pen-scribble">
            <path d="M0 0l3-9 22-24 6 6-24 22z" className="fill-bg-subtle-pressed stroke-fg-normal" strokeWidth="2" strokeLinejoin="round" />
            <path d="M0 0l3-9 6 6z" className="fill-fg-normal" />
            <path d="M21-29l6 6" className="stroke-fg-brand" strokeWidth="4" />
          </g>
        </g>
      </g>

      {/* Sparkles about the card. */}
      <g className="fill-fg-brand">
        <path className="pen-sparkle" style={beat({ i: 0 })} d={sparkle(12, 40, 5)} />
        <path className="pen-sparkle" style={beat({ i: 2 })} d={sparkle(190, 120, 4)} />
      </g>
      <g className="fill-(--color-amber-400)">
        <path className="pen-sparkle" style={beat({ i: 1 })} d={sparkle(186, 22, 6)} />
        <path className="pen-sparkle" style={beat({ i: 3 })} d={sparkle(10, 140, 3.5)} />
      </g>
    </svg>
  );
}
