// The one decision the release workflow makes: how far the version moves for
// the commits being shipped.
import { describe, expect, test } from "vitest";
import { bumpAcross, bumpFor, nextVersion, withVersion } from "../../scripts/version";

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
