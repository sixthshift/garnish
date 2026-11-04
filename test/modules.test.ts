// A domain or feature-model folder with an `index.ts` is a module: the index is its surface and
// everything else in it is internal. This holds that line mechanically — no
// file outside the folder may import a path inside it — so the boundary is a
// test rather than a habit. Tests of a module's internals live under
// `test/domain/<section>/<module>` (`test/app/features/settings/model/backup`) and
// are the one place allowed to reach in.
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

/**
 * Every folder that declares a surface. Under `src/domain` the top level is the
 * app's sections (home, plan, shopping, recipes); each holds its logic as
 * modules one level down (`src/domain/recipes/recipe`), beside the section's
 * screens in `pages/` and `components/` and its addresses in `routes/`, which
 * are not modules (a `routes/index.ts` puts a subtree together). A feature of
 * the app itself, `src/app/features/<feature>/`, keeps its logic in `model/`,
 * a module a folder (`src/app/features/settings/model/backup`).
 */
export function modules(): string[] {
  // A folder that is not there holds nothing: no features yet is no modules, not a crash.
  const folders = (dir: string) =>
    existsSync(join(root, dir)) ? readdirSync(join(root, dir)).filter((name) => statSync(join(root, dir, name)).isDirectory()) : [];
  const inside = (dir: string, skip: (name: string) => boolean = () => false) =>
    folders(dir)
      .filter((name) => !skip(name) && existsSync(join(root, dir, name, "index.ts")))
      .map((name) => `${dir}/${name}`);
  return [
    ...folders("src/domain").flatMap((section) => inside(`src/domain/${section}`, (name) => name === "routes")),
    ...folders("src/app/features").flatMap((feature) => inside(`src/app/features/${feature}/model`)),
  ];
}

/** A section's or an app feature's screens and addresses: its `pages/`, `components/` and `routes/`. Pure. */
export function isScreen(path: string): boolean {
  return /^src\/(domain|app\/features)\/[^/]+\/(pages|components|routes)(\/|$)/.test(path);
}

/** A route definition: a file in any `routes/` folder or its `api/`, or in `src/api/rest/` (the server routes), but `src/routes/tree.ts`. Pure. */
export function isRouteDefinition(path: string): boolean {
  return (
    (/^src\/(routes|(domain|app\/features)\/[^/]+\/routes)\/(api\/)?[^/]+\.tsx?$/.test(path) || isServerRoute(path)) && !path.startsWith("src/routes/tree.")
  );
}

/** A server route: the app's, in `src/api/rest/`, or a section's or feature's, in its `routes/api/`. Pure. */
export function isServerRoute(path: string): boolean {
  return /^src\/(api\/rest|(domain|app\/features)\/[^/]+\/routes\/api)\/[^/]+\.tsx?$/.test(path);
}

/** Relative import specifiers in a file, wherever they appear: `from`, a bare `import`, `import()`, `vi.mock`. Pure. */
export function relativeSpecifiers(source: string): string[] {
  return [...source.matchAll(/(?:from\s+|import\s+|import\(\s*|vi\.mock\(\s*)["'](\.\.?\/[^"']+)["']/g)].map((match) => match[1]!);
}

/** The files outside `module` (and outside its test folder) that import a path inside it rather than the module itself. */
export function deepImportsInto(module: string, files: readonly string[]): { file: string; specifier: string }[] {
  const testFolder = module.replace(/^src\//, "test/");
  const found: { file: string; specifier: string }[] = [];
  for (const file of files) {
    const rel = relative(root, file);
    if (rel.startsWith(`${module}/`) || rel.startsWith(`${testFolder}/`)) continue;
    for (const specifier of relativeSpecifiers(readFileSync(file, "utf8"))) {
      const target = relative(root, resolve(dirname(file), specifier));
      if (target.startsWith(`${module}/`)) found.push({ file: rel, specifier });
    }
  }
  return found;
}

describe("domain modules", () => {
  const files = [...walk(join(root, "src")), ...walk(join(root, "test"))];

  test("import is one", () => {
    expect(modules()).toContain("src/domain/recipes/import");
    expect(modules()).toContain("src/domain/home/home");
    expect(modules()).toContain("src/app/features/settings/model/backup");
  });

  for (const module of modules()) {
    test(`${module} is entered through its index only`, () => {
      expect(deepImportsInto(module, files)).toEqual([]);
    });
  }
});

// Layers: a domain module is what is true of a recipe on any screen, lib/ is
// logic that exists because a screen or a widget does, and app/ (but for a
// feature's model/), routes/, components/ and each section's or feature's
// pages/, components/ and routes/ render. Each may import
// from the ones before it and never from the ones after — with one allowance: a
// lib file that imports nothing of the app (id, lists, numbers, dates...) is a
// library, and a module may use a library.
describe("layers", () => {
  const files = walk(join(root, "src"));
  const logic = modules();
  const inModule = (path: string) => logic.some((module) => path.startsWith(`${module}/`));
  // app/ renders, but for a feature's model/, which is logic (settings' backup format).
  const featureModel = (path: string) => /^src\/app\/features\/[^/]+\/model\//.test(path);
  const rendering = (path: string) =>
    (["src/app/", "src/routes/", "src/components/"].some((dir) => path.startsWith(dir)) && !featureModel(path)) || isScreen(path);
  const importsFrom = (from: (path: string) => boolean, to: (path: string) => boolean) =>
    files
      .filter((file) => from(relative(root, file)))
      .flatMap((file) =>
        relativeSpecifiers(readFileSync(file, "utf8"))
          .map((specifier) => relative(root, resolve(dirname(file), specifier)))
          .filter(to)
          .map((target) => `${relative(root, file)} -> ${target}`)
      );
  /**
   * The imports of a file outside `mayImport` that land on a path `isTarget`
   * holds, a specifier resolved the way the bundler would: as written, with
   * `.ts` or `.tsx`, or as a folder's `index.ts`.
   */
  const edgesInto = (isTarget: (path: string) => boolean, mayImport: (path: string) => boolean) =>
    importsFrom(
      (path) => !mayImport(path),
      (target) => [target, `${target}.ts`, `${target}.tsx`, `${target}/index.ts`].some(isTarget)
    );

  test("the modules have logic in them", () => {
    expect(logic).toContain("src/domain/recipes/recipe");
    expect(files.some((file) => isScreen(relative(root, file)))).toBe(true);
  });

  test("a domain module imports nothing that renders: app/, routes/, components/, a section's pages/, components/ or routes/", () => {
    expect(importsFrom(inModule, rendering)).toEqual([]);
  });

  test("a domain module imports from lib/ only library files: ones that import nothing of the app", () => {
    const notLibraries = importsFrom(inModule, (target) => target.startsWith("src/lib/")).filter((edge) => {
      const target = edge.split(" -> ")[1]!;
      const file = ["", ".ts"].map((ext) => join(root, target + ext)).find((p) => existsSync(p) && statSync(p).isFile());
      return file === undefined || relativeSpecifiers(readFileSync(file, "utf8")).length > 0;
    });
    expect(notLibraries).toEqual([]);
  });

  // A route is defined in its section's routes/ folder, put in a subtree by
  // that folder's index.ts and in the tree by routes/tree.ts; a page reads its
  // route through getRouteApi. So only routes (one route's parent is another)
  // and the tree import one.
  test("nothing imports a route definition but the tree and the other definitions", () => {
    const definitions = files.map((file) => relative(root, file)).filter(isRouteDefinition);
    expect(definitions).toContain("src/domain/plan/routes/planIndex.ts");
    expect(edgesInto(isRouteDefinition, (path) => isRouteDefinition(path) || path === "src/routes/tree.ts")).toEqual([]);
  });

  // A server route's handlers import the store, so it must never reach the
  // browser: the tree adds the list on the server only, and nothing else but
  // another server route imports one.
  test("nothing imports a server route but the tree and the other server routes", () => {
    expect(files.map((file) => relative(root, file)).filter(isServerRoute)).toEqual(
      expect.arrayContaining(["src/domain/recipes/routes/api/images.ts", "src/api/rest/health.ts"])
    );
    expect(edgesInto(isServerRoute, (path) => isServerRoute(path) || path === "src/routes/tree.ts")).toEqual([]);
  });

  test("lib/ imports nothing that renders", () => {
    expect(importsFrom((path) => path.startsWith("src/lib/"), rendering)).toEqual([]);
  });
});
