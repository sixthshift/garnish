// FavouriteButton: the pure optimistic toggle and the rendered markup's
// pressed state. `toggleFavourite` is also exercised against the real
// `setFavourite` server function, so the toggle is proven to round-trip
// through it, not just through a mock.
import { renderToString } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import { FavouriteButton, toggleFavourite } from "../../../src/components/ui/FavouriteButton";
import { recipeInputSchema } from "../../../src/domain/recipe";
import { createRecipe, getRecipe, setFavourite } from "../../../src/server/fns/recipes";
import { callServerFn, useTempDataDir } from "../../helpers/server";

const id = "11111111-1111-4111-8111-111111111111";

describe("toggleFavourite", () => {
  test("flips the flag and reports no error once the write resolves", async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    const result = await toggleFavourite("r1", false, write);
    expect(result).toEqual({ favourite: true });
    expect(write).toHaveBeenCalledWith("r1", true);
  });

  test("reverts to the current value and surfaces the error when the write rejects", async () => {
    const error = new Error("offline");
    const write = vi.fn().mockRejectedValue(error);
    const result = await toggleFavourite("r1", true, write);
    expect(result).toEqual({ favourite: true, error });
  });
});

describe("toggleFavourite against the real server function", () => {
  useTempDataDir();

  test("round-trips through setFavourite: the stored flag flips both ways", async () => {
    const created = await callServerFn(createRecipe, recipeInputSchema.parse({ name: "Toast", parts: [{ name: "", ingredients: [], steps: [] }] }));

    const write = (recipeId: string, favourite: boolean) => callServerFn(setFavourite, { id: recipeId, favourite });

    const on = await toggleFavourite(created.id, false, write);
    expect(on).toEqual({ favourite: true });
    expect((await callServerFn(getRecipe, { slug: created.slug })).favourite).toBe(true);

    const off = await toggleFavourite(created.id, true, write);
    expect(off).toEqual({ favourite: false });
    expect((await callServerFn(getRecipe, { slug: created.slug })).favourite).toBe(false);
  });
});

describe("FavouriteButton render", () => {
  test("reflects favourite: true", () => {
    const html = renderToString(<FavouriteButton id={id} favourite={true} />);
    expect(html).toMatch(/aria-label="Remove from favourites"/);
    expect(html).toMatch(/aria-pressed="true"/);
  });

  test("reflects favourite: false", () => {
    const html = renderToString(<FavouriteButton id={id} favourite={false} />);
    expect(html).toMatch(/aria-label="Add to favourites"/);
    expect(html).toMatch(/aria-pressed="false"/);
  });

  test("is hidden from print and takes the caller's className", () => {
    const html = renderToString(<FavouriteButton id={id} favourite={false} className="absolute right-2 top-2" />);
    expect(html).toMatch(/data-print="hide"/);
    expect(html).toContain("absolute right-2 top-2");
  });
});
