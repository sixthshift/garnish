// Fetching a recipe image from a pasted URL (M13.5). The browser cannot read
// most image hosts itself (CORS), and the editor already holds a chosen image
// as a `File` until the recipe has an id, so the server fetches the bytes and
// hands them back base64-encoded; the client rebuilds a File from them and the
// existing POST /api/recipes/:id/image path stores it.
//
// The checks are the upload route's, imported from ../domain/image rather than
// restated: same size cap, same magic-byte sniffing, so a URL can no more put
// an SVG or a PDF on disk than a file picker can.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { IMAGE_TYPES, MAX_IMAGE_BYTES, sniffImage, type ImageExtension } from "../domain/image";

/** What the server sends back for a fetched URL: enough to rebuild the file client-side. */
export type FetchedImage = {
  ext: ImageExtension;
  contentType: string;
  /** The image bytes, base64. */
  base64: string;
  /** Decoded length in bytes, so the client need not measure it. */
  size: number;
  /** A file name to give the rebuilt File; from the URL's last path segment. */
  name: string;
};

/** The pasted text as an http(s) URL, or null for anything else (file:, data:, javascript:, nonsense). Pure. */
export function parseImageUrl(raw: string): URL | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  return url;
}

/** A file name for the rebuilt File: the URL's last path segment under the sniffed extension, else "image". Pure. */
export function fetchedImageName(url: URL, ext: ImageExtension): string {
  const raw = url.pathname.split("/").filter(Boolean).pop() ?? "";
  let last = raw;
  try {
    last = decodeURIComponent(raw);
  } catch {
    // A malformed escape stays as it is; the sanitiser below handles it.
  }
  const stem = last.replace(/\.[^.]*$/, "").replace(/[^\w.-]+/g, "-").slice(0, 64);
  return `${stem === "" ? "image" : stem}.${ext}`;
}

/** Bytes as base64. Pure. */
export function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

/** The slice of `fetch` used here; injectable for tests. */
export type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

/**
 * GET the URL and return the image it holds. Throws with a message meant for
 * the editor when the URL is not http(s), unreachable, an error response,
 * empty, larger than the upload cap, or not a png/jpeg/webp/gif.
 */
export async function fetchImageBytes(raw: string, fetcher: Fetcher = fetch): Promise<FetchedImage> {
  const url = parseImageUrl(raw);
  if (!url) throw new Error("Enter an http or https image URL");

  let response: Response;
  try {
    response = await fetcher(url.href, { redirect: "follow" });
  } catch {
    throw new Error(`Could not reach ${url.hostname}`);
  }
  if (!response.ok) throw new Error(`The image could not be fetched (${response.status})`);

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length === 0) throw new Error("empty file");
  if (bytes.length > MAX_IMAGE_BYTES) throw new Error(`file larger than ${MAX_IMAGE_BYTES} bytes`);
  const ext = sniffImage(bytes);
  if (!ext) throw new Error("not a png, jpeg, webp or gif image");

  return { ext, contentType: IMAGE_TYPES[ext], base64: toBase64(bytes), size: bytes.length, name: fetchedImageName(url, ext) };
}

export const FetchImageInput = z.object({ url: z.string().trim().min(1) });

/** Fetch an image from a pasted URL. The bytes come back base64; nothing is written to disk here. */
export const fetchImage = createServerFn({ method: "POST" })
  .validator(FetchImageInput)
  .handler(async ({ data }) => fetchImageBytes(data.url));
