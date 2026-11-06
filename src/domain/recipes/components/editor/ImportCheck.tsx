// Check, the import's stage in the editor (decisions.md row 203): what the read
// has to say at the top, and the lines it still asks about, each with Add, Pick
// or Keep as text.

import { Button } from "@sixthshift/design-system/button";
import { Card } from "@sixthshift/design-system/card";
import { Muted } from "@sixthshift/design-system/muted";
import { Link } from "@tanstack/react-router";
import { createContext, useContext, useState } from "react";
import {
  addedAsNew,
  checkStatus,
  type DraftIngredient,
  livePending,
  type PendingLines,
  pendingLabel,
  type RecipeDraft,
  withIngredientPatched,
} from "../../draft";
import type { DuplicateBy } from "../new/importSummary";

/** What an import brings to the form besides its draft. */
export type ImportCheckProps = {
  /** The lines the read could not settle, by the draft row's id. */
  pending: PendingLines;
  /** The line saying the model's sort did not land, when it did not. */
  note: string | null;
  /** A recipe already here from the same address or under the same name. */
  duplicate: { name: string; slug: string; by: DuplicateBy } | null;
  /** The source's new tags, offered as one-press additions. */
  suggestedTags: readonly string[];
  /** Leave Check for the chooser; the page asks first. */
  onBack: () => void;
};

/** The lines still asked about and what can be done with each, shared with the ingredient rows. */
export type ImportCheckState = {
  pending: PendingLines;
  /** The row Pick just opened, so it mounts with its fields open. */
  picking: string | null;
  /** How many times Check has filled each row: a row it fills mounts afresh, so its fields read the new food. */
  revisions: Readonly<Record<string, number>>;
  add: (id: string) => void;
  pick: (id: string) => void;
  keep: (id: string) => void;
  /** The row was changed by hand: it is settled, whatever was done. */
  settle: (id: string) => void;
  donePicking: () => void;
  addAll: () => void;
  keepAll: () => void;
};

export const ImportCheckContext = createContext<ImportCheckState | null>(null);

/** The import's state for a row, or null outside an import. */
export function useImportCheck(): ImportCheckState | null {
  return useContext(ImportCheckContext);
}

/** The state behind Check's pending lines, over the form's draft. */
export function useImportCheckState(
  initial: PendingLines | undefined,
  draft: RecipeDraft,
  setDraft: (update: (draft: RecipeDraft) => RecipeDraft) => void
): ImportCheckState | null {
  const [pending, setPending] = useState<PendingLines>(initial ?? {});
  const [picking, setPicking] = useState<string | null>(null);
  const [revisions, setRevisions] = useState<Record<string, number>>({});
  if (initial === undefined) return null;
  const live = livePending(draft, pending);
  const drop = (ids: readonly string[]) => setPending((current) => Object.fromEntries(Object.entries(current).filter(([id]) => !ids.includes(id))));
  const apply = (ids: readonly string[]) => {
    const patches = ids.flatMap((id) => {
      const row = live[id];
      const patch = row === undefined ? null : addedAsNew(row);
      return patch === null ? [] : [[id, patch] as [string, Partial<DraftIngredient>]];
    });
    setDraft((current) => patches.reduce((next, [id, patch]) => withIngredientPatched(next, id, patch), current));
    setRevisions((current) => ({ ...current, ...Object.fromEntries(patches.map(([id]) => [id, (current[id] ?? 0) + 1])) }));
    drop(ids);
  };
  return {
    pending: live,
    picking,
    revisions,
    add: (id) => apply([id]),
    pick: (id) => {
      apply([id]);
      setPicking(id);
    },
    keep: (id) => drop([id]),
    settle: (id) => {
      if (id in live) drop([id]);
    },
    donePicking: () => setPicking(null),
    addAll: () => apply(Object.keys(live)),
    keepAll: () => drop(Object.keys(live)),
  };
}

/** The host a source address names, for its link's text. */
function hostOf(address: string): string {
  try {
    return new URL(address).hostname.replace(/^www\./, "");
  } catch {
    return address;
  }
}

/** The top of Check: where the recipe came from, what the read has to say, and the lines still to settle. */
export function ImportCheckCard({ draft, check, state }: { draft: RecipeDraft; check: ImportCheckProps; state: ImportCheckState }) {
  const status = checkStatus(draft, state.pending);
  const asking = Object.keys(state.pending).length;
  const source = draft.sourceUrl ?? "";
  return (
    <Card size="md" className="flex flex-col gap-3" data-testid="import-check">
      {source !== "" && (
        <p className="text-sm">
          From{" "}
          <a href={source} target="_blank" rel="noreferrer" className="font-medium underline underline-offset-2" data-testid="import-source">
            {hostOf(source)} ↗
          </a>
        </p>
      )}
      {check.note !== null && (
        <Muted as="p" className="text-sm" data-testid="sort-note">
          {check.note}
        </Muted>
      )}
      {check.duplicate !== null && (
        <p className="text-sm" data-testid="duplicate-note">
          Already in your recipes:{" "}
          <Link to="/recipes/$slug" params={{ slug: check.duplicate.slug }} className="font-medium underline underline-offset-2">
            {check.duplicate.name}
          </Link>
        </p>
      )}
      {status !== "" && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="grow text-sm" data-testid="import-status">
            Ingredients: {status}
          </span>
          {asking > 0 && (
            <>
              <Button type="button" variant="outline" intent="neutral" size="sm" onClick={state.addAll}>
                Add all as new foods
              </Button>
              <Button type="button" variant="ghost" intent="neutral" size="sm" onClick={state.keepAll}>
                Keep all as text
              </Button>
            </>
          )}
        </div>
      )}
    </Card>
  );
}

/** Under a line Check still asks about: what it names, and Add, Pick or Keep as text. */
export function PendingLine({ id, label, state, disabled }: { id: string; label: string; state: ImportCheckState; disabled?: boolean }) {
  const row = state.pending[id];
  if (row === undefined) return null;
  const named = pendingLabel(row);
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pl-8 text-sm" data-pending-line={id}>
      <Muted as="span" className="grow">
        {named}
      </Muted>
      <Button
        type="button"
        variant="outline"
        intent="neutral"
        size="sm"
        disabled={disabled}
        aria-label={`Add ${named.charAt(0).toLowerCase()}${named.slice(1)}`}
        onClick={() => state.add(id)}
      >
        Add
      </Button>
      <Button
        type="button"
        variant="ghost"
        intent="neutral"
        size="sm"
        disabled={disabled}
        aria-label={`Pick a food for ${label.toLowerCase()}`}
        onClick={() => state.pick(id)}
      >
        Pick
      </Button>
      <Button
        type="button"
        variant="ghost"
        intent="neutral"
        size="sm"
        disabled={disabled}
        aria-label={`Keep ${label.toLowerCase()} as text`}
        onClick={() => state.keep(id)}
      >
        Keep as text
      </Button>
    </div>
  );
}
