// The confirm before a restore (M40.5): what it replaces beside what is here,
// and Restore held back until the household ticks that it understands.
import { renderToString } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { RestoreSheetContent, replacementLines } from "../../../../src/routes/settings/components/RestoreSheet";
import { RESTORE_CHECK as CHECK } from "../../../helpers/backup";

describe("replacementLines", () => {
  test("one line per kind, empty kinds left out, the guides as one", () => {
    expect(replacementLines(CHECK.current, CHECK.backup)).toEqual([
      "142 recipes become 138",
      "38 cooks become 35",
      "7 plan entries become 0",
      "0 list lines become 12",
      "30 units become 30",
      "16 guide statements become 15",
      "1 photo becomes 40",
    ]);
  });
});

describe("RestoreSheetContent", () => {
  const html = renderToString(<RestoreSheetContent check={CHECK} onRestore={() => {}} onCancel={() => {}} />);

  test("names the backup by its day and lists what it replaces", () => {
    expect(html).toContain("7 Oct 2026");
    expect(html).toContain("replaces everything here");
    expect(html).toContain("142 recipes become 138");
    expect(html).toContain("backups/");
  });

  test("Restore is disabled until the box is ticked", () => {
    expect(html).toContain("I understand this replaces everything");
    expect(html).toMatch(/<button[^>]*data-testid="restore-confirm"[^>]*disabled=""|<button[^>]*disabled=""[^>]*data-testid="restore-confirm"/);
  });
});
