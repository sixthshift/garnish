import { Button } from "@sixthshift/design-system/button";
import { Message } from "@sixthshift/design-system/message";
import { Link, useRouter } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Disclosure } from "../../../../components/ui/Disclosure";
import { messageFrom } from "../../../../lib/errors";
import { checkImportLibrary, importLibrary, type LibraryCheck, type LibraryReport } from "../../../../lib/importFile";
import { SettingRow, SettingsPanel } from "./SettingsPanel";

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * Settings › Backup's way in from another app (decisions.md row 201): a whole
 * Mealie backup or Tandoor export, every recipe saved without a review,
 * foods and units matched by name and made where nothing matches, recipes
 * already here left alone. It only adds, so a count is the whole confirm.
 */
export function LibraryImport() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [check, setCheck] = useState<LibraryCheck | null>(null);
  const [report, setReport] = useState<LibraryReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setFile(null);
    setCheck(null);
    if (input.current) input.current.value = "";
  };

  const choose = async (chosen: File | null) => {
    setError(null);
    setReport(null);
    setCheck(null);
    setFile(chosen);
    if (!chosen) return;
    setBusy(true);
    try {
      setCheck(await checkImportLibrary(chosen));
    } catch (cause) {
      setError(messageFrom(cause));
      reset();
    } finally {
      setBusy(false);
    }
  };

  const run = async () => {
    if (!file) return;
    setBusy(true);
    try {
      setReport(await importLibrary(file));
      reset();
      await router.invalidate();
    } catch (cause) {
      setError(messageFrom(cause));
    } finally {
      setBusy(false);
    }
  };

  const toAdd = check === null ? 0 : check.recipes - check.alreadyHere;

  return (
    <div className="flex flex-col gap-2">
      <SettingsPanel title="From another app">
        <SettingRow
          label="Bring in from Mealie or Tandoor"
          description="Every recipe in a Mealie backup or a Tandoor export, added to what is here. Recipes already here are left alone."
        >
          <Button
            type="button"
            variant="outline"
            intent="neutral"
            size="sm"
            loading={busy && check === null}
            disabled={busy}
            onClick={() => input.current?.click()}
          >
            Choose export…
          </Button>
          <input
            ref={input}
            type="file"
            accept=".zip,.json,application/zip,application/json"
            aria-label="Mealie or Tandoor export"
            className="sr-only"
            tabIndex={-1}
            data-testid="library-file"
            onChange={(event) => void choose(event.target.files?.[0] ?? null)}
          />
        </SettingRow>
      </SettingsPanel>

      {error !== null && (
        <Message intent="danger" title="That export could not be brought in">
          {error}
        </Message>
      )}

      {check !== null && (
        <Message intent="info" title={`${plural(check.recipes, "recipe")} in ${file?.name ?? "the export"}`} data-testid="library-check">
          <span className="flex flex-col items-start gap-3">
            <span>
              {check.alreadyHere > 0 && `${plural(check.alreadyHere, "is", "are")} already here and will be left alone. `}
              {toAdd > 0
                ? `${plural(toAdd, "recipe")} will be added. Ingredients are matched to your foods by name, and any food not here yet is made.`
                : "Nothing to add."}
            </span>
            <span className="flex flex-wrap gap-2">
              {toAdd > 0 && (
                <Button type="button" variant="solid" intent="brand" size="sm" loading={busy} disabled={busy} onClick={() => void run()}>
                  Add {plural(toAdd, "recipe")}
                </Button>
              )}
              <Button type="button" variant="ghost" intent="neutral" size="sm" disabled={busy} onClick={reset}>
                Cancel
              </Button>
            </span>
          </span>
        </Message>
      )}

      {report !== null && <LibraryReportView report={report} />}
    </div>
  );
}

/** What the import did: the counts, then each list to open. */
function LibraryReportView({ report }: { report: LibraryReport }) {
  const made = [report.foodsCreated > 0 && plural(report.foodsCreated, "new food"), report.unitsCreated > 0 && plural(report.unitsCreated, "new unit")].filter(
    Boolean
  );
  return (
    <div className="flex flex-col gap-2" data-testid="library-report">
      <Message intent={report.failed.length > 0 ? "warning" : "success"} title={`Added ${plural(report.imported.length, "recipe")}`}>
        {[
          report.skipped.length > 0 && `${plural(report.skipped.length, "was", "were")} already here.`,
          made.length > 0 && `Made ${made.join(" and ")}: tidy them in Foods and Units.`,
          report.failed.length > 0 && `${plural(report.failed.length, "recipe")} could not be added.`,
        ]
          .filter(Boolean)
          .join(" ")}
      </Message>
      {report.failed.length > 0 && (
        <Disclosure title="Not added" hint={String(report.failed.length)} defaultOpen>
          <ul className="flex flex-col gap-1 text-sm">
            {report.failed.map((failed) => (
              <li key={failed.name}>
                <span className="font-medium">{failed.name}</span>: {failed.error}
              </li>
            ))}
          </ul>
        </Disclosure>
      )}
      {report.imported.length > 0 && (
        <Disclosure title="Added" hint={String(report.imported.length)}>
          <RecipeLinks recipes={report.imported} />
        </Disclosure>
      )}
      {report.skipped.length > 0 && (
        <Disclosure title="Already here" hint={String(report.skipped.length)}>
          <RecipeLinks recipes={report.skipped} />
        </Disclosure>
      )}
    </div>
  );
}

function RecipeLinks({ recipes }: { recipes: readonly { name: string; slug: string }[] }) {
  return (
    <ul className="flex flex-col gap-1 text-sm">
      {recipes.map((recipe) => (
        <li key={recipe.slug}>
          <Link to="/recipes/$slug" params={{ slug: recipe.slug }} className="underline-offset-2 hover:underline">
            {recipe.name}
          </Link>
        </li>
      ))}
    </ul>
  );
}
