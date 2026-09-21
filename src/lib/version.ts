// The version in package.json, inlined at build time by vite.config.ts's
// `define`. The bump is the release workflow's (scripts/version.ts); nothing
// here reads it at runtime, so there is no package.json in the image's server
// bundle to keep in step. Outside a vite build — a bare `bun run` of a CLI —
// the constant is absent and the fallback says so.
declare const __GARNISH_VERSION__: string | undefined;

export const VERSION: string = typeof __GARNISH_VERSION__ === "string" ? __GARNISH_VERSION__ : "0.0.0-dev";
