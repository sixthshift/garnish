import { toast } from "@sixthshift/design-system/overlay";
import { cn } from "@sixthshift/design-system/utils";
import { type ReactNode, useEffect, useState } from "react";
import { PencilIcon } from "../../../../components/ui/icons";
import { Menu } from "../../../../components/ui/Menu";
import { type DraftIngredient, withIngredientReplaced, withStepReplaced } from "../../../../domain/draft";
import type { Unit } from "../../../../domain/reference";
import { toastError } from "../../../../lib/toast";
import { listUnits } from "../../../../server/fns/units";
import { useQuickEditContext } from "./QuickEditContext";
import { QuickEditIngredientSheet } from "./QuickEditIngredient";
import { QuickEditStepSheet, type StepPatch } from "./QuickEditStep";
import { saveQuickEdit } from "./saveQuickEdit";

// --- The trigger a row renders ------------------------------------------------

/**
 * How a row's trigger rests. Fixing lines (the recipe menu's "Fix a line"),
 * it is simply there. Otherwise a page read or cooked from carries no edit
 * mark per row (design-language rule 3): with a mouse the trigger keeps its
 * place but fades in only while its row is hovered. On a touch screen an
 * ingredient's pencil is visually hidden, so a short row keeps its width;
 * `keepPlace` (the step's ⋯) holds its column there too, transparent and
 * untappable, because a step's paragraph rewrapped round a ⋯ appearing would
 * grow every card as the mode starts. In all of these it is still in the tab
 * order and the accessibility tree, and shows once focus is inside it or its
 * menu is open — the step menu's panel hangs inside the wrapper, so a hidden
 * or clipped wrapper would hide it.
 */
export function triggerRest(fixing: boolean, keepPlace = false): string {
  if (fixing) return "";
  const shown = "group-hover/quick-edit:opacity-100 focus-within:opacity-100 has-[[aria-expanded=true]]:opacity-100";
  if (keepPlace)
    return cn(
      "pointer-events-none opacity-0 transition-opacity",
      "group-hover/quick-edit:pointer-events-auto focus-within:pointer-events-auto has-[[aria-expanded=true]]:pointer-events-auto",
      shown
    );
  return cn(
    "sr-only focus-within:not-sr-only has-[[aria-expanded=true]]:not-sr-only",
    "[@media(hover:hover)]:not-sr-only [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:transition-opacity",
    shown
  );
}

/** A pencil, drawn the way the recipe route draws its own: 44px square on a touch screen. */
function pencil(label: string, fixing: boolean, onOpen: () => void) {
  return (
    <span data-print="hide" className={cn("shrink-0", triggerRest(fixing))}>
      <button
        type="button"
        aria-label={label}
        data-testid="quick-edit-trigger"
        className="mt-0.5 flex items-center justify-center rounded p-1 text-fg-subtle hover:text-fg-normal pointer-coarse:-my-2.5 pointer-coarse:-mr-2.5 pointer-coarse:size-11"
        onClick={onOpen}
      >
        <PencilIcon size={14} title="Edit" />
      </button>
    </span>
  );
}

/** The step card's own trigger: an unboxed "…" menu in its corner, one item, "Edit step". Its 44px touch square overhangs the row, as the pencil's does. */
function stepMenu(fixing: boolean, onOpen: () => void) {
  return (
    <div data-print="hide" className={cn("-mt-1 -mr-1 shrink-0 pointer-coarse:-my-2.5 pointer-coarse:-mr-2.5", triggerRest(fixing, true))}>
      <Menu label="Step actions" iconOnly ghost>
        <Menu.Item onSelect={onOpen}>Edit step</Menu.Item>
      </Menu>
    </div>
  );
}

/**
 * The quick edit for one ingredient row: its pencil (resting as
 * `triggerRest` says) and its sheet, or nothing outside the recipe page.
 * Outside a `QuickEditProvider`, or for a row whose part is unknown (the
 * merged summary list), there is nothing to render: the row is what it always
 * was.
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
      {pencil("Edit ingredient", context.fixing, () => setOpen(true))}
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

  const save = async (patch: StepPatch) => {
    setBusy(true);
    setError(null);
    try {
      await saveQuickEdit(withStepReplaced(context.recipe, partId, stepId, patch), context.run);
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
      {stepMenu(context.fixing, () => setOpen(true))}
      <QuickEditStepSheet
        open={open}
        step={{ title: stored.title, text: stored.text, summary: stored.summary }}
        busy={busy}
        error={error}
        onSave={(patch) => void save(patch)}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}
