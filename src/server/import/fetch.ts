// The importer's `fetchPage` port (M23.5, M35.4): GET a page the way a browser
// would. The browser itself cannot read most recipe sites (CORS), so the server
// does it, exactly as `imageFetch` does for an imported recipe's image.
//
// The fetch sends a full browser header set because a default one, or even a
// bare `User-Agent`, gets a 403 from a good number of sites. A 403 gets one
// retry under a second header profile (`fetchProfiles.ts`) before this hands
// the 403 back and the importer says the site is blocking automated requests.
// That is as far as this goes: Mealie impersonates a real browser's TLS
// fingerprint with curl_cffi to get past Cloudflare, and Tandoor sidesteps the
// problem with a bookmarklet that captures the HTML the browser already has.
// Both are worth revisiting if headers alone stop being enough — see
// docs/plan.md's Log for M35.4 on Serious Eats, which they are not.
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
