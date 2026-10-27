// The version in package.json is bumped by .github/workflows/docker.yml on
// every push to main, and the size of the bump is read out of the commits
// being shipped (Conventional Commits). The same commits are the release's
// notes: GitHub's own generator lists merged pull requests, and this repo
// pushes straight to main, so it has nothing to list. The rules live here as
// pure functions so the workflow's decisions are testable; the CLI below is
// what the workflow calls.
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

/** The release notes' sections, in the order they print. */
const SECTIONS = ["Breaking changes", "Features", "Fixes and performance", "Other changes"] as const;
type Section = (typeof SECTIONS)[number];

/** Commit types that change nothing a household sees; the notes leave them out. */
const HOUSEKEEPING = new Set(["chore", "test", "ci", "docs", "build"]);

/** Where one commit goes in the notes, and its line there; null to leave it out. Pure. */
export function noteFor(message: string): { section: Section; line: string } | null {
  const header = (message.split("\n")[0] ?? "").trim();
  if (header === "") return null;
  const match = HEADER.exec(header);
  if (!match) return { section: "Other changes", line: `- ${header}` };
  const type = match[1]!.toLowerCase();
  const scope = match[2]?.slice(1, -1).trim();
  const subject = header.slice(match[0].length).trim();
  const line = scope ? `- **${scope}:** ${subject}` : `- ${subject}`;
  if (bumpFor(message) === "major") return { section: "Breaking changes", line };
  if (type === "feat") return { section: "Features", line };
  if (type === "fix" || type === "perf") return { section: "Fixes and performance", line };
  if (HOUSEKEEPING.has(type)) return null;
  return { section: "Other changes", line };
}

/** Markdown notes for `messages`, given newest first as git log gives them; "" when nothing is worth saying. Pure. */
export function releaseNotes(messages: readonly string[]): string {
  const bySection = new Map<Section, string[]>();
  for (const message of [...messages].reverse()) {
    const note = noteFor(message);
    if (note) bySection.set(note.section, [...(bySection.get(note.section) ?? []), note.line]);
  }
  return SECTIONS.filter((section) => bySection.has(section))
    .map((section) => `## ${section}\n\n${bySection.get(section)!.join("\n")}\n`)
    .join("\n");
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
  const messages = await messagesSinceLastTag();
  const version = nextVersion(current, messages);
  await Bun.write(path, withVersion(source, version));
  console.log(version);
  // Outside the repo, so the release step's `git commit -am` cannot pick it up.
  const notes = `${process.env.RUNNER_TEMP ?? "/tmp"}/release-notes.md`;
  await Bun.write(notes, releaseNotes(messages));
  const output = process.env.GITHUB_OUTPUT;
  if (output) await appendFile(output, `version=${version}\nnotes=${notes}\n`);
}
