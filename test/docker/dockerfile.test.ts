// The Dockerfile is text, not code, so its contract is asserted here: two
// stages on the pinned Bun, the volume, the port and the start command. Docker
// itself is not run under vitest.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const root = join(import.meta.dirname, "..", "..");
const dockerfile = readFileSync(join(root, "Dockerfile"), "utf8");
const devcontainer = readFileSync(join(root, ".devcontainer", "Dockerfile"), "utf8");

/** Instruction lines, comments and blank lines dropped, continuation lines joined. Pure. */
export function instructions(text: string): string[] {
  return text
    .replace(/\\\n\s*/g, " ")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
}

/** `image:tag` from a FROM line, the `AS name` alias dropped. Pure. */
export function fromImage(line: string): string {
  const match = /^FROM\s+(\S+)/i.exec(line);
  if (!match) throw new Error(`Not a FROM line: ${line}`);
  return match[1]!;
}

const lines = instructions(dockerfile);
const froms = lines.filter((line) => /^FROM\s/i.test(line));

describe("stages", () => {
  test("two stages: a named build stage and a slim runtime", () => {
    expect(froms).toHaveLength(2);
    expect(froms[0]).toMatch(/\sAS\s+build$/i);
    expect(fromImage(froms[1]!)).toMatch(/-slim$/);
    expect(lines).toContainEqual(expect.stringMatching(/^COPY\s+--from=build\s+\/app\/\.output\s+/));
  });

  test("both stages run the same oven/bun version", () => {
    const [build, runtime] = froms.map(fromImage);
    expect(build).toMatch(/^oven\/bun:\d+\.\d+\.\d+$/);
    expect(runtime).toBe(`${build}-slim`);
  });
});

describe("bun pin", () => {
  const version = fromImage(froms[0]!).split(":")[1]!;
  const [major, minor] = version.split(".").map(Number);

  test("is Bun 1.4 or newer (decisions.md row 32)", () => {
    expect(major).toBe(1);
    expect(minor).toBeGreaterThanOrEqual(4);
  });

  test("matches the devcontainer's pin", () => {
    const pinned = /bun-v(\d+\.\d+\.\d+)/.exec(devcontainer)?.[1];
    expect(pinned).toBeDefined();
    expect(version).toBe(pinned);
  });
});

describe("runtime contract", () => {
  test("installs from the lockfile and builds", () => {
    expect(lines).toContainEqual(expect.stringMatching(/^RUN\s+bun install --frozen-lockfile$/));
    expect(lines).toContainEqual(expect.stringMatching(/^RUN\s+bun run build$/));
  });

  test("DATA_DIR=/data is the volume", () => {
    expect(lines).toContainEqual(expect.stringMatching(/^ENV\s.*\bDATA_DIR=\/data\b/));
    expect(lines).toContainEqual(expect.stringMatching(/^VOLUME\s+\/data$/));
  });

  test("listens on 3000 on every interface", () => {
    expect(lines).toContainEqual(expect.stringMatching(/^ENV\s.*\bPORT=3000\b/));
    expect(lines).toContainEqual(expect.stringMatching(/^ENV\s.*\bHOST=0\.0\.0\.0\b/));
    expect(lines).toContainEqual(expect.stringMatching(/^EXPOSE\s+3000$/));
  });

  test("healthcheck probes /api/health", () => {
    const health = lines.find((line) => /^HEALTHCHECK\s/i.test(line));
    expect(health).toContain("/api/health");
  });

  test("starts the built server", () => {
    expect(lines.at(-1)).toBe('CMD ["bun", "run", ".output/server/index.mjs"]');
  });
});
