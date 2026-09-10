// The confirm's content renders to a string; the Modal around it is mount-driven
// and paints only on the client, so the wrapper is checked to render empty
// without throwing.
import { renderToString } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { ConfirmDialog, ConfirmDialogContent } from "../../../src/components/ui/ConfirmDialog";

describe("ConfirmDialogContent", () => {
  test("renders the title, explanation, Cancel and the danger action, all enabled", () => {
    const html = renderToString(
      <ConfirmDialogContent title="Delete Lemon tart?" confirmLabel="Delete" onCancel={() => {}} onConfirm={() => {}}>
        This cannot be undone.
      </ConfirmDialogContent>,
    );
    expect(html).toContain("Delete Lemon tart?");
    expect(html).toContain("<p>This cannot be undone.</p>");
    expect(html).toMatch(/<button[^>]*type="button"[^>]*>(<[^>]*>)*Cancel</);
    expect(html).toMatch(/<button[^>]*type="button"[^>]*>(<[^>]*>)*Delete</);
    expect(html.match(/<button/g)).toHaveLength(2);
    expect(html).not.toContain('disabled=""');
  });

  test("busy disables both buttons and swaps the action's text; element children pass through", () => {
    const html = renderToString(
      <ConfirmDialogContent title="Delete Lemon tart?" confirmLabel="Delete" busy busyLabel="Deleting…" onCancel={() => {}} onConfirm={() => {}}>
        <p className="x">Gone for good.</p>
      </ConfirmDialogContent>,
    );
    expect(html.match(/disabled=""/g)).toHaveLength(2);
    expect(html).toContain("Deleting…");
    expect(html).not.toMatch(/>Delete</);
    expect(html).toContain('<p class="x">Gone for good.</p>');
  });
});

describe("ConfirmDialog", () => {
  test("renders nothing on the server: the modal mounts on the client", () => {
    const html = renderToString(
      <ConfirmDialog title="Delete Lemon tart?" confirmLabel="Delete" aria-label="Delete recipe" onCancel={() => {}} onConfirm={() => {}}>
        This cannot be undone.
      </ConfirmDialog>,
    );
    expect(html).toBe("");
  });
});
