// Test-only server functions exercising the scaffold. Not part of the app.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { units } from "../../src/db/models/unit/repo";
import { getDb } from "../../src/server/core/db";
import { NotFound } from "../../src/server/core/errors";
import { notFoundMiddleware } from "../../src/server/core/fn";

/** Reads through getDb(): proves the temp DATA_DIR wiring end to end. */
export const unitCount = createServerFn()
  .middleware([notFoundMiddleware])
  .handler(async () => ({ count: units(await getDb()).list().length }));

export const FindInput = z.object({ id: z.string() });

/** Always misses, so the NotFound mapping can be observed. */
export const findThing = createServerFn()
  .middleware([notFoundMiddleware])
  .validator(FindInput)
  .handler(({ data }): never => {
    throw new NotFound("thing", data.id);
  });

/** Throws something that is not a NotFound; must pass through untouched. */
export const explode = createServerFn()
  .middleware([notFoundMiddleware])
  .handler((): never => {
    throw new RangeError("boom");
  });
