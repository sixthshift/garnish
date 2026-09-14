// The importer: one object that turns whatever a source hands over into an
// `ImportedRecipe`. The caller says what it has — an address, a paste, a
// file — and the importer chooses the sequence:
//
//   url   fetch the page, then `extractRecipe` over it: the schema.org rung,
//         then the OpenGraph stub. The model is not run here, so the review
//         can show the rules' result at once and ask for the read separately.
//   text  prose goes to the model. A paste that is a page's own source
//         (M36.7) takes the page road first, exactly as a fetched page does,
//         and the model then reads the page's text with the JSON-LD as its
//         anchor (M36.4) and the answer checked against it (M36.5). A page the
//         review already holds comes back the same way: its text and its
//         anchor, and the importer neither knows nor cares that it fetched
//         that page a moment ago.
//   file  another app's export, Mealie's or Tandoor's, told apart by shape.
//
// Three rules hold it in place:
//
//   nothing is written    the result lands on the same M17.5 review whatever
//                         the source. The importer proposes; the household
//                         approves.
//   nothing is trusted    a model's answer is parsed through the recipe
//                         schema like any other untrusted input. A malformed
//                         answer is an `ImportError`, never a recipe.
//   nothing is touched    the importer does no IO of its own. The page fetch
//                         and the model call are ports it is given, so the
//                         whole sequence runs in a test with two fakes.
import { checkAgainstAnchor } from "./check";
import { ImportError } from "./errors";
import { extractRecipe } from "./extract";
import { aiPrompt, anchorJson, MAX_AI_TEXT, parseAiAnswer } from "./model";
import { looksLikeHtml, readableText } from "./page/text";
import type { ImportedRecipe } from "./result";
import type { ScrapedRecipe } from "./scraped";
import { type FileRecipe, readExport } from "./sources/tandoor";
import type { ImportFile } from "./sources/mealie";

/** How much of a page is worth reading. Structured data is near the top; a page this big is not a recipe. */
export const MAX_PAGE_BYTES = 5_000_000;

/** How long a model read is given before it is abandoned. A recipe answers in seconds; a minute is the outer bound. */
export const READ_TIMEOUT_MS = 60_000;

/** What a page fetch hands back: the status, the address after redirects, and the body. */
export type PageResponse = { status: number; url: string; bytes: Uint8Array };

/**
 * What the importer needs from the world, and all it may touch.
 *
 * `fetchPage` GETs an address and answers with the status and body; it throws
 * when the host cannot be reached at all. How it gets past a bot wall is its
 * own business (`src/server/import/fetch.ts`).
 *
 * `model` asks a model for a recipe as JSON and answers with the message
 * content. A provider failure is an `ImportError` of the matching kind: no key
 * is `unavailable`, an abort is `timeout`, anything else is `failed`.
 */
export type Ports = {
  fetchPage: (url: URL) => Promise<PageResponse>;
  model: (prompt: string, timeoutMs: number) => Promise<string>;
};

/** What a caller has. The importer chooses what to do with it. */
export type Source =
  | { kind: "url"; url: string }
  | {
      kind: "text";
      text: string;
      /** The address the text came from, when it came from one; becomes the recipe's `sourceUrl`. */
      sourceUrl?: string;
      /** The rules' own reading of the same page, when there was one: the lines the model may only sort, never change. */
      anchor?: ScrapedRecipe | null;
    }
  | { kind: "file"; file: ImportFile };

/** The pasted text as an http(s) URL, or null for anything else. Pure. */
export function parsePageUrl(raw: string): URL | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  return url.protocol === "http:" || url.protocol === "https:" ? url : null;
}

export class Importer {
  constructor(private readonly ports: Ports) {}

  /** A recipe out of a web page: the rules' result, with the page's text for a later read. */
  import(source: { kind: "url"; url: string }): Promise<ImportedRecipe>;
  /** A recipe out of text: the model's read, anchored when the text is a page the rules already read. */
  import(source: { kind: "text"; text: string; sourceUrl?: string; anchor?: ScrapedRecipe | null }): Promise<ImportedRecipe>;
  /** The recipes in another app's export file. Many, because a backup holds a collection; the review picks one. */
  import(source: { kind: "file"; file: ImportFile }): Promise<FileRecipe[]>;
  async import(source: Source): Promise<ImportedRecipe | FileRecipe[]> {
    switch (source.kind) {
      case "url":
        return this.fromUrl(source.url);
      case "text":
        return this.read(source.text, { sourceUrl: source.sourceUrl ?? "", anchor: source.anchor ?? null });
      case "file":
        return readExport(source.file);
    }
  }

  /**
   * GET the page and read a recipe out of it. Throws with a message meant for
   * the import screen when the URL is not http(s), unreachable, an error
   * response, too large, or carries neither structured data nor OpenGraph
   * tags. A 403 that survives the fetch's own retries gets its own message:
   * this is a bot wall headers cannot pass, and the paste box is the way round
   * it.
   */
  private async fromUrl(raw: string): Promise<ImportedRecipe> {
    const url = parsePageUrl(raw);
    if (!url) throw new ImportError("failed", "Enter an http or https address");

    let page: PageResponse;
    try {
      page = await this.ports.fetchPage(url);
    } catch {
      throw new ImportError("failed", `Could not reach ${url.hostname}`);
    }
    if (page.status === 403) {
      throw new ImportError(
        "failed",
        `${url.hostname} is blocking automated requests. Try pasting the recipe text, or the page's HTML (view source, select all, copy), instead.`,
      );
    }
    if (page.status < 200 || page.status >= 300) throw new ImportError("failed", `${url.hostname} returned ${page.status}`);
    if (page.bytes.length === 0) throw new ImportError("failed", `${url.hostname} returned an empty page`);
    if (page.bytes.length > MAX_PAGE_BYTES) throw new ImportError("failed", "That page is too large to read");

    const found = extractRecipe(new TextDecoder().decode(page.bytes), page.url || url.href);
    if (found === null) throw new ImportError("failed", "No recipe data on that page. You can still start a blank recipe and type it in.");
    return found;
  }

  /**
   * Text in, the model's reading out. Prose goes straight to the model. A
   * paste that is a page's source takes the rules first, through the very
   * same `extractRecipe` a fetched page goes through, so someone who got past
   * a bot wall by copying view-source lands on exactly the result the fetch
   * would have given: the JSON-LD as the anchor, the readable text as what
   * the model sorts into parts, the check over the answer. A model failure on
   * that path is not fatal — the rules already produced a usable recipe, so it
   * is returned as it stands rather than thrown away with the error. That is
   * also what happens when no model is configured at all.
   */
  private async read(text: string, options: { sourceUrl: string; anchor: ScrapedRecipe | null }): Promise<ImportedRecipe> {
    const { sourceUrl, anchor } = options;
    const body = text.trim();
    if (body === "") throw new ImportError("failed", "Paste the recipe first.");

    // An anchor means the caller has already run the rules over this page and
    // is handing back its text (M36.6); only a bare paste can be markup.
    if (anchor === null && looksLikeHtml(body)) {
      const found = extractRecipe(body, sourceUrl);
      if (found !== null) {
        try {
          return await this.modelRead(found.pageText, {
            sourceUrl,
            anchor: found.from === "schema" ? found.recipe : null,
            pageText: found.pageText,
          });
        } catch (cause) {
          if (cause instanceof ImportError) return found;
          throw cause;
        }
      }
      // Markup the rules could make nothing of: the model still gets a fair go
      // at it, over the readable text rather than the tags.
      return await this.modelRead(readableText(body), { sourceUrl, anchor: null, pageText: "" });
    }

    return await this.modelRead(body, { sourceUrl, anchor, pageText: "" });
  }

  /**
   * One prompt, one answer, and — when the read was anchored — the check over
   * it. The same whether the text came from a paste, a page's readable text,
   * or the review handing back the text it already had.
   */
  private async modelRead(text: string, options: { sourceUrl: string; anchor: ScrapedRecipe | null; pageText: string }): Promise<ImportedRecipe> {
    const { sourceUrl, anchor, pageText } = options;
    // The cap is on what the request carries, not on the paste alone: an
    // anchored read sends the page's text and the page's JSON-LD together, and
    // it is the pair of them the model has to fit in.
    if (text.length + (anchor === null ? 0 : anchorJson(anchor).length) > MAX_AI_TEXT) {
      throw new ImportError("failed", "That is too much text to read in one go. Paste one recipe at a time.");
    }

    let content: string;
    try {
      content = await this.ports.model(aiPrompt({ text, anchor }), READ_TIMEOUT_MS);
    } catch (cause) {
      if (cause instanceof ImportError) throw cause;
      throw new ImportError("failed", `The model could not be reached: ${cause instanceof Error ? cause.message : String(cause)}`);
    }
    const answer = parseAiAnswer(content);
    if (anchor === null) return { from: "ai", url: sourceUrl, recipe: answer, pageText };

    // The anchored read is the model sorting known lines into parts (M36.5), so
    // the only question left is whether it did anything else. It did: the
    // structure goes and the page's own content stays, as `from: "schema"`, with
    // the answer kept under `rejected` so the review can still offer it.
    const check = checkAgainstAnchor(answer, anchor);
    if (check.ok) return { from: "ai", url: sourceUrl, recipe: answer, pageText, check };
    return { from: "schema", url: sourceUrl, recipe: anchor, pageText, check, rejected: answer };
  }
}
