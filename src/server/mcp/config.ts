// Where the MCP door is (decisions.md row 181): the addresses it answers on, from the request that
// reached it, or from GARNISH_PUBLIC_URL when that is set. Always open; the pairing code is the guard.

type Env = Record<string, string | undefined>;

/** Where the door is, for one request: the origin the client reached, and the MCP endpoint under it. */
export type McpSettings = {
  /** The origin, no trailing slash: the OAuth issuer, and the base of every address the metadata names. */
  issuer: string;
  /** The MCP endpoint: the resource every token is bound to (RFC 8707). */
  resource: string;
};

/** The MCP endpoint's path, under the origin. */
export const MCP_PATH = "/api/mcp";
/** The OAuth server's own endpoints. */
export const OAUTH_PATHS = {
  authorize: "/api/oauth/authorize",
  token: "/api/oauth/token",
  register: "/api/oauth/register",
  revoke: "/api/oauth/revoke",
} as const;

/**
 * `GARNISH_PUBLIC_URL` read: the origin it names, null when unset, or why it
 * cannot be used. Optional: it pins the address for a tunnel that does not
 * say it is https, and gives Settings the public address to show. Pure.
 */
export function publicOrigin(env: Env = process.env): { origin: string | null; problem: string | null } {
  const url = env.GARNISH_PUBLIC_URL?.trim() ?? "";
  if (url === "") return { origin: null, problem: null };
  let origin: URL;
  try {
    origin = new URL(url);
  } catch {
    return { origin: null, problem: `GARNISH_PUBLIC_URL is not an address: ${url}` };
  }
  const loopback = origin.hostname === "localhost" || origin.hostname === "127.0.0.1";
  if (origin.protocol !== "https:" && !(origin.protocol === "http:" && loopback)) {
    return { origin: null, problem: "GARNISH_PUBLIC_URL must be https (http only for localhost)." };
  }
  if (origin.pathname !== "/" || origin.search !== "" || origin.hash !== "") {
    return { origin: null, problem: "GARNISH_PUBLIC_URL must be an origin alone, like https://garnish.example.com." };
  }
  return { origin: origin.origin, problem: null };
}

const first = (header: string | null): string => header?.split(",")[0]?.trim() ?? "";

/**
 * The origin a request reached: the host it asked for, and https when a
 * proxy in front says so. Behind a tunnel the request arrives as plain http
 * from the tunnel, naming the public host and `X-Forwarded-Proto: https`;
 * on the LAN it is the address the person typed. A forged header changes
 * only the answer to the request that forged it. Pure.
 */
export function requestOrigin(request: Request): string {
  const url = new URL(request.url);
  const proto = first(request.headers.get("x-forwarded-proto")).toLowerCase();
  const scheme = proto === "https" || proto === "http" ? proto : url.protocol.slice(0, -1);
  const host = first(request.headers.get("x-forwarded-host")) || first(request.headers.get("host")) || url.host;
  // A host and an optional port, nothing that could carry a path or a login into the address.
  if (!/^[a-z0-9.-]+(:\d{1,5})?$|^\[[0-9a-f:.]+\](:\d{1,5})?$/i.test(host)) return url.origin;
  return new URL(`${scheme}://${host}`).origin;
}

/** The door's addresses for `request`: GARNISH_PUBLIC_URL when it is set and sound, else the origin the request reached. */
export function mcpSettings(request: Request, env: Env = process.env): McpSettings {
  const issuer = publicOrigin(env).origin ?? requestOrigin(request);
  return { issuer, resource: `${issuer}${MCP_PATH}` };
}
