// GET a page with a full browser header set; a 403 gets one retry under a second profile before it is handed back.

import type { PageResponse } from "../../domain/import";
import { FETCH_PROFILES, fetchProfileForAttempt } from "./fetchProfiles";

/** How long to wait on a page before giving up. */
export const PAGE_TIMEOUT_MS = 15_000;

/** The slice of `fetch` used here; injectable for tests. Matches `imageFetch`. */
export type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

/**
 * GET `url` with a browser header profile; on a 403, once more under the next
 * profile before giving up. A single fixed header set is itself a
 * fingerprint some sites already block on its own, so a retry under a
 * different one is worth the extra round trip; a status other than 403 is
 * returned straight away; there is nothing a different profile would change
 * about a 404 or a 500. A network failure is thrown as it came: the importer
 * turns it into its own message.
 */
export function createPageFetcher(fetcher: Fetcher = fetch): (url: URL) => Promise<PageResponse> {
  return async (url) => {
    let response: Response | null = null;
    for (let attempt = 0; attempt < FETCH_PROFILES.length; attempt++) {
      response = await fetcher(url.href, {
        redirect: "follow",
        signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
        headers: fetchProfileForAttempt(attempt).headers,
      });
      if (response.status !== 403) break;
    }
    const answered = response!;
    return { status: answered.status, url: answered.url || url.href, bytes: new Uint8Array(await answered.arrayBuffer()) };
  };
}
