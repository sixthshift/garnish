import type { RecipeDraft } from "../../../../domain/draft";
import type { FileRecipe, ImportedRecipe } from "../../../../domain/import";
import type { FoodRow, Tag, Unit } from "../../../../domain/reference";
import { listFoods } from "../../../../server/fns/foods";
import { FileSource } from "./FileSource";
import { ImportReview } from "./ImportReview";
import type { ModelReader, SourceKind } from "./importSummary";
import { PasteSource } from "./PasteSource";
import { RecipePicker } from "./RecipePicker";
import { SourceChooser } from "./SourceChooser";
import { UrlSource } from "./UrlSource";
import { useRecipeSource } from "./useRecipeSource";

export type RecipeSourceProps = {
  units: readonly Unit[];
  tags?: readonly Tag[];
  /** The chosen source, from the route's `?source`; null shows the chooser. */
  source: SourceKind | null;
  /** Choosing a source is a navigation, so the route owns it. */
  onChoose: (kind: SourceKind | null) => void;
  /** An address handed in by the route (a share sheet's): the URL stage opens on it and reads it at once. */
  initialUrl?: string | null;
  /** Called once with the draft the editor should open on. */
  onDraft: (draft: RecipeDraft, imageUrl: string | null) => void;
  /** Look for a recipe already imported from this address. */
  findDuplicate?: (url: string) => Promise<{ name: string; slug: string } | null>;
  /** Look for a recipe already here under this name, for an upload. */
  findDuplicateByName?: (name: string) => Promise<{ name: string; slug: string } | null>;
  /** Override the food vocabulary (tests); otherwise `listFoods` supplies it. */
  loadFoods?: () => Promise<FoodRow[]>;
  /** Override the fetch (tests). */
  load?: (url: string) => Promise<ImportedRecipe>;
  /** Override the upload (tests); otherwise `postImportFile` does it. */
  loadFile?: (file: File) => Promise<FileRecipe[]>;
  /** Whether a model is configured on the server; false hides the paste option and leaves every page unsorted. */
  aiAvailable?: boolean;
  /**
   * Override the AI read (tests); otherwise `importFromText` does it. The
   * anchor is the rules rung's own reading of the same page, given for
   * a `schema` result and absent for a paste or a stub.
   */
  loadText?: ModelReader;
  /**
   * The food standing for a recipe already here under `name`, for a
   * Tandoor export's nested recipes; null when no such recipe is here yet.
   * Overridable for tests.
   */
  linkSubRecipeFood?: (name: string) => Promise<FoodRow | null>;
};

export function RecipeSource(props: RecipeSourceProps) {
  const { units, source, onChoose, aiAvailable = false } = props;
  const state = useRecipeSource(props);
  const { url, text, file, choices, imported, rows, busy, error, reading, readError } = state;

  if (source === null) return <SourceChooser disabled={busy} aiAvailable={aiAvailable} onChoose={onChoose} />;

  if (imported !== null) {
    return (
      <ImportReview
        imported={imported}
        rows={rows}
        units={units}
        searchFoods={(q) => listFoods({ data: { q } })}
        busy={busy}
        error={error}
        duplicate={state.duplicate}
        duplicateBy={imported.from === "schema" || imported.from === "stub" ? "url" : "name"}
        aiAvailable={aiAvailable}
        reading={reading}
        readError={readError}
        onRetryRead={state.retryRead}
        onUseRejected={state.useRejected}
        onRowsChange={state.setRows}
        onBack={state.leaveReview}
        onCreate={() => void state.create()}
      />
    );
  }

  if (choices !== null) {
    return <RecipePicker recipes={choices} busy={busy} onPick={state.pickUploaded} onBack={state.leavePicker} />;
  }

  if (source === "paste") {
    return (
      <PasteSource text={text} busy={busy} error={error} onTextChange={state.changeText} onRead={() => void state.readText()} onBack={state.leaveSource} />
    );
  }

  if (source === "file") {
    return <FileSource file={file} busy={busy} error={error} onFileChange={state.changeFile} onRead={() => void state.readFile()} onBack={state.leaveSource} />;
  }

  return <UrlSource url={url} busy={busy} error={error} onUrlChange={state.setUrl} onFetch={() => void state.read()} onBack={state.leaveSource} />;
}
