import { Muted } from "@sixthshift/design-system/muted";
import { SectionTitle } from "@sixthshift/design-system/section-title";
import { Switch } from "@sixthshift/design-system/switch";
import { usePushAlerts } from "../../../lib/usePushAlerts";

/** What the section says under the switch for each state. Pure. */
export function timerAlertsNote(state: "unsupported" | "off" | "on" | "denied"): string {
  switch (state) {
    case "unsupported":
      return "Not available here. On an iPhone, add Garnish to the home screen first; on Android, install it or use Chrome.";
    case "denied":
      return "Notifications are blocked for Garnish in this browser's settings. Allow them there, then come back.";
    case "on":
      return "This device is told when a timer ends, even with the screen off or the app closed.";
    case "off":
      return "Ring this device when a timer ends, even with the screen off or the app closed.";
  }
}

/** The Alerts tab: one switch, for this device, and what it means. */
export function TimerAlerts() {
  const { state, pending, error, setEnabled } = usePushAlerts();
  return (
    <section className="flex flex-col gap-2" aria-label="Timer alerts">
      <SectionTitle as="h2">Timer alerts</SectionTitle>
      <Muted as="p" className="text-sm">
        {timerAlertsNote(state)}
      </Muted>
      <div>
        <Switch
          label="Timer alerts on this device"
          checked={state === "on"}
          pending={pending}
          disabled={state === "unsupported" || state === "denied"}
          onCheckedChange={setEnabled}
          data-testid="timer-alerts-switch"
        />
      </div>
      {error !== null && (
        <p className="text-sm text-fg-danger" role="alert">
          {error}
        </p>
      )}
      <Muted as="p" className="text-sm">
        Timers still show on the page as they do now. Each device is switched on from its own Settings.
      </Muted>
    </section>
  );
}
