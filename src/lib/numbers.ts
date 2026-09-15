/** `value` held within [min, max]. NaN becomes `min` (or 0 when unbounded). Pure. */
export function clamp(value: number, min = Number.NEGATIVE_INFINITY, max = Number.POSITIVE_INFINITY): number {
  if (!Number.isFinite(value)) return Number.isFinite(min) ? min : 0;
  return Math.min(max, Math.max(min, value));
}

/** Decimal places in `step`, so 0.1 + 0.2 does not become 0.30000000000000004. Pure. */
export function stepPrecision(step: number): number {
  const text = String(step);
  const dot = text.indexOf(".");
  return dot === -1 ? 0 : text.length - dot - 1;
}

/** `value` moved one `step` in `direction`, rounded to the step's precision and clamped. Pure. */
export function stepValue(value: number, step: number, direction: -1 | 1, min?: number, max?: number): number {
  const next = Number((value + direction * step).toFixed(stepPrecision(step)));
  return clamp(next, min, max);
}

/** Typed text as a number, or null when it is not a complete decimal ("", "-", "1."). Pure. */
export function parseDecimal(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === "" || !/^-?\d+(\.\d+)?$/.test(trimmed)) return null;
  return Number(trimmed);
}
