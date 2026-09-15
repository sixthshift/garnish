// The confirm's content renders to a string; the Modal around it is mount-driven
// and paints only on the client, so the wrapper is checked to render empty
// without throwing.

import { Modal } from "@sixthshift/design-system/modal";
import type { ReactElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { ConfirmDialog, ConfirmDialogContent } from "../../../src/components/ui/ConfirmDialog";

describe("ConfirmDialogContent", () => {
  test("renders the title, explanation, Cancel and the danger action, all enabled", () => {
    const html = renderToString(
      <ConfirmDialogContent title="Delete Lemon tart?" confirmLabel="Delete" onCancel={() => {}} onConfirm={() => {}}>
        This cannot be undone.
      </ConfirmDialogContent>
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
      </ConfirmDialogContent>
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
      </ConfirmDialog>
    );
    expect(html).toBe("");
  });
});

// Phone confirmations (M13.6): "sheet below md, centred above" — same call as
// decision 44/45. Modal itself never paints server-side (see above), so its
// classnames are not something a static render can assert on; what's
// checkable without a client renderer is the element ConfirmDialog builds —
// it must be a bare `Modal` with `size="sm"` and no `align` override, since
// those are exactly the two props that decide Modal's per-width shape:
// `size` sets the desktop width (mobile is always full width regardless);
// leaving `align` at its default keeps the desktop dialog vertically centred
// rather than pinned to the top. Same element at both widths — Modal's own
// media queries are what differ, not this component.
describe("ConfirmDialog at both widths", () => {
  function element(): ReactElement<{ size?: string; align?: string }> {
    return ConfirmDialog({
      title: "Delete Lemon tart?",
      confirmLabel: "Delete",
      onCancel: () => {},
      onConfirm: () => {},
      children: "This cannot be undone.",
    }) as ReactElement<{
      size?: string;
      align?: string;
    }>;
  }

  test("phone: sized for Modal's full-width mobile sheet, not a second dialog", () => {
    const el = element();
    expect(el.type).toBe(Modal);
    expect(el.props.size).toBe("sm");
  });

  test("wide: no `align` override, so Modal keeps it centred rather than top-aligned", () => {
    const el = element();
    expect(el.props.align).toBeUndefined();
  });
});
