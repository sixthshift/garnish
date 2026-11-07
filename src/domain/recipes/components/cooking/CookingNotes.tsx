import { Button } from "@sixthshift/design-system/button";
import { Muted } from "@sixthshift/design-system/muted";
import { SectionTitle } from "@sixthshift/design-system/section-title";
import { Textarea } from "@sixthshift/design-system/textarea";
import { type FormEvent, useState } from "react";
import { noteCooking, unadjustCooking } from "../../../../api/rpc/cooking";
import { useMutate } from "../../../../lib/mutate";
import { toastError } from "../../../../lib/toast";
import type { CookSession } from "../../cooking";

/**
 * What the cook says while cooking, without a model (decisions.md row 214):
 * a box to note something for the review ("too salty", "took ages to
 * thicken"), and what has been noted and changed so far, a change with Put
 * back. A desktop's third column; a phone's Note sheet.
 */
export function CookingNotes({ recipeId, session, onNoted }: { recipeId: string; session: CookSession | null; onNoted?: () => void }) {
  const mutate = useMutate();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const words = text.trim();
    if (words === "" || session === null) return;
    setBusy(true);
    try {
      await mutate(() => noteCooking({ data: { recipeId, text: words } }));
      setText("");
      onNoted?.();
    } catch (error) {
      toastError("Could not keep that note", error);
    } finally {
      setBusy(false);
    }
  };

  const putBack = async (adjustmentId: string) => {
    try {
      await mutate(() => unadjustCooking({ data: { recipeId, adjustmentId } }));
    } catch (error) {
      toastError("Could not put that back", error);
    }
  };

  const notes = session?.notes ?? [];
  const adjustments = session?.adjustments ?? [];

  return (
    <div className="flex flex-col gap-4" data-testid="cooking-notes">
      <form className="flex flex-col gap-2" onSubmit={(event) => void submit(event)}>
        <label htmlFor="cooking-note" className="text-sm text-fg-subtle">
          Say what happened, and it is kept for the review.
        </label>
        <Textarea
          id="cooking-note"
          value={text}
          rows={2}
          disabled={busy || session === null}
          placeholder="Too salty, took ages to thicken…"
          onChange={(event) => setText(event.target.value)}
        />
        <Button type="submit" variant="outline" intent="neutral" size="sm" className="self-end" disabled={busy || text.trim() === "" || session === null}>
          {busy ? "Keeping…" : "Note it"}
        </Button>
      </form>

      {adjustments.length > 0 && (
        <section className="flex flex-col gap-2" aria-label="Changed tonight">
          <SectionTitle as="h3">Changed tonight</SectionTitle>
          <ul className="flex flex-col gap-1.5">
            {adjustments.map((adjustment) => (
              <li key={adjustment.id} className="flex items-center gap-2 text-sm">
                <span className="min-w-0 flex-1">{adjustment.summary}</span>
                <Button inline intent="neutral" size="sm" onClick={() => void putBack(adjustment.id)}>
                  Put back
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {notes.length > 0 && (
        <section className="flex flex-col gap-2" aria-label="Noted">
          <SectionTitle as="h3">Noted</SectionTitle>
          <ul className="flex flex-col gap-1.5 text-sm">
            {notes.map((note) => (
              <li key={note.id}>
                {note.text}
                {note.origin === "timer" && (
                  <Muted as="span" className="ml-1 text-xs">
                    · timer
                  </Muted>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
