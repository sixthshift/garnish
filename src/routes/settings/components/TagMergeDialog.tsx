// The merge confirm for the Tags tab: pick which of two (or more) tags
// survives. The source is deleted and every recipe carrying it gains the
// target tag instead (`tags.merge`, ui-gap.md's tag tab).
//
// Built on the same ConfirmDialogContent as the plain delete confirm, with a
// Select in place of the confirm question's body. Mirrors FoodMergeDialog and
// UnitMergeDialog.
import { Modal } from "@sixthshift/design-system/modal";
import { Select } from "@sixthshift/design-system/select";
import { useState } from "react";
import { type Tag } from "../../../domain/reference";
import { ConfirmDialogContent } from "../../../components/ui/ConfirmDialog";

export type TagMergeDialogProps = {
  /** The tag being merged away. */
  source: Tag;
  /** Tags it can be merged into; the source itself should not be among them. */
  targets: readonly Tag[];
  busy?: boolean;
  onCancel: () => void;
  /** Called with the chosen target's id. */
  onConfirm: (targetId: string) => void;
};

export function TagMergeDialogContent({ source, targets, busy = false, onCancel, onConfirm }: TagMergeDialogProps) {
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
        <p>{`${source.name} will be deleted. Every recipe carrying it will carry the tag you pick below instead.`}</p>
        {targets.length > 0 ? (
          <Select
            aria-label="Merge into"
            options={targets.map((tag) => ({ value: tag.id, label: tag.name }))}
            value={targetId}
            disabled={busy}
            onValueChange={setTargetId}
          />
        ) : (
          <p>There is no other tag to merge into.</p>
        )}
      </div>
    </ConfirmDialogContent>
  );
}

export function TagMergeDialog(props: TagMergeDialogProps) {
  return (
    <Modal size="sm" aria-label={`Merge ${props.source.name}`} dismissable={props.busy !== true} onOpenChange={(open) => !open && props.onCancel()}>
      <TagMergeDialogContent {...props} />
    </Modal>
  );
}
