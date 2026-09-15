/** One browser's worth of request headers. `name` is for error messages and tests, never sent. */
export type FetchProfile = {
  name: string;
  headers: Record<string, string>;
};

const CHROME_MACOS: FetchProfile = {
  name: "Chrome on macOS",
  headers: {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-AU,en;q=0.9",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1",
  },
};

const FIREFOX_WINDOWS: FetchProfile = {
  name: "Firefox on Windows",
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:130.0) Gecko/20100101 Firefox/130.0",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-AU,en;q=0.5",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1",
  },
};

/** The profiles tried in order: the first attempt, then a 403's retry. Pure data. */
export const FETCH_PROFILES: readonly FetchProfile[] = [CHROME_MACOS, FIREFOX_WINDOWS];

/**
 * Which profile a given 0-based attempt sends. An attempt past the list's
 * end — there is no third profile — keeps sending the last one rather than
 * throwing, so a caller can loop without special-casing the tail. Pure.
 */
export function fetchProfileForAttempt(attempt: number): FetchProfile {
  const index = Math.min(Math.max(attempt, 0), FETCH_PROFILES.length - 1);
  return FETCH_PROFILES[index]!;
}
