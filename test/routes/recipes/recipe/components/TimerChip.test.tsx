// TimerChip: still presentational. It renders the matched text with a clock
// icon, or its timer's remaining time once M26.3's store has one for it, and
// reports a tap upward. `StepCard` is what gives each chip a stable timer id
// (src/lib/timers.ts `chipTimerId`) and looks its timer up.
import { renderToString } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import { TimerChip, timerPhrase } from "../../../../../src/routes/recipes/recipe/components/TimerChip";

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

// Critique #5: in cook mode the chip is a real button that says what it does.
describe("TimerChip at cook size", () => {
  test("idle, it is a 48px button reading 'Start 20 minute timer', named by those words", () => {
    const html = renderToString(<TimerChip seconds={1200} label="20 minutes" size="cook" />);
    expect(html).toContain('data-size="cook"');
    expect(html).toMatch(/class="[^"]*\bh-12\b/);
    expect(html).toContain("Start 20 minute timer");
    expect(html).not.toContain("aria-label=");
    // Neutral: brand is Next's alone.
    expect(html).toContain('data-intent="neutral"');
  });

  test("running, it shows the time left in the brand state colour; done, in success", () => {
    const running = renderToString(<TimerChip seconds={1200} label="20 minutes" size="cook" timer={{ text: "4:32", done: false }} />);
    expect(running).toContain("4:32");
    expect(running).toContain('data-intent="brand"');
    expect(running).toContain('aria-label="20 minutes: 4:32. Restart this timer"');
    const done = renderToString(<TimerChip seconds={1200} label="20 minutes" size="cook" timer={{ text: "Done", done: true }} />);
    expect(done).toContain('data-intent="success"');
    expect(done).toContain('data-done="true"');
  });

  test("the page keeps the compact chip", () => {
    expect(renderToString(<TimerChip seconds={1200} label="20 minutes" />)).not.toContain("Start 20 minute timer");
  });
});

describe("timerPhrase", () => {
  test("the last word loses its plural s, as a measure before a noun does", () => {
    expect(timerPhrase("20 minutes")).toBe("20 minute");
    expect(timerPhrase("10-12 minutes")).toBe("10-12 minute");
    expect(timerPhrase("1 hour 30 minutes")).toBe("1 hour 30 minute");
    expect(timerPhrase("2 mins")).toBe("2 min");
    expect(timerPhrase("1 hour")).toBe("1 hour");
    expect(timerPhrase("45 seconds")).toBe("45 second");
  });
});
