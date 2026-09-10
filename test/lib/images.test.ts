import { describe, expect, test } from "vitest";
import { type Fetcher, IMAGE_FIELD, recipeImageUploadUrl, recipeImageUrl, uploadRecipeImage } from "../../src/lib/images";

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

describe("recipeImageUploadUrl", () => {
  test("targets the recipe's image route", () => {
    expect(recipeImageUploadUrl("abc-1")).toBe("/api/recipes/abc-1/image");
  });
});

describe("uploadRecipeImage", () => {
  const file = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "tart.png", { type: "image/png" });

  test("posts the file in the image field and returns the stored name", async () => {
    const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
    const fetcher: Fetcher = async (url, init) => {
      calls.push({ url, init });
      return Response.json({ image: "abc.png" });
    };
    await expect(uploadRecipeImage("abc", file, fetcher)).resolves.toBe("abc.png");
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe("/api/recipes/abc/image");
    expect(calls[0]!.init?.method).toBe("POST");
    const body = calls[0]!.init?.body;
    expect(body).toBeInstanceOf(FormData);
    expect((body as FormData).get(IMAGE_FIELD)).toBeInstanceOf(Blob);
  });

  test("rejects with the server's error text on a failed response", async () => {
    const fetcher: Fetcher = async () => Response.json({ error: "not a png, jpeg, webp or gif image" }, { status: 400 });
    await expect(uploadRecipeImage("abc", file, fetcher)).rejects.toThrow("not a png, jpeg, webp or gif image");
  });

  test("falls back to the status when the error body is not JSON", async () => {
    const fetcher: Fetcher = async () => new Response("nope", { status: 500 });
    await expect(uploadRecipeImage("abc", file, fetcher)).rejects.toThrow("image upload failed (500)");
  });
});
