// Every page request is answered with the shell (decisions.md row 169): the
// document, the frame and the pending spinner, with no page drawn and no
// loader run. The browser draws the page, as it does in Mealie, Tandoor,
// Sonarr and Radarr.
//
// Start's SPA mode already serves the shell in dev — its plugin sets
// TSS_SHELL for `vite dev` — and the build prerenders one, but a built server
// draws every page in full unless TSS_SHELL is set where it runs. Start reads
// the variable once, as its handler module loads, so this module is imported
// for its side effect first in src/server.ts, ahead of Start's own imports.
process.env.TSS_SHELL = "true";
