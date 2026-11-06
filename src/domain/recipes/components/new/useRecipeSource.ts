// The source stage of /recipes/new: reading a recipe whole, then handing it to Check (decisions.md row 203).

import { useEffect, useRef, useState } from "react";
import { listFoods } from "../../../../api/rpc/foods";
import { importFromPage, importFromText, importFromUrl } from "../../../../api/rpc/import";
import { messageFrom } from "../../../../lib/errors";
import { postImportFile } from "../../../../lib/importFile";
import { emptyDraft, type IngredientReview } from "../../draft";
import { type FileRecipe, type ImportedRecipe, looksLikeHtml, review } from "../../import";
import { reviewRows } from "../../ingredient";
import type { FoodRow } from "../../reference";
import type { SentPage } from "./bookmarklet";
import { type DuplicateBy, type ModelReader, PASTE_NOTE, STUB_NOTE, shouldReadWithModel, sortedRead } from "./importSummary";
import type { RecipeSourceProps } from "./RecipeSource";
import { checkFromRead, reviewOfUpload } from "./reviewFlows";
import { useSentPage } from "./useSentPage";

/** What one read hands to Check beside the recipe itself. */
type ReadExtras = {
  rows?: IngredientReview[];
  rowSteps?: number[] | null;
  subRecipes?: string[];
  by: DuplicateBy;
  note?: string | null;
  /** What the read was made from, when it was not a page's readable text: the text pasted. */
  sourceText?: string;
};

export function useRecipeSource(props: RecipeSourceProps) {
  const { units, tags, source, onChoose, onDraft, findDuplicate, findDuplicateByName, loadFoods, load, loadPage, loadFile, linkSubRecipeFood } = props;
  const { aiAvailable = false, loadText, initialUrl = null } = props;
  const [url, setUrl] = useState(initialUrl ?? "");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  // The page the Save to Garnish bookmark sent, kept so a failed read can be tried again.
  const [sent, setSent] = useState<SentPage | null>(null);
  // The address a failed read was of, when the reader went on to paste it instead: the paste's source.
  const [pasteFrom, setPasteFrom] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Whether the model is sorting the read into parts; the source stage holds until it lands or is skipped.
  const [sorting, setSorting] = useState(false);
  // Skip's way into a sort in flight: resolving it ends the wait on the rules' reading.
  const skipSort = useRef<(() => void) | null>(null);
  // Which read is current: a read that is left (Back, a new address) must not land later.
  const readToken = useRef(0);
  const [error, setError] = useState<string | null>(null);

  // Read at call time rather than closed over: an address typed on the chooser
  // is read in the same press that sets it, before a render has caught up.
  const urlRef = useRef(url);
  urlRef.current = url;
  const reader: ModelReader = (pageText, anchor) =>
    loadText ? loadText(pageText, anchor) : importFromText({ data: { text: pageText, sourceUrl: urlRef.current, anchor } });

  const fetchFoods = loadFoods ?? (() => listFoods({ data: {} }));

  /** A read, whole, to Check: the draft, what it still asks about, and the duplicate, if any. */
  const toCheck = async (found: ImportedRecipe, foods: readonly FoodRow[], extras: ReadExtras) => {
    const rows = extras.rows ?? reviewRows(review.ingredientLines(found.recipe), { units, foods });
    const check = await checkFromRead({
      imported: found,
      rows,
      rowSteps: extras.rowSteps ?? null,
      subRecipes: extras.subRecipes ?? [],
      tags,
      linkSubRecipeFood,
    });
    const lookup = extras.by === "url" ? findDuplicate?.(found.url) : findDuplicateByName?.(found.recipe.name);
    const duplicate = (await lookup) ?? null;
    const sourceText = extras.sourceText ?? found.pageText;
    onDraft({
      ...check,
      ...(sourceText.trim() !== "" && { sourceText }),
      imageUrl: found.recipe.image,
      // A page with no recipe on it gave a title and a picture and nothing else: Check says so.
      note: extras.note ?? (found.from === "stub" ? STUB_NOTE : null),
      duplicate: duplicate === null ? null : { ...duplicate, by: extras.by },
    });
  };

  /**
   * A page whose recipe card grouped its ingredients and not its steps, with
   * the steps placed in the parts whose ingredients they name; settled, the
   * model has nothing left to sort (decisions.md row 204).
   */
  const withPlacedSteps = (found: ImportedRecipe, foods: readonly FoodRow[]): ImportedRecipe => {
    if (found.partsFromPage !== "ingredients") return found;
    const placed = review.placeSteps(found.recipe, { units, foods });
    return { ...found, recipe: placed.recipe, partsFromPage: placed.settled ? "complete" : "ingredients" };
  };

  /** Read a page: the stage's own address, or one handed in by the chooser's field. */
  const read = (address: string = url) => readPageAt(address, () => (load ? load(address) : importFromUrl({ data: { url: address } })));

  /** Read the page the bookmark sent: the address's road from the fetch on. */
  const readSent = (page: SentPage | null = sent) => {
    if (page === null) return Promise.resolve();
    return readPageAt(page.url, () => (loadPage ? loadPage(page) : importFromPage({ data: { html: page.html, url: page.url } })));
  };

  const sentStatus = useSentPage(source === "page", (page) => {
    setSent(page);
    void readSent(page);
  });

  /**
   * A page read whole before Check opens: the rules' result and, with a model,
   * its sort into parts. Skip ends the wait on the rules' result; a sort that
   * fails or is rejected ends it there too, with the note.
   */
  const readPageAt = async (address: string, fetchPage: () => Promise<ImportedRecipe>) => {
    setUrl(address);
    urlRef.current = address;
    const token = ++readToken.current;
    setBusy(true);
    setError(null);
    try {
      const [fetched, foods] = await Promise.all([fetchPage(), fetchFoods()]);
      if (token !== readToken.current) return;
      const found = withPlacedSteps(fetched, foods);
      let shown = found;
      let note: string | null = null;
      if (shouldReadWithModel(found, aiAvailable)) {
        setSorting(true);
        const skipped = new Promise<null>((resolve) => {
          skipSort.current = () => resolve(null);
        });
        const sorted = await Promise.race([sortedRead(found, reader), skipped]);
        skipSort.current = null;
        setSorting(false);
        if (token !== readToken.current) return;
        if (sorted !== null) {
          shown = sorted.imported;
          note = sorted.note;
        }
      }
      await toCheck(shown, foods, { by: "url", note });
    } catch (cause) {
      if (token === readToken.current) setError(messageFrom(cause));
    } finally {
      if (token === readToken.current) setBusy(false);
    }
  };

  /** End a sort in flight: Check opens on the rules' reading. */
  const skip = () => skipSort.current?.();

  // A shared address is read as soon as the stage mounts: the share already
  // said which page, so asking for "Read the page" again would be a second
  // tap for nothing. Once only, whatever the address later becomes.
  const readShared = useRef(initialUrl !== null && initialUrl !== "");
  useEffect(() => {
    if (!readShared.current) return;
    readShared.current = false;
    void read();
  });

  /**
   * Pasted text: a page's HTML is read by the rules, plain text by the model,
   * and either way it opens on Check. A failed read is shown here and nothing
   * is written.
   */
  const readText = async () => {
    // Prose with no model to read it: Check opens on an empty recipe with the
    // text in the ingredient box, to be sorted by hand (decisions.md row 203).
    if (!aiAvailable && !looksLikeHtml(text.trim())) {
      setError(null);
      onDraft({
        draft: { ...emptyDraft(), sourceUrl: pasteFrom },
        imageUrl: null,
        pending: {},
        note: PASTE_NOTE,
        duplicate: null,
        suggestedTags: [],
        leftOutTags: [],
        pastedText: text.trim(),
        sourceText: text.trim(),
      });
      return;
    }
    const token = ++readToken.current;
    setBusy(true);
    setError(null);
    try {
      const [found, foods] = await Promise.all([loadText ? loadText(text) : importFromText({ data: { text, sourceUrl: pasteFrom ?? "" } }), fetchFoods()]);
      if (token !== readToken.current) return;
      // Prose pasted is itself what was read; a page's markup is shown as its readable text, as an address's is.
      await toCheck(found, foods, { by: "name", sourceText: looksLikeHtml(text.trim()) ? found.pageText : text.trim() });
    } catch (cause) {
      if (token === readToken.current) setError(messageFrom(cause));
    } finally {
      if (token === readToken.current) setBusy(false);
    }
  };

  /** One recipe out of an upload, to Check as the export states it. */
  const chooseUploaded = async (recipe: FileRecipe, foods: readonly FoodRow[]) => {
    const reviewed = reviewOfUpload(recipe, units, foods);
    await toCheck(reviewed.imported, foods, { rows: reviewed.rows, rowSteps: reviewed.rowSteps, subRecipes: reviewed.subRecipeNames, by: "name" });
  };

  const readFile = async () => {
    if (file === null) return;
    const token = ++readToken.current;
    setBusy(true);
    setError(null);
    try {
      const [found, foods] = await Promise.all([(loadFile ?? postImportFile)(file), fetchFoods()]);
      if (found.length === 0) throw new Error("No recipe in that file");
      // A whole export is moving house, not adding a recipe (decisions.md row 201).
      if (found.length > 1) throw new Error(`That file holds ${found.length} recipes. Bring a whole export in from Settings › Backup.`);
      if (token !== readToken.current) return;
      await chooseUploaded(found[0]!, foods);
    } catch (cause) {
      if (token === readToken.current) setError(messageFrom(cause));
    } finally {
      if (token === readToken.current) setBusy(false);
    }
  };

  /** Back from any source stage to the chooser. A read still running is let go: it must not open Check after Back. */
  const leaveSource = () => {
    readToken.current += 1;
    skipSort.current = null;
    setSorting(false);
    setBusy(false);
    setError(null);
    setPasteFrom(null);
    onChoose(null);
  };

  /** From a page that could not be read to the paste, carrying its address as the recipe's source. */
  const pasteInstead = () => {
    setError(null);
    setPasteFrom(url.trim() === "" ? null : url.trim());
    onChoose("paste");
  };

  const changeText = (next: string) => {
    setText(next);
    setError(null);
  };

  const changeFile = (next: File | null) => {
    setFile(next);
    setError(null);
  };

  return {
    url,
    text,
    file,
    sent,
    sentStatus,
    busy,
    error,
    sorting,
    skip,
    setUrl,
    changeText,
    changeFile,
    read,
    readSent,
    readText,
    readFile,
    leaveSource,
    pasteInstead,
  };
}
