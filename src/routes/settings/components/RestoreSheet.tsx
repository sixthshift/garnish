import { Button } from "@sixthshift/design-system/button";
import { Checkbox } from "@sixthshift/design-system/checkbox";
import { Muted } from "@sixthshift/design-system/muted";
import { Sheet } from "@sixthshift/design-system/sheet";
import { useState } from "react";
import type { BackupCounts } from "../../../domain/backup";
import type { RestoreCheck } from "../../../lib/backup";
import { formatDateStamp } from "../../../lib/dates";

const COUNTED: { key: keyof BackupCounts | "guides"; one: string; many: string }[] = [
  { key: "recipes", one: "recipe", many: "recipes" },
  { key: "timeline", one: "cook", many: "cooks" },
  { key: "plan", one: "plan entry", many: "plan entries" },
  { key: "shopping", one: "list line", many: "list lines" },
  { key: "foods", one: "food", many: "foods" },
  { key: "units", one: "unit", many: "units" },
  { key: "aisles", one: "aisle", many: "aisles" },
  { key: "tags", one: "tag", many: "tags" },
  { key: "guides", one: "guide statement", many: "guide statements" },
  { key: "images", one: "photo", many: "photos" },
];

const countOf = (counts: BackupCounts, key: keyof BackupCounts | "guides") => (key === "guides" ? counts.styleRules + counts.plannerRules : counts[key]);

/**
 * What a restore replaces, one line per kind of thing: "142 recipes become
 * 138". Kinds that are empty on both sides are left out. Pure.
 */
export function replacementLines(current: BackupCounts, backup: BackupCounts): string[] {
  return COUNTED.flatMap(({ key, one, many }) => {
    const now = countOf(current, key);
    const then = countOf(backup, key);
    if (now === 0 && then === 0) return [];
    return [`${now} ${now === 1 ? one : many} ${now === 1 ? "becomes" : "become"} ${then}`];
  });
}

export type RestoreSheetContentProps = {
  check: RestoreCheck;
  busy?: boolean;
  onRestore: () => void;
  onCancel: () => void;
};

/**
 * The confirm before a restore, Mealie's: what the backup is, what it
 * replaces beside what is here now, and Restore held back until the household
 * ticks that it understands everything is replaced.
 */
export function RestoreSheetContent({ check, busy = false, onRestore, onCancel }: RestoreSheetContentProps) {
  const [understood, setUnderstood] = useState(false);
  return (
    <>
      <Sheet.Header>
        <h2 className="text-base font-medium">Restore from a backup</h2>
      </Sheet.Header>
      <Sheet.Body>
        <div className="flex flex-col gap-4">
          <p className="text-sm">
            The backup of <strong>{formatDateStamp(check.createdAt)}</strong> replaces everything here. Nothing is merged: what is not in the backup is gone
            afterwards.
          </p>
          <ul className="flex flex-col gap-1 text-sm" data-testid="restore-counts">
            {replacementLines(check.current, check.backup).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <Muted as="p" className="text-sm">
            The database as it is now is kept in <code>backups/</code> first, so a wrong file can be undone.
          </Muted>
          <Checkbox label="I understand this replaces everything" checked={understood} disabled={busy} onCheckedChange={setUnderstood} />
        </div>
      </Sheet.Body>
      <Sheet.Footer>
        <Button type="button" variant="ghost" intent="neutral" disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" variant="solid" intent="danger" disabled={!understood || busy} loading={busy} onClick={onRestore} data-testid="restore-confirm">
          Restore
        </Button>
      </Sheet.Footer>
    </>
  );
}

export type RestoreSheetProps = RestoreSheetContentProps & { open: boolean };

export function RestoreSheet({ open, ...props }: RestoreSheetProps) {
  return (
    <Sheet open={open} onOpenChange={(next) => !next && !props.busy && props.onCancel()} size="sm" closable aria-label="Restore from a backup">
      <RestoreSheetContent {...props} />
    </Sheet>
  );
}
