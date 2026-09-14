// The reference server function: the shape every other one in this directory follows.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { notFoundMiddleware } from "../core/fn";

export const PingInput = z.object({ echo: z.string().min(1) });

export const ping = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .validator(PingInput)
  .handler(({ data }) => ({ ok: true as const, echo: data.echo }));
