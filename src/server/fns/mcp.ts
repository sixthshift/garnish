import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import mcp, { type Connection } from "../../db/models/mcp/repo";
import { IdInput } from "../../domain/reference";
import { notFoundMiddleware } from "../core/fn";
import { MCP_PATH, publicOrigin, requestOrigin } from "../mcp/config";

/** Settings › MCP: the address to give a client, the pairing code, and who is connected. */
export type McpStatus = {
  /** The address to give a client: GARNISH_PUBLIC_URL's when set, else the one this browser reached garnish at. */
  url: string;
  /** Why GARNISH_PUBLIC_URL is not used, when it is set and wrong; null otherwise. */
  problem: string | null;
  /** What the consent page asks for; replaced on every Allow and by Regenerate. */
  pairingCode: string;
  connections: Connection[];
};

/**
 * Settings › MCP's view of the door. The address is the one the browser asked
 * at — which, since the tunnel carries only the connector's paths, is the
 * LAN's — unless GARNISH_PUBLIC_URL names the public one. Read each time, so
 * setting the variable needs no restart.
 */
export const getMcpStatus = createServerFn({ method: "GET" })
  .middleware([notFoundMiddleware])
  .handler((): McpStatus => {
    const pinned = publicOrigin();
    return {
      url: `${pinned.origin ?? requestOrigin(getRequest())}${MCP_PATH}`,
      problem: pinned.problem,
      pairingCode: mcp.pairingCode(),
      connections: mcp.connections(),
    };
  });

/** Disconnect: the grant and every token under it go, so the client's next call is refused and it must ask again. */
export const disconnectClient = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .validator(IdInput)
  .handler(({ data }) => ({ id: data.id, disconnected: mcp.revokeGrant(data.id) }));

/** Regenerate: a new pairing code, the old one no longer good. Clients already connected keep their keys. */
export const regeneratePairingCode = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .handler(() => ({ pairingCode: mcp.replacePairingCode()! }));
