// Custom server entry: the default TanStack Start handler plus boot-time setup.
import { createStartHandler, defaultStreamHandler } from "@tanstack/react-start/server";
import type { RequestHandler } from "@tanstack/react-start/server";
import type { Register } from "@tanstack/react-router";
import { boot } from "./server/boot";

boot();

const fetch: RequestHandler<Register> = createStartHandler(defaultStreamHandler);

export default { fetch };
