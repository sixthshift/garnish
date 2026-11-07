import { cn } from "@sixthshift/design-system/utils";

/**
 * The dark theme's tokens, whatever the theme, for the frame around the card
 * (decisions.md row 208, the mockup's dark warm cook screen), on a phone's
 * deck and a desktop's filmstrip alike: cook mode is one kitchen screen. Re-pointing the
 * semantic tokens on the frame, rather than painting its controls one by one,
 * lets the design system's buttons, badges and timer rows draw themselves dark
 * from the theme's own earth scale. The card, between the header and the
 * footer, sits outside it and keeps the theme's tokens: the page's paper in
 * light, so the step is the one lit thing on the screen.
 */
export const DARK_FRAME = cn(
  "[--bg-normal:var(--color-earth-925)] [--bg-normal-hovered:var(--color-earth-900)] [--bg-normal-pressed:var(--color-earth-800)]",
  "[--bg-subtle:var(--color-earth-950)] [--bg-subtle-hovered:var(--color-earth-900)] [--bg-subtle-pressed:var(--color-earth-800)]",
  "[--fg-strong:var(--color-earth-50)] [--fg-normal:var(--color-earth-100)] [--fg-subtle:var(--color-earth-400)]",
  "[--border-normal:var(--color-earth-800)] [--border-subtle:var(--color-earth-900)]",
  "bg-bg-subtle text-fg-normal"
);
