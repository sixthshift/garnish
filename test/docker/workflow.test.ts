// .github/workflows/docker.yml is text, so its contract is asserted here: the
// image is built from docker/Dockerfile for both platforms, published to
// ghcr.io on pushes and not on pull requests, gated by the test job, and the
// tests run on the Bun the image is pinned to. Actions itself is not run here.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { fromImage, instructions } from "./dockerfile.test";

const root = join(import.meta.dirname, "..", "..");
const workflow = Bun.YAML.parse(readFileSync(join(root, ".github", "workflows", "docker.yml"), "utf8")) as Workflow;
const dockerfile = readFileSync(join(root, "docker", "Dockerfile"), "utf8");

type Step = { uses?: string; run?: string; id?: string; if?: string; with?: Record<string, string> };
type Workflow = {
  on: { push?: { branches?: string[]; tags?: string[] }; pull_request?: unknown };
  permissions?: Record<string, string>;
  jobs: Record<string, { needs?: string | string[]; steps: Step[] }>;
};

/** The step whose `uses` starts with `action`, or undefined. Pure. */
export function stepUsing(steps: readonly Step[], action: string): Step | undefined {
  return steps.find((step) => step.uses?.startsWith(action));
}

const { test: testJob, image } = workflow.jobs;
const build = stepUsing(image!.steps, "docker/build-push-action")!;
const meta = stepUsing(image!.steps, "docker/metadata-action")!;

describe("triggers", () => {
  test("runs on pushes to main and v* tags, and on pull requests", () => {
    expect(workflow.on.push?.branches).toEqual(["main"]);
    expect(workflow.on.push?.tags).toEqual(["v*"]);
    expect(workflow.on.pull_request).toBeDefined();
  });

  test("may write packages", () => {
    expect(workflow.permissions?.packages).toBe("write");
  });
});

describe("test job", () => {
  test("installs from the lockfile, typechecks and tests", () => {
    const runs = testJob!.steps.map((step) => step.run).filter(Boolean);
    expect(runs).toEqual(["bun install --frozen-lockfile", "bun run check", "bun run test"]);
  });

  test("runs the Bun the image is pinned to", () => {
    const pinned = fromImage(instructions(dockerfile).find((line) => /^FROM\s/i.test(line))!).split(":")[1];
    expect(stepUsing(testJob!.steps, "oven-sh/setup-bun")?.with?.["bun-version"]).toBe(pinned);
  });
});

describe("image job", () => {
  test("waits for the tests", () => {
    expect(image!.needs).toBe("test");
  });

  test("builds docker/Dockerfile from the repo root for amd64 and arm64", () => {
    expect(build.with?.context).toBe(".");
    expect(build.with?.file).toBe("docker/Dockerfile");
    expect(build.with?.platforms).toBe("linux/amd64,linux/arm64");
  });

  test("publishes to ghcr.io under the repository's name, latest on main, except for pull requests", () => {
    expect(meta.with?.images).toBe("ghcr.io/${{ github.repository }}");
    expect(meta.with?.tags).toContain("type=raw,value=latest,enable={{is_default_branch}}");
    expect(build.with?.push).toBe("${{ github.event_name != 'pull_request' }}");
    expect(stepUsing(image!.steps, "docker/login-action")?.if).toBe("github.event_name != 'pull_request'");
  });
});
