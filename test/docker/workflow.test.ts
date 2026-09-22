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

type Step = { uses?: string; run?: string; id?: string; name?: string; if?: string; env?: Record<string, string>; with?: Record<string, string> };
type Workflow = {
  on: { push?: { branches?: string[]; tags?: string[] }; pull_request?: unknown };
  permissions?: Record<string, string>;
  concurrency?: { group?: string; "cancel-in-progress"?: boolean };
  jobs: Record<string, { needs?: string | string[]; permissions?: Record<string, string>; steps: Step[] }>;
};

/** The step whose `uses` starts with `action`, or undefined. Pure. */
export function stepUsing(steps: readonly Step[], action: string): Step | undefined {
  return steps.find((step) => step.uses?.startsWith(action));
}

const { test: testJob, image } = workflow.jobs;
const build = stepUsing(image!.steps, "docker/build-push-action")!;
const meta = stepUsing(image!.steps, "docker/metadata-action")!;
const bump = image!.steps.find((step) => step.id === "bump")!;
const record = image!.steps.find((step) => step.name?.startsWith("commit the version"))!;
const release = image!.steps.find((step) => step.name === "publish the release")!;

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
  test("installs from the lockfile, typechecks, tests and lints", () => {
    const runs = testJob!.steps.map((step) => step.run).filter(Boolean);
    expect(runs).toEqual(["bun install --frozen-lockfile", "bun run check", "bun run test", "bun run lint"]);
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

// The version is bumped before the build so the image carries it, and the
// commit and tag are written after it so a version is only spent on an image
// that published. scripts/version.ts owns the size of the bump.
describe("version bump", () => {
  test("runs the bumper, on a push to main only", () => {
    expect(bump.run).toBe("bun run version:next");
    expect(bump.if).toBe("github.event_name == 'push' && github.ref == 'refs/heads/main'");
  });

  test("bumps before the build and commits after it", () => {
    const order = image!.steps.indexOf.bind(image!.steps);
    expect(order(bump)).toBeLessThan(order(build));
    expect(order(record)).toBeGreaterThan(order(build));
  });

  test("checks out the whole history, since the bumper reads the commits since the last tag", () => {
    expect(stepUsing(image!.steps, "actions/checkout")?.with?.["fetch-depth"]).toBe(0);
  });

  test("runs the bumper on the Bun the image is pinned to", () => {
    const pinned = fromImage(instructions(dockerfile).find((line) => /^FROM\s/i.test(line))!).split(":")[1];
    expect(stepUsing(image!.steps, "oven-sh/setup-bun")?.with?.["bun-version"]).toBe(pinned);
  });

  test("tags the image with the new version as well as latest", () => {
    expect(meta.with?.tags).toContain("type=raw,value=${{ steps.bump.outputs.version }},enable=${{ steps.bump.outputs.version != '' }}");
  });

  test("writes the commit and its v tag back to main, skipping CI so it does not loop", () => {
    expect(record.if).toBe("steps.bump.outputs.version != ''");
    expect(record.run).toContain("[skip ci]");
    // Annotated and named on the push: a lightweight tag is not pushed by
    // --follow-tags, which is how v1.0.1 shipped an image but no tag.
    expect(record.run).toContain('git tag -a "v$VERSION"');
    expect(record.run).toContain('git push origin HEAD:main "refs/tags/v$VERSION"');
  });

  test("publishes the tag as a release, with notes generated from the commits", () => {
    expect(release.if).toBe("steps.bump.outputs.version != ''");
    expect(release.run).toContain('gh release create "v$VERSION"');
    expect(release.run).toContain("--generate-notes");
    expect(release.env?.GH_TOKEN).toBe("${{ secrets.GITHUB_TOKEN }}");
    expect(image!.steps.indexOf(release)).toBeGreaterThan(image!.steps.indexOf(record));
  });

  test("may write to the repository, and only one release runs at a time", () => {
    expect(image!.permissions?.contents).toBe("write");
    expect(workflow.concurrency?.group).toBe("docker-${{ github.ref }}");
    expect(workflow.concurrency?.["cancel-in-progress"]).toBe(false);
  });
});
