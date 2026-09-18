import { Button } from "@sixthshift/design-system/button";
import { toast } from "@sixthshift/design-system/overlay";
import { useState } from "react";
import type { Recipe, TimelineEventInput } from "../../../../domain/recipe";
import { formatDateStamp } from "../../../../lib/dates";
import { uploadTimelineImage } from "../../../../lib/images";
import { useMutate } from "../../../../lib/mutate";
import { toastError } from "../../../../lib/toast";
import { createTimelineEvent } from "../../../../server/fns/timeline";
import { MadeThisSheet } from "./MadeThisSheet";
import { saveCookAndClearTicks } from "./saveCook";

export type MadeThisButtonProps = { recipe: Pick<Recipe, "id" | "name" | "recipeServings"> };

/** Opens the sheet, logs the cook and uploads the photo, if one was given. */
export function MadeThisButton({ recipe }: MadeThisButtonProps) {
  const mutate = useMutate();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const save = async (input: TimelineEventInput, photo: File | null) => {
    setSaving(true);
    try {
      const event = await mutate(() =>
        saveCookAndClearTicks(
          { recipeId: recipe.id, event: input, photo },
          {
            createEvent: (recipeId, created) => createTimelineEvent({ data: { recipeId, event: created } }),
            uploadPhoto: uploadTimelineImage,
          }
        )
      );
      toast({ intent: "success", title: "Cook logged", children: formatDateStamp(event.occurredOn) });
      setOpen(false);
    } catch (error) {
      toastError("Could not log this cook", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button type="button" variant="outline" intent="neutral" size="sm" data-testid="made-this" onClick={() => setOpen(true)}>
        Made this
      </Button>
      <MadeThisSheet
        open={open}
        busy={saving}
        onCancel={() => setOpen(false)}
        onSave={(input, photo) => void save(input, photo)}
        defaultServings={recipe.recipeServings > 0 ? Number(recipe.recipeServings.toFixed(2)) : 1}
      />
    </>
  );
}
