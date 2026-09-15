import { Modal } from "@sixthshift/design-system/modal";
import { Select } from "@sixthshift/design-system/select";
import { useState } from "react";
import { ConfirmDialogContent } from "../../../components/ui/ConfirmDialog";
import type { Food } from "../../../db/models/food/repo";

export type FoodMergeDialogProps = {
  /** The food being merged away. */
  source: Food;
  /** Foods it can be merged into; the source itself should not be among them. */
  targets: readonly Food[];
  busy?: boolean;
  onCancel: () => void;
  /** Called with the chosen target's id. */
  onConfirm: (targetId: string) => void;
};

export function FoodMergeDialogContent({ source, targets, busy = false, onCancel, onConfirm }: FoodMergeDialogProps) {
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
        <p>{`${source.name} will be deleted. Every ingredient using it will point at the food you pick below instead.`}</p>
        {targets.length > 0 ? (
          <Select
            aria-label="Merge into"
            options={targets.map((food) => ({ value: food.id, label: food.name }))}
            value={targetId}
            disabled={busy}
            onValueChange={setTargetId}
          />
        ) : (
          <p>There is no other food to merge into.</p>
        )}
      </div>
    </ConfirmDialogContent>
  );
}

export function FoodMergeDialog(props: FoodMergeDialogProps) {
  return (
    <Modal size="sm" aria-label={`Merge ${props.source.name}`} dismissable={props.busy !== true} onOpenChange={(open) => !open && props.onCancel()}>
      <FoodMergeDialogContent {...props} />
    </Modal>
  );
}
