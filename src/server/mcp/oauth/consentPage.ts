// The one page a person sees in the OAuth flow: "<client> wants to use garnish", the pairing code, Allow.
// Plain HTML from the server, not a page of the app: it is reached through the tunnel, which forwards
// only the OAuth and MCP paths, so the app's scripts and styles are not there to draw it.
import { SCOPE_LABELS, SCOPES, type Scope } from "./tokens";

const escapeHtml = (text: string): string => text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** The authorization request, carried through the form unchanged so the POST can check it again. */
export type AuthorizeParams = {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  scope: string;
  resource: string;
};

const STYLE = `
:root { color-scheme: light dark; --bg: #faf8f5; --card: #fff; --fg: #1f1d1a; --muted: #6b665f; --line: #e4e0da; --brand: #3f6b4a; --danger: #a63a2b; }
@media (prefers-color-scheme: dark) { :root { --bg: #171614; --card: #201f1c; --fg: #ece8e2; --muted: #a39d94; --line: #34312c; --brand: #7fae88; --danger: #e0806f; } }
* { box-sizing: border-box; }
body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 16px; background: var(--bg); color: var(--fg); font: 16px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; }
main { width: 100%; max-width: 420px; background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 24px; }
h1 { font-size: 1.25rem; margin: 0 0 4px; }
p { margin: 0 0 16px; color: var(--muted); }
fieldset { border: 0; padding: 0; margin: 0 0 16px; }
legend { font-weight: 600; margin-bottom: 8px; }
label { display: flex; gap: 10px; align-items: flex-start; margin-bottom: 8px; }
input[type=checkbox] { margin-top: 4px; width: 18px; height: 18px; accent-color: var(--brand); }
.field { display: block; font-weight: 600; margin-bottom: 6px; }
input.code { width: 100%; font: 1.125rem/1.5 ui-monospace, "SF Mono", Menlo, monospace; letter-spacing: 0.08em; text-transform: uppercase; padding: 10px 12px; border: 1px solid var(--line); border-radius: 8px; background: var(--bg); color: var(--fg); margin-bottom: 4px; }
.hint { font-size: 0.875rem; margin-bottom: 16px; }
.actions { display: flex; gap: 8px; }
button { flex: 1; font: inherit; font-weight: 600; padding: 10px 12px; border-radius: 8px; border: 1px solid var(--line); background: transparent; color: var(--fg); cursor: pointer; }
button[value=allow] { background: var(--brand); border-color: var(--brand); color: var(--card); }
.error { color: var(--danger); font-weight: 600; }
code { font-size: 0.875em; word-break: break-all; }
`;

function page(title: string, body: string): string {
  return `<!doctype html>
<html lang="en-AU">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escapeHtml(title)} · garnish</title>
<style>${STYLE}</style>
</head>
<body>
<main>
${body}
</main>
</body>
</html>`;
}

/**
 * The consent page: who is asking, what it may do, the pairing code, Allow and
 * Deny. `host` is the address a metadata client's document came from, shown
 * because a name is whatever the client says it is and the host is not.
 * `granted` is what the boxes start as; `error` a line in red above the form.
 */
export function consentPage(input: { clientName: string; host: string | null; params: AuthorizeParams; granted: readonly Scope[]; error?: string }): string {
  const { clientName, host, params, granted, error } = input;
  const hidden = (Object.entries(params) as [keyof AuthorizeParams, string][])
    .map(([name, value]) => `<input type="hidden" name="${name}" value="${escapeHtml(value)}">`)
    .join("\n");
  const boxes = SCOPES.map(
    (scope) =>
      `<label><input type="checkbox" name="grant" value="${scope}"${granted.includes(scope) ? " checked" : ""}><span>${escapeHtml(SCOPE_LABELS[scope])}</span></label>`
  ).join("\n");
  const from = host
    ? `<p>The request comes from <code>${escapeHtml(host)}</code>. Only allow it if you just asked for it.</p>`
    : `<p>Only allow it if you just asked for it.</p>`;
  return page(
    `Connect ${clientName}`,
    `<h1>${escapeHtml(clientName)} wants to use garnish</h1>
${from}
${error ? `<p class="error" role="alert">${escapeHtml(error)}</p>` : ""}
<form method="post">
${hidden}
<fieldset>
<legend>It may</legend>
${boxes}
</fieldset>
<label class="field" for="pairingCode">Pairing code</label>
<input id="pairingCode" class="code" name="pairingCode" type="text" placeholder="XXXX-XXXX-XXXX" autocomplete="off" autocapitalize="characters" spellcheck="false" required autofocus aria-describedby="pairingHint">
<p class="hint" id="pairingHint">In garnish, under Settings › MCP. It changes once this connection is allowed.</p>
<div class="actions">
<button type="submit" name="decision" value="deny" formnovalidate>Deny</button>
<button type="submit" name="decision" value="allow">Allow</button>
</div>
</form>`
  );
}

/** A request the consent page cannot honour, and cannot send back to the client either (an unknown client or address). */
export function problemPage(message: string): string {
  return page("Cannot connect", `<h1>Cannot connect to garnish</h1>\n<p>${escapeHtml(message)}</p>`);
}
