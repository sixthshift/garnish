import { Button } from "@sixthshift/design-system/button";
import { SettingRow, SettingsColumn, SettingsPanel } from "../SettingsPanel";

/**
 * The Export tab: one link at the whole database, and the caveat that
 * matters — the file names its images by URL and does not carry their bytes,
 * so it restores text, not photographs. The database is still the master
 *; this is a copy taken for reading elsewhere.
 */
export function ExportTab() {
  return (
    <SettingsColumn>
      <SettingsPanel title="Export" foot="Images are referenced by their URLs, not included in the file.">
        <SettingRow label="All recipes" description="Every recipe as JSON, with the foods, units, aisles and tags they use.">
          <Button asChild variant="outline" intent="neutral" size="sm">
            <a href="/api/export.json" download data-testid="export-download">
              Download JSON
            </a>
          </Button>
        </SettingRow>
        <SettingRow
          label="One recipe"
          description={
            <>
              At <code>/api/recipes/&lt;slug&gt;.json</code>, for any recipe's slug.
            </>
          }
        />
      </SettingsPanel>
    </SettingsColumn>
  );
}
