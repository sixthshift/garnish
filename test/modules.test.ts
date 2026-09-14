// A domain folder with an `index.ts` is a module: the index is its surface and
// everything else in it is internal. This holds that line mechanically — no
// file outside the folder may import a path inside it — so the boundary is a
// test rather than a habit. Tests of a module's internals live under
// `test/domain/<module>` and are the one place allowed to reach in.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { describe, expect, test } from "vitest";

const root = resolve(import.meta.dirname, "..");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (/\.(ts|tsx)$/.test(name) && !name.endsWith(".gen.ts")) out.push(path);
  }
  return out;
}

/** Every `src/domain/<name>` that declares a surface. */
export function modules(): string[] {
  const domain = join(root, "src", "domain");
  return readdirSync(domain)
    .filter((name) => existsSync(join(domain, name, "index.ts")))
    .map((name) => `src/domain/${name}`);
}

/** Relative import specifiers in a file, wherever they appear: `from`, `import()`, `vi.mock`. Pure. */
export function relativeSpecifiers(source: string): string[] {
  return [...source.matchAll(/(?:from\s+|import\(\s*|vi\.mock\(\s*)["'](\.\.?\/[^"']+)["']/g)].map((match) => match[1]!);
}

/** The files outside `module` (and outside its test folder) that import a path inside it rather than the module itself. */
export function deepImportsInto(module: string, files: readonly string[]): { file: string; specifier: string }[] {
  const testFolder = module.replace(/^src\//, "test/");
  const found: { file: string; specifier: string }[] = [];
  for (const file of files) {
    const rel = relative(root, file);
    if (rel.startsWith(module + "/") || rel.startsWith(testFolder + "/")) continue;
    for (const specifier of relativeSpecifiers(readFileSync(file, "utf8"))) {
      const target = relative(root, resolve(dirname(file), specifier));
      if (target.startsWith(module + "/")) found.push({ file: rel, specifier });
    }
  }
  return found;
}

describe("domain modules", () => {
  const files = [...walk(join(root, "src")), ...walk(join(root, "test"))];

  test("import is one", () => {
    expect(modules()).toContain("src/domain/import");
  });

  for (const module of modules()) {
    test(`${module} is entered through its index only`, () => {
      expect(deepImportsInto(module, files)).toEqual([]);
    });
  }
});
