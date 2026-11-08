import { describe, expect, test } from "vitest";
import {
  base64ToBytes,
  type Fetcher,
  fetchedImageFile,
  IMAGE_FIELD,
  recipeImageUploadUrl,
  recipeImageUrl,
  stepImageUploadUrl,
  stepImageUrl,
  timelineImageUploadUrl,
  timelineImageUrl,
  uploadRecipeImage,
  uploadStepImage,
  uploadTimelineImage,
} from "../../src/lib/images";

// The three kinds of image share one shape: a URL that serves the stored file, an upload route, and a POST to it.
const kinds = [
  {
    kind: "recipe",
    url: recipeImageUrl,
    served: "/api/images/",
    uploadUrl: recipeImageUploadUrl("abc-1"),
    routeUrl: "/api/recipes/abc-1/image",
    upload: (file: File, fetcher: Fetcher) => uploadRecipeImage("abc", file, fetcher),
    posted: "/api/recipes/abc/image",
    what: "image",
  },
  {
    kind: "timeline",
    url: timelineImageUrl,
    served: "/api/images/timeline/",
    uploadUrl: timelineImageUploadUrl("abc-1"),
    routeUrl: "/api/timeline/abc-1/image",
    upload: (file: File, fetcher: Fetcher) => uploadTimelineImage("abc", file, fetcher),
    posted: "/api/timeline/abc/image",
    what: "photo",
  },
  {
    kind: "step",
    url: stepImageUrl,
    served: "/api/images/steps/",
    uploadUrl: stepImageUploadUrl("r-1", "abc-1"),
    routeUrl: "/api/recipes/r-1/steps/abc-1/image",
    upload: (file: File, fetcher: Fetcher) => uploadStepImage("r", "abc", file, fetcher),
    posted: "/api/recipes/r/steps/abc/image",
    what: "photo",
  },
] as const;

describe.each(kinds)("a $kind image", ({ url, served, uploadUrl, routeUrl, upload, posted, what }) => {
  const file = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "tart.png", { type: "image/png" });

  test("maps a stored file name onto its image route, escaping anything not URL-safe", () => {
    expect(url("0f3b-1.jpg")).toBe(`${served}0f3b-1.jpg`);
    expect(url("a b/../c.png")).toBe(`${served}a%20b%2F..%2Fc.png`);
  });

  test("null, undefined and empty give no URL", () => {
    expect(url(null)).toBeNull();
    expect(url(undefined)).toBeNull();
    expect(url("")).toBeNull();
  });

  test("its upload targets its own route", () => {
    expect(uploadUrl).toBe(routeUrl);
  });

  test("posts the file in the image field and returns the stored name", async () => {
    const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
    const fetcher: Fetcher = async (at, init) => {
      calls.push({ url: at, init });
      return Response.json({ image: "abc.png" });
    };
    await expect(upload(file, fetcher)).resolves.toBe("abc.png");
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe(posted);
    expect(calls[0]!.init?.method).toBe("POST");
    expect((calls[0]!.init?.body as FormData).get(IMAGE_FIELD)).toBeInstanceOf(File);
  });

  test("rejects with the server's error text, the status when the body is not JSON, and a missing file name", async () => {
    await expect(upload(file, async () => Response.json({ error: "not a png, jpeg, webp or gif image" }, { status: 400 }))).rejects.toThrow(
      "not a png, jpeg, webp or gif image"
    );
    await expect(upload(file, async () => new Response("nope", { status: 500 }))).rejects.toThrow(`${what} upload failed (500)`);
    await expect(upload(file, async () => Response.json({}))).rejects.toThrow("no file name");
  });
});

describe("base64ToBytes and fetchedImageFile", () => {
  const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
  const base64 = Buffer.from(png).toString("base64");

  test("decodes base64 to the original bytes", () => {
    expect(base64ToBytes(base64)).toEqual(png);
    expect(base64ToBytes("")).toEqual(new Uint8Array());
  });

  test("rebuilds a fetched image as a File the upload can post", async () => {
    const file = fetchedImageFile({ base64, contentType: "image/png", name: "tart.png" });
    expect(file.name).toBe("tart.png");
    expect(file.type).toBe("image/png");
    expect(file.size).toBe(png.length);
    expect(new Uint8Array(await file.arrayBuffer())).toEqual(png);
  });
});
