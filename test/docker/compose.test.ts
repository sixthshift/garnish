// docker-compose.yml and the README's Docker sections are text, so their
// contract is asserted here: one `garnish` service on port 3000 with the
// `garnish-data` volume at DATA_DIR=/data, and a README that documents run,
// backup and restore. Docker itself is not run under vitest.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const root = join(import.meta.dirname, "..", "..");
const composeText = readFileSync(join(root, "docker-compose.yml"), "utf8");
const readme = readFileSync(join(root, "README.md"), "utf8");
const dockerfile = readFileSync(join(root, "Dockerfile"), "utf8");

type Compose = {
  version?: unknown;
  services: Record<
    string,
    {
      build?: unknown;
      ports?: string[];
      volumes?: string[];
      environment?: Record<string, string> | string[];
      restart?: string;
    }
  >;
  volumes?: Record<string, unknown>;
};

/** Parse the compose file with Bun's YAML parser. Pure. */
export function parseCompose(text: string): Compose {
  return Bun.YAML.parse(text) as Compose;
}

/** `DATA_DIR` from either the map or the list form of `environment`. Pure. */
export function envValue(environment: Compose["services"][string]["environment"], key: string): string | undefined {
  if (!environment) return undefined;
  if (Array.isArray(environment)) {
    const hit = environment.find((entry) => entry.startsWith(`${key}=`));
    return hit?.slice(key.length + 1);
  }
  return environment[key];
}

/** Section headings (`## ...`) of a markdown file. Pure. */
export function headings(markdown: string): string[] {
  return markdown
    .split("\n")
    .filter((line) => /^## /.test(line))
    .map((line) => line.replace(/^## /, "").trim());
}

const compose = parseCompose(composeText);
const garnish = compose.services.garnish!;

describe("compose file", () => {
  test("has no version key and exactly one service, garnish", () => {
    expect(compose.version).toBeUndefined();
    expect(Object.keys(compose.services)).toEqual(["garnish"]);
  });

  test("builds from the repo root", () => {
    expect(garnish.build).toBe(".");
  });

  test("publishes 3000, the Dockerfile's EXPOSE", () => {
    expect(garnish.ports).toEqual(["3000:3000"]);
    expect(dockerfile).toMatch(/^EXPOSE\s+3000$/m);
  });

  test("mounts the named volume at /data and declares it", () => {
    expect(garnish.volumes).toEqual(["garnish-data:/data"]);
    expect(compose.volumes).toHaveProperty("garnish-data");
  });

  test("DATA_DIR points at the mount", () => {
    expect(envValue(garnish.environment, "DATA_DIR")).toBe("/data");
  });

  test("restarts unless stopped", () => {
    expect(garnish.restart).toBe("unless-stopped");
  });
});

describe("envValue", () => {
  test("reads the list form too", () => {
    expect(envValue(["DATA_DIR=/x", "PORT=1"], "DATA_DIR")).toBe("/x");
    expect(envValue(["PORT=1"], "DATA_DIR")).toBeUndefined();
    expect(envValue(undefined, "DATA_DIR")).toBeUndefined();
  });
});

describe("README", () => {
  const sections = headings(readme);

  test("documents run, backup and restore", () => {
    expect(sections).toContain("Run with Docker");
    expect(sections).toContain("Backup");
    expect(sections).toContain("Restore");
  });

  test("names the compose and backup commands", () => {
    expect(readme).toContain("docker compose up");
    expect(readme).toContain("docker compose exec garnish bun run backup");
    expect(readme).toContain("bun run backup");
  });

  test("restore removes the WAL sidecars", () => {
    const restore = readme.slice(readme.indexOf("## Restore"));
    expect(restore).toContain("garnish.db-wal");
    expect(restore).toContain("garnish.db-shm");
  });

  test("dev instructions match package.json scripts and ports", () => {
    expect(readme).toContain("bun run dev");
    expect(readme).toContain("5173");
    expect(readme).toContain("bun run build");
    expect(readme).toContain("bun run start");
    expect(readme).toContain("DATA_DIR");
    expect(readme).toContain("PORT");
  });
});
