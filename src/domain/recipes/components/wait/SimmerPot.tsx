import { type CSSProperties, useId } from "react";

/** Custom properties for one element's beat in styles.css (`--i` for its stagger, and whatever else its motion reads). */
const beat = (vars: Record<string, number>) => Object.fromEntries(Object.entries(vars).map(([key, value]) => [`--${key}`, value])) as CSSProperties;

/** A four-pointed sparkle at (x, y), `r` from its centre to a point. */
const sparkle = (x: number, y: number, r: number) =>
  `M${x} ${y - r}Q${x} ${y} ${x + r} ${y}Q${x} ${y} ${x} ${y + r}Q${x} ${y} ${x - r} ${y}Q${x} ${y} ${x} ${y - r}z`;

/**
 * An import's wait, drawn: a pot on a lit hob, steam swirling off it, bubbles
 * breaking on the surface, a sprig bobbing in it, ingredients tossed out of it
 * and back, sparkles about it. `boil` is the long wait, the model's sort: the
 * heat turned up, everything quicker, the pot jiggling on the ring. Motion is
 * in styles.css (`.simmer-*`), as the loading sprig's is; without motion the
 * pot stands still, steam and all. Amber is the flame's alone
 * (design-language.md, rule 5).
 */
export function SimmerPot({ boil = false, className }: { boil?: boolean; className?: string }) {
  // Ids for the gradients and the blur: two pots on one page must not share them.
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 160 156" className={`simmer-pot overflow-visible ${className ?? ""}`} data-boil={boil ? "hard" : "low"} aria-hidden="true">
      <defs>
        <radialGradient id={`${id}-glow`}>
          <stop offset="0%" className="[stop-color:var(--color-amber-400)]" stopOpacity="0.8" />
          <stop offset="100%" className="[stop-color:var(--color-amber-400)]" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-flame`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" className="[stop-color:var(--color-amber-500)]" />
          <stop offset="100%" className="[stop-color:var(--color-amber-200)]" />
        </linearGradient>
        <filter id={`${id}-soft`} x="-50%" y="-20%" width="200%" height="140%">
          <feGaussianBlur stdDeviation="0.8" />
        </filter>
      </defs>

      {/* The hob's glow, breathing with the flame. */}
      <ellipse className="simmer-glow" cx="80" cy="140" rx="58" ry="16" fill={`url(#${id}-glow)`} />

      {/* Sparkles about the pot, each on its own twinkle. */}
      <g className="fill-fg-brand">
        <path className="simmer-sparkle" style={beat({ i: 0 })} d={sparkle(18, 46, 5)} />
        <path className="simmer-sparkle" style={beat({ i: 1 })} d={sparkle(144, 34, 6)} />
        <path className="simmer-sparkle" style={beat({ i: 2 })} d={sparkle(138, 84, 4)} />
        <path className="simmer-sparkle" style={beat({ i: 3 })} d={sparkle(24, 92, 3.5)} />
      </g>
      <g className="fill-(--color-amber-400)">
        <path className="simmer-sparkle" style={beat({ i: 4 })} d={sparkle(40, 18, 3.5)} />
        <path className="simmer-sparkle" style={beat({ i: 5 })} d={sparkle(118, 12, 4)} />
      </g>

      {/* Steam: soft wisps rising, swaying and thinning, in turn. */}
      <g className="fill-none stroke-fg-subtle" strokeWidth="3.5" strokeLinecap="round" filter={`url(#${id}-soft)`}>
        <path className="simmer-steam" style={beat({ i: 0, sway: 1 })} d="M56 50c-6-7 6-12 0-20s5-12 0-18" />
        <path className="simmer-steam" style={beat({ i: 1, sway: -1 })} d="M72 46c-6-8 6-13 0-21s5-12 0-19" />
        <path className="simmer-steam" style={beat({ i: 2, sway: 1 })} d="M88 46c-6-8 6-13 0-21s5-12 0-19" />
        <path className="simmer-steam" style={beat({ i: 3, sway: -1 })} d="M104 50c-6-7 6-12 0-20s5-12 0-18" />
      </g>

      {/* What is in the pot, tossed up and back in: a leaf, a carrot's coin, an onion's ring. */}
      <g className="simmer-toss fill-fg-brand" style={beat({ i: 0, dx: -14, spin: -1 })}>
        <path d="M66 62c-7-1-10-5-10-10 6 0 10 4 10 10z" />
      </g>
      <g className="simmer-toss" style={beat({ i: 1, dx: 12, spin: 1 })}>
        <circle cx="90" cy="60" r="5" className="fill-(--color-amber-500)" />
        <circle cx="90" cy="60" r="2" className="fill-(--color-amber-200)" />
      </g>
      <g className="simmer-toss" style={beat({ i: 2, dx: -6, spin: 1 })}>
        <circle cx="78" cy="60" r="4.5" className="fill-none stroke-fg-subtle" strokeWidth="2" />
      </g>

      {/* The pot: handles, body, its shine, the soup's surface and rim. */}
      <g className="simmer-body">
        <g className="fill-bg-normal stroke-fg-subtle" strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round">
          <path className="fill-none" d="M28 76h-9a5 5 0 0 0 0 10h9M132 76h9a5 5 0 0 1 0 10h-9" />
          <path d="M28 66h104v38a20 20 0 0 1-20 20H48a20 20 0 0 1-20-20z" />
        </g>
        <path d="M40 78v22a12 12 0 0 0 7 11" className="fill-none stroke-bg-subtle" strokeWidth="3" opacity="0.9" strokeLinecap="round" />
        <ellipse cx="80" cy="66" rx="52" ry="8" className="fill-bg-subtle-pressed stroke-fg-subtle" strokeWidth="3.5" />
        <g className="simmer-sprig fill-fg-brand stroke-fg-brand" strokeLinecap="round">
          <path d="M92 66c1-7 4-13 9-18" fill="none" strokeWidth="2.5" />
          <path d="M96 58c-6-1-10-5-10-10 6 0 10 4 10 10z" strokeWidth="0.5" />
          <path d="M99 53c3-5 8-6 12-5-1 5-6 7-12 5z" strokeWidth="0.5" />
        </g>
        <g className="fill-none stroke-fg-subtle" strokeWidth="2">
          <circle className="simmer-bubble" style={beat({ i: 0 })} cx="46" cy="65" r="3.5" />
          <circle className="simmer-bubble" style={beat({ i: 1 })} cx="62" cy="68" r="2.5" />
          <circle className="simmer-bubble" style={beat({ i: 2 })} cx="76" cy="64" r="3" />
          <circle className="simmer-bubble" style={beat({ i: 3 })} cx="112" cy="66" r="3" />
          <circle className="simmer-bubble" style={beat({ i: 4 })} cx="122" cy="67" r="2" />
          <circle className="simmer-bubble" style={beat({ i: 5 })} cx="38" cy="68" r="2" />
        </g>
      </g>

      {/* The hob: a ring and its flames, two-tone, each flickering on its own. */}
      <path d="M34 146h92" className="stroke-fg-subtle" strokeWidth="3.5" strokeLinecap="round" />
      <g fill={`url(#${id}-flame)`}>
        {[44, 62, 80, 98, 116].map((x, i) => (
          <path key={x} className="simmer-flame" style={beat({ i })} d={`M${x} 141c-5-3-6-8-1-15 1 4 3 5 4 3 3 4 3 9-3 12z`} />
        ))}
      </g>
    </svg>
  );
}
