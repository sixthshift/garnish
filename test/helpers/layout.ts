// The DOM tests' window is a phone's (390 wide, vite.config.ts), so a part
// drawn per layout draws the phone's. A test of a desktop's resizes it here,
// and puts the window back after, as the boot script would on a real screen.
import { afterEach, beforeEach } from "vitest";

type HappyWindow = Window & { happyDOM: { setWindowSize(size: { width: number; height: number }): void } };

/** Resize the window to `width` and set `<html data-layout>` to match, as the boot script does. */
export function resizeTo(width: number, height = width >= 1024 ? 900 : 844): void {
  (window as unknown as HappyWindow).happyDOM.setWindowSize({ width, height });
  document.documentElement.dataset.layout = width >= 1024 ? "desktop" : "mobile";
}

/** Every test in the calling file runs at a desktop's size (1440 × 900), and the phone's is put back after each. */
export function atDesktop(): void {
  beforeEach(() => resizeTo(1440));
  afterEach(() => resizeTo(390));
}
