// TimerChip: still presentational. It renders the matched text with a clock
// icon, or its timer's remaining time once M26.3's store has one for it, and
// reports a tap upward. `decorateDurations` is the seam that gives each chip
// a stable timer id and looks its timer up.
import { renderToString } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import { decorateDurations, TimerChip } from "../../src/components/TimerChip";
import { chipTimerId } from "../../src/lib/timers";

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

describe("TimerChip with a timer", () => {
  test("a running timer replaces the matched text with the time left", () => {
    const html = renderToString(<TimerChip seconds={1200} label="20 minutes" timer={{ text: "4:32", done: false }} />);
    expect(html).toContain("4:32");
    expect(html).not.toContain("20 minutes<");
    expect(html).toContain('data-running="true"');
    expect(html).toContain('aria-label="20 minutes: 4:32. Restart this timer"');
  });

  test("a finished timer reads Done until it is dismissed", () => {
    const html = renderToString(<TimerChip seconds={1200} label="20 minutes" timer={{ text: "Done", done: true }} />);
    expect(html).toContain("Done");
    expect(html).toContain('data-done="true"');
    expect(html).not.toContain('data-running="true"');
  });
});

describe("decorateDurations", () => {
  const STEP = "33333333-3333-4333-8333-333333333333";

  test("splices a chip in for every duration and leaves the rest as text", () => {
    const nodes = decorateDurations()("Simmer for 20 minutes, then rest 5 min.");
    const html = renderToString(<>{nodes}</>);
    expect(html.split('data-testid="timer-chip"').length - 1).toBe(2);
    expect(html).toContain("Simmer for ");
    expect(html).toContain("20 minutes");
    expect(html).toContain("5 min");
  });

  test("text with no duration in it comes back untouched", () => {
    expect(decorateDurations()("Crack 2 eggs into the bowl")).toBe("Crack 2 eggs into the bowl");
  });

  test("a tapped chip starts a timer under an id keyed by the step and the offset, labelled with the step", () => {
    const onStart = vi.fn();
    const text = "Simmer for 20 minutes, then rest 5 min.";
    const nodes = decorateDurations({ keyPrefix: STEP, label: text, onStart })(text);
    const chips = (nodes as { props: { onStart?: (seconds: number, label: string) => void } }[]).filter((node) => node.props.onStart);

    chips[0]?.props.onStart?.(1200, "20 minutes");
    expect(onStart).toHaveBeenCalledWith({ id: chipTimerId(STEP, text.indexOf("20 minutes"), "20 minutes"), label: text, seconds: 1200 });

    chips[1]?.props.onStart?.(300, "5 min");
    expect(onStart).toHaveBeenLastCalledWith({ id: chipTimerId(STEP, text.indexOf("5 min"), "5 min"), label: text, seconds: 300 });
  });

  test("each chip is shown its own timer, looked up by that same id", () => {
    const text = "Simmer for 20 minutes, then rest 5 min.";
    const first = chipTimerId(STEP, text.indexOf("20 minutes"), "20 minutes");
    const decorate = decorateDurations({
      keyPrefix: STEP,
      timerFor: (id) => (id === first ? { text: "4:32", done: false } : undefined),
    });
    const html = renderToString(<>{decorate(text)}</>);
    expect(html).toContain("4:32");
    // The second chip has no timer, so it still reads its matched text.
    expect(html).toContain("5 min");
  });
});
