import type { Register } from "@tanstack/react-router";
import type { RequestHandler } from "@tanstack/react-start/server";
import { createStartHandler, defaultStreamHandler } from "@tanstack/react-start/server";
import { boot } from "./server/core/boot";
import { getDb } from "./server/core/db";

boot();
// Open, migrate and seed before the first request; a broken volume fails the start, not a user.
await getDb();

const fetch: RequestHandler<Register> = createStartHandler(defaultStreamHandler);

export default { fetch };
