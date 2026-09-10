import { describe, expect, test } from "vitest";
import { recipeImageUrl } from "../../src/lib/images";

describe("recipeImageUrl", () => {
  test("maps a stored file name onto the image route", () => {
    expect(recipeImageUrl("0f3b-1.jpg")).toBe("/api/images/0f3b-1.jpg");
  });

  test("null, undefined and empty give no URL", () => {
    expect(recipeImageUrl(null)).toBeNull();
    expect(recipeImageUrl(undefined)).toBeNull();
    expect(recipeImageUrl("")).toBeNull();
  });

  test("escapes anything that is not URL-safe", () => {
    expect(recipeImageUrl("a b/../c.png")).toBe("/api/images/a%20b%2F..%2Fc.png");
  });
});
