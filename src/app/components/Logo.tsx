import type { CSSProperties } from "react";

/**
 * The icon's fixed palette, copied from src/styles/theme.css: a
 * teal-100 ground under a teal-700 sprig. Literal hex, not token vars,
 * because an app icon is a baked asset — it does not follow the light/dark
 * toggle, and the PNGs are generated once and committed.
 */
export const ICON_GROUND = "#d6eef0"; // teal-100
export const ICON_MARK = "#234e53"; // teal-700

/**
 * The app icon's corner radius: half of 512, so the ground is a circle. The
 * sprig's furthest point at SCALE_FULL is about 231 from the centre, inside
 * the circle's 256 with room to spare.
 */
export const ICON_RADIUS = 256;

/**
 * How large the sprig is drawn inside the 512 box, as a scale on the artwork.
 *
 * Only the maskable icon has to survive Android cropping the square to a circle
 * of 80% width, so only it pays for that margin: SAFE puts the furthest point
 * of the mark at 192 of the 205-unit safe radius. Everything else — the rounded
 * icon, the favicon, the apple-touch icon — is shown whole, so it fills the
 * frame instead. That difference is most of the legibility at 16px, where the
 * safe-zone margin alone costs about a quarter of the drawing's width.
 */
export const SCALE_SAFE = 1.43;
export const SCALE_FULL = 1.72;

/**
 * A leaf: two symmetric circular arcs meeting at a point each end, drawn from
 * the origin along +x. `length` is the tip-to-tip chord; `radius` controls how
 * fat it is — a larger radius is a narrower leaf, because the arcs flatten.
 * Each leaf is placed and angled with a transform, so all seven are one shape
 * at one scale.
 */
function leaf(length: number, radius: number): string {
  return `M0 0 A ${radius} ${radius} 0 0 1 ${length} 0 A ${radius} ${radius} 0 0 1 0 0 Z`;
}

/** The stem, from its foot to its tip. */
const STEM = "M262 384 C 250 330 250 278 256 188";

/** Each leaf's length, radius, base and angle, from the stem's foot to its tip. */
const LEAVES: readonly [number, number, number, number, number][] = [
  [94, 61, 252, 381, -39],
  [90, 58, 264, 345, -158],
  [86, 55, 244, 313, -30],
  [82, 53, 261, 279, -151],
  [77, 50, 244, 245, -26],
  [71, 46, 263, 213, -149],
  [66, 43, 255, 200, -86],
];

/** Scales the artwork about its centre to fill the 512 box. */
function sprigTransform(scale: number): string {
  return `translate(256,256) scale(${scale}) translate(-253,-259)`;
}

/**
 * The sprig. Every leaf base sits on the stem's own curve — the positions are
 * sampled from the cubic, and each leaf is turned to that point's tangent ±55°,
 * so nothing floats free of the stroke. The group is then scaled about the
 * artwork's centre to fill the icon: 1.373 puts the furthest point at 190 of
 * the 205-unit maskable safe radius, which is as large as it can go and still
 * survive Android's circular crop.
 */
function Sprig({ scale }: { scale: number }) {
  return (
    <g transform={sprigTransform(scale)}>
      <path d={STEM} fill="none" stroke="currentColor" strokeWidth="18" strokeLinecap="round" />
      {LEAVES.map(([length, radius, x, y, angle]) => (
        <path key={`${x},${y}`} d={leaf(length, radius)} fill="currentColor" transform={`translate(${x},${y}) rotate(${angle})`} />
      ))}
    </g>
  );
}

export type LogoMarkProps = {
  /** Rendered width and height in px. The mark is square. */
  size: number;
  className?: string;
  style?: CSSProperties;
};

/** The bare sprig, no ground. Takes its colour from `currentColor`. */
export function LogoMark({ size, className, style }: LogoMarkProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      width={size}
      height={size}
      className={className}
      style={style}
      role="img"
      aria-label="Garnish"
    >
      <Sprig scale={SCALE_FULL} />
    </svg>
  );
}

/**
 * The bare sprig growing, then swaying, for the loading screen. The stem is
 * drawn from its foot, `pathLength` making its dash one unit long; each leaf
 * unfurls from its base in turn as the stem passes it, then flutters; and once
 * it is whole the sprig sways from the stem's foot. The motion is all CSS
 * (`.logo-animated`, `.sprig-stem`, `.sprig-leaf` in styles.css), so it plays
 * from the shell the server sends, before the app's JS has loaded, and stands
 * still under reduced motion. A leaf's path is wrapped in a group carrying its
 * placement, since a CSS transform on the path would replace the attribute.
 * Decorative: whatever shows it says what is happening in words.
 */
export function LogoAnimated({ size, className, style }: LogoMarkProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      width={size}
      height={size}
      className={`logo-animated ${className ?? ""}`}
      style={style}
      aria-hidden="true"
    >
      <g transform={sprigTransform(SCALE_FULL)}>
        <path d={STEM} fill="none" stroke="currentColor" strokeWidth="18" strokeLinecap="round" pathLength={1} className="sprig-stem" />
        {LEAVES.map(([length, radius, x, y, angle], index) => (
          <g key={`${x},${y}`} transform={`translate(${x},${y}) rotate(${angle})`}>
            <path d={leaf(length, radius)} fill="currentColor" className="sprig-leaf" style={{ "--leaf": index } as CSSProperties} />
          </g>
        ))}
      </g>
    </svg>
  );
}

export type LogoIconProps = LogoMarkProps & {
  /** The square behind the mark. Any CSS colour. */
  ground?: string;
  /** The sprig's colour. Defaults to `currentColor` so CSS can drive it. */
  mark?: string;
  /**
   * Corner radius in the 512 viewBox. A circle by default; pass 0 for a
   * maskable or apple-touch icon, where the platform applies its own mask and
   * a radius here would show as a double-rounded edge.
   */
  cornerRadius?: number;
  /**
   * True only for the maskable asset, which shrinks the mark into the 80% safe
   * circle. Every other icon is shown whole and fills the frame.
   */
  maskable?: boolean;
};

/** The app-icon treatment: the sprig on a round ground. */
export function LogoIcon({ size, ground = ICON_GROUND, mark, cornerRadius = ICON_RADIUS, maskable = false, className, style }: LogoIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      width={size}
      height={size}
      className={className}
      style={mark ? { color: mark, ...style } : style}
      role="img"
      aria-label="Garnish"
    >
      <rect width="512" height="512" rx={cornerRadius} fill={ground} />
      <Sprig scale={maskable ? SCALE_SAFE : SCALE_FULL} />
    </svg>
  );
}

/**
 * The horizontal lockup: mark plus the wordmark in the display face. The app
 * presents its name as Garnish — the capital is the name, not a sentence
 * position. Identifiers keep the lowercase form (decisions.md row 96).
 */
export function Logo({ size, className, style }: LogoMarkProps) {
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ""}`} style={style}>
      <LogoMark size={size} />
      {/* The sprig takes currentColor from the caller; the word is always
          fg-strong, so a caller can tint the mark without the name following
          it into a colour that fails contrast. */}
      <span className="font-display font-semibold tracking-tight text-fg-strong" style={{ fontSize: size * 0.82, lineHeight: 1 }}>
        Garnish
      </span>
    </span>
  );
}
