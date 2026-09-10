// The Toaster renders whatever the notice store holds. The design system's
// Toast paints only once its enter animation starts (usePresence), which never
// happens in a server render, so the assertions are on the stack container and
// the per-notice wrappers this file owns.
import { renderToString } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { Toaster, ToastStack } from "../../src/components/Toaster";
import { type Notice, notices } from "../../src/lib/notify";

const notice = (id: string, intent: Notice["intent"]): Notice => ({ id, intent, title: `Notice ${id}`, duration: 0 });

describe("ToastStack", () => {
  test("renders an empty, click-through container when there is nothing to say", () => {
    const html = renderToString(<ToastStack notices={[]} onDismiss={() => {}} />);
    expect(html).toContain('data-testid="toasts"');
    expect(html).toContain('data-count="0"');
    expect(html).toContain("pointer-events-none");
    expect(html).not.toContain("data-notice=");
  });

  test("renders one wrapper per notice, in order, carrying its intent and id", () => {
    const html = renderToString(<ToastStack notices={[notice("a", "success"), notice("b", "danger")]} onDismiss={() => {}} />);
    expect(html).toContain('data-count="2"');
    expect(html.indexOf('data-notice-id="a"')).toBeLessThan(html.indexOf('data-notice-id="b"'));
    expect(html).toContain('data-notice="success"');
    expect(html).toContain('data-notice="danger"');
  });
});

describe("Toaster", () => {
  test("reads the app's store, which is empty on the server", () => {
    notices.clear();
    expect(renderToString(<Toaster />)).toContain('data-count="0"');
  });
});
