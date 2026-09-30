// The Save to Garnish bookmark, and the two messages it trades with the new-recipe page.
//
// The bookmark runs on the recipe's own page, in the reader's browser, which
// already got past whatever wall stops this server's fetch. It cannot send
// the page to Garnish itself: the page is https and Garnish is http on the
// LAN, so a request would be blocked as mixed content, and many sites' CSP
// forbids it anyway. So it opens Garnish in a new tab, which is navigation
// and allowed, waits for that tab to say it is ready, and posts the page's
// markup to it.

/** Garnish's tab, to the recipe's: ready to be sent the page. */
export const READY = "garnish:ready";
/** The recipe's tab, to Garnish's: the page. */
export const PAGE = "garnish:page";

/** What the bookmark sends. */
export type SentPage = { html: string; url: string; title: string };

/** Where the bookmark opens Garnish. */
export const RECEIVER_PATH = "/recipes/new?source=page";

/**
 * The bookmark's address for a Garnish served at `origin`. The markup is
 * taken at the press, and posted only to `origin` and only to the tab it
 * opened, so no other page and no other window ever sees it. Pure.
 */
export function bookmarklet(origin: string): string {
  const script = [
    "(()=>{",
    `const g=${JSON.stringify(origin)};`,
    `const w=window.open(g+${JSON.stringify(RECEIVER_PATH)},"_blank");`,
    'if(!w){alert("Allow pop-ups on this site to send it to Garnish.");return}',
    `const d={type:${JSON.stringify(PAGE)},html:document.documentElement.outerHTML,url:location.href,title:document.title};`,
    `const f=e=>{if(e.source!==w||e.origin!==g||!e.data||e.data.type!==${JSON.stringify(READY)})return;removeEventListener("message",f);w.postMessage(d,g)};`,
    'addEventListener("message",f)',
    "})()",
  ].join("");
  return `javascript:${encodeURIComponent(script)}`;
}

/** A message's data as a sent page, or null when it is anything else. Pure. */
export function sentPage(data: unknown): SentPage | null {
  if (typeof data !== "object" || data === null) return null;
  const { type, html, url, title } = data as Record<string, unknown>;
  if (type !== PAGE || typeof html !== "string" || typeof url !== "string") return null;
  if (html.trim() === "" || !/^https?:\/\//i.test(url)) return null;
  return { html, url, title: typeof title === "string" ? title : "" };
}
