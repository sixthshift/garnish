/// <reference types="@testing-library/jest-dom" />
// The DOM project's setup (vite.config.ts). The node project has none: a shim
// there would hide the very absence it exists to prove.
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import "@testing-library/jest-dom/vitest";

// Not in happy-dom, and the design system's primitives measure with it.
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Not in happy-dom either. ReorderList drags with pointer events and calls
// these on the handle; without them a drag test throws instead of dragging.
if (!Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
  Element.prototype.hasPointerCapture = () => false;
}

// Unimplemented in happy-dom; a component that scrolls a list into view should
// not fail a test about what it rendered.
Element.prototype.scrollIntoView = vi.fn();

afterEach(() => {
  cleanup();
});
