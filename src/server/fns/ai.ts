import { createServerFn } from "@tanstack/react-start";
import ai from "../ai/provider";
import { notFoundMiddleware } from "../core/fn";

/**
 * Whether a model is configured: the one gate for every feature that asks one —
 * the import's paste and Style stage, the restyle, the planner's Propose. One
 * key is the whole of the setup. Read on the server every time rather than
 * cached: giving the container a key should not need the app restarted.
 */
export const aiAvailable = createServerFn({ method: "GET" })
  .middleware([notFoundMiddleware])
  .handler(() => ({ available: ai.configured() }));

/** The AI tab's configuration: which provider and models, and whether a key is set — never the key. Read each time, as `aiAvailable` is. */
export const getAiStatus = createServerFn({ method: "GET" })
  .middleware([notFoundMiddleware])
  .handler(() => ai.status());

/**
 * Settings' "Test connection": the provider's model list, not a completion, so
 * pressing it costs no tokens (the provider's `check`, src/server/ai/provider/api.ts).
 */
export const testAiConnection = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .handler(() => ai.check());
