// The domain's Importer given the server's two ports: fetch.ts for pages, the server's AI client for the model.

import { ImportError, Importer, type Ports } from "../../domain/import";
import { type AiClient, AiError, type Fetcher } from "../ai/client";
import serverAi from "../ai/provider";
import { createPageFetcher } from "./fetch";

/** The model port over an AI client: whatever the importer asks, in whatever shape it asks for, of the import's model. */
export function createModelPort(ai: AiClient = serverAi): Ports["model"] {
  return async ({ prompt, schema, schemaName, timeoutMs }) => {
    try {
      return await ai.ask({ prompt, schema, schemaName, model: ai.model("import"), timeoutMs });
    } catch (cause) {
      if (cause instanceof AiError) throw new ImportError(cause.kind, cause.message);
      throw cause;
    }
  };
}

/** An importer over the platform's `fetch` and the server's AI client — or injected ones, so the whole path can be driven without a network. */
export function createImporter(fetcher: Fetcher = fetch, ai: AiClient = serverAi): Importer {
  return new Importer({ fetchPage: createPageFetcher(fetcher), model: createModelPort(ai) });
}

/** The importer the server functions and the upload route use. */
export const importer = createImporter();
