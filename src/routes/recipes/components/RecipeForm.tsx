import { Button } from "@sixthshift/design-system/button";
import { Card } from "@sixthshift/design-system/card";
import { Message } from "@sixthshift/design-system/message";
import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import { SaveBar } from "../../../components/ui/SaveBar";
import type { RecipeDraft } from "../../../domain/draft";
import type { Tag, Unit } from "../../../domain/reference";
import type { StorageLike } from "../../../lib/drafts";
import { DiscardImportDialog } from "./DiscardImport";
import { DraftNotice } from "./DraftNotice";
import { NotesEditor } from "./NotesEditor";
import { PartsEditor } from "./PartsEditor";
import { RecipeDetails } from "./RecipeDetails";
import { RecipeFormCancel, RecipeFormToolbar } from "./RecipeFormToolbar";
import { RecipeHead } from "./RecipeHead";
import { RecipeJsonView } from "./RecipeJsonView";
import { useRecipeForm } from "./useRecipeForm";

/** The import's "Edit details": the form checks the draft and hands it back rather than saving it. */
export type ContinueWith = {
  label: string;
  onContinue: (draft: RecipeDraft, file: File | null) => void;
  onBack: () => void;
};

export type RecipeFormProps = {
  initial: RecipeDraft;
  units: Unit[];
  tags: Tag[];
  /**
   * The stored recipe being edited. Absent for a new recipe. `servings`, when
   * the edit link carried one, is only used to send Cancel back to the same
   * scale on the view page.
   */
  existing?: { id: string; slug: string; servings?: number };
  /** Override the detected online state (tests). Writes are refused offline; nothing is queued. */
  online?: boolean;
  /**
   * Where the unsaved draft is kept (src/lib/drafts.ts). Defaults to
   * `localStorage`; tests pass an in-memory one.
   */
  storage?: StorageLike;
  /**
   * An image an import found, as a remote URL. Shown straight away and
   * fetched once through `fetchImage`, so it joins the same upload path a
   * picked file does. A failure is silent: the recipe is worth more than its
   * picture, and the field is right there to try again with.
   */
  importedImageUrl?: string | null;
  /**
   * Hand the checked draft back instead of saving it: the import's "Edit
   * details", which returns to the Style stage, where Save lives. `label`
   * names the button that does it, and `onBack` replaces Cancel.
   */
  continueWith?: ContinueWith;
  /**
   * The draft is an import's and is stored nowhere yet: leaving the form
   * asks whether to discard the import, changed or not, as the import's
   * other stages do.
   */
  isImport?: boolean;
  /**
   * Forwarded to the JSON toggle's `Menu` (tests). The menu is closed by
   * default and opens on click, like every other `Menu` in the app; there is
   * no jsdom in this project's vitest config, so a render test cannot click
   * it open and instead renders it open through this prop.
   */
  jsonMenuOpen?: boolean;
};

export function RecipeForm({
  initial,
  units,
  tags: knownTags,
  existing,
  online,
  importedImageUrl,
  storage,
  continueWith,
  isImport = false,
  jsonMenuOpen,
}: RecipeFormProps) {
  const form = useRecipeForm({ initial, existing, online, importedImageUrl, storage, continueWith, isImport });
  const { draft, errors, saving, dirty, json, blocker } = form;
  const cancelLink = continueWith ? (
    <Button type="button" variant="ghost" intent="neutral" size="sm" disabled={saving} onClick={continueWith.onBack}>
      Back
    </Button>
  ) : (
    <RecipeFormCancel existing={existing} disabled={saving} />
  );
  const saveLabel = continueWith?.label ?? (existing ? "Save changes" : "Create recipe");

  return (
    <form onSubmit={(event) => void form.submit(event)} noValidate className="flex flex-col gap-6" aria-label={existing ? "Edit recipe" : "New recipe"}>
      {!form.online && (
        <Message intent="warning" title="You are offline" data-testid="offline-notice">
          Changes cannot be saved offline. Keep editing; Save comes back with the connection.
        </Message>
      )}
      {form.pending !== null && <DraftNotice text={form.pending.text} onResume={form.resumePending} onDiscard={form.discardPending} />}
      <RecipeFormToolbar
        title={draft.name}
        existing={existing !== undefined}
        label={saveLabel}
        saving={saving}
        online={form.online}
        dirty={dirty}
        cancel={cancelLink}
        jsonOpen={json !== null}
        jsonMenuOpen={jsonMenuOpen}
        onToggleJson={form.toggleJson}
      />

      {json !== null ? (
        <RecipeJsonView json={json} error={form.jsonError} disabled={saving} onChange={form.setJson} onApply={form.applyJson} />
      ) : (
        <>
          <Card size="lg" className="flex flex-col gap-4">
            <RecipeHead
              draft={draft}
              errors={errors}
              saving={saving}
              existing={existing !== undefined}
              importedImageUrl={importedImageUrl}
              onPatch={form.patch}
              onFile={form.setFile}
            />
          </Card>

          <PartsEditor draft={draft} onChange={form.setDraft} units={units} errors={errors} disabled={saving} />

          <NotesEditor draft={draft} onChange={form.setDraft} errors={errors} disabled={saving} />

          <RecipeDetails
            draft={draft}
            errors={errors}
            saving={saving}
            units={units}
            knownTags={knownTags}
            defaultOpen={form.detailsOpen}
            onPatch={form.patch}
          />
        </>
      )}

      {/* The phone's footer save; from `md` the toolbar above carries it. */}
      <SaveBar
        className="md:hidden"
        label={saveLabel}
        busyLabel="Saving…"
        busy={saving}
        disabled={!form.online}
        note={dirty ? "Unsaved changes" : undefined}
        cancel={cancelLink}
      />

      {blocker.status === "blocked" && isImport && (
        <DiscardImportDialog
          onStay={blocker.reset}
          onDiscard={() => {
            form.clearStoredDraft();
            blocker.proceed();
          }}
        />
      )}
      {blocker.status === "blocked" && !isImport && (
        <ConfirmDialog
          title="Discard changes?"
          confirmLabel="Discard"
          aria-label="Discard changes"
          onCancel={blocker.reset}
          onConfirm={() => {
            form.clearStoredDraft();
            blocker.proceed();
          }}
        >
          <p>This recipe has changes that have not been saved. Leaving now loses them.</p>
        </ConfirmDialog>
      )}
    </form>
  );
}
