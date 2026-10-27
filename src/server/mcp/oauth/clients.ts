// Who is asking: a client that registered (RFC 7591) or one known by its metadata document's URL
// (Client ID Metadata Documents, which claude.ai's custom connectors use).
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { z } from "zod";

/** A client as the consent page and the token endpoint see it, wherever it came from. */
export type KnownClient = {
  id: string;
  name: string;
  redirectUris: string[];
  kind: "registered" | "metadata";
  secretHash: string | null;
  /** For a metadata client, the host its document came from: what the consent page vouches for. */
  host: string | null;
};

/** Whether a client may ask to be sent back to `uri`: https anywhere, or http on this machine (Claude Code's local callback). Pure. */
export function redirectAllowed(uri: string): boolean {
  let url: URL;
  try {
    url = new URL(uri);
  } catch {
    return false;
  }
  if (url.hash !== "") return false;
  if (url.protocol === "https:") return true;
  return url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]");
}

/**
 * Whether `uri` is one of `registered`. Exact, except that a loopback address
 * may differ in its port, which a native client picks when it starts
 * (RFC 8252 §7.3). Pure.
 */
export function redirectMatches(uri: string, registered: readonly string[]): boolean {
  if (registered.includes(uri)) return true;
  let asked: URL;
  try {
    asked = new URL(uri);
  } catch {
    return false;
  }
  if (asked.protocol !== "http:") return false;
  return registered.some((entry) => {
    try {
      const known = new URL(entry);
      return known.protocol === "http:" && known.hostname === asked.hostname && known.pathname === asked.pathname && known.search === asked.search;
    } catch {
      return false;
    }
  });
}

/** A registration request: only the fields garnish uses, the rest ignored. */
export const registrationSchema = z.object({
  redirect_uris: z.array(z.string()).min(1, "redirect_uris is required"),
  client_name: z.string().optional(),
  token_endpoint_auth_method: z.enum(["none", "client_secret_post", "client_secret_basic"]).default("client_secret_basic"),
  grant_types: z.array(z.string()).optional(),
  response_types: z.array(z.string()).optional(),
  scope: z.string().optional(),
});

/** Whether a client_id is a metadata document's address rather than an id garnish made. Pure. */
export function isMetadataClientId(clientId: string): boolean {
  if (!clientId.startsWith("https://")) return false;
  try {
    return new URL(clientId).pathname.length > 1;
  } catch {
    return false;
  }
}

/** The fields of a client metadata document garnish reads. */
const documentSchema = z.object({
  client_id: z.string(),
  client_name: z.string().optional(),
  redirect_uris: z.array(z.string()).min(1),
});

/**
 * A metadata document read into a client, or why it was refused. The
 * document must name itself by the address it was fetched from, and every
 * redirect it names must be one `redirectAllowed` accepts. Pure.
 */
export function clientFromDocument(url: string, document: unknown): { ok: true; client: KnownClient } | { ok: false; problem: string } {
  const parsed = documentSchema.safeParse(document);
  if (!parsed.success) return { ok: false, problem: "The client's metadata document is not one garnish can read." };
  if (parsed.data.client_id !== url) return { ok: false, problem: "The client's metadata document names a different client." };
  const bad = parsed.data.redirect_uris.find((uri) => !redirectAllowed(uri));
  if (bad) return { ok: false, problem: `The client's metadata document names an address garnish will not send you to: ${bad}` };
  const host = new URL(url).host;
  return {
    ok: true,
    client: {
      id: url,
      name: parsed.data.client_name?.trim().slice(0, 100) || host,
      redirectUris: parsed.data.redirect_uris,
      kind: "metadata",
      secretHash: null,
      host,
    },
  };
}

/** Whether `address` is one an outside caller must not make garnish fetch: this machine, the LAN, link-local. Pure. */
export function privateAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const [a, b] = address.split(".").map(Number) as [number, number];
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    );
  }
  const lower = address.toLowerCase();
  if (lower.startsWith("::ffff:")) return privateAddress(lower.slice(7));
  return (
    lower === "::" ||
    lower === "::1" ||
    lower.startsWith("fc") ||
    lower.startsWith("fd") ||
    lower.startsWith("fe8") ||
    lower.startsWith("fe9") ||
    lower.startsWith("fea") ||
    lower.startsWith("feb")
  );
}

/** Largest metadata document read. */
export const MAX_DOCUMENT_BYTES = 16 * 1024;

/**
 * Fetch a client metadata document. The address comes from whoever opened the
 * consent page, and garnish sits on the LAN, so it is held to a public https
 * host: no IP literals, no name that resolves to a private address, no
 * redirects, five seconds and 16 KB.
 */
export async function fetchClientDocument(url: string): Promise<unknown> {
  const target = new URL(url);
  if (target.protocol !== "https:" || isIP(target.hostname.replace(/^\[|\]$/g, "")) !== 0) throw new Error("not a public https address");
  const addresses = await lookup(target.hostname, { all: true });
  if (addresses.length === 0 || addresses.some((entry) => privateAddress(entry.address))) throw new Error("resolves to a private address");
  const response = await fetch(target, { redirect: "error", signal: AbortSignal.timeout(5000), headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`answered ${response.status}`);
  const text = await response.text();
  if (text.length > MAX_DOCUMENT_BYTES) throw new Error("too large");
  return JSON.parse(text);
}
