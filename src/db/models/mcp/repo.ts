import type { Database } from "bun:sqlite";
import { and, desc, eq, isNull, lt, notExists, sql } from "drizzle-orm";
import { lazy } from "../../../lib/lazy";
import { getDb } from "../../../server/core/db";
import { orm } from "../../connection/client";
import { mcpPairing, oauthClient, oauthGrant, oauthToken } from "./schema";

export type OauthClient = typeof oauthClient.$inferSelect;
export type OauthGrant = typeof oauthGrant.$inferSelect;
export type OauthToken = typeof oauthToken.$inferSelect;

/** A token as the server checks it: the row, its grant, and the client the grant was given to. */
export type HeldToken = OauthToken & { grant: OauthGrant; client: OauthClient };

/** One connection as Settings › MCP lists it. */
export type Connection = {
  id: string;
  clientId: string;
  clientName: string;
  scope: string;
  createdAt: string;
  lastUsedAt: string | null;
};

/** Crockford's base32: no I, L, O or U, so a code read aloud or off a screen is not misread. */
const PAIRING_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** A fresh pairing code: twelve random characters in groups of four, `K7QF-M2XP-9RTD`, 60 bits. */
export function newPairingCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  const chars = Array.from(bytes, (byte) => PAIRING_ALPHABET[byte % 32]);
  return [0, 4, 8].map((start) => chars.slice(start, start + 4).join("")).join("-");
}

export type TokenInput = { hash: string; grantId: string; kind: OauthToken["kind"]; resource: string; expiresAt: string };

/**
 * The OAuth server's memory (023_mcp.sql, 024_mcp_pairing.sql): the clients
 * that introduced themselves, the grants the household made them, the hashes
 * of the tokens those grants hold, and the pairing code that lets the next
 * one in. No token is ever stored as itself.
 */
export function mcpRepository(db: Database) {
  const dz = orm(db);

  const client = (id: string): OauthClient | null => dz.select().from(oauthClient).where(eq(oauthClient.id, id)).get() ?? null;
  const grant = (id: string): OauthGrant | null => dz.select().from(oauthGrant).where(eq(oauthGrant.id, id)).get() ?? null;

  /** The pairing code, made the first time it is asked for. */
  const pairingCode = (): string => {
    dz.insert(mcpPairing).values({ id: 1, code: newPairingCode() }).onConflictDoNothing().run();
    return dz.select({ code: mcpPairing.code }).from(mcpPairing).where(eq(mcpPairing.id, 1)).get()!.code;
  };

  return {
    client,
    grant,

    /** A client that registered (RFC 7591): garnish makes its id. */
    registerClient(input: { name: string; redirectUris: string[]; secretHash: string | null }): OauthClient {
      const id = crypto.randomUUID();
      dz.insert(oauthClient)
        .values({ id, kind: "registered", ...input })
        .run();
      return client(id)!;
    },

    /**
     * A client known by its metadata document's URL, kept the first time it is
     * allowed in (the grant needs a row to point at) and refreshed from the
     * document every time after, since the document is the client's to change.
     */
    saveMetadataClient(input: { id: string; name: string; redirectUris: string[] }): OauthClient {
      dz.insert(oauthClient)
        .values({ ...input, kind: "metadata", secretHash: null })
        .onConflictDoUpdate({ target: oauthClient.id, set: { name: input.name, redirectUris: input.redirectUris } })
        .run();
      return client(input.id)!;
    },

    /** One Allow: the client and the scopes it was given. */
    createGrant(clientId: string, scope: string): OauthGrant {
      const id = crypto.randomUUID();
      dz.insert(oauthGrant).values({ id, clientId, scope }).run();
      return grant(id)!;
    },

    /** Every connection, the one used most recently first. */
    connections(): Connection[] {
      return dz
        .select({
          id: oauthGrant.id,
          clientId: oauthGrant.clientId,
          clientName: oauthClient.name,
          scope: oauthGrant.scope,
          createdAt: oauthGrant.createdAt,
          lastUsedAt: oauthGrant.lastUsedAt,
        })
        .from(oauthGrant)
        .innerJoin(oauthClient, eq(oauthClient.id, oauthGrant.clientId))
        .orderBy(desc(sql`coalesce(${oauthGrant.lastUsedAt}, ${oauthGrant.createdAt})`))
        .all();
    },

    /** Disconnect: the grant and every token under it. True when there was one. */
    revokeGrant: (id: string): boolean => dz.delete(oauthGrant).where(eq(oauthGrant.id, id)).returning({ id: oauthGrant.id }).all().length > 0,

    /** Note that a grant's key was just used, for Settings' "last used". */
    touchGrant(id: string, at: string): void {
      dz.update(oauthGrant).set({ lastUsedAt: at }).where(eq(oauthGrant.id, id)).run();
    },

    storeToken(input: TokenInput): void {
      dz.insert(oauthToken).values(input).run();
    },

    /** The token with this hash, its grant and its client, or null. Expiry is the caller's to judge. */
    token(hash: string): HeldToken | null {
      const row = dz
        .select({ token: oauthToken, grant: oauthGrant, client: oauthClient })
        .from(oauthToken)
        .innerJoin(oauthGrant, eq(oauthGrant.id, oauthToken.grantId))
        .innerJoin(oauthClient, eq(oauthClient.id, oauthGrant.clientId))
        .where(eq(oauthToken.hash, hash))
        .get();
      return row ? { ...row.token, grant: row.grant, client: row.client } : null;
    },

    /** Mark a refresh token spent. False when it already was, so two racing refreshes cannot both win. */
    spendToken(hash: string, at: string): boolean {
      return (
        dz
          .update(oauthToken)
          .set({ usedAt: at })
          .where(and(eq(oauthToken.hash, hash), isNull(oauthToken.usedAt)))
          .returning({ hash: oauthToken.hash })
          .all().length > 0
      );
    },

    pairingCode,

    /**
     * A new pairing code in place of the old. With `expected`, only while the
     * code is still that one, so two Allows racing on one code cannot both use
     * it: null for the loser.
     */
    replacePairingCode(expected?: string): string | null {
      pairingCode();
      const code = newPairingCode();
      const replaced = dz
        .update(mcpPairing)
        .set({ code, createdAt: new Date().toISOString() })
        .where(expected === undefined ? eq(mcpPairing.id, 1) : and(eq(mcpPairing.id, 1), eq(mcpPairing.code, expected)))
        .returning({ code: mcpPairing.code })
        .all();
      return replaced.length > 0 ? code : null;
    },

    /**
     * Forget what can no longer be used at `now` (ISO): expired tokens, and
     * registered clients older than `staleBefore` that were never allowed in,
     * which is what an abandoned or unanswered registration leaves.
     */
    sweep(now: string, staleBefore: string): void {
      dz.delete(oauthToken).where(lt(oauthToken.expiresAt, now)).run();
      dz.delete(oauthClient)
        .where(
          and(
            lt(oauthClient.createdAt, staleBefore),
            notExists(dz.select({ id: oauthGrant.id }).from(oauthGrant).where(eq(oauthGrant.clientId, oauthClient.id)))
          )
        )
        .run();
    },
  };
}

export type McpRepository = ReturnType<typeof mcpRepository>;

/** The repository over the application database. Tests build their own with `mcpRepository(db)`. */
export default lazy(getDb, mcpRepository);
