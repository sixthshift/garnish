// The domain's Importer given the server's ports: fetch.ts for pages, render.ts for the ones a fetch cannot get, the server's AI client for the model.

import { ImportError, Importer, type Ports } from "../../domain/recipes/import";
import { type AiClient, AiError, type Fetcher } from "../ai/client";
import serverAi from "../ai/provider";
import { createPageFetcher } from "./fetch";
import { createPageRenderer, findChromium } from "./render";

/** The model port over an AI client: whatever the importer asks, in whatever shape it asks for, of the import's model. */
export function createModelPort(ai: AiClient = serverAi): Ports["model"] {
  return async ({ prompt, schema, schemaName, timeoutMs }) => {
    // No model is the app working without one, not a failure to record (decisions.md row 203): a
    // pasted page's HTML is read by the rules, which is what the importer falls back to.
    if (!ai.configured()) throw new ImportError("unavailable", "No model is configured.");
    try {
      return await ai.ask({ prompt, schema, schemaName, model: ai.model("import"), timeoutMs });
    } catch (cause) {
      if (cause instanceof AiError) throw new ImportError(cause.kind, cause.message);
      throw cause;
    }
  };
}

/**
 * An importer over the platform's `fetch` and the server's AI client — or
 * injected ones, so the whole path can be driven without a network. No
 * browser unless one is given: a test's fake fetch must not end in a real
 * Chromium.
 */
export function createImporter(fetcher: Fetcher = fetch, ai: AiClient = serverAi, renderPage?: Ports["renderPage"]): Importer {
  return new Importer({ fetchPage: createPageFetcher(fetcher), renderPage, model: createModelPort(ai) });
}

/** The browser this server renders with, when it has one (decisions.md row 202). */
function serverRenderer(): Ports["renderPage"] {
  const chromium = findChromium();
  return chromium === null ? undefined : createPageRenderer(chromium);
}

/** The importer the server functions and the upload route use. */
export const importer = createImporter(fetch, serverAi, serverRenderer());
