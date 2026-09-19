// The Alerts tab under renderToString: no effects run, so it reads as it does
// on the server and before the browser has answered — unsupported, the switch
// off and disabled — and each state's note is its own sentence.
import { renderToString } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { TimerAlerts, timerAlertsNote } from "../../../../src/routes/settings/components/TimerAlerts";

describe("timerAlertsNote", () => {
  test("names what to do in each state", () => {
    expect(timerAlertsNote("unsupported")).toMatch(/home screen/);
    expect(timerAlertsNote("denied")).toMatch(/blocked/);
    expect(timerAlertsNote("on")).toMatch(/screen off/);
    expect(timerAlertsNote("off")).toMatch(/screen off/);
  });
});

describe("TimerAlerts", () => {
  test("renders the section with its switch off and disabled until the browser answers", () => {
    const html = renderToString(<TimerAlerts />);
    expect(html).toContain("Timer alerts");
    expect(html).toContain('data-testid="timer-alerts-switch"');
    expect(html).toContain('aria-checked="false"');
    expect(html).toMatch(/disabled/);
    expect(html).toContain("home screen");
    expect(html).not.toContain('role="alert"');
  });
});
