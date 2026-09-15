// The editor's toolbar (M22.2). Static render only (no jsdom in this project's
// vitest config).
import { renderToString } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { EditorToolbar } from "../../../src/components/ui/EditorToolbar";

const cancel = <a href="/">Cancel</a>;

describe("EditorToolbar", () => {
  test("names what is being edited and carries the save", () => {
    const html = renderToString(<EditorToolbar title="Lemon tart" label="Save changes" cancel={cancel} />);
    expect(html).toContain('data-testid="editor-toolbar"');
    expect(html).toContain("Lemon tart");
    expect(html).toContain(">Save changes<");
    expect(html).toContain(">Cancel<");
    expect(html).toMatch(/<button[^>]*type="submit"/);
    // Sticky from md up, where the app's chrome is a side nav.
    expect(html).toContain("md:sticky");
    expect(html).not.toContain("data-toolbar-note");
  });

  test("a blank name falls back to the placeholder, quietly", () => {
    const html = renderToString(<EditorToolbar title="   " placeholder="New recipe" label="Create recipe" cancel={cancel} />);
    expect(html).toContain("New recipe");
    expect(html).toContain("text-fg-subtle");
  });

  test("the dirty note sits under the title", () => {
    const html = renderToString(<EditorToolbar title="Lemon tart" label="Save changes" note="Unsaved changes" cancel={cancel} />);
    expect(html).toContain("data-toolbar-note");
    expect(html).toContain("Unsaved changes");
    expect(html.indexOf("Lemon tart")).toBeLessThan(html.indexOf("Unsaved changes"));
  });

  test("busy disables the save and reads the busy label; disabled does the first only", () => {
    const busy = renderToString(<EditorToolbar title="x" label="Save changes" busyLabel="Saving…" busy cancel={cancel} />);
    expect(busy).toContain("Saving…");
    expect(busy).toMatch(/<button[^>]*disabled=""/);

    const offline = renderToString(<EditorToolbar title="x" label="Save changes" disabled cancel={cancel} />);
    expect(offline).toContain(">Save changes<");
    expect(offline).toMatch(/<button[^>]*disabled=""/);
  });

  test("extra actions render between the title and the buttons", () => {
    const html = renderToString(<EditorToolbar title="x" label="Save" cancel={cancel} actions={<button type="button">Edit as JSON</button>} />);
    expect(html.indexOf("Edit as JSON")).toBeLessThan(html.indexOf(">Cancel<"));
  });
});
