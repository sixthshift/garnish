// The OAuth 2.1 authorization server behind the MCP door (decisions.md row 181), as Request -> Response
// handlers over injected ports, so a test runs the whole flow with a fake clock and a fake document fetch.
//
// The flow it serves, as the MCP authorization spec draws it:
//   1. /api/mcp answers 401 naming the protected-resource metadata    (RFC 9728)
//   2. that names this server, whose own metadata names the endpoints (RFC 8414)
//   3. the client registers (RFC 7591) or brings a metadata document (CIMD)
//   4. the browser opens /api/oauth/authorize: the consent page, the pairing code, Allow
//   5. the client trades the code and its PKCE verifier for tokens    (RFC 7636)
//   6. every MCP request carries the access token, bound to /api/mcp  (RFC 8707)
import type { HeldToken, McpRepository } from "../../../db/models/mcp/repo";
import { MCP_PATH, type McpSettings, OAUTH_PATHS } from "../config";
import { clientFromDocument, isMetadataClientId, type KnownClient, redirectAllowed, redirectMatches, registrationSchema } from "./clients";
import { type AuthorizeParams, consentPage, problemPage } from "./consentPage";
import { AttemptLimit, CodeStore } from "./memory";
import {
  ACCESS_TOKEN_SECONDS,
  after,
  CODE_SECONDS,
  hashSecret,
  newSecret,
  parseScope,
  REFRESH_GRACE_SECONDS,
  REFRESH_TOKEN_SECONDS,
  SCOPES,
  type Scope,
  samePairingCode,
  verifyPkce,
} from "./tokens";

/** What the server needs from outside: its addresses for a request, its store, the clock, and the way to read a client's metadata document. */
export type OauthPorts = {
  settings: (request: Request) => McpSettings;
  repo: McpRepository;
  now: () => Date;
  fetchClientDocument: (url: string) => Promise<unknown>;
};

/** Who an access token speaks for: the grant it was issued under and what it may do. */
export type Caller = { grantId: string; clientId: string; clientName: string; scopes: Scope[] };

/**
 * Wrong pairing codes allowed a minute before the consent page stops checking
 * until the minute is out. Light, since a 60-bit code is not guessed at any
 * rate this lets through, and short, so nobody can lock the household out.
 */
export const PAIRING_ATTEMPTS_PER_MINUTE = 10;
/** Registrations allowed in an hour. A client registers once per connection. */
export const REGISTRATIONS_PER_HOUR = 30;
/** Token requests allowed per client per minute. */
export const TOKEN_REQUESTS_PER_MINUTE = 30;
/** A registered client nobody allowed in is forgotten after a day. */
const STALE_CLIENT_SECONDS = 24 * 60 * 60;

const json = (body: unknown, status = 200, headers: Record<string, string> = {}): Response =>
  Response.json(body, { status, headers: { "cache-control": "no-store", ...headers } });

/** An OAuth error body (RFC 6749 §5.2). */
const oauthError = (error: string, description: string, status = 400): Response => json({ error, error_description: description }, status);

const html = (body: string, status = 200): Response =>
  new Response(body, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-frame-options": "DENY",
      "content-security-policy":
        "default-src 'none'; style-src 'unsafe-inline'; form-action 'self' https: http://localhost:* http://127.0.0.1:*; frame-ancestors 'none'",
      "referrer-policy": "no-referrer",
    },
  });

/** The address a client is sent back to, with `params` added and the issuer named (RFC 9207). */
function backTo(redirectUri: string, params: Record<string, string>, issuer: string): Response {
  const url = new URL(redirectUri);
  for (const [key, value] of Object.entries(params)) if (value !== "") url.searchParams.set(key, value);
  url.searchParams.set("iss", issuer);
  return new Response(null, { status: 302, headers: { location: url.toString(), "cache-control": "no-store" } });
}

/** A form or JSON body as flat strings; anything else is empty. */
async function readForm(request: Request): Promise<Record<string, string>> {
  const type = request.headers.get("content-type") ?? "";
  try {
    if (type.includes("application/json")) {
      const body = (await request.json()) as Record<string, unknown>;
      return Object.fromEntries(Object.entries(body).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
    }
    const form = await request.formData();
    const out: Record<string, string> = {};
    for (const [key, value] of form) if (typeof value === "string" && !(key in out)) out[key] = value;
    return out;
  } catch {
    return {};
  }
}

/** The client's credentials from HTTP Basic or the body (RFC 6749 §2.3.1). */
function clientCredentials(request: Request, body: Record<string, string>): { clientId: string; secret: string | null } {
  const header = request.headers.get("authorization") ?? "";
  if (header.toLowerCase().startsWith("basic ")) {
    const decoded = Buffer.from(header.slice(6).trim(), "base64").toString("utf8");
    const colon = decoded.indexOf(":");
    if (colon > 0) return { clientId: decodeURIComponent(decoded.slice(0, colon)), secret: decodeURIComponent(decoded.slice(colon + 1)) };
  }
  return { clientId: body.client_id ?? "", secret: body.client_secret ?? null };
}

const trimSlash = (text: string): string => text.replace(/\/+$/, "");

export function oauthServer(ports: OauthPorts) {
  const codes = new CodeStore();
  const pairingFailures = new AttemptLimit(PAIRING_ATTEMPTS_PER_MINUTE, 60 * 1000);
  const registrations = new AttemptLimit(REGISTRATIONS_PER_HOUR, 60 * 60 * 1000);
  const tokenRequests = new AttemptLimit(TOKEN_REQUESTS_PER_MINUTE, 60 * 1000);
  /** Metadata documents read in the last hour, by URL, so a consent page and its POST fetch once. */
  const documents = new Map<string, { client: KnownClient; at: number }>();

  /** A client by id: a stored one, or a metadata client read from its document. Null with the reason when neither. */
  async function findClient(clientId: string): Promise<{ client: KnownClient } | { problem: string }> {
    if (isMetadataClientId(clientId)) {
      const now = ports.now().getTime();
      const cached = documents.get(clientId);
      if (cached && cached.at > now - 60 * 60 * 1000) return { client: cached.client };
      let document: unknown;
      try {
        document = await ports.fetchClientDocument(clientId);
      } catch (error) {
        return { problem: `garnish could not read the client's metadata document (${error instanceof Error ? error.message : String(error)}).` };
      }
      const read = clientFromDocument(clientId, document);
      if (!read.ok) return { problem: read.problem };
      documents.set(clientId, { client: read.client, at: now });
      return { client: read.client };
    }
    const row = ports.repo.client(clientId);
    if (!row) return { problem: "garnish does not know this client. Remove the connector and add it again." };
    return { client: { id: row.id, name: row.name, redirectUris: row.redirectUris, kind: row.kind, secretHash: row.secretHash, host: null } };
  }

  /** Issue an access and a refresh token under `grantId`. */
  function issue(grantId: string, scopes: readonly Scope[], resource: string): Response {
    const now = ports.now();
    const access = newSecret("gat");
    const refresh = newSecret("grt");
    ports.repo.storeToken({ hash: hashSecret(access), grantId, kind: "access", resource, expiresAt: after(now, ACCESS_TOKEN_SECONDS) });
    ports.repo.storeToken({ hash: hashSecret(refresh), grantId, kind: "refresh", resource, expiresAt: after(now, REFRESH_TOKEN_SECONDS) });
    ports.repo.sweep(now.toISOString(), after(now, -STALE_CLIENT_SECONDS));
    return json({ access_token: access, token_type: "Bearer", expires_in: ACCESS_TOKEN_SECONDS, refresh_token: refresh, scope: scopes.join(" ") }, 200, {
      pragma: "no-cache",
    });
  }

  /** The authorization request's parameters, checked as far as they can be without a person. */
  async function readAuthorize(
    fields: Record<string, string>,
    site: McpSettings
  ): Promise<{ page: Response } | { redirect: Response } | { client: KnownClient; params: AuthorizeParams; scopes: Scope[] }> {
    const clientId = fields.client_id ?? "";
    const redirectUri = fields.redirect_uri ?? "";
    if (clientId === "") return { page: html(problemPage("The request names no client."), 400) };
    const found = await findClient(clientId);
    if ("problem" in found) return { page: html(problemPage(found.problem), 400) };
    const { client } = found;
    // An address the client never registered is never redirected to: the error stays on this page (RFC 6749 §4.1.2.1).
    if (redirectUri === "" || !redirectMatches(redirectUri, client.redirectUris)) {
      return { page: html(problemPage("The request asks to send you to an address this client did not register."), 400) };
    }
    const state = fields.state ?? "";
    const fail = (error: string, description: string) => ({ redirect: backTo(redirectUri, { error, error_description: description, state }, site.issuer) });
    if (fields.response_type !== "code") return fail("unsupported_response_type", "Only the authorization code flow is supported.");
    if (!fields.code_challenge || fields.code_challenge_method !== "S256") return fail("invalid_request", "PKCE with S256 is required.");
    const resource = trimSlash(fields.resource ?? site.resource);
    if (resource !== site.resource) return fail("invalid_target", "The only resource here is garnish's MCP endpoint.");
    const scopes = parseScope(fields.scope);
    if (scopes.length === 0) return fail("invalid_scope", `Known scopes: ${SCOPES.join(", ")}.`);
    return {
      client,
      scopes,
      params: { clientId, redirectUri, state, codeChallenge: fields.code_challenge, scope: scopes.join(" "), resource },
    };
  }

  return {
    /** GET /.well-known/oauth-protected-resource[/api/mcp] (RFC 9728): who guards the MCP endpoint. */
    protectedResource(request: Request): Response {
      const site = ports.settings(request);
      return json(
        {
          resource: site.resource,
          authorization_servers: [site.issuer],
          scopes_supported: SCOPES,
          bearer_methods_supported: ["header"],
          resource_name: "garnish",
        },
        200,
        { "access-control-allow-origin": "*" }
      );
    },

    /** GET /.well-known/oauth-authorization-server (RFC 8414): where each step of the flow is. */
    authorizationServer(request: Request): Response {
      const site = ports.settings(request);
      return json(
        {
          issuer: site.issuer,
          authorization_endpoint: `${site.issuer}${OAUTH_PATHS.authorize}`,
          token_endpoint: `${site.issuer}${OAUTH_PATHS.token}`,
          registration_endpoint: `${site.issuer}${OAUTH_PATHS.register}`,
          revocation_endpoint: `${site.issuer}${OAUTH_PATHS.revoke}`,
          response_types_supported: ["code"],
          grant_types_supported: ["authorization_code", "refresh_token"],
          code_challenge_methods_supported: ["S256"],
          token_endpoint_auth_methods_supported: ["none", "client_secret_post", "client_secret_basic"],
          revocation_endpoint_auth_methods_supported: ["none", "client_secret_post", "client_secret_basic"],
          scopes_supported: SCOPES,
          authorization_response_iss_parameter_supported: true,
          client_id_metadata_document_supported: true,
        },
        200,
        { "access-control-allow-origin": "*" }
      );
    },

    /** POST /api/oauth/register (RFC 7591): a client introduces itself and gets a client_id. */
    async register(request: Request): Promise<Response> {
      if (!registrations.take("register", ports.now().getTime())) return oauthError("too_many_requests", "Too many registrations. Try again later.", 429);
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return oauthError("invalid_client_metadata", "The registration must be JSON.");
      }
      const parsed = registrationSchema.safeParse(body);
      if (!parsed.success) return oauthError("invalid_client_metadata", parsed.error.issues[0]?.message ?? "Invalid registration.");
      const meta = parsed.data;
      const bad = meta.redirect_uris.find((uri) => !redirectAllowed(uri));
      if (bad) return oauthError("invalid_redirect_uri", `Redirect addresses must be https, or http on localhost: ${bad}`);
      const confidential = meta.token_endpoint_auth_method !== "none";
      const secret = confidential ? newSecret("gcs") : null;
      const name = meta.client_name?.trim().slice(0, 100) || "MCP client";
      const client = ports.repo.registerClient({ name, redirectUris: meta.redirect_uris, secretHash: secret ? hashSecret(secret) : null });
      return json(
        {
          client_id: client.id,
          client_id_issued_at: Math.floor(ports.now().getTime() / 1000),
          ...(secret ? { client_secret: secret, client_secret_expires_at: 0 } : {}),
          client_name: name,
          redirect_uris: meta.redirect_uris,
          token_endpoint_auth_method: meta.token_endpoint_auth_method,
          grant_types: ["authorization_code", "refresh_token"],
          response_types: ["code"],
          scope: SCOPES.join(" "),
        },
        201
      );
    },

    /** GET /api/oauth/authorize: the consent page, or the reason there is none. */
    async authorizePage(request: Request): Promise<Response> {
      const site = ports.settings(request);
      const fields = Object.fromEntries(new URL(request.url).searchParams);
      const read = await readAuthorize(fields, site);
      if ("page" in read) return read.page;
      if ("redirect" in read) return read.redirect;
      return html(consentPage({ clientName: read.client.name, host: read.client.host, params: read.params, granted: read.scopes }));
    },

    /**
     * POST /api/oauth/authorize: the consent page's answer. Allow with the
     * pairing code sends the browser back with an authorization code, and
     * replaces the pairing code, so the one just typed is never good again.
     */
    async authorizeAnswer(request: Request): Promise<Response> {
      const site = ports.settings(request);
      // The consent page posts a urlencoded form; `grant` repeats, once per ticked box.
      const posted = new URLSearchParams(await request.text().catch(() => ""));
      const form = Object.fromEntries(posted);
      const read = await readAuthorize(
        {
          client_id: form.clientId ?? "",
          redirect_uri: form.redirectUri ?? "",
          state: form.state ?? "",
          code_challenge: form.codeChallenge ?? "",
          code_challenge_method: "S256",
          response_type: "code",
          scope: form.scope ?? "",
          resource: form.resource ?? "",
        },
        site
      );
      if ("page" in read) return read.page;
      if ("redirect" in read) return read.redirect;
      const { client, params } = read;

      if (form.decision !== "allow")
        return backTo(params.redirectUri, { error: "access_denied", error_description: "The request was denied.", state: params.state }, site.issuer);

      // Only the scopes the client asked for, and of those only the ticked ones.
      const ticked = new Set(posted.getAll("grant"));
      const granted = read.scopes.filter((scope) => ticked.has(scope));
      const again = (error: string, status = 200) => html(consentPage({ clientName: client.name, host: client.host, params, granted, error }), status);

      const now = ports.now().getTime();
      if (granted.length === 0) return again("Tick at least one thing it may do, or press Deny.");
      if (pairingFailures.blocked("pairing", now)) return again("Too many wrong codes. Wait a minute and try again.", 429);
      const pairing = ports.repo.pairingCode();
      if (!samePairingCode(form.pairingCode ?? "", pairing)) {
        pairingFailures.take("pairing", now);
        return again("That code is not right. It is in garnish, under Settings › MCP.", 401);
      }

      if (client.kind === "metadata") ports.repo.saveMetadataClient({ id: client.id, name: client.name, redirectUris: client.redirectUris });
      const code = newSecret("gac");
      const stored = codes.put(
        code,
        {
          clientId: client.id,
          redirectUri: params.redirectUri,
          scopes: granted,
          codeChallenge: params.codeChallenge,
          resource: params.resource,
          expiresAt: now + CODE_SECONDS * 1000,
        },
        now
      );
      if (!stored) return again("garnish is busy. Try again in a minute.", 503);
      // Spend the pairing code; if another Allow spent it first, this one gets nothing.
      if (ports.repo.replacePairingCode(pairing) === null) {
        codes.take(code, now);
        return again("That code was just used. Use the new one in Settings › MCP.", 409);
      }
      return backTo(params.redirectUri, { code, state: params.state }, site.issuer);
    },

    /** POST /api/oauth/token: a code and its verifier, or a refresh token, for a fresh pair of tokens. */
    async token(request: Request): Promise<Response> {
      const body = await readForm(request);
      const { clientId, secret } = clientCredentials(request, body);
      if (clientId === "") return oauthError("invalid_client", "client_id is required.", 401);
      if (!tokenRequests.take(clientId, ports.now().getTime())) return oauthError("too_many_requests", "Too many token requests. Try again shortly.", 429);

      const stored = ports.repo.client(clientId);
      if (!stored) return oauthError("invalid_client", "Unknown client.", 401);
      if (stored.secretHash !== null && (secret === null || hashSecret(secret) !== stored.secretHash))
        return oauthError("invalid_client", "Client authentication failed.", 401);

      if (body.grant_type === "authorization_code") {
        const pending = codes.take(body.code ?? "", ports.now().getTime());
        if (!pending || pending.clientId !== clientId || pending.redirectUri !== body.redirect_uri)
          return oauthError("invalid_grant", "The authorization code is invalid or expired.");
        if (!verifyPkce(body.code_verifier ?? "", pending.codeChallenge)) return oauthError("invalid_grant", "The code verifier does not match.");
        if (body.resource && trimSlash(body.resource) !== pending.resource) return oauthError("invalid_target", "The code was issued for another resource.");
        const grant = ports.repo.createGrant(clientId, pending.scopes.join(" "));
        return issue(grant.id, pending.scopes, pending.resource);
      }

      if (body.grant_type === "refresh_token") {
        const held = ports.repo.token(hashSecret(body.refresh_token ?? ""));
        const now = ports.now();
        if (held?.kind !== "refresh" || held.client.id !== clientId || held.expiresAt <= now.toISOString()) {
          return oauthError("invalid_grant", "The refresh token is invalid or expired.");
        }
        if (!ports.repo.spendToken(held.hash, now.toISOString())) {
          // Spent already. A retry inside the grace gets a fresh pair; later, it is a stolen token, and the grant goes.
          const spentAt = held.usedAt ? new Date(held.usedAt).getTime() : 0;
          if (now.getTime() - spentAt > REFRESH_GRACE_SECONDS * 1000) {
            ports.repo.revokeGrant(held.grantId);
            return oauthError("invalid_grant", "The refresh token was already used. Connect again.");
          }
        }
        return issue(held.grantId, parseScope(held.grant.scope), held.resource);
      }

      return oauthError("unsupported_grant_type", "Supported: authorization_code, refresh_token.");
    },

    /** POST /api/oauth/revoke (RFC 7009): a client hangs up; its grant and every token under it go. Always 200. */
    async revoke(request: Request): Promise<Response> {
      const body = await readForm(request);
      const { clientId } = clientCredentials(request, body);
      const held = ports.repo.token(hashSecret(body.token ?? ""));
      if (held && held.client.id === clientId) ports.repo.revokeGrant(held.grantId);
      return json({});
    },

    /**
     * Who a request to the MCP endpoint speaks for: a live access token for
     * this resource, or null. Notes the grant as used, for Settings.
     */
    authenticate(request: Request): Caller | null {
      const site = ports.settings(request);
      const header = request.headers.get("authorization") ?? "";
      const match = /^Bearer\s+(\S+)$/i.exec(header);
      if (!match) return null;
      const held: HeldToken | null = ports.repo.token(hashSecret(match[1]!));
      const now = ports.now().toISOString();
      if (held?.kind !== "access" || held.expiresAt <= now || held.resource !== site.resource) return null;
      ports.repo.touchGrant(held.grantId, now);
      return { grantId: held.grantId, clientId: held.client.id, clientName: held.client.name, scopes: parseScope(held.grant.scope) };
    },

    /** The 401 an MCP request without a good token gets: where to start (RFC 9728 §5.1). */
    challenge(request: Request, error?: "invalid_token" | "insufficient_scope"): Response {
      const site = ports.settings(request);
      const metadata = `${site.issuer}/.well-known/oauth-protected-resource${MCP_PATH}`;
      const status = error === "insufficient_scope" ? 403 : 401;
      return json({ error: error ?? "unauthorized", error_description: "garnish needs an access token. Connect it from your MCP client." }, status, {
        "www-authenticate": `Bearer resource_metadata="${metadata}", scope="${SCOPES.join(" ")}"${error ? `, error="${error}"` : ""}`,
      });
    },
  };
}

export type OauthServer = ReturnType<typeof oauthServer>;
