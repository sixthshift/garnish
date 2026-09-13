import { describe, expect, test } from "vitest";
import {
  type Fetcher,
  base64ToBytes,
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

describe("timelineImageUrl", () => {
  test("maps a stored file name onto the timeline image route", () => {
    expect(timelineImageUrl("0f3b-1.jpg")).toBe("/api/images/timeline/0f3b-1.jpg");
  });

  test("null, undefined and empty give no URL", () => {
    expect(timelineImageUrl(null)).toBeNull();
    expect(timelineImageUrl(undefined)).toBeNull();
    expect(timelineImageUrl("")).toBeNull();
  });

  test("escapes anything that is not URL-safe", () => {
    expect(timelineImageUrl("a b/../c.png")).toBe("/api/images/timeline/a%20b%2F..%2Fc.png");
  });
});

describe("timelineImageUploadUrl", () => {
  test("targets the event's photo route", () => {
    expect(timelineImageUploadUrl("abc-1")).toBe("/api/timeline/abc-1/image");
  });
});

describe("uploadTimelineImage", () => {
  const file = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "cook.png", { type: "image/png" });

  test("posts the file in the image field and returns the stored name", async () => {
    const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
    const fetcher: Fetcher = async (url, init) => {
      calls.push({ url, init });
      return Response.json({ image: "abc.png" });
    };
    await expect(uploadTimelineImage("abc", file, fetcher)).resolves.toBe("abc.png");
    expect(calls[0]!.url).toBe("/api/timeline/abc/image");
    expect(calls[0]!.init?.method).toBe("POST");
    expect((calls[0]!.init?.body as FormData).get(IMAGE_FIELD)).toBeInstanceOf(File);
  });

  test("rejects with the server's error text", async () => {
    const fetcher: Fetcher = async () => Response.json({ error: "not a png, jpeg, webp or gif image" }, { status: 400 });
    await expect(uploadTimelineImage("abc", file, fetcher)).rejects.toThrow("not a png, jpeg, webp or gif image");
  });

  test("rejects when the response carries no file name", async () => {
    const fetcher: Fetcher = async () => Response.json({});
    await expect(uploadTimelineImage("abc", file, fetcher)).rejects.toThrow("no file name");
  });
});

describe("stepImageUrl", () => {
  test("maps a stored file name onto the step image route", () => {
    expect(stepImageUrl("0f3b-1.jpg")).toBe("/api/images/steps/0f3b-1.jpg");
  });

  test("null, undefined and empty give no URL", () => {
    expect(stepImageUrl(null)).toBeNull();
    expect(stepImageUrl(undefined)).toBeNull();
    expect(stepImageUrl("")).toBeNull();
  });

  test("escapes anything that is not URL-safe", () => {
    expect(stepImageUrl("a b/../c.png")).toBe("/api/images/steps/a%20b%2F..%2Fc.png");
  });
});

describe("stepImageUploadUrl", () => {
  test("targets the step's photo route", () => {
    expect(stepImageUploadUrl("abc-1")).toBe("/api/steps/abc-1/image");
  });
});

describe("uploadStepImage", () => {
  const file = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "step.png", { type: "image/png" });

  test("posts the file in the image field and returns the stored name", async () => {
    const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
    const fetcher: Fetcher = async (url, init) => {
      calls.push({ url, init });
      return Response.json({ image: "abc.png" });
    };
    await expect(uploadStepImage("abc", file, fetcher)).resolves.toBe("abc.png");
    expect(calls[0]!.url).toBe("/api/steps/abc/image");
    expect(calls[0]!.init?.method).toBe("POST");
    expect((calls[0]!.init?.body as FormData).get(IMAGE_FIELD)).toBeInstanceOf(File);
  });

  test("rejects with the server's error text — a step the recipe never saved is a 404 there", async () => {
    const fetcher: Fetcher = async () => Response.json({ error: "step abc not found" }, { status: 404 });
    await expect(uploadStepImage("abc", file, fetcher)).rejects.toThrow("step abc not found");
  });

  test("rejects when the response carries no file name", async () => {
    const fetcher: Fetcher = async () => Response.json({});
    await expect(uploadStepImage("abc", file, fetcher)).rejects.toThrow("no file name");
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
