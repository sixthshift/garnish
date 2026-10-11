// Start's instance: the middleware every request and every server function
// runs through. Imported on both sides; the middleware bodies are server-only
// and compiled out of the client (src/server/core/middleware.ts).
import { createStart } from "@tanstack/react-start";
import { recordApiFailures, recordFunctionFailures } from "./server/core/middleware";

export const startInstance = createStart(() => ({
  requestMiddleware: [recordApiFailures],
  functionMiddleware: [recordFunctionFailures],
}));
