import { Button } from "@sixthshift/design-system/button";
import { Message } from "@sixthshift/design-system/message";
import { toast } from "@sixthshift/design-system/overlay";
import { useRouter } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { BACKUP_URL, checkRestore, type RestoreCheck, RestoreRefused, restore } from "../../../../lib/backup";
import { formatDateStamp } from "../../../../lib/dates";
import { writeOutbox } from "../../../../lib/outbox";
import { toastError } from "../../../../lib/toast";
import { RestoreSheet } from "../RestoreSheet";
import { SettingRow, SettingsColumn, SettingsPanel } from "../SettingsPanel";

/** Forget this device's queued shopping writes: after a restore they name lines that may no longer exist. */
function clearOutbox(): void {
  try {
    if (typeof window !== "undefined") writeOutbox(window.localStorage, []);
  } catch {
    // No storage, nothing queued.
  }
}

/**
 * The Backup tab (decisions.md row 131): back up — the whole household down
 * to this device as one zip, nothing kept on the server — and restore from
 * one. The verb is "back up", the file "a backup". A restore replaces everything, so the file is read and
 * checked on the server first, and only a file that passes opens the confirm.
 * Export, one recipe at a time, is the recipe page's.
 */
export function BackupTab() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [check, setCheck] = useState<RestoreCheck | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setFile(null);
    setCheck(null);
    if (input.current) input.current.value = "";
  };

  const choose = async (chosen: File | null) => {
    setProblems([]);
    setCheck(null);
    setFile(chosen);
    if (!chosen) return;
    setBusy(true);
    try {
      setCheck(await checkRestore(chosen));
    } catch (error) {
      setProblems(error instanceof RestoreRefused ? error.problems : [error instanceof Error ? error.message : String(error)]);
      reset();
    } finally {
      setBusy(false);
    }
  };

  const run = async () => {
    if (!file || !check) return;
    setBusy(true);
    try {
      const done = await restore(file);
      clearOutbox();
      reset();
      toast({
        intent: "success",
        title: `Restored from the backup of ${formatDateStamp(done.createdAt)}`,
        children: `The database as it was is kept as ${done.snapshot}.`,
      });
      await router.invalidate();
    } catch (error) {
      if (error instanceof RestoreRefused) {
        setProblems(error.problems);
        reset();
      } else toastError("Couldn't restore the backup", error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SettingsColumn>
      <SettingsPanel title="Backup" foot="Export is per recipe: its JSON or Cooklang file is on the recipe page's menu.">
        <SettingRow
          label="Back up"
          description="Every recipe and its photos, the cook history, the meal plan, the shopping list and both guides, as one .zip saved to this device."
        >
          <Button asChild variant="outline" intent="neutral" size="sm">
            <a href={BACKUP_URL} download data-testid="backup-download">
              Download backup
            </a>
          </Button>
        </SettingRow>
        <SettingRow label="Restore" description="Replace everything here with a backup. You'll see what it holds before anything changes.">
          <Button
            type="button"
            variant="outline"
            intent="neutral"
            size="sm"
            loading={busy && check === null}
            disabled={busy}
            onClick={() => input.current?.click()}
          >
            Choose backup…
          </Button>
          <input
            ref={input}
            type="file"
            accept=".zip,application/zip"
            aria-label="Backup file"
            className="sr-only"
            tabIndex={-1}
            data-testid="restore-file"
            onChange={(event) => void choose(event.target.files?.[0] ?? null)}
          />
        </SettingRow>
      </SettingsPanel>
      {problems.length > 0 && (
        <Message intent="danger" title="That backup can't be restored. Nothing was changed.">
          <ul className="flex flex-col gap-1" data-testid="restore-problems">
            {problems.slice(0, 20).map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
            {problems.length > 20 && <li>…and {problems.length - 20} more</li>}
          </ul>
        </Message>
      )}
      {check && <RestoreSheet open check={check} busy={busy} onRestore={() => void run()} onCancel={reset} />}
    </SettingsColumn>
  );
}
