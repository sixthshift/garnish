import { Button } from "@sixthshift/design-system/button";
import { Muted } from "@sixthshift/design-system/muted";
import { SectionTitle } from "@sixthshift/design-system/section-title";
import { AiImportNote } from "../AiImportNote";

/**
 * The Export tab: one link at the whole database, and the caveat that
 * matters — the file names its images by URL and does not carry their bytes,
 * so it restores text, not photographs. The database is still the master
 *; this is a copy taken for reading elsewhere.
 */
export function ExportTab() {
  return (
    <section className="flex flex-col gap-2" aria-label="Export">
      <SectionTitle as="h2">Export</SectionTitle>
      <Muted as="p" className="text-sm">
        Every recipe as JSON, with the foods, units, aisles and tags they use. Images are referenced by their URLs, not included in the file.
      </Muted>
      <div>
        <Button asChild variant="outline" intent="neutral">
          <a href="/api/export.json" download data-testid="export-download">
            Download JSON
          </a>
        </Button>
      </div>
      <Muted as="p" className="text-sm">
        One recipe on its own is at <code>/api/recipes/&lt;slug&gt;.json</code>.
      </Muted>
      <AiImportNote />
    </section>
  );
}
