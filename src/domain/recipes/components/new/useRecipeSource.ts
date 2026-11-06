// The stage state of /recipes/new and the flows between stages; RecipeSource renders what this returns.

import { useEffect, useMemo, useRef, useState } from "react";
import { listFoods } from "../../../../api/rpc/foods";
import { importFromPage, importFromText, importFromUrl } from "../../../../api/rpc/import";
import { messageFrom } from "../../../../lib/errors";
import { postImportFile } from "../../../../lib/importFile";
import { type IngredientReview, tagSuggestions, tickedTags } from "../../draft";
import { type FileRecipe, type ImportedRecipe, review } from "../../import";
import { reviewRows } from "../../ingredient";
import type { FoodRow } from "../../reference";
import type { SentPage } from "./bookmarklet";
import { type DuplicateBy, type ModelReader, shouldReadWithModel, sortedRead } from "./importSummary";
import type { RecipeSourceProps } from "./RecipeSource";
import { draftFromReview, reviewOfUpload } from "./reviewFlows";
import { useSentPage } from "./useSentPage";

export function useRecipeSource(props: RecipeSourceProps) {
  const { units, tags, source, onChoose, onDraft, findDuplicate, findDuplicateByName, loadFoods, load, loadPage, loadFile, linkSubRecipeFood } = props;
  const { aiAvailable = false, loadText, initialUrl = null } = props;
  const [url, setUrl] = useState(initialUrl ?? "");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  // The page the Save to Garnish bookmark sent, kept so Back from the review can read it again.
  const [sent, setSent] = useState<SentPage | null>(null);
  // The address a failed read was of, when the reader went on to paste it instead: the paste's source.
  const [pasteFrom, setPasteFrom] = useState<string | null>(null);
  const [imported, setImported] = useState<ImportedRecipe | null>(null);
  const [rows, setRows] = useState<IngredientReview[]>([]);
  // Which step of the row's part owns the row, and the nested recipes the rows
  // stand for; only a Tandoor export knows either.
  const [rowSteps, setRowSteps] = useState<number[] | null>(null);
  const [subRecipes, setSubRecipes] = useState<string[]>([]);
  const [duplicate, setDuplicate] = useState<{ name: string; slug: string } | null>(null);
  // How the duplicate was found, fixed when the read starts: a page by its address, a paste or an upload by its name.
  const [duplicateBy, setDuplicateBy] = useState<DuplicateBy>("url");
  const [busy, setBusy] = useState(false);
  // Whether the model is sorting the read into parts; the source stage holds until it lands or is skipped.
  const [sorting, setSorting] = useState(false);
  // The line Check shows when the sort did not land.
  const [sortNote, setSortNote] = useState<string | null>(null);
  // Skip's way into a sort in flight: resolving it ends the wait on the rules' reading.
  const skipSort = useRef<(() => void) | null>(null);
  // Which read is current: a read that is left (Back, a new address) must not land later.
  const readToken = useRef(0);
  const [error, setError] = useState<string | null>(null);
  // The tags ticked on the review, held against the import they were ticked
  // on: a new import (a model's answer, another recipe out of a backup) starts
  // again from its own suggestions rather than carrying the last one's ticks.
  const [picked, setPicked] = useState<{ on: ImportedRecipe; names: string[] } | null>(null);
  const suggestions = useMemo(
    () =>
      imported === null
        ? null
        : tagSuggestions(imported.recipe.tags, imported.recipe.name, tags ?? [], imported.from === "mealie" || imported.from === "tandoor"),
    [imported, tags]
  );
  const chosenTags = imported !== null && picked?.on === imported ? picked.names : suggestions === null ? [] : tickedTags(suggestions);
  const setChosenTags = (names: string[]) => {
    if (imported !== null) setPicked({ on: imported, names });
  };

  // Read at call time rather than closed over: an address typed on the chooser
  // is read in the same press that sets it, before a render has caught up.
  const urlRef = useRef(url);
  urlRef.current = url;
  const reader: ModelReader = (pageText, anchor) =>
    loadText ? loadText(pageText, anchor) : importFromText({ data: { text: pageText, sourceUrl: urlRef.current, anchor } });

  const fetchFoods = loadFoods ?? (() => listFoods({ data: {} }));

  /** A page or a paste onto the review, with the vocabulary it was reviewed against. */
  const showReview = (found: ImportedRecipe, foods: readonly FoodRow[]) => {
    setImported(found);
    setRows(reviewRows(review.ingredientLines(found.recipe), { units, foods }));
    setRowSteps(null);
    setSubRecipes([]);
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
   * its sort into parts (decisions.md row 203). Skip ends the wait on the
   * rules' result; a sort that fails or is rejected ends it there too, with
   * the note.
   */
  const readPageAt = async (address: string, fetchPage: () => Promise<ImportedRecipe>) => {
    setUrl(address);
    urlRef.current = address;
    const token = ++readToken.current;
    setBusy(true);
    setError(null);
    setSortNote(null);
    try {
      const [found, foods] = await Promise.all([fetchPage(), fetchFoods()]);
      if (token !== readToken.current) return;
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
      showReview(shown, foods);
      setSortNote(note);
      setDuplicateBy("url");
      setDuplicate(findDuplicate ? await findDuplicate(found.url) : null);
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
   * Pasted text through `claude -p`, onto the same review. A failed
   * read — no binary, a timeout, an answer that was not a recipe — is shown
   * here and nothing is written, which is true of every rung above it too.
   */
  const readText = async () => {
    setBusy(true);
    setError(null);
    try {
      const [found, foods] = await Promise.all([loadText ? loadText(text) : importFromText({ data: { text, sourceUrl: pasteFrom ?? "" } }), fetchFoods()]);
      showReview(found, foods);
      setDuplicateBy("name");
      setDuplicate(findDuplicateByName ? await findDuplicateByName(found.recipe.name) : null);
    } catch (cause) {
      setError(messageFrom(cause));
    } finally {
      setBusy(false);
    }
  };

  /** One recipe out of an upload, onto the same review the URL import uses. */
  const chooseUploaded = async (recipe: FileRecipe, foods: readonly FoodRow[]) => {
    const reviewed = reviewOfUpload(recipe, units, foods);
    setImported(reviewed.imported);
    setRows(reviewed.rows);
    setRowSteps(reviewed.rowSteps);
    setSubRecipes(reviewed.subRecipeNames);
    setDuplicateBy("name");
    setDuplicate(findDuplicateByName ? await findDuplicateByName(recipe.name) : null);
  };

  const readFile = async () => {
    if (file === null) return;
    setBusy(true);
    setError(null);
    try {
      const [found, foods] = await Promise.all([(loadFile ?? postImportFile)(file), fetchFoods()]);
      if (found.length === 0) throw new Error("No recipe in that file");
      // A whole export is moving house, not adding a recipe (decisions.md row 201).
      if (found.length > 1) throw new Error(`That file holds ${found.length} recipes. Bring a whole export in from Settings › Backup.`);
      await chooseUploaded(found[0]!, foods);
    } catch (cause) {
      setError(messageFrom(cause));
    } finally {
      setBusy(false);
    }
  };

  /** Create only what the reviewer approved, then hand the draft up. */
  const create = async () => {
    if (imported === null) return;
    setBusy(true);
    setError(null);
    try {
      // Only the tags ticked on the review go on: a new one is made only when it was ticked.
      const withTags = { ...imported, recipe: { ...imported.recipe, tags: chosenTags } };
      const draft = await draftFromReview({ imported: withTags, rows, rowSteps, subRecipes, tags, linkSubRecipeFood });
      onDraft(draft, imported.recipe.image);
    } catch (cause) {
      setBusy(false);
      setError(messageFrom(cause));
    }
  };

  /** Back from the review to the source it came from. */
  const leaveReview = () => {
    setImported(null);
    setRowSteps(null);
    setSubRecipes([]);
    setDuplicate(null);
    setError(null);
    setSortNote(null);
  };

  /** Back from any source stage to the chooser. */
  const leaveSource = () => {
    // A read still running is let go: it must not open Check after Back.
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
    imported,
    rows,
    busy,
    error,
    duplicate,
    suggestions,
    chosenTags,
    setChosenTags,
    duplicateBy,
    sorting,
    sortNote,
    skip,
    setUrl,
    setRows,
    changeText,
    changeFile,
    read,
    readSent,
    readText,
    readFile,
    create,
    leaveReview,
    leaveSource,
    pasteInstead,
  };
}
