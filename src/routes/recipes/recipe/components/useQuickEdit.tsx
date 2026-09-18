import { toast } from "@sixthshift/design-system/overlay";
import { type ReactNode, useEffect, useState } from "react";
import { PencilIcon } from "../../../../components/ui/icons";
import { Menu } from "../../../../components/ui/Menu";
import { type DraftIngredient, withIngredientReplaced, withStepReplaced } from "../../../../domain/draft";
import type { Unit } from "../../../../domain/reference";
import { toastError } from "../../../../lib/toast";
import { listUnits } from "../../../../server/fns/units";
import { useQuickEditContext } from "./QuickEditContext";
import { QuickEditIngredientSheet } from "./QuickEditIngredient";
import { QuickEditStepSheet } from "./QuickEditStep";
import { saveQuickEdit } from "./saveQuickEdit";

// --- The trigger a row renders ------------------------------------------------

/** A pencil, drawn the way the recipe route draws its own. */
function pencil(label: string, onOpen: () => void) {
  return (
    <button
      type="button"
      aria-label={label}
      data-print="hide"
      data-testid="quick-edit-trigger"
      className="mt-0.5 shrink-0 rounded p-1 text-fg-subtle transition-opacity hover:text-fg-normal focus:opacity-100 md:opacity-0 md:group-hover:opacity-100"
      onClick={onOpen}
    >
      <PencilIcon size={14} title="Edit" />
    </button>
  );
}

/** The step card's own trigger: a quiet "…" menu in its corner, one item, "Edit step" — the pencil and the long press below `md` are gone. */
function stepMenu(onOpen: () => void) {
  return (
    <div data-print="hide" className="mt-0.5 shrink-0">
      <Menu label="Step actions" iconOnly>
        <Menu.Item onSelect={onOpen}>Edit step</Menu.Item>
      </Menu>
    </div>
  );
}

/**
 * The quick edit for one ingredient row: the hover pencil (`md` and up) and
 * its sheet, or nothing outside the recipe page. Outside a
 * `QuickEditProvider`, or for a row whose part is unknown (the merged summary
 * list), there is nothing to render: the row is what it always was. Below
 * `md`, where there is no hover, an ingredient is edited from the editor
 * instead.
 */
export function useQuickEditIngredient(partId: string | undefined, ingredientId: string): ReactNode {
  const context = useQuickEditContext();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [units, setUnits] = useState<readonly Unit[]>([]);

  // The units list is the sheet's, not the page's: it is only worth a request
  // once a row is actually being edited.
  useEffect(() => {
    if (!open) return;
    let stale = false;
    listUnits({ data: {} })
      .then((rows) => {
        if (!stale) setUnits(rows);
      })
      .catch(() => {
        if (!stale) setUnits([]);
      });
    return () => {
      stale = true;
    };
  }, [open]);

  if (context === null || partId === undefined) return null;

  const part = context.recipe.parts.find((candidate) => candidate.id === partId);
  const stored = part?.ingredients.find((candidate) => candidate.id === ingredientId);
  if (stored === undefined) return null;

  const save = async (next: DraftIngredient) => {
    setBusy(true);
    setError(null);
    try {
      // The stored document with one row swapped; ids are kept, so session ticks keyed by row id survive the save.
      await saveQuickEdit(withIngredientReplaced(context.recipe, partId, ingredientId, next), context.run);
      toast({ intent: "success", title: "Ingredient saved" });
      setOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save this ingredient");
      toastError("Couldn't save this ingredient", cause);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {pencil("Edit ingredient", () => setOpen(true))}
      <QuickEditIngredientSheet
        open={open}
        // The stored row, never the scaled one on screen: this is what a save writes back.
        ingredient={{ ...stored }}
        units={units}
        busy={busy}
        error={error}
        onSave={(next) => void save(next)}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}

/**
 * The quick edit for one step: the corner "…" menu (`stepMenu`) and its
 * sheet. Same context and "unknown row" rules as `useQuickEditIngredient`.
 */
export function useQuickEditStep(partId: string | undefined, stepId: string): ReactNode {
  const context = useQuickEditContext();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (context === null || partId === undefined) return null;

  const part = context.recipe.parts.find((candidate) => candidate.id === partId);
  const stored = part?.steps.find((candidate) => candidate.id === stepId);
  if (stored === undefined) return null;

  const save = async (text: string) => {
    setBusy(true);
    setError(null);
    try {
      await saveQuickEdit(withStepReplaced(context.recipe, partId, stepId, text), context.run);
      toast({ intent: "success", title: "Step saved" });
      setOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save this step");
      toastError("Couldn't save this step", cause);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {stepMenu(() => setOpen(true))}
      <QuickEditStepSheet open={open} text={stored.text} busy={busy} error={error} onSave={(text) => void save(text)} onCancel={() => setOpen(false)} />
    </>
  );
}
