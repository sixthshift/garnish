// Fetching a recipe image from a pasted URL: the pure helpers, the fetch
// against a local fixture server, and the server function itself (M13.5).
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { MAX_IMAGE_BYTES } from "../../../src/server/api/images";
import { fetchImage, fetchImageBytes, fetchedImageName, parseImageUrl, toBase64 } from "../../../src/server/import/imageFetch";
import { callServerFn } from "../../helpers/server";

const ascii = (s: string) => Uint8Array.from(s, (c) => c.charCodeAt(0));
const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const gif = ascii("GIF89a-fixture");

describe("parseImageUrl", () => {
  test.each(["https://example.com/a.jpg", "http://192.168.1.4:8080/pic.png"])("accepts %s", (raw) => {
    expect(parseImageUrl(raw)?.href).toBe(new URL(raw).href);
  });

  test("trims surrounding whitespace", () => {
    expect(parseImageUrl("  https://example.com/a.jpg \n")?.pathname).toBe("/a.jpg");
  });

  test.each(["", "not a url", "/local/path.png", "file:///etc/passwd", "data:image/png;base64,AAA", "javascript:alert(1)"])("rejects %j", (raw) => {
    expect(parseImageUrl(raw)).toBeNull();
  });
});

describe("fetchedImageName", () => {
  test.each([
    ["https://example.com/photos/lemon-tart.jpeg", "png", "lemon-tart.png"],
    ["https://example.com/photos/lemon%20tart.jpg", "jpg", "lemon-tart.jpg"],
    ["https://example.com/", "webp", "image.webp"],
    ["https://example.com/a/b/", "gif", "b.gif"],
  ])("%s -> %s", (raw, ext, expected) => {
    expect(fetchedImageName(new URL(raw), ext as "png")).toBe(expected);
  });
});

test("toBase64 round-trips through Buffer", () => {
  expect(toBase64(png)).toBe(Buffer.from(png).toString("base64"));
  expect(Uint8Array.from(Buffer.from(toBase64(gif), "base64"))).toEqual(gif);
});

// A local fixture server, so the fetch under test is a real one over HTTP.
let base = "";
let server: { stop: (force?: boolean) => void } | undefined;

beforeAll(() => {
  const listener = Bun.serve({
    port: 0,
    fetch(request) {
      const { pathname } = new URL(request.url);
      if (pathname === "/tart.png") return new Response(png, { headers: { "content-type": "image/png" } });
      if (pathname === "/photo") return new Response(gif, { headers: { "content-type": "application/octet-stream" } });
      if (pathname === "/notes.txt") return new Response("just words", { headers: { "content-type": "text/plain" } });
      if (pathname === "/empty") return new Response(new Uint8Array());
      if (pathname === "/huge") return new Response(new Uint8Array(MAX_IMAGE_BYTES + 1));
      return new Response("nope", { status: 404 });
    },
  });
  server = listener;
  base = `http://127.0.0.1:${listener.port}`;
});

afterAll(() => server?.stop(true));

describe("fetchImageBytes", () => {
  test("returns the bytes, format and a file name for a local fixture URL", async () => {
    const fetched = await fetchImageBytes(`${base}/tart.png`);
    expect(fetched.ext).toBe("png");
    expect(fetched.contentType).toBe("image/png");
    expect(fetched.size).toBe(png.length);
    expect(fetched.name).toBe("tart.png");
    expect(Uint8Array.from(Buffer.from(fetched.base64, "base64"))).toEqual(png);
  });

  test("sniffs the format rather than trusting the URL or the content type", async () => {
    const fetched = await fetchImageBytes(`${base}/photo`);
    expect(fetched.ext).toBe("gif");
    expect(fetched.name).toBe("photo.gif");
  });

  test.each([
    ["not an image", "/notes.txt", "not a png, jpeg, webp or gif image"],
    ["empty body", "/empty", "empty file"],
    ["over the cap", "/huge", `file larger than ${MAX_IMAGE_BYTES} bytes`],
    ["an error response", "/missing", "The image could not be fetched (404)"],
  ])("rejects %s", async (_label, path, message) => {
    await expect(fetchImageBytes(`${base}${path}`)).rejects.toThrow(message);
  });

  test("rejects a URL that is not http(s) without fetching", async () => {
    let called = false;
    const fetcher = async () => {
      called = true;
      return new Response(png);
    };
    await expect(fetchImageBytes("file:///etc/passwd", fetcher)).rejects.toThrow("Enter an http or https image URL");
    expect(called).toBe(false);
  });

  test("rejects an unreachable host by name", async () => {
    const fetcher = () => Promise.reject(new Error("connect ECONNREFUSED"));
    await expect(fetchImageBytes("https://nowhere.invalid/a.png", fetcher)).rejects.toThrow("Could not reach nowhere.invalid");
  });
});

describe("fetchImage", () => {
  test("answers with the fetched image for a local fixture URL", async () => {
    const fetched = await callServerFn(fetchImage, { url: `${base}/tart.png` });
    expect(fetched).toMatchObject({ ext: "png", contentType: "image/png", name: "tart.png", size: png.length });
  });

  test("refuses a blank URL at the validator", async () => {
    await expect(callServerFn(fetchImage, { url: "   " })).rejects.toThrow();
  });

  test("surfaces the fetch failure", async () => {
    await expect(callServerFn(fetchImage, { url: `${base}/notes.txt` })).rejects.toThrow("not a png, jpeg, webp or gif image");
  });
});
