/**
 * Regenerates every file in public/icons, plus apple-touch-icon.png, from the
 * <LogoIcon> component — so the PNGs can never drift from the mark the app
 * renders. Run with `bun run icons` after changing src/components/Logo.tsx.
 *
 * Three shapes come out of one drawing:
 *   icon.svg, icon-192, icon-512   rounded, purpose "any"
 *   maskable-512                   full-bleed square; Android crops it to a
 *                                  circle of 80% width, which the mark clears
 *   apple-touch-icon               full-bleed square at 180; iOS rounds it
 *                                  itself, and a radius here would double up
 */
import { Resvg } from "@resvg/resvg-js";
import { renderToStaticMarkup } from "react-dom/server";
import { ICON_GROUND, ICON_MARK, LogoIcon } from "../src/components/shell/Logo";

const OUT = new URL("../public/", import.meta.url);

/** One 512 drawing, as standalone SVG source. */
function svg(cornerRadius: number, maskable = false): string {
  return renderToStaticMarkup(<LogoIcon size={512} ground={ICON_GROUND} mark={ICON_MARK} cornerRadius={cornerRadius} maskable={maskable} />);
}

function png(source: string, width: number): Buffer {
  return new Resvg(source, { fitTo: { mode: "width", value: width } }).render().asPng();
}

const rounded = svg(512 * 0.2);
const maskable = svg(0, true);
const appleTouch = svg(0);

const files: [string, Uint8Array | string][] = [
  ["icons/icon.svg", `${rounded}\n`],
  ["icons/icon-192.png", png(rounded, 192)],
  ["icons/icon-512.png", png(rounded, 512)],
  ["icons/maskable-512.png", png(maskable, 512)],
  ["apple-touch-icon.png", png(appleTouch, 180)],
];

for (const [name, data] of files) {
  const path = new URL(name, OUT);
  await Bun.write(path, data);
  const size = typeof data === "string" ? data.length : data.byteLength;
  console.log(`${name.padEnd(28)} ${size.toLocaleString()} bytes`);
}
