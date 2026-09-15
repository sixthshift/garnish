// The merge confirm for the Units tab: pick which of two (or more) units
// survives. The source is deleted and every ingredient and recipe yield using
// it is repointed to the target (`units.merge`, ui-gap.md's "Merge two foods
// or units into one, source deleted, references repointed").
//
// Built on the same ConfirmDialogContent as the plain delete confirm, with a
// Select in place of the confirm question's body. Mirrors FoodMergeDialog.
import { Modal } from "@sixthshift/design-system/modal";
import { Select } from "@sixthshift/design-system/select";
import { useState } from "react";
import { ConfirmDialogContent } from "../../../components/ui/ConfirmDialog";
import type { Unit } from "../../../db/models/unit/repo";

export type UnitMergeDialogProps = {
  /** The unit being merged away. */
  source: Unit;
  /** Units it can be merged into; the source itself should not be among them. */
  targets: readonly Unit[];
  busy?: boolean;
  onCancel: () => void;
  /** Called with the chosen target's id. */
  onConfirm: (targetId: string) => void;
};

export function UnitMergeDialogContent({ source, targets, busy = false, onCancel, onConfirm }: UnitMergeDialogProps) {
  const [targetId, setTargetId] = useState(targets[0]?.id ?? "");
  const canMerge = targetId !== "" && !busy && targets.length > 0;

  return (
    <ConfirmDialogContent
      title={`Merge ${source.name}?`}
      confirmLabel="Merge"
      busy={busy || !canMerge}
      busyLabel={busy ? "Merging…" : undefined}
      onCancel={onCancel}
      onConfirm={() => canMerge && onConfirm(targetId)}
    >
      <div className="flex flex-col gap-3">
        <p>{`${source.name} will be deleted. Every ingredient and recipe yield using it will point at the unit you pick below instead.`}</p>
        {targets.length > 0 ? (
          <Select
            aria-label="Merge into"
            options={targets.map((unit) => ({ value: unit.id, label: unit.name }))}
            value={targetId}
            disabled={busy}
            onValueChange={setTargetId}
          />
        ) : (
          <p>There is no other unit to merge into.</p>
        )}
      </div>
    </ConfirmDialogContent>
  );
}

export function UnitMergeDialog(props: UnitMergeDialogProps) {
  return (
    <Modal size="sm" aria-label={`Merge ${props.source.name}`} dismissable={props.busy !== true} onOpenChange={(open) => !open && props.onCancel()}>
      <UnitMergeDialogContent {...props} />
    </Modal>
  );
}
