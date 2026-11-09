import type { FileRecipe, ImportedRecipe } from "../../import";
import type { FoodRow, Tag, Unit } from "../../reference";
import { DISCARD_PASTE, useImportGuard } from "../editor/DiscardImport";
import { BrowserSource } from "./BrowserSource";
import type { SentPage } from "./bookmarklet";
import { FileSource } from "./FileSource";
import { ImportWait } from "./ImportWait";
import type { ModelReader, SourceKind } from "./importSummary";
import { PageSource } from "./PageSource";
import { PasteSource } from "./PasteSource";
import type { ImportedCheck } from "./reviewFlows";
import { SourceChooser } from "./SourceChooser";
import { StageBack } from "./SourceStage";
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
  /** Called once a read is whole, with what Check opens on (decisions.md row 203). */
  onDraft: (check: ImportedCheck) => void;
  /** Look for a recipe already imported from this address. */
  findDuplicate?: (url: string) => Promise<{ name: string; slug: string } | null>;
  /** Look for a recipe already here under this name, for an upload. */
  findDuplicateByName?: (name: string) => Promise<{ name: string; slug: string } | null>;
  /** Override the food vocabulary (tests); otherwise `listFoods` supplies it. */
  loadFoods?: () => Promise<FoodRow[]>;
  /** Override the fetch (tests). */
  load?: (url: string) => Promise<ImportedRecipe>;
  /** Override the read of a page the bookmark sent (tests). */
  loadPage?: (page: SentPage) => Promise<ImportedRecipe>;
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
  const { source, onChoose, aiAvailable = false } = props;
  const state = useRecipeSource(props);
  const { url, text, file, busy, error } = state;
  // Pasted text is work the browser's Back would drop unseen: the stages share
  // one URL, so Back leaves /recipes/new.
  const guard = useImportGuard(source === "paste" && text.trim() !== "", DISCARD_PASTE);

  return (
    <>
      {/* The chooser and each source's form share the page's one column, so choosing a source does not move the page. */}
      {stage()}
      {guard.dialog}
    </>
  );

  function stage() {
    // While a read runs its form steps aside for the wait. Back stays live: it lets the read go (`leaveSource`).
    if (busy && state.progress !== null && source !== null) {
      return (
        <div className="flex flex-col gap-3">
          <StageBack onBack={state.leaveSource} />
          <ImportWait progress={state.progress} aiAvailable={aiAvailable} onSkip={state.sorting ? state.skip : undefined} />
        </div>
      );
    }

    if (source === null) {
      return (
        <SourceChooser
          disabled={busy}
          aiAvailable={aiAvailable}
          onChoose={onChoose}
          onReadUrl={(address) => {
            onChoose("url");
            void state.read(address);
          }}
        />
      );
    }

    if (source === "paste") {
      return (
        <PasteSource
          text={text}
          busy={busy}
          error={error}
          aiAvailable={aiAvailable}
          onTextChange={state.changeText}
          onRead={() => void state.readText()}
          onBack={state.leaveSource}
        />
      );
    }

    if (source === "browser") return <BrowserSource onBack={state.leaveSource} />;

    if (source === "page") {
      return (
        <PageSource
          sent={state.sent}
          status={state.sentStatus}
          busy={busy}
          error={error}
          onRead={() => void state.readSent()}
          onSkip={state.sorting ? state.skip : undefined}
          onPaste={() => onChoose("paste")}
          onBack={state.leaveSource}
        />
      );
    }

    if (source === "file") {
      return (
        <FileSource file={file} busy={busy} error={error} onFileChange={state.changeFile} onRead={() => void state.readFile()} onBack={state.leaveSource} />
      );
    }

    return (
      <UrlSource
        url={url}
        busy={busy}
        error={error}
        onUrlChange={state.setUrl}
        onFetch={() => void state.read()}
        onBack={state.leaveSource}
        onPaste={state.pasteInstead}
        onBookmark={() => onChoose("browser")}
        onSkip={state.sorting ? state.skip : undefined}
      />
    );
  }
}
