// The importer's `renderPage` port (M43.1) against a fake `spawn`: the command
// line, the profile directory's lifetime, the failures, one render at a time.
// One test drives a real browser over a page served here whose recipe a
// script writes, when a browser is installed (the image, the devcontainer, or
// CHROMIUM_PATH).
import { existsSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { type ImportedRecipe, Importer } from "../../../src/domain/recipes/import";
import { FETCH_PROFILES } from "../../../src/server/import/fetchProfiles";
import { createPageRenderer, DEFAULT_CHROMIUM, findChromium, RENDER_TIMEOUT_MS, renderCommand, type Spawn } from "../../../src/server/import/render";

const URL_UNDER_TEST = new URL("https://example.test/anzac-biscuits");

/** A spawn that answers `out` with exit `code`, after `delay` ms, recording each command and whether its profile directory existed while it ran. */
function fakeSpawn(out: string, code = 0, delay = 0) {
  const calls: { cmd: string[]; timeout: number; profileExisted: boolean }[] = [];
  let running = 0;
  let overlapped = false;
  const spawn: Spawn = (cmd, { timeout }) => {
    const dir = cmd.find((arg) => arg.startsWith("--user-data-dir="))!.slice("--user-data-dir=".length);
    calls.push({ cmd, timeout, profileExisted: existsSync(dir) });
    running++;
    if (running > 1) overlapped = true;
    const exited = new Promise<number>((resolve) =>
      setTimeout(() => {
        running--;
        resolve(code);
      }, delay)
    );
    return { stdout: new Response(out).body!, exited };
  };
  return { spawn, calls, overlapped: () => overlapped };
}

const profileOf = (cmd: string[]) => cmd.find((arg) => arg.startsWith("--user-data-dir="))!.slice("--user-data-dir=".length);

describe("findChromium", () => {
  test("CHROMIUM_PATH wins, when the file is there", () => {
    expect(findChromium({ CHROMIUM_PATH: "/opt/chrome" }, (path) => path === "/opt/chrome")).toBe("/opt/chrome");
  });

  test("the image's binary otherwise", () => {
    expect(findChromium({}, (path) => path === DEFAULT_CHROMIUM)).toBe(DEFAULT_CHROMIUM);
  });

  test("null when there is no browser, so the port is left out", () => {
    expect(findChromium({ CHROMIUM_PATH: "/nowhere" }, () => false)).toBeNull();
  });
});

describe("renderCommand", () => {
  test("dumps the DOM under the fetch's Chrome user agent, Australian English, a wall-clock limit and the given profile", () => {
    const cmd = renderCommand("/usr/bin/chromium-headless-shell", URL_UNDER_TEST, "/tmp/p");
    expect(cmd[0]).toBe("/usr/bin/chromium-headless-shell");
    expect(cmd).toContain("--dump-dom");
    expect(cmd).toContain("--no-sandbox");
    expect(cmd).toContain(`--user-agent=${FETCH_PROFILES[0]!.headers["User-Agent"]}`);
    expect(cmd).toContain("--lang=en-AU");
    expect(cmd).toContain("--timeout=10000");
    expect(cmd).toContain("--user-data-dir=/tmp/p");
    expect(cmd.some((arg) => arg.startsWith("--virtual-time-budget"))).toBe(false);
    expect(cmd.at(-1)).toBe(URL_UNDER_TEST.href);
  });
});

describe("createPageRenderer", () => {
  test("answers the dump as a 200 at the address it was given", async () => {
    const fake = fakeSpawn("<html><body>drawn</body></html>");
    const page = await createPageRenderer("/bin/chrome", fake.spawn)(URL_UNDER_TEST);
    expect(page.status).toBe(200);
    expect(page.url).toBe(URL_UNDER_TEST.href);
    expect(new TextDecoder().decode(page.bytes)).toContain("drawn");
    expect(fake.calls[0]!.timeout).toBe(RENDER_TIMEOUT_MS);
  });

  test("a fresh profile directory for the run, removed after", async () => {
    const fake = fakeSpawn("<html></html>");
    await createPageRenderer("/bin/chrome", fake.spawn)(URL_UNDER_TEST);
    expect(fake.calls[0]!.profileExisted).toBe(true);
    expect(existsSync(profileOf(fake.calls[0]!.cmd))).toBe(false);
  });

  test("a non-zero exit (a kill at the timeout among them) throws, and still removes the profile", async () => {
    const fake = fakeSpawn("", 137);
    await expect(createPageRenderer("/bin/chrome", fake.spawn)(URL_UNDER_TEST)).rejects.toThrow("Chromium exited 137 on example.test");
    expect(existsSync(profileOf(fake.calls[0]!.cmd))).toBe(false);
  });

  test("an empty dump throws", async () => {
    await expect(createPageRenderer("/bin/chrome", fakeSpawn("  \n").spawn)(URL_UNDER_TEST)).rejects.toThrow("drew nothing");
  });

  test("one render at a time: a second waits for the first, even when the first fails", async () => {
    const fake = fakeSpawn("<html></html>", 0, 20);
    const render = createPageRenderer("/bin/chrome", fake.spawn);
    await Promise.all([render(URL_UNDER_TEST), render(URL_UNDER_TEST), render(URL_UNDER_TEST)]);
    expect(fake.calls).toHaveLength(3);
    expect(fake.overlapped()).toBe(false);

    const failing = fakeSpawn("", 1, 10);
    const renderFailing = createPageRenderer("/bin/chrome", failing.spawn);
    const results = await Promise.allSettled([renderFailing(URL_UNDER_TEST), renderFailing(URL_UNDER_TEST)]);
    expect(results.map((result) => result.status)).toEqual(["rejected", "rejected"]);
    expect(failing.overlapped()).toBe(false);
  });
});

/** A page whose recipe exists only once its script has run: what the plain fetch reads as no recipe. */
const DRAWN_PAGE = `<!doctype html><html><head><title>Anzac biscuits</title>
<script>
  const data = { "@context": "https://schema.org", "@type": "Recipe", name: "Anzac biscuits",
    recipeIngredient: ["1 cup plain flour", "125 g butter"], recipeInstructions: [{ "@type": "HowToStep", text: "Mix." }] };
  const tag = document.createElement("script");
  tag.type = "application/ld+json";
  tag.textContent = JSON.stringify(data);
  document.head.appendChild(tag);
</script></head><body></body></html>`;

const browser = findChromium();

describe.skipIf(browser === null)("a real browser", () => {
  test("renders a page whose recipe a script writes, and the importer finds it in the dump", async () => {
    const server = Bun.serve({ port: 0, hostname: "127.0.0.1", fetch: () => new Response(DRAWN_PAGE, { headers: { "content-type": "text/html" } }) });
    try {
      const address = `http://127.0.0.1:${server.port}/anzac`;
      const plain = async (url: URL) => ({ status: 200, url: url.href, bytes: new TextEncoder().encode(DRAWN_PAGE) });
      const model = () => Promise.reject(new Error("model was called"));
      // The plain fetch's markup has no recipe until a script runs…
      await expect(new Importer({ fetchPage: plain, model }).import({ kind: "url", url: address })).rejects.toThrow(/No recipe data/);
      // …and the browser runs it.
      const found: ImportedRecipe = await new Importer({ fetchPage: plain, renderPage: createPageRenderer(browser!), model }).import({
        kind: "url",
        url: address,
      });
      expect(found.via).toBe("render");
      expect(found.recipe.parts[0]?.ingredients).toEqual(["1 cup plain flour", "125 g butter"]);
    } finally {
      server.stop(true);
    }
  }, 40_000);
});
