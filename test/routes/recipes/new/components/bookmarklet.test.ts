// The Save to Garnish bookmark, run against a fake recipe tab: it opens
// Garnish, waits for Garnish's tab to say it is ready, and sends the page to
// that tab and that origin only.
import { expect, test, vi } from "vitest";
import { bookmarklet, PAGE, READY, RECEIVER_PATH, sentPage } from "../../../../../src/routes/recipes/new/components/bookmarklet";

const GARNISH = "http://garnish.lan:9988";

/** Run the bookmark's code in a fake recipe tab. */
function press(code: string, opened: { postMessage: ReturnType<typeof vi.fn> } | null) {
  expect(code.startsWith("javascript:")).toBe(true);
  const listeners = new Set<(event: { source: unknown; origin: string; data: unknown }) => void>();
  const tab = {
    open: vi.fn(() => opened),
    alert: vi.fn(),
    document: { documentElement: { outerHTML: "<html><body>Anzac biscuits</body></html>" }, title: "Anzac biscuits" },
    location: { href: "https://recipes.example/anzac" },
    addEventListener: (_: string, f: never) => listeners.add(f),
    removeEventListener: (_: string, f: never) => listeners.delete(f),
  };
  const run = new Function(
    "window",
    "document",
    "location",
    "addEventListener",
    "removeEventListener",
    "alert",
    decodeURIComponent(code.slice("javascript:".length))
  );
  run({ open: tab.open }, tab.document, tab.location, tab.addEventListener, tab.removeEventListener, tab.alert);
  const dispatch = (event: { source: unknown; origin: string; data: unknown }) => {
    for (const f of [...listeners]) f(event);
  };
  return { tab, listeners, dispatch };
}

test("opens Garnish's receiving page in a new tab", () => {
  const opened = { postMessage: vi.fn() };
  const { tab } = press(bookmarklet(GARNISH), opened);
  expect(tab.open).toHaveBeenCalledWith(GARNISH + RECEIVER_PATH, "_blank");
});

test("sends the page once Garnish's tab is ready, to Garnish's origin, and stops listening", () => {
  const opened = { postMessage: vi.fn() };
  const { dispatch, listeners } = press(bookmarklet(GARNISH), opened);
  expect(opened.postMessage).not.toHaveBeenCalled();

  dispatch({ source: opened, origin: GARNISH, data: { type: READY } });
  expect(opened.postMessage).toHaveBeenCalledWith(
    { type: PAGE, html: "<html><body>Anzac biscuits</body></html>", url: "https://recipes.example/anzac", title: "Anzac biscuits" },
    GARNISH
  );
  expect(listeners.size).toBe(0);
});

test("ignores a ready from any other window or origin", () => {
  const opened = { postMessage: vi.fn() };
  const { dispatch } = press(bookmarklet(GARNISH), opened);
  dispatch({ source: {}, origin: GARNISH, data: { type: READY } });
  dispatch({ source: opened, origin: "https://evil.example", data: { type: READY } });
  dispatch({ source: opened, origin: GARNISH, data: { type: "something else" } });
  expect(opened.postMessage).not.toHaveBeenCalled();
});

test("says so when the site blocked the pop-up", () => {
  const { tab, listeners } = press(bookmarklet(GARNISH), null);
  expect(tab.alert).toHaveBeenCalledWith(expect.stringMatching(/pop-ups/));
  expect(listeners.size).toBe(0);
});

test("sentPage takes the bookmark's message and nothing else", () => {
  const page = { type: PAGE, html: "<html></html>", url: "https://recipes.example/anzac", title: "Anzac" };
  expect(sentPage(page)).toEqual({ html: "<html></html>", url: "https://recipes.example/anzac", title: "Anzac" });
  expect(sentPage({ ...page, title: undefined })?.title).toBe("");
  expect(sentPage({ ...page, type: READY })).toBeNull();
  expect(sentPage({ ...page, html: " " })).toBeNull();
  expect(sentPage({ ...page, url: "javascript:alert(1)" })).toBeNull();
  expect(sentPage("<html></html>")).toBeNull();
  expect(sentPage(null)).toBeNull();
});
