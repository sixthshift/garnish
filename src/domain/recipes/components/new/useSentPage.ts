import { useEffect, useRef, useState } from "react";
import { READY, type SentPage, sentPage } from "./bookmarklet";

/** How long the page is waited for. The bookmark answers within a second; past this, the link between the tabs is gone. */
export const SENT_PAGE_TIMEOUT_MS = 15_000;

/**
 * Where the wait for the bookmark's page is: `waiting` for it; `received`
 * once it came; `orphan` when this tab was not opened by the bookmark at all
 * (typed in, reloaded, or a site whose `Cross-Origin-Opener-Policy` cut the
 * tie); `timeout` when the opener never answered.
 */
export type SentPageStatus = "waiting" | "received" | "orphan" | "timeout";

/**
 * The receiving end of the Save to Garnish bookmark: while `enabled`, tell the
 * tab that opened this one it is ready, and hand the first page it sends to
 * `onPage`. Only the opener is listened to — any other window's message is
 * ignored — and only once.
 */
export function useSentPage(enabled: boolean, onPage: (page: SentPage) => void): SentPageStatus {
  const [status, setStatus] = useState<SentPageStatus>("waiting");
  const onPageRef = useRef(onPage);
  onPageRef.current = onPage;

  useEffect(() => {
    if (!enabled) return;
    const opener = window.opener as Window | null;
    if (opener === null || opener === undefined) {
      setStatus("orphan");
      return;
    }
    let done = false;
    const listen = (event: MessageEvent) => {
      if (done || event.source !== opener) return;
      const page = sentPage(event.data);
      if (page === null) return;
      done = true;
      window.clearTimeout(timer);
      setStatus("received");
      onPageRef.current(page);
    };
    window.addEventListener("message", listen);
    const timer = window.setTimeout(() => {
      if (!done) setStatus("timeout");
    }, SENT_PAGE_TIMEOUT_MS);
    // The opener is whatever recipe site the bookmark ran on, so its origin
    // cannot be named here; the message carries nothing but that we are ready.
    opener.postMessage({ type: READY }, "*");
    return () => {
      window.removeEventListener("message", listen);
      window.clearTimeout(timer);
    };
  }, [enabled]);

  return status;
}
