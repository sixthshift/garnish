import { createServerFn } from "@tanstack/react-start";
import { aiStatus, checkConnection } from "../ai/check";
import { aiConfigured } from "../ai/client";
import { notFoundMiddleware } from "../core/fn";

/**
 * Whether a model is configured: the one gate for every feature that asks one —
 * the import's paste and Style stage, the restyle, the planner's Propose. One
 * key is the whole of the setup. Read on the server every time rather than
 * cached: giving the container a key should not need the app restarted.
 */
export const aiAvailable = createServerFn({ method: "GET" })
  .middleware([notFoundMiddleware])
  .handler(() => ({ available: aiConfigured() }));

/** The AI tab's configuration: which provider and models, and whether a key is set — never the key. Read each time, as `aiAvailable` is. */
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
