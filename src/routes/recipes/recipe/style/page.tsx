import { Button } from "@sixthshift/design-system/button";
import { Message } from "@sixthshift/design-system/message";
import { Muted } from "@sixthshift/design-system/muted";
import { toast } from "@sixthshift/design-system/overlay";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Page, PageHeader } from "../../../../components/shell/Page";
import type { RestyledPart } from "../../../../domain/style";
import { useMutate } from "../../../../lib/mutate";
import { toastError } from "../../../../lib/toast";
import { applyRestyle, restoreSteps, restyleSteps } from "../../../../server/ai/restyle";
import { StyleSpace } from "../../components/style/StyleSpace";
import { forSaving } from "../../components/style/styleSession";
import { Route } from "./route";

/**
 * A saved recipe's Style page: the house style over its steps as they stand,
 * chosen step by step, and — once it has been restyled — the way back to the
 * author's words.
 */
export function StyleRecipePage() {
  const { recipe, aiAvailable } = Route.useLoaderData();
  const navigate = useNavigate();
  const mutate = useMutate();
  const [confirmingRestore, setConfirmingRestore] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const back = () => navigate({ to: "/recipes/$slug", params: { slug: recipe.slug } });

  const save = async (parts: RestyledPart[] | null) => {
    if (parts === null) {
      await back();
      return;
    }
    await mutate(() => applyRestyle({ data: { id: recipe.id, parts: forSaving(parts) } }));
    toast({ intent: "success", title: "Steps restyled" });
    await back();
  };

  const restore = async () => {
    setRestoring(true);
    try {
      await mutate(() => restoreSteps({ data: { id: recipe.id } }));
      toast({ intent: "success", title: "Original steps restored" });
      await back();
    } catch (cause) {
      toastError("Couldn't restore the original steps", cause);
      setRestoring(false);
    }
  };

  return (
    <Page>
      <PageHeader
        title={recipe.name}
        actions={
          <Link to="/recipes/$slug" params={{ slug: recipe.slug }} className="text-sm text-fg-brand">
            Back to the recipe
          </Link>
        }
      />
      {!aiAvailable ? (
        <Message intent="neutral" title="No model is configured" data-testid="style-unavailable">
          Restyling needs a model. Set AI_API_KEY on the server, then come back.
        </Message>
      ) : (
        <>
          {recipe.restyledAt !== null && (
            <div className="flex flex-wrap items-center gap-2" data-testid="style-restore">
              <Muted as="span" className="grow text-sm">
                {confirmingRestore
                  ? "The author’s steps come back and this recipe’s restyle is dropped."
                  : "These steps are already restyled; a new run starts from them."}
              </Muted>
              {confirmingRestore ? (
                <>
                  <Button type="button" size="sm" variant="solid" intent="danger" disabled={restoring} onClick={() => void restore()}>
                    {restoring ? "Restoring…" : "Restore"}
                  </Button>
                  <Button type="button" size="sm" variant="ghost" intent="neutral" disabled={restoring} onClick={() => setConfirmingRestore(false)}>
                    Keep the restyle
                  </Button>
                </>
              ) : (
                <Button type="button" size="sm" variant="outline" intent="neutral" onClick={() => setConfirmingRestore(true)}>
                  Restore original steps
                </Button>
              )}
            </div>
          )}
          <StyleSpace
            key={recipe.id}
            parts={recipe.parts}
            run={(ruleIds) => restyleSteps({ data: { id: recipe.id, ruleIds } })}
            onSave={save}
            saveLabel="Save"
            secondary={
              <Button type="button" variant="ghost" intent="neutral" onClick={() => void back()}>
                Cancel
              </Button>
            }
          />
        </>
      )}
    </Page>
  );
}
