import { Button } from "@sixthshift/design-system/button";
import { Card } from "@sixthshift/design-system/card";
import { Muted } from "@sixthshift/design-system/muted";
import { cn } from "@sixthshift/design-system/utils";
import { useEffect, useState } from "react";
import { SimmerPot } from "./SimmerPot";
import type { ImportPhase, ImportPreview, ImportProgress } from "./useRecipeSource";

export type ImportWaitProps = {
  progress: ImportProgress;
  /** Whether a model is there to sort a page into parts: the page's list names that step only then. */
  aiAvailable: boolean;
  /** End the model's sort and go on without it: offered only while it runs. */
  onSkip?: () => void;
};

/** The steps a read goes through, by what it was made from, each with its name in the list and as the headline while it runs. */
function stepsFor(from: ImportProgress["from"], aiAvailable: boolean): { phase: ImportPhase; label: string }[] {
  const first = { page: "Getting the page", text: "Reading your text", file: "Reading the file" }[from];
  return [
    { phase: "get", label: first },
    ...(from === "page" && aiAvailable ? [{ phase: "sort" as const, label: "Sorting it into parts" }] : []),
    { phase: "match", label: "Matching your foods" },
  ];
}

/** Seconds since `startedAt`, once a second. */
function useSeconds(startedAt: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return Math.max(0, Math.floor((now - startedAt) / 1000));
}

/**
 * What an import shows while it runs, in place of its source's form: the pot
 * simmering, where the read has got to, and, once the page is read, the recipe
 * it found, while the model sorts it. The steps are the ones the browser sees
 * land; the server's fetch and read are one, and too quick to tell apart.
 */
export function ImportWait({ progress, aiAvailable, onSkip }: ImportWaitProps) {
  const seconds = useSeconds(progress.startedAt);
  const steps = stepsFor(progress.from, aiAvailable);
  const at = Math.max(
    0,
    steps.findIndex((step) => step.phase === progress.phase)
  );
  // The long wait: the model's sort of a page, or its whole read of a paste.
  const boil = progress.phase === "sort" || (progress.from === "text" && progress.phase === "get" && aiAvailable);

  return (
    <Card size="lg" className="flex flex-col items-center gap-5 text-center mobile:p-4" data-testid="import-wait">
      <SimmerPot boil={boil} className="w-36 desktop:w-44" />
      <div className="flex flex-col items-center gap-1">
        <h2 className="text-lg font-medium" role="status">
          {`${steps[at]!.label}…`}
        </h2>
        <Muted as="p" className="text-sm tabular-nums">
          {boil ? "This can take up to a minute." : " "}
          {seconds >= 3 && <span> {seconds} s</span>}
        </Muted>
      </div>

      {progress.found !== null && <Found found={progress.found} />}

      <ol className="flex w-full max-w-xs flex-col gap-2 text-left text-sm" aria-label="Import progress">
        {steps.map((step, index) => {
          const state = index < at ? "done" : index === at ? "now" : "next";
          return (
            <li key={step.phase} className="flex items-center gap-3" data-state={state}>
              <StepMark state={state} />
              <span className={cn(state === "next" ? "text-fg-subtle" : "text-fg-normal", state === "now" && "font-medium")}>{step.label}</span>
              {state === "done" && <span className="sr-only">(done)</span>}
            </li>
          );
        })}
      </ol>

      {onSkip !== undefined && (
        <Button type="button" variant="ghost" intent="neutral" size="sm" onClick={onSkip}>
          Skip sorting into parts
        </Button>
      )}
    </Card>
  );
}

/** The recipe the read found: its picture, name, site and size. */
function Found({ found }: { found: ImportPreview }) {
  const facts = [
    found.host,
    found.ingredients > 0 && `${found.ingredients} ingredient${found.ingredients === 1 ? "" : "s"}`,
    found.steps > 0 && `${found.steps} step${found.steps === 1 ? "" : "s"}`,
  ].filter(Boolean);
  return (
    <div className="simmer-in flex w-full max-w-sm items-center gap-3 rounded-lg bg-bg-subtle p-2 text-left" data-testid="import-found">
      {found.image !== null && <img src={found.image} alt="" className="size-14 shrink-0 rounded-md object-cover" />}
      <div className="flex min-w-0 flex-col">
        <span className="truncate font-medium">{found.name || "Untitled recipe"}</span>
        {facts.length > 0 && (
          <Muted as="span" className="truncate text-sm">
            {facts.join(" · ")}
          </Muted>
        )}
      </div>
    </div>
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
