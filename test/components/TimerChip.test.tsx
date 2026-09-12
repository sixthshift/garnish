// TimerChip: presentational only for now (M26.2 — M26.3 wires the running-
// timer store). Renders the matched text with a clock icon and reports a tap
// upward; it does not start anything itself.
import { renderToString } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import { TimerChip } from "../../src/components/TimerChip";

describe("TimerChip", () => {
  test("shows the matched text and carries the duration as data attributes", () => {
    const html = renderToString(<TimerChip seconds={1200} label="20 minutes" />);
    expect(html).toContain("20 minutes");
    expect(html).toContain('data-testid="timer-chip"');
    expect(html).toContain('data-seconds="1200"');
    expect(html).toContain('aria-label="Start a timer for 20 minutes"');
    // The clock icon, drawn the same way as the header's total-time stat.
    expect(html).toMatch(/<svg[^>]*>.*<circle[^>]*cx="12"[^>]*cy="12"[^>]*r="9"/);
  });

  test("a range carries its upper bound too, though the label is the whole matched text", () => {
    const html = renderToString(<TimerChip seconds={600} upperSeconds={720} label="10-12 minutes" />);
    expect(html).toContain("10-12 minutes");
    expect(html).toContain('data-seconds="600"');
    expect(html).toContain('data-upper-seconds="720"');
  });

  test("no upper bound: no data-upper-seconds attribute", () => {
    const html = renderToString(<TimerChip seconds={1200} label="20 minutes" />);
    expect(html).not.toContain("data-upper-seconds");
  });

  test("tapping calls onStart with the (lower) seconds and the label", () => {
    const onStart = vi.fn();
    const element = TimerChip({ seconds: 600, upperSeconds: 720, label: "10-12 minutes", onStart });
    element.props.onClick();
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onStart).toHaveBeenCalledWith(600, "10-12 minutes");
  });

  test("tapping with no onStart does nothing, and does not throw", () => {
    const element = TimerChip({ seconds: 1200, label: "20 minutes" });
    expect(() => element.props.onClick()).not.toThrow();
  });
});
