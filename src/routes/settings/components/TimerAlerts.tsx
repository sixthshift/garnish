import { Message } from "@sixthshift/design-system/message";
import { Switch } from "@sixthshift/design-system/switch";
import { usePushAlerts } from "../../../lib/usePushAlerts";
import { SettingRow, SettingsColumn, SettingsPanel } from "./SettingsPanel";

/** What the section says for each state. Pure. */
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

/** The Alerts tab: one switch, for this device. A state that stops it working is a warning above it, not helper text. */
export function TimerAlerts() {
  const { state, pending, error, setEnabled } = usePushAlerts();
  const blocked = state === "unsupported" || state === "denied";
  return (
    <SettingsColumn>
      {blocked && (
        <Message intent="warning" size="sm">
          {timerAlertsNote(state)}
        </Message>
      )}
      <SettingsPanel title="Timer alerts" foot="Timers still show on the page either way. Each device is switched on from its own Settings.">
        <SettingRow label="Timer alerts on this device" description={blocked ? undefined : timerAlertsNote(state)}>
          <Switch
            aria-label="Timer alerts on this device"
            checked={state === "on"}
            pending={pending}
            disabled={blocked}
            onCheckedChange={setEnabled}
            data-testid="timer-alerts-switch"
          />
        </SettingRow>
      </SettingsPanel>
      {error !== null && (
        <Message intent="danger" size="sm">
          {error}
        </Message>
      )}
    </SettingsColumn>
  );
}
