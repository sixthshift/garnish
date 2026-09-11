// Stand-in for the Lighthouse "installable" audit: the requirements Chrome
// checks before offering an install prompt, read straight from public/.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

const root = resolve(import.meta.dirname, "../..");
const pub = (p: string) => resolve(root, "public", p.replace(/^\//, ""));

type Icon = { src: string; sizes: string; type?: string; purpose?: string };
type Manifest = {
  name?: string;
  short_name?: string;
  start_url?: string;
  scope?: string;
  display?: string;
  theme_color?: string;
  background_color?: string;
  icons: Icon[];
};

const manifest = JSON.parse(readFileSync(pub("manifest.webmanifest"), "utf8")) as Manifest;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Width and height from a PNG's IHDR chunk, which always follows the signature. */
export function pngDimensions(bytes: Buffer): { width: number; height: number } {
  expect(bytes.subarray(0, 8).equals(PNG_SIGNATURE)).toBe(true);
  expect(bytes.subarray(12, 16).toString("ascii")).toBe("IHDR");
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

const sizeOf = (icon: Icon) => Number(icon.sizes.split("x")[0]);
const pngIcons = manifest.icons.filter((icon) => icon.type === "image/png");

describe("manifest installability", () => {
  test("has a name", () => {
    expect(manifest.name || manifest.short_name).toBeTruthy();
    expect(manifest.short_name).toBe("garnish");
  });

  test("start_url, scope and standalone display", () => {
    expect(manifest.start_url).toBe("/");
    expect(manifest.scope).toBe("/");
    expect(["standalone", "fullscreen", "minimal-ui"]).toContain(manifest.display);
  });

  test("colours are literal hex matching the light tokens", () => {
    expect(manifest.theme_color).toBe("#2c666c"); // --bg-brand light (emerald-600)
    expect(manifest.background_color).toBe("#fefcfb"); // --bg-normal light (earth-50)
  });

  test("has PNG icons of at least 192 and 512 plus a maskable one", () => {
    const any = pngIcons.filter((icon) => !icon.purpose || icon.purpose.includes("any"));
    expect(any.some((icon) => sizeOf(icon) >= 192)).toBe(true);
    expect(any.some((icon) => sizeOf(icon) >= 512)).toBe(true);
    expect(pngIcons.some((icon) => icon.purpose?.includes("maskable") && sizeOf(icon) >= 512)).toBe(true);
  });

  test("every PNG icon exists, is a PNG, and matches its declared size", () => {
    for (const icon of pngIcons) {
      const size = sizeOf(icon);
      expect(icon.sizes).toBe(`${size}x${size}`);
      const dims = pngDimensions(readFileSync(pub(icon.src)));
      expect(dims, icon.src).toEqual({ width: size, height: size });
    }
  });

  test("SVG icon exists and is listed with sizes any", () => {
    const svg = manifest.icons.find((icon) => icon.type === "image/svg+xml");
    expect(svg?.sizes).toBe("any");
    expect(readFileSync(pub(svg!.src), "utf8")).toContain("<svg");
  });

  test("apple-touch-icon is a 180px PNG", () => {
    expect(pngDimensions(readFileSync(pub("apple-touch-icon.png")))).toEqual({ width: 180, height: 180 });
  });
});

describe("root document head", () => {
  const source = readFileSync(resolve(root, "src/routes/__root.tsx"), "utf8");

  test("links the manifest and apple touch icon", () => {
    expect(source).toMatch(/rel:\s*"manifest",\s*href:\s*"\/manifest\.webmanifest"/);
    expect(source).toMatch(/rel:\s*"apple-touch-icon",\s*href:\s*"\/apple-touch-icon\.png"/);
  });

  test("declares theme-color for light and dark and the iOS standalone metas", () => {
    // Rendered in RootDocument rather than head(): HeadContent dedupes meta by name.
    expect(source).toMatch(/<meta name="theme-color" content=\{themeColorLight\} media="\(prefers-color-scheme: light\)"/);
    expect(source).toMatch(/<meta name="theme-color" content=\{themeColorDark\} media="\(prefers-color-scheme: dark\)"/);
    expect(source).toContain('name: "apple-mobile-web-app-capable", content: "yes"');
    expect(source).toContain('name: "apple-mobile-web-app-status-bar-style"');
  });
});
