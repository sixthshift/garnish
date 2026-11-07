import { cn } from "@sixthshift/design-system/utils";

const RADIUS = 34;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** How much of the list is ticked, as a ring with the percentage in it: Home's shopping card on a phone and its tile on a desktop. */
export function ProgressRing({ ticked, total, className }: { ticked: number; total: number; className?: string }) {
  const fraction = total === 0 ? 0 : ticked / total;
  return (
    <svg viewBox="0 0 84 84" className={cn("size-21 shrink-0", className)} role="img" aria-label={`${ticked} of ${total} ticked`}>
      <circle cx="42" cy="42" r={RADIUS} fill="none" strokeWidth="9" className="stroke-bg-subtle-pressed" />
      <circle
        cx="42"
        cy="42"
        r={RADIUS}
        fill="none"
        strokeWidth="9"
        strokeLinecap="round"
        strokeDasharray={CIRCUMFERENCE}
        strokeDashoffset={CIRCUMFERENCE * (1 - fraction)}
        transform="rotate(-90 42 42)"
        className={cn("stroke-fg-brand transition-[stroke-dashoffset] duration-300", fraction === 0 && "opacity-0")}
      />
      <text x="42" y="47" textAnchor="middle" className="fill-fg-strong text-[17px] font-semibold">
        {Math.round(fraction * 100)}%
      </text>
    </svg>
  );
}
