// A line beside the page it came from, on a phone's Check (decisions.md row
// 208): a sheet with the source line lit amid its neighbours, what garnish made
// of it, and what can be done about it. A desktop shows the whole source beside
// the editor instead (desktop/EditorColumns).

import { Button } from "@sixthshift/design-system/button";
import { Modal, ModalBody, ModalHeader } from "@sixthshift/design-system/modal";
import { Muted } from "@sixthshift/design-system/muted";
import { cn } from "@sixthshift/design-system/utils";
import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react";
import {
  type DraftIngredient,
  indexSource,
  type LineRead,
  linkSource,
  type RecipeDraft,
  reviewRead,
  rowRead,
  type SourceContext,
  sourceContext,
} from "../../../draft";
import type { ImportCheckState } from "../ImportCheck";
import { ReadLine } from "./ReadLine";

/** What a row needs to offer its line's sheet, and to open its own fields when the sheet says Edit the line. */
export type LineSourceState = {
  /** Whether there is a page to show a line beside: an import of a page or a paste, not a file or a typed recipe. */
  hasSource: boolean;
  /** Open the sheet for the row whose id this is. */
  show: (id: string) => void;
  /** The ingredient row the sheet's Edit the line asked to open, until it has. */
  editing: string | null;
  doneEditing: () => void;
};

const LineSourceContext = createContext<LineSourceState | null>(null);

/** The sheet's state for a row, or null outside a phone's Check. */
export function useLineSource(): LineSourceState | null {
  return useContext(LineSourceContext);
}

/** An ingredient row as read: a line Check still asks about as its parse proposed it, any other as its fields stand. */
export function checkedRead(check: ImportCheckState | null, row: DraftIngredient): LineRead | null {
  const asking = row.id === undefined ? undefined : check?.pending[row.id];
  return asking !== undefined ? reviewRead(asking) : rowRead(row);
}

type Found = { kind: "ingredient"; label: string; row: DraftIngredient } | { kind: "step"; label: string; title: string; text: string };

/** The row whose id is `id`, wherever it is, named as the editor names it ("Ingredient 3", "Step 2"). */
function findRow(draft: RecipeDraft, id: string): Found | null {
  for (const part of draft.parts) {
    const ii = part.ingredients.findIndex((row) => row.id === id);
    if (ii !== -1) return { kind: "ingredient", label: `Ingredient ${ii + 1}`, row: part.ingredients[ii]! };
    const si = part.steps.findIndex((step) => step.id === id);
    if (si !== -1) {
      const step = part.steps[si]!;
      return { kind: "step", label: `Step ${si + 1}`, title: step.title ?? "", text: step.text ?? "" };
    }
  }
  return null;
}

export type LineSourceProviderProps = {
  children: ReactNode;
  draft: RecipeDraft;
  /** The draft as Check opened on it: a step is found on the page by its text as read. */
  initial: RecipeDraft;
  sourceText?: string;
  check: ImportCheckState;
};

/** Holds which line's sheet is open on a phone's Check, and draws it. */
export function LineSourceProvider({ children, draft, initial, sourceText, check }: LineSourceProviderProps) {
  const [open, setOpen] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [focusStep, setFocusStep] = useState<string | null>(null);
  const hasSource = sourceText !== undefined && sourceText.trim() !== "";
  const indexed = useMemo(() => (hasSource ? indexSource(sourceText) : null), [hasSource, sourceText]);
  const lines = useMemo(() => (indexed === null ? null : linkSource(indexed, initial, draft)), [indexed, initial, draft]);

  // A step has no sheet of its own: Edit the line puts the cursor in its text, once the sheet has handed focus back.
  useEffect(() => {
    if (focusStep === null) return;
    // After the sheet's own hand-back of focus to what opened it, which runs once it has gone.
    const timer = window.setTimeout(() => {
      const field = document.querySelector<HTMLTextAreaElement>(`[data-row-id="${CSS.escape(focusStep)}"] textarea`);
      field?.focus();
      field?.scrollIntoView?.({ block: "center" });
      setFocusStep(null);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [focusStep]);

  const state = useMemo<LineSourceState>(() => ({ hasSource, show: setOpen, editing, doneEditing: () => setEditing(null) }), [hasSource, editing]);
  const found = open === null ? null : findRow(draft, open);
  const close = () => setOpen(null);

  return (
    <LineSourceContext.Provider value={state}>
      {children}
      {open !== null && found !== null && (
        <LineSheet
          id={open}
          found={found}
          context={lines === null ? undefined : sourceContext(lines, open)}
          check={check}
          onClose={close}
          onEdit={() => {
            close();
            if (found.kind === "ingredient") setEditing(open);
            else setFocusStep(open);
          }}
        />
      )}
    </LineSourceContext.Provider>
  );
}

/**
 * The sheet itself. `context` is undefined with no page to show (a file, a
 * typed recipe) and null when the row is on no line of it word for word.
 * Looks right only where it changes nothing but the asking: a line kept as
 * text stays text. A food or unit the library lacks asks the same three
 * questions its line does.
 */
function LineSheet({
  id,
  found,
  context,
  check,
  onClose,
  onEdit,
}: {
  id: string;
  found: Found;
  context: SourceContext | null | undefined;
  check: ImportCheckState;
  onClose: () => void;
  onEdit: () => void;
}) {
  const flag = check.flags.find((candidate) => candidate.id === id) ?? null;
  const read = found.kind === "ingredient" ? checkedRead(check, found.row) : null;
  const act = (run: () => void) => () => {
    run();
    onClose();
  };
  const big = "min-h-11 flex-1";

  return (
    <Modal size="md" closable aria-label={`${found.label}, where it came from`} onOpenChange={(next) => !next && onClose()}>
      <ModalHeader>{flag !== null ? "Check this line" : "Where it came from"}</ModalHeader>
      <ModalBody className="flex flex-col gap-4 max-sm:pb-[max(1.5rem,env(safe-area-inset-bottom))]" data-testid="line-source">
        {context !== undefined && (
          <section className="flex flex-col gap-2" aria-label="On the page">
            <Muted as="p" className="text-xs font-medium uppercase tracking-wide">
              {context === null ? "On the page" : `On the page · line ${context.number}`}
            </Muted>
            {context === null ? (
              <Muted as="p" className="text-sm">
                This line isn't on the page word for word: it was changed here, or made from more than one line.
              </Muted>
            ) : (
              <ol className="rounded-xl bg-bg-subtle py-2 text-sm leading-relaxed">
                {context.lines.map((line) => (
                  <li
                    key={line.number}
                    className={cn(
                      "px-3.5 py-1",
                      line.heading && "font-semibold",
                      line.lit ? "bg-bg-warning-subtle font-medium text-fg-strong shadow-[inset_3px_0_0_var(--color-bg-warning)]" : "text-fg-subtle"
                    )}
                    data-source-line={line.number}
                    data-lit={line.lit ? "true" : undefined}
                  >
                    {line.text}
                  </li>
                ))}
              </ol>
            )}
          </section>
        )}

        <section className="flex flex-col gap-2" aria-label="Garnish read it as">
          <Muted as="p" className="text-xs font-medium uppercase tracking-wide">
            Garnish read it as
          </Muted>
          <div className="rounded-xl border border-border-normal bg-bg-normal p-3 text-base" data-testid="read-as">
            {found.kind === "ingredient" ? (
              read === null ? (
                <Muted as="span">An empty line</Muted>
              ) : (
                <ReadLine read={read} />
              )
            ) : (
              <div className="flex flex-col gap-1">
                {found.title.trim() !== "" && <strong className="font-semibold text-fg-strong">{found.title}</strong>}
                <span className="whitespace-pre-line text-sm">{found.text.trim() === "" ? "An empty step" : found.text}</span>
              </div>
            )}
          </div>
        </section>

        {flag !== null && (
          <p className="flex gap-2 rounded-xl bg-bg-warning-subtle px-3 py-2.5 text-sm text-fg-strong" data-testid="line-flag">
            <span className="mt-1.5 size-2 shrink-0 rounded-full bg-bg-warning" aria-hidden="true" />
            {flag.reason}
          </p>
        )}

        {flag !== null && flag.kind !== "text" ? (
          <div className="flex flex-col gap-2">
            <Button type="button" variant="solid" intent="brand" className="min-h-11" onClick={act(() => check.add(id))}>
              {flag.kind === "food" ? "Add as a new food" : "Add as a new unit"}
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" intent="neutral" className={big} onClick={act(() => check.pick(id))}>
                {flag.kind === "food" ? "Pick a food" : "Pick a unit"}
              </Button>
              <Button type="button" variant="outline" intent="neutral" className={big} onClick={act(() => check.keep(id))}>
                Keep as text
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button type="button" variant="outline" intent="neutral" className={big} onClick={onEdit}>
              Edit the line
            </Button>
            {flag !== null ? (
              <Button type="button" variant="solid" intent="brand" className={big} onClick={act(() => check.pass(id))}>
                Looks right
              </Button>
            ) : (
              <Button type="button" variant="solid" intent="brand" className={big} onClick={onClose}>
                Close
              </Button>
            )}
          </div>
        )}
      </ModalBody>
    </Modal>
  );
}
