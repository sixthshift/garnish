import { SettingRow, SettingsColumn, SettingsPanel } from "./SettingsPanel";
import { ThemeToggle } from "./ThemeToggle";

export function Appearance() {
  return (
    <SettingsColumn>
      <SettingsPanel title="Appearance">
        <SettingRow label="Theme" description="System follows the device's light or dark setting.">
          <ThemeToggle />
        </SettingRow>
      </SettingsPanel>
    </SettingsColumn>
  );
}
