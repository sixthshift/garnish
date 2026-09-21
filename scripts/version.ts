// The version in package.json is bumped by .github/workflows/docker.yml on
// every push to main, and the size of the bump is read out of the commits
// being shipped (Conventional Commits). The rules live here as pure functions
// so the workflow's one decision is testable; the CLI below is what the
// workflow calls.
import { appendFile } from "node:fs/promises";
import { $ } from "bun";

export type Bump = "major" | "minor" | "patch";

const RANK: Record<Bump, number> = { patch: 0, minor: 1, major: 2 };
const HEADER = /^([a-zA-Z]+)(\([^)]*\))?(!)?:\s/;
const BREAKING = /^BREAKING[ -]CHANGE\s*:/m;

/** The bump one commit message asks for. Anything unconventional is a patch. Pure. */
export function bumpFor(message: string): Bump {
  const [header = "", ...body] = message.split("\n");
  const match = HEADER.exec(header.trim());
  if (match?.[3] || BREAKING.test(body.join("\n"))) return "major";
  if (match?.[1]?.toLowerCase() === "feat") return "minor";
  return "patch";
}

/** The largest bump the messages ask for; patch when there are none. Pure. */
export function bumpAcross(messages: readonly string[]): Bump {
  return messages.reduce<Bump>((largest, message) => {
    const bump = bumpFor(message);
    return RANK[bump] > RANK[largest] ? bump : largest;
  }, "patch");
}

/** `current` advanced by what `messages` ask for. Throws on a non-semver current. Pure. */
export function nextVersion(current: string, messages: readonly string[]): string {
  const parts = /^(\d+)\.(\d+)\.(\d+)$/.exec(current.trim());
  if (!parts) throw new Error(`not a version: ${current}`);
  const [major, minor, patch] = parts.slice(1).map(Number) as [number, number, number];
  switch (bumpAcross(messages)) {
    case "major":
      return `${major + 1}.0.0`;
    case "minor":
      return `${major}.${minor + 1}.0`;
    default:
      return `${major}.${minor}.${patch + 1}`;
  }
}

/** package.json with its version line rewritten, everything else byte for byte. Pure. */
export function withVersion(packageJson: string, version: string): string {
  const replaced = packageJson.replace(/^(\s*"version":\s*")[^"]*(")/m, `$1${version}$2`);
  if (replaced === packageJson) throw new Error("package.json has no version field");
  return replaced;
}

/** The commit messages since the last v* tag, or the tip commit alone when there is no tag. */
async function messagesSinceLastTag(): Promise<string[]> {
  const tag = (await $`git describe --tags --match "v*" --abbrev=0`.nothrow().quiet()).stdout.toString().trim();
  const range = tag ? `${tag}..HEAD` : "-1";
  const log = await $`git log ${range} --format=%B%x00`.quiet();
  return log.stdout
    .toString()
    .split("\0")
    .map((message) => message.trim())
    .filter(Boolean);
}

if (import.meta.main) {
  const path = new URL("../package.json", import.meta.url).pathname;
  const source = await Bun.file(path).text();
  const current = (JSON.parse(source) as { version?: string }).version ?? "0.0.0";
  const version = nextVersion(current, await messagesSinceLastTag());
  await Bun.write(path, withVersion(source, version));
  console.log(version);
  const output = process.env.GITHUB_OUTPUT;
  if (output) await appendFile(output, `version=${version}\n`);
}
