import { createServerFn } from "@tanstack/react-start";
import { aiStatus, checkConnection } from "../ai/check";
import { notFoundMiddleware } from "../core/fn";

/** The AI tab's configuration: which provider and models, and whether a key is set — never the key. Read each time, as `aiImportAvailable` is. */
export const getAiStatus = createServerFn({ method: "GET" })
  .middleware([notFoundMiddleware])
  .handler(() => aiStatus());

/**
 * Settings' "Test connection": the provider's model list, not a completion, so
 * pressing it costs no tokens (src/server/ai/check.ts).
 */
export const testAiConnection = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .handler(() => checkConnection());
