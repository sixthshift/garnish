import type { CSSProperties } from "react";

/** A per-element index for the stagger in styles.css (`--wisp`, `--bubble`, `--flame`). */
const nth = (name: string, index: number) => ({ [`--${name}`]: index }) as CSSProperties;

/**
 * An import's wait, drawn: a pot on the hob, steam curling off it, bubbles
 * breaking on the surface and a sprig of garnish bobbing in it. `boil` is the
 * long wait, the model's sort, and turns the heat up. Motion lives in
 * styles.css (`.simmer-*`), as the loading sprig's does; without motion the
 * pot stands still with its steam and bubbles drawn.
 */
export function SimmerPot({ boil = false, className }: { boil?: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 120 116" className={`simmer-pot ${className ?? ""}`} data-boil={boil ? "hard" : "low"} aria-hidden="true">
      {/* Steam, three wisps rising off the surface in turn. */}
      <g className="fill-none stroke-fg-subtle" strokeWidth="3" strokeLinecap="round">
        <path className="simmer-steam" style={nth("wisp", 0)} d="M44 40c-5-6 5-10 0-17s4-10 0-15" />
        <path className="simmer-steam" style={nth("wisp", 1)} d="M60 38c-5-7 5-11 0-18s4-11 0-16" />
        <path className="simmer-steam" style={nth("wisp", 2)} d="M76 40c-5-6 5-10 0-17s4-10 0-15" />
      </g>

      {/* The pot: handles, body, rim. */}
      <g className="fill-bg-normal stroke-fg-subtle" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round">
        <path className="fill-none" d="M18 60h-7a4 4 0 0 0 0 8h7M102 60h7a4 4 0 0 1 0 8h-7" />
        <path d="M18 52h84v32a16 16 0 0 1-16 16H34a16 16 0 0 1-16-16z" />
      </g>
      {/* The soup's surface, with a sprig in it and bubbles breaking. */}
      <ellipse cx="60" cy="52" rx="40" ry="6" className="fill-bg-subtle-pressed stroke-fg-subtle" strokeWidth="3" />
      <g className="simmer-sprig fill-fg-brand stroke-fg-brand" strokeLinecap="round">
        <path d="M70 52c1-6 3-11 7-15" fill="none" strokeWidth="2" />
        <path d="M73 45c-5-1-8-4-8-8 5 0 8 3 8 8z" strokeWidth="0.5" />
        <path d="M75 41c3-4 7-5 10-4-1 4-5 6-10 4z" strokeWidth="0.5" />
      </g>
      <g className="fill-none stroke-fg-subtle" strokeWidth="2">
        <circle className="simmer-bubble" style={nth("bubble", 0)} cx="42" cy="51" r="3" />
        <circle className="simmer-bubble" style={nth("bubble", 1)} cx="56" cy="53" r="2.5" />
        <circle className="simmer-bubble" style={nth("bubble", 2)} cx="88" cy="51" r="2.5" />
        <circle className="simmer-bubble" style={nth("bubble", 3)} cx="34" cy="53" r="2" />
      </g>

      {/* The hob: a ring and its flames. */}
      <path d="M26 112h68" className="stroke-fg-subtle" strokeWidth="3" strokeLinecap="round" />
      <g className="fill-fg-subtle opacity-60">
        <path className="simmer-flame" style={nth("flame", 0)} d="M42 108c-3-2-3-5 0-8 3 3 3 6 0 8z" />
        <path className="simmer-flame" style={nth("flame", 1)} d="M60 108c-3-2-3-5 0-8 3 3 3 6 0 8z" />
        <path className="simmer-flame" style={nth("flame", 2)} d="M78 108c-3-2-3-5 0-8 3 3 3 6 0 8z" />
      </g>
    </svg>
  );
}
