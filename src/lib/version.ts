// The version in package.json and the commit it was built from, inlined at
// build time by vite.config.ts's `define`. The bump is the release workflow's
// (scripts/version.ts); the commit is GARNISH_COMMIT when the build is handed
// one (the image is built without .git, so the workflow passes it as a build
// argument), else what git says, else empty. Nothing here reads either at
// runtime, so there is no package.json or .git in the image's server bundle to
// keep in step. Outside a vite build — a bare `bun run` of a CLI — the
// constants are absent and the fallbacks say so.
declare const __GARNISH_VERSION__: string | undefined;
declare const __GARNISH_COMMIT__: string | undefined;

export const VERSION: string = typeof __GARNISH_VERSION__ === "string" ? __GARNISH_VERSION__ : "0.0.0-dev";

/** The short commit hash this build came from, or "" when the build was not told one. */
export const COMMIT: string = typeof __GARNISH_COMMIT__ === "string" ? __GARNISH_COMMIT__ : "";

/** What is running, in one line: `1.4.0 (940422d)`, or the version alone when the commit is unknown. Pure. */
export function buildLabel(version: string = VERSION, commit: string = COMMIT): string {
  return commit === "" ? version : `${version} (${commit})`;
}
