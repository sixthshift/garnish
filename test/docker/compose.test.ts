// docker/docker-compose.yml is text, so its contract is asserted here: one
// `garnish` service pulling the published image, on port 9988 with the host
// data folder (GARNISH_DATA_DIR, default ./data) bind-mounted at
// DATA_DIR=/data plus the AI variables. Docker itself is not run under vitest.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const root = join(import.meta.dirname, "..", "..");
const composeText = readFileSync(join(root, "docker", "docker-compose.yml"), "utf8");
const dockerfile = readFileSync(join(root, "docker", "Dockerfile"), "utf8");

type Compose = {
  version?: unknown;
  services: Record<
    string,
    {
      build?: unknown;
      image?: string;
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

const compose = parseCompose(composeText);
const garnish = compose.services.garnish!;

describe("compose file", () => {
  test("has no version key and exactly one service, garnish", () => {
    expect(compose.version).toBeUndefined();
    expect(Object.keys(compose.services)).toEqual(["garnish"]);
  });

  test("pulls the published image, overridable for a local build, and builds nothing", () => {
    expect(garnish.image).toBe("${GARNISH_IMAGE:-ghcr.io/sixthshift/garnish:latest}");
    expect(garnish.build).toBeUndefined();
  });

  test("publishes 9988, the Dockerfile's EXPOSE", () => {
    expect(garnish.ports).toEqual(["9988:9988"]);
    expect(dockerfile).toMatch(/^EXPOSE\s+9988$/m);
  });

  test("bind-mounts the host data folder at /data, ./data unless GARNISH_DATA_DIR says otherwise", () => {
    expect(garnish.volumes).toEqual(["${GARNISH_DATA_DIR:-./data}:/data"]);
    expect(compose.volumes).toBeUndefined();
  });

  test("DATA_DIR points at the mount", () => {
    expect(envValue(garnish.environment, "DATA_DIR")).toBe("/data");
  });

  test("passes the three AI variables through from the host, defaulting to empty", () => {
    expect(envValue(garnish.environment, "AI_PROVIDER")).toBe("${AI_PROVIDER:-}");
    expect(envValue(garnish.environment, "CLAUDE_CODE_OAUTH_TOKEN")).toBe("${CLAUDE_CODE_OAUTH_TOKEN:-}");
    expect(envValue(garnish.environment, "AI_API_KEY")).toBe("${AI_API_KEY:-}");
    expect(envValue(garnish.environment, "AI_BASE_URL")).toBe("${AI_BASE_URL:-}");
    expect(envValue(garnish.environment, "AI_IMPORT_MODEL")).toBe("${AI_IMPORT_MODEL:-}");
  });

  test("passes the per-pass model overrides through too", () => {
    expect(envValue(garnish.environment, "AI_RESTYLE_MODEL")).toBe("${AI_RESTYLE_MODEL:-}");
    expect(envValue(garnish.environment, "AI_PLANNER_MODEL")).toBe("${AI_PLANNER_MODEL:-}");
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
