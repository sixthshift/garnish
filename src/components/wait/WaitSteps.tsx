import { cn } from "@sixthshift/design-system/utils";
import { useEffect, useState } from "react";

// What every wait on a model shares (the import's, the restyle's, the planner's): the
// seconds it has taken, and the steps it goes through, ticked as they land.

/** Seconds since `startedAt`, once a second. */
export function useSeconds(startedAt: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return Math.max(0, Math.floor((now - startedAt) / 1000));
}

/** A wait's steps in order: those before `at` done, `at` running, the rest to come. */
export function WaitSteps({ labels, at, label, className }: { labels: readonly string[]; at: number; label: string; className?: string }) {
  return (
    <ol className={cn("flex flex-col gap-2 text-left text-sm", className)} aria-label={label}>
      {labels.map((text, index) => {
        const state = index < at ? "done" : index === at ? "now" : "next";
        return (
          <li key={text} className="flex items-center gap-3" data-state={state}>
            <StepMark state={state} />
            <span className={cn(state === "next" ? "text-fg-subtle" : "text-fg-normal", state === "now" && "font-medium")}>{text}</span>
            {state === "done" && <span className="sr-only">(done)</span>}
          </li>
        );
      })}
    </ol>
  );
}

/** A step's mark: ticked once done, a pulsing dot while it runs, an empty ring before. */
function StepMark({ state }: { state: "done" | "now" | "next" }) {
  if (state === "done") {
    return (
      <span className="simmer-in flex size-5 shrink-0 items-center justify-center rounded-full bg-bg-subtle-pressed text-fg-normal">
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M5 12l5 5 9-10" />
        </svg>
      </span>
    );
  }
  if (state === "now") {
    return (
      <span className="flex size-5 shrink-0 items-center justify-center">
        <span className="size-2.5 animate-pulse rounded-full bg-fg-brand motion-reduce:animate-none" />
      </span>
    );
  }
  return <span className="size-5 shrink-0 rounded-full border-2 border-border-normal" />;
}
