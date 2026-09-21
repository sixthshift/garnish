// vite.config.ts inlines package.json's version as __GARNISH_VERSION__; this
// is the test that the inlining happens at all, since the fallback would pass
// every other assertion quietly.
import { expect, test } from "vitest";
import { VERSION } from "../../src/lib/version";

test("VERSION is the version in package.json, inlined at build time", async () => {
  const pkg = (await Bun.file(new URL("../../package.json", import.meta.url).pathname).json()) as { version: string };
  expect(VERSION).toBe(pkg.version);
});
