// The editor's toolbar (M22.2). Static render only (no jsdom in this project's
// vitest config).
import { renderToString } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { EditorToolbar, type EditorToolbarProps } from "../../../src/components/ui/EditorToolbar";
import { LayoutContext } from "../../../src/lib/useLayout";

const cancel = <a href="/">Cancel</a>;

/** The toolbar as a desktop draws it, where it carries the save and Cancel (a phone's are the SaveBar's). */
function Toolbar(props: Omit<EditorToolbarProps, "cancel"> & { cancel?: EditorToolbarProps["cancel"] }) {
  return (
    <LayoutContext value="desktop">
      <EditorToolbar cancel={cancel} {...props} />
    </LayoutContext>
  );
}

describe("EditorToolbar", () => {
  test("names what is being edited and carries the save", () => {
    const html = renderToString(<Toolbar title="Lemon tart" label="Save changes" />);
    expect(html).toContain('data-testid="editor-toolbar"');
    expect(html).toContain("Lemon tart");
    expect(html).toContain(">Save changes<");
    expect(html).toContain(">Cancel<");
    expect(html).toMatch(/<button[^>]*type="submit"/);
    // Sticky on a desktop, under the top bar.
    expect(html).toContain("desktop:sticky");
    expect(html).toContain("desktop:top-(--top-bar)");
    expect(html).not.toContain("data-toolbar-note");
  });

  test("a blank name falls back to the placeholder, quietly", () => {
    const html = renderToString(<Toolbar title="   " placeholder="New recipe" label="Create recipe" />);
    expect(html).toContain("New recipe");
    expect(html).toContain("text-fg-subtle");
  });

  test("the dirty note sits under the title", () => {
    const html = renderToString(<Toolbar title="Lemon tart" label="Save changes" note="Unsaved changes" />);
    expect(html).toContain("data-toolbar-note");
    expect(html).toContain("Unsaved changes");
    expect(html.indexOf("Lemon tart")).toBeLessThan(html.indexOf("Unsaved changes"));
  });

  test("busy disables the save and reads the busy label; disabled does the first only", () => {
    const busy = renderToString(<Toolbar title="x" label="Save changes" busyLabel="Saving…" busy />);
    expect(busy).toContain("Saving…");
    expect(busy).toMatch(/<button[^>]*disabled=""/);

    const offline = renderToString(<Toolbar title="x" label="Save changes" disabled />);
    expect(offline).toContain(">Save changes<");
    expect(offline).toMatch(/<button[^>]*disabled=""/);
  });

  test("extra actions render between the title and the buttons", () => {
    const html = renderToString(<Toolbar title="x" label="Save" cancel={cancel} actions={<button type="button">Edit as JSON</button>} />);
    expect(html.indexOf("Edit as JSON")).toBeLessThan(html.indexOf(">Cancel<"));
  });
});

test("on a phone the toolbar names the recipe alone: the save and Cancel are the SaveBar's", () => {
  const html = renderToString(<EditorToolbar title="Lemon tart" label="Save changes" cancel={cancel} />);
  expect(html).toContain("Lemon tart");
  expect(html).not.toContain(">Save changes<");
  expect(html).not.toContain(">Cancel<");
});
