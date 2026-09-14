// Pure helpers of the image store, and storeImage against a temp directory.
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, test } from "vitest";
import { imageContentType, imageFileName, imagesDir, sniffImage, storeImage } from "../../../src/server/api/images";

const id = "11111111-1111-4111-8111-111111111111";
const ascii = (s: string) => Uint8Array.from(s, (c) => c.charCodeAt(0));
const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const jpg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 16]);
const webp = Uint8Array.from([...ascii("RIFF"), 0, 0, 0, 0, ...ascii("WEBPVP8 ")]);

test.each([
  ["png", png, "png"],
  ["jpeg", jpg, "jpg"],
  ["gif87a", ascii("GIF87a...."), "gif"],
  ["gif89a", ascii("GIF89a...."), "gif"],
  ["webp", webp, "webp"],
  ["riff without webp", Uint8Array.from([...ascii("RIFF"), 0, 0, 0, 0, ...ascii("WAVEfmt ")]), null],
  ["svg", ascii("<svg xmlns='http://www.w3.org/2000/svg'/>"), null],
  ["pdf", ascii("%PDF-1.4"), null],
  ["truncated png signature", png.slice(0, 4), null],
  ["empty", new Uint8Array(), null],
])("sniffImage: %s", (_label, bytes, expected) => {
  expect(sniffImage(bytes)).toBe(expected);
});

test.each([
  [`${id}.png`, "image/png"],
  [`${id}.jpg`, "image/jpeg"],
  [`${id}.webp`, "image/webp"],
  [`${id}.GIF`, "image/gif"],
  [`${id}.svg`, null],
  [`${id}`, null],
  [`../${id}.png`, null],
  [`..%2F${id}.png`, null],
  [`images/${id}.png`, null],
  [`..`, null],
  [`garnish.db`, null],
  ["", null],
])("imageContentType(%j) -> %j", (file, expected) => {
  expect(imageContentType(file)).toBe(expected);
});

test("imageFileName and imagesDir", () => {
  expect(imageFileName(id, "webp")).toBe(`${id}.webp`);
  expect(imagesDir("/srv/garnish")).toBe("/srv/garnish/images");
  process.env.DATA_DIR = "/srv/other";
  expect(imagesDir()).toBe("/srv/other/images");
  delete process.env.DATA_DIR;
});

let dir: string;
beforeEach(() => {
  dir = join(mkdtempSync(join(tmpdir(), "garnish-images-")), "images");
});
afterEach(() => rmSync(join(dir, ".."), { recursive: true, force: true }));

test("storeImage creates the directory, writes the bytes and removes the recipe's old file", async () => {
  expect(existsSync(dir)).toBe(false);
  const first = await storeImage(id, "png", png, dir);
  expect(first).toBe(`${id}.png`);
  expect(new Uint8Array(await Bun.file(join(dir, first)).arrayBuffer())).toEqual(png);

  const other = "22222222-2222-4222-8222-222222222222";
  await storeImage(other, "png", png, dir);

  const second = await storeImage(id, "jpg", jpg, dir);
  expect(second).toBe(`${id}.jpg`);
  expect(readdirSync(dir).sort()).toEqual([`${id}.jpg`, `${other}.png`]);
  expect(new Uint8Array(await Bun.file(join(dir, second)).arrayBuffer())).toEqual(jpg);
});

test("storeImage with the same extension overwrites in place", async () => {
  await storeImage(id, "png", png, dir);
  const bigger = Uint8Array.from([...png, 9, 9, 9]);
  await storeImage(id, "png", bigger, dir);
  expect(readdirSync(dir)).toEqual([`${id}.png`]);
  expect(new Uint8Array(await Bun.file(join(dir, `${id}.png`)).arrayBuffer())).toEqual(bigger);
});
