import { Button } from "@sixthshift/design-system/button";
import { Message } from "@sixthshift/design-system/message";
import { Muted } from "@sixthshift/design-system/muted";
import { cn } from "@sixthshift/design-system/utils";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { adjustCooking, unadjustCooking } from "../../../../api/rpc/cooking";
import { askCooking } from "../../../../api/rpc/cookingAssistant";
import { useMutate } from "../../../../lib/mutate";
import { getTicks } from "../../../../lib/ticks";
import { useTimers } from "../../../../lib/useTimers";
import type { Adjustment, CookSession } from "../../cooking";

/** Quick questions under the box: tap first, type last. */
const PROMPTS = ["What's next?", "How long left?", "What can I swap?", "Note for next time…"];

/** An offer without its id: what `adjustCooking` takes. */
function offerInput(offer: Adjustment) {
  const { id: _id, ...input } = offer;
  return input;
}

export type CookingAssistantProps = {
  recipeId: string;
  session: CookSession | null;
  /** The servings the page shows: the assistant's amounts are at these. */
  servings: number | null;
  nowStepId: string | null;
  /** Taller rows and a box that stays at the foot, for a phone's sheet. */
  compact?: boolean;
};

/**
 * Ask about this recipe while cooking it (decisions.md row 214). Each answer
 * that changes what to do brings its adjustments as rows to tap: Use tonight
 * draws it on the page, nothing written to the recipe; taken, it says so and
 * can be put back. A desktop's third column; a phone's half sheet.
 */
export function CookingAssistant({ recipeId, session, servings, nowStepId, compact = false }: CookingAssistantProps) {
  const mutate = useMutate();
  const { timers } = useTimers(recipeId);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const log = useRef<HTMLDivElement>(null);
  const messages = session?.messages ?? [];
  const taken = new Set((session?.adjustments ?? []).map((adjustment) => adjustment.id));

  // The newest turn in view, as a chat keeps it.
  // biome-ignore lint/correctness/useExhaustiveDependencies: scrolls when a turn arrives or is waited on.
  useEffect(() => {
    const node = log.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages.length, pending]);

  const ask = async (question: string) => {
    const words = question.trim();
    if (words === "" || session === null || busy) return;
    setBusy(true);
    setError(null);
    setPending(words);
    setText("");
    try {
      const ticks = typeof window === "undefined" ? { ingredients: [], steps: [] } : getTicks(window.sessionStorage, recipeId);
      await mutate(() =>
        askCooking({
          data: {
            recipeId,
            message: words,
            context: {
              servings,
              tickedIngredientIds: ticks.ingredients,
              doneStepIds: ticks.steps,
              nowStepId,
              timers: timers.filter((timer) => !timer.done).map((timer) => ({ label: timer.label, remaining: timer.text })),
            },
          },
        })
      );
    } catch (cause) {
      setText(words);
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setPending(null);
      setBusy(false);
    }
  };

  const take = async (offer: Adjustment) => {
    try {
      await mutate(() => adjustCooking({ data: { recipeId, adjustment: offerInput(offer), offerId: offer.id } }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  const putBack = async (offer: Adjustment) => {
    try {
      await mutate(() => unadjustCooking({ data: { recipeId, adjustmentId: offer.id } }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void ask(text);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="cooking-assistant">
      <div ref={log} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4" aria-live="polite">
        {messages.length === 0 && pending === null && (
          <Muted as="p" className="m-auto max-w-[30ch] text-center text-sm" data-testid="assistant-empty">
            “Out of celery?” “Can I do this in the oven?” “Too salty — what now?” Or just say what happened; it is kept for the review.
          </Muted>
        )}
        {messages.map((turn) => (
          <div
            key={turn.id}
            className={cn(
              "max-w-[88%] rounded-2xl px-3 py-2 text-sm leading-relaxed",
              turn.role === "cook" ? "self-end rounded-br-sm bg-bg-brand text-fg-on-brand" : "self-start rounded-bl-sm bg-bg-subtle text-fg-normal"
            )}
            data-testid={turn.role === "cook" ? "cook-turn" : "assistant-turn"}
          >
            <p className="whitespace-pre-line">{turn.text}</p>
            {turn.offers.map((offer) => {
              const on = taken.has(offer.id);
              return (
                <div
                  key={offer.id}
                  className={cn(
                    "mt-2 flex items-center gap-2 rounded-lg border px-2.5 py-1.5",
                    on ? "border-border-warning bg-bg-warning-subtle" : "border-border-normal bg-bg-normal"
                  )}
                  data-testid="assistant-offer"
                  data-taken={on ? "true" : undefined}
                >
                  <span className="min-w-0 flex-1 text-sm text-fg-strong">{offer.summary}</span>
                  {on ? (
                    <Button inline intent="neutral" size="sm" onClick={() => void putBack(offer)} aria-label={`Put back: ${offer.summary}`}>
                      ✓ On the page
                    </Button>
                  ) : (
                    <Button variant="solid" intent="brand" size="sm" onClick={() => void take(offer)} aria-label={`Use tonight: ${offer.summary}`}>
                      Use tonight
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        ))}
        {pending !== null && (
          <>
            <p className="max-w-[88%] self-end rounded-2xl rounded-br-sm bg-bg-brand px-3 py-2 text-sm text-fg-on-brand opacity-70">{pending}</p>
            <Muted as="p" className="self-start text-sm" data-testid="assistant-thinking">
              Thinking…
            </Muted>
          </>
        )}
      </div>
      <form
        className={cn("flex flex-col gap-2 border-t border-border-subtle p-3", compact && "pb-[max(0.75rem,env(safe-area-inset-bottom))]")}
        onSubmit={submit}
      >
        {error !== null && (
          <Message intent="danger" size="sm">
            {error}
          </Message>
        )}
        <div className="flex flex-wrap gap-1.5">
          {PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              disabled={busy || session === null}
              className="rounded-full border border-border-normal bg-bg-subtle px-2.5 py-1 text-xs text-fg-normal hover:bg-bg-subtle-hovered disabled:opacity-50"
              onClick={() => (prompt.endsWith("…") ? setText(prompt.replace("…", ": ")) : void ask(prompt))}
            >
              {prompt}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <label htmlFor="cooking-ask" className="sr-only">
            Ask, or say what happened
          </label>
          <input
            id="cooking-ask"
            value={text}
            disabled={busy || session === null}
            placeholder="Ask, or say what happened…"
            autoComplete="off"
            enterKeyHint="send"
            className={cn(
              "min-w-0 flex-1 rounded-full border border-border-normal bg-bg-normal px-4 text-sm outline-none focus:border-border-brand",
              compact ? "h-12 text-base" : "h-10"
            )}
            onChange={(event) => setText(event.target.value)}
          />
          <Button
            type="submit"
            variant="solid"
            intent="brand"
            className={cn("rounded-full", compact && "h-12")}
            disabled={busy || text.trim() === "" || session === null}
          >
            Send
          </Button>
        </div>
      </form>
    </div>
  );
}
