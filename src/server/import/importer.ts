// The one real importer: the domain's `Importer` given the server's two ports.
// The page fetch is `fetch.ts` with its browser profiles; the model is the
// shared OpenAI-compatible client asked whatever the importer asks, its failures
// mapped onto the importer's own error kinds so the screen shows the import's
// words rather than the provider's class.
import { AiError, createFetchRunner, type Fetcher } from "../ai/client";
import { ImportError, Importer, type Ports } from "../../domain/import";
import { createPageFetcher } from "./fetch";

/** The model port over the shared client: whatever the importer asks, in whatever shape it asks for. */
export function createModelPort(fetcher: Fetcher = fetch): Ports["model"] {
  return async ({ prompt, schema, schemaName, timeoutMs }) => {
    try {
      return await createFetchRunner(fetcher, { schema, schemaName })(prompt, timeoutMs);
    } catch (cause) {
      if (cause instanceof AiError) throw new ImportError(cause.kind, cause.message);
      throw cause;
    }
  };
}

/** An importer over the platform's `fetch` — or an injected one, so the whole path can be driven without a network. */
export function createImporter(fetcher: Fetcher = fetch): Importer {
  return new Importer({ fetchPage: createPageFetcher(fetcher), model: createModelPort(fetcher) });
}

/** The importer the server functions and the upload route use. */
export const importer = createImporter();
