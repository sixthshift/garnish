// README.md and docs/architecture.md are prose, so their contract with the
// code is asserted here: the README names every command a fresh reader needs,
// every `bun run <script>` it mentions is a real package.json script, and the
// architecture layout names every source directory that exists.
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, test } from "vitest";
import { apiRoutes } from "../../src/routes/api/routes";
import { testRouter } from "../helpers/routes";

const root = join(import.meta.dirname, "..", "..");
const readme = readFileSync(join(root, "README.md"), "utf8");
const architecture = readFileSync(join(root, "docs", "architecture.md"), "utf8");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as { scripts: Record<string, string> };

/** The commands a fresh reader runs, in the order the README should give them. */
export const REQUIRED_COMMANDS = [
  "bun install",
  "bun run dev",
  "bun run check",
  "bun run test",
  "bun run seed",
  "bun run seed --sample",
  "bun run build",
  "bun run start",
  "docker compose up",
  "bun run backup",
] as const;

/** Distinct `bun run <script>` names in `markdown`. Paths (`bun run src/x.ts`) are not scripts and are skipped. Pure. */
export function bunRunScripts(markdown: string): string[] {
  const names = new Set<string>();
  for (const match of markdown.matchAll(/\bbun run ([A-Za-z][\w:-]*)(?![\w:\/.-])/g)) names.add(match[1]!);
  return [...names].sort();
}

/**
 * Directories under `src/`, relative to it. File-route directories below
 * `routes/` mirror URLs rather than architecture, so only `routes` itself and
 * `routes/api` are reported from that subtree. Not pure: reads the tree.
 */
export function sourceDirectories(src: string): string[] {
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const path = join(dir, entry.name);
      const rel = relative(src, path).split("\\").join("/");
      if (rel.startsWith("routes/") && rel !== "routes/api") continue;
      found.push(rel);
      if (rel !== "routes/api") walk(path);
    }
  };
  walk(src);
  return found.sort();
}

/**
 * A route path in the `:param` form the docs use: `$name` is a param, and
 * `{$name}` one with a prefix or suffix beside it (`{$slug}.json`). Pure.
 */
export function routePathToUrl(path: string): string {
  return path.replace(/\{\$(\w+)\}/g, ":$1").replace(/\$(\w+)/g, ":$1");
}

/** Server route URL paths, read from the code list in `src/routes/api/routes.ts`. A route learns its full path when a router builds the tree. */
export function serverRoutePaths(): string[] {
  testRouter("/");
  return apiRoutes.map((route) => routePathToUrl(route.fullPath)).sort();
}

/** Table names created by the migrations, in file order. Not pure: reads the SQL. */
export function migrationTables(migrations: string): string[] {
  const names: string[] = [];
  for (const file of readdirSync(migrations).sort()) {
    const sql = readFileSync(join(migrations, file), "utf8");
    for (const match of sql.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?(\w+)/gi)) names.push(match[1]!);
  }
  return names;
}

describe("bunRunScripts", () => {
  test("collects distinct script names and ignores file paths", () => {
    expect(bunRunScripts("run `bun run dev` then `bun run dev` and `bun run seed --sample`; `bun run src/db/seed.ts`")).toEqual([
      "dev",
      "seed",
    ]);
  });
});

describe("routePathToUrl", () => {
  test.each([
    ["a plain path", "/api/health", "/api/health"],
    ["a whole-segment param", "/api/images/$file", "/api/images/:file"],
    ["a param with a suffix", "/api/recipes/{$slug}.json", "/api/recipes/:slug.json"],
  ])("%s", (_label, path, expected) => {
    expect(routePathToUrl(path)).toBe(expected);
  });
});

describe("README", () => {
  test("names every command a fresh reader needs, in order", () => {
    let from = 0;
    for (const command of REQUIRED_COMMANDS) {
      const at = readme.indexOf(command, from);
      expect(at, `"${command}" after position ${from}`).toBeGreaterThanOrEqual(0);
      from = at;
    }
  });

  test("covers prerequisites, ports and environment", () => {
    expect(readme).toMatch(/Bun.*1\.4/);
    expect(readme).toContain("3000");
    expect(readme).toContain("3000");
    expect(readme).toContain("DATA_DIR");
    expect(readme).toContain("PORT");
    expect(readme).toMatch(/VS Code/);
  });

  test("covers the stage 2 screens a reader has to find", () => {
    for (const tab of ["Foods", "Units", "Aisles", "Tags", "Appearance"]) expect(readme, `settings tab ${tab}`).toContain(tab);
    expect(readme).toContain("Made this");
    expect(readme).toContain("images/timeline");
  });

  test("every bun run script it names exists in package.json", () => {
    const named = bunRunScripts(readme);
    expect(named.length).toBeGreaterThan(0);
    for (const name of named) expect(Object.keys(pkg.scripts), `script "${name}"`).toContain(name);
  });
});

describe("architecture.md", () => {
  test("names every directory under src/", () => {
    const dirs = sourceDirectories(join(root, "src"));
    expect(dirs).toContain("db/migrations");
    for (const dir of dirs) expect(architecture, `directory ${dir}/`).toContain(`${dir}/`);
  });

  test("names every package.json script", () => {
    for (const name of Object.keys(pkg.scripts)) expect(architecture).toContain(`\`${name}\``);
  });

  test("names every migration file and the tables they create", () => {
    const migrations = join(root, "src", "db", "migrations");
    for (const file of readdirSync(migrations)) expect(architecture, `migration ${file}`).toContain(file);
    for (const table of migrationTables(migrations)) expect(architecture, `table ${table}`).toContain(table);
  });

  test("documents every server route under /api/", () => {
    for (const path of serverRoutePaths()) expect(architecture, `route ${path}`).toContain(path);
  });
});
