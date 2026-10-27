// The release workflow's two decisions: how far the version moves for
// the commits being shipped, and what the release says about them.
import { describe, expect, test } from "vitest";
import { bumpAcross, bumpFor, nextVersion, noteFor, releaseNotes, withVersion } from "../../scripts/version";

describe("bumpFor", () => {
  test("feat is a minor", () => {
    expect(bumpFor("feat: propose a week")).toBe("minor");
    expect(bumpFor("feat(planner): propose a week")).toBe("minor");
  });

  test("fix, chore and anything else are a patch", () => {
    expect(bumpFor("fix: the swipe misses")).toBe("patch");
    expect(bumpFor("chore(deps): bun 1.4.3")).toBe("patch");
    expect(bumpFor("The restyle conserves what a recipe tells you")).toBe("patch");
  });

  test("a bang in the header is a major, whatever the type", () => {
    expect(bumpFor("feat!: drop the old export envelope")).toBe("major");
    expect(bumpFor("refactor(db)!: rename the volume")).toBe("major");
  });

  test("a BREAKING CHANGE footer is a major", () => {
    expect(bumpFor("feat: new envelope\n\nBREAKING CHANGE: old files no longer import")).toBe("major");
    expect(bumpFor("fix: paths\n\nBREAKING-CHANGE: DATA_DIR moved")).toBe("major");
  });

  test("the words alone, in prose, are not a footer", () => {
    expect(bumpFor("fix: avoid a BREAKING CHANGE in the schema")).toBe("patch");
  });
});

describe("bumpAcross", () => {
  test("takes the largest", () => {
    expect(bumpAcross(["fix: a", "feat: b", "chore: c"])).toBe("minor");
    expect(bumpAcross(["fix: a", "feat!: b", "feat: c"])).toBe("major");
  });

  test("no commits is a patch", () => {
    expect(bumpAcross([])).toBe("patch");
  });
});

describe("nextVersion", () => {
  test("advances the right field and zeroes the ones below", () => {
    expect(nextVersion("1.2.3", ["fix: a"])).toBe("1.2.4");
    expect(nextVersion("1.2.3", ["feat: a"])).toBe("1.3.0");
    expect(nextVersion("1.2.3", ["feat!: a"])).toBe("2.0.0");
  });

  test("refuses a version it cannot read", () => {
    expect(() => nextVersion("1.2.3-rc.1", ["fix: a"])).toThrow();
  });
});

describe("withVersion", () => {
  const source = '{\n  "name": "garnish",\n  "version": "1.0.0",\n  "private": true\n}\n';

  test("rewrites the version and nothing else", () => {
    expect(withVersion(source, "1.1.0")).toBe(source.replace("1.0.0", "1.1.0"));
  });

  test("refuses a package.json with no version", () => {
    expect(() => withVersion('{\n  "name": "garnish"\n}\n', "1.1.0")).toThrow();
  });
});

test("the version in package.json is one the bumper can read", async () => {
  const pkg = (await Bun.file(new URL("../../package.json", import.meta.url).pathname).json()) as { version: string };
  expect(pkg.version).toMatch(/^\d+\.\d+\.\d+$/);
});

describe("noteFor", () => {
  test("sorts by type, keeping the scope", () => {
    expect(noteFor("feat(mcp): an MCP server")).toEqual({ section: "Features", line: "- **mcp:** an MCP server" });
    expect(noteFor("fix: the swipe misses")).toEqual({ section: "Fixes and performance", line: "- the swipe misses" });
    expect(noteFor("perf(server): no JIT")).toEqual({ section: "Fixes and performance", line: "- **server:** no JIT" });
    expect(noteFor("style(shopping): a circle")).toEqual({ section: "Other changes", line: "- **shopping:** a circle" });
  });

  test("a breaking change goes first, whatever the type", () => {
    expect(noteFor("refactor(db)!: rename the volume")?.section).toBe("Breaking changes");
    expect(noteFor("fix: paths\n\nBREAKING CHANGE: DATA_DIR moved")?.section).toBe("Breaking changes");
  });

  test("housekeeping and the bot's release commits are left out", () => {
    for (const message of ["chore: retire the skill", "chore(release): v1.8.0 [skip ci]", "test: x", "ci: y", "docs: z", "build: w"]) {
      expect(noteFor(message)).toBeNull();
    }
  });

  test("an unconventional header is kept whole, and only the header is used", () => {
    expect(noteFor("Store data in a bind mount\n\nBecause volumes hide it.")).toEqual({
      section: "Other changes",
      line: "- Store data in a bind mount",
    });
  });
});

describe("releaseNotes", () => {
  test("sections in order, each oldest first, empty ones left out", () => {
    const newestFirst = ["chore(release): v1.7.1 [skip ci]", "style(shopping): a circle", "feat(ui): a sprig", "chore: tidy", "feat(mcp): a server"];
    expect(releaseNotes(newestFirst)).toBe("## Features\n\n- **mcp:** a server\n- **ui:** a sprig\n\n## Other changes\n\n- **shopping:** a circle\n");
  });

  test("nothing worth saying is empty", () => {
    expect(releaseNotes(["chore: tidy"])).toBe("");
    expect(releaseNotes([])).toBe("");
  });
});
