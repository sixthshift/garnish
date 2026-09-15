// The garnish mark: a sprig of seven leaves staggered up one side of the stem
// then the other, tapering gently towards the tip.
//
// Everything is drawn in a 512×512 box, and the mark itself stays inside a
// centred 300px box — so the same drawing serves the rounded app icon, the
// full-bleed maskable icon (where the platform crops to a circle of 80% width)
// and the favicon, with no second version to keep in step.
//
// The taper is deliberate and was the last thing settled: leaves run 82 down to
// 52, a 37% drop. Enough that the sprig has a growing tip and you can tell which
// way is up; gentle enough that the top leaves are still above the size a 16px
// favicon can draw. Steepen it and the crown disappears before the icon does.
//
// Colour is never hard-coded in the mark. Its shapes take `currentColor`, so
// the app sets it with a text-colour class and the fixed PNG assets pass the
// literal hex below. `bun run icons` regenerates every file in public/icons
// from this component; nothing in there is drawn by hand.
import type { CSSProperties } from "react";

/**
 * The icon's fixed palette, copied from design-system/src/theme/tokens.css: an
 * emerald-100 ground under an emerald-700 sprig. Literal hex, not token vars,
 * because an app icon is a baked asset — it does not follow the light/dark
 * toggle, and the PNGs are generated once and committed.
 */
export const ICON_GROUND = "#d6eef0"; // emerald-100
export const ICON_MARK = "#234e53"; // emerald-700

/** The rounded app icon's corner radius, 20% of 512, as the PWA icons use. */
export const ICON_RADIUS = 102.4;

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
    <g transform={`translate(256,256) scale(${scale}) translate(-253,-259)`}>
      <path d="M262 384 C 250 330 250 278 256 188" fill="none" stroke="currentColor" strokeWidth="18" strokeLinecap="round" />
      <path d={leaf(94, 61)} fill="currentColor" transform="translate(252,381) rotate(-39)" />
      <path d={leaf(90, 58)} fill="currentColor" transform="translate(264,345) rotate(-158)" />
      <path d={leaf(86, 55)} fill="currentColor" transform="translate(244,313) rotate(-30)" />
      <path d={leaf(82, 53)} fill="currentColor" transform="translate(261,279) rotate(-151)" />
      <path d={leaf(77, 50)} fill="currentColor" transform="translate(244,245) rotate(-26)" />
      <path d={leaf(71, 46)} fill="currentColor" transform="translate(263,213) rotate(-149)" />
      <path d={leaf(66, 43)} fill="currentColor" transform="translate(255,200) rotate(-86)" />
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
      aria-label="garnish"
    >
      <Sprig scale={SCALE_FULL} />
    </svg>
  );
}

export type LogoIconProps = LogoMarkProps & {
  /** The square behind the mark. Any CSS colour. */
  ground?: string;
  /** The sprig's colour. Defaults to `currentColor` so CSS can drive it. */
  mark?: string;
  /**
   * Corner radius in the 512 viewBox. Rounded by default; pass 0 for a
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

/** The app-icon treatment: the sprig on a square ground. */
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
      aria-label="garnish"
    >
      <rect width="512" height="512" rx={cornerRadius} fill={ground} />
      <Sprig scale={maskable ? SCALE_SAFE : SCALE_FULL} />
    </svg>
  );
}

/**
 * The horizontal lockup: mark plus the lowercase wordmark in the display face.
 * The app writes its name lowercase everywhere, so the wordmark does too — it
 * is never capitalised, even at the start of a sentence.
 */
export function Logo({ size, className, style }: LogoMarkProps) {
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ""}`} style={style}>
      <LogoMark size={size} />
      {/* The sprig takes currentColor from the caller; the word is always
          fg-strong, so a caller can tint the mark without the name following
          it into a colour that fails contrast. */}
      <span className="font-display font-semibold tracking-tight text-fg-strong" style={{ fontSize: size * 0.82, lineHeight: 1 }}>
        garnish
      </span>
    </span>
  );
}
