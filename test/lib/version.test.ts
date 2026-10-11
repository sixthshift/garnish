// vite.config.ts inlines package.json's version as __GARNISH_VERSION__; this
// is the test that the inlining happens at all, since the fallback would pass
// every other assertion quietly.
import { expect, test } from "vitest";
import { buildLabel, COMMIT, VERSION } from "../../src/lib/version";

test("VERSION is the version in package.json, inlined at build time", async () => {
  const pkg = (await Bun.file(new URL("../../package.json", import.meta.url).pathname).json()) as { version: string };
  expect(VERSION).toBe(pkg.version);
});

test("COMMIT is the checkout's short commit, inlined at build time", async () => {
  const head = (await Bun.$`git rev-parse --short=7 HEAD`.quiet().nothrow().text()).trim();
  // A checkout always has one; GARNISH_COMMIT, when set, wins over git.
  expect(COMMIT).toBe(process.env.GARNISH_COMMIT?.trim().slice(0, 7) || head);
});

test("buildLabel puts the commit after the version, and is the version alone without one", () => {
  expect(buildLabel("1.4.0", "940422d")).toBe("1.4.0 (940422d)");
  expect(buildLabel("1.4.0", "")).toBe("1.4.0");
});
