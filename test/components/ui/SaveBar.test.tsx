// The editor's save bar: the submit's label and busy state, the Cancel control
// passed through, the optional note, and the classes that make it sticky on
// phone and inline from `md` (the layout is only assertable that way in a
// string render).
import { renderToString } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { SaveBar } from "../../../src/components/ui/SaveBar";

const cancel = <button type="button">Cancel</button>;

describe("SaveBar", () => {
  test("renders the submit and the Cancel control, both live", () => {
    const html = renderToString(<SaveBar label="Save changes" cancel={cancel} />);
    expect(html).toMatch(/<button[^>]*type="submit"/);
    expect(html).toContain("Save changes");
    expect(html).toContain("Cancel");
    expect(html).not.toContain('disabled=""');
    expect(html).not.toContain("Unsaved changes");
  });

  test("busy disables the submit and swaps its text", () => {
    const html = renderToString(<SaveBar label="Save changes" busyLabel="Saving…" busy cancel={cancel} />);
    expect(html).toContain("Saving…");
    expect(html).not.toContain("Save changes");
    expect(html).toContain('disabled=""');
  });

  test("busy without a busy label keeps the label", () => {
    const html = renderToString(<SaveBar label="Create recipe" busy cancel={cancel} />);
    expect(html).toContain("Create recipe");
  });

  test("disabled refuses the save but leaves Cancel alone", () => {
    const html = renderToString(<SaveBar label="Save changes" disabled cancel={cancel} />);
    expect(html.match(/disabled=""/g)).toHaveLength(1);
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*type="submit"/);
  });

  test("the note renders beside the buttons", () => {
    const html = renderToString(<SaveBar label="Save changes" note="Unsaved changes" cancel={cancel} />);
    expect(html).toContain("Unsaved changes");
  });

  test("sticks above the phone tab bar and goes inline from md", () => {
    const html = renderToString(<SaveBar label="Save changes" cancel={cancel} />);
    const bar = /<div[^>]*data-testid="save-bar"[^>]*class="([^"]*)"|<div[^>]*class="([^"]*)"[^>]*data-testid="save-bar"/.exec(html);
    const classes = bar?.[1] ?? bar?.[2] ?? "";
    expect(classes).toContain("sticky");
    expect(classes).toContain("bottom-20");
    expect(classes).toContain("border-t");
    expect(classes).toContain("bg-bg-normal");
    expect(classes).toContain("md:static");
    expect(classes).toContain("md:border-0");
    expect(classes).toContain("md:bg-transparent");
  });
});
