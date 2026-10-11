import { Badge } from "@sixthshift/design-system/badge";
import { Button } from "@sixthshift/design-system/button";
import { Muted } from "@sixthshift/design-system/muted";
import { SectionTitle } from "@sixthshift/design-system/section-title";
import { useState } from "react";
import { Disclosure } from "../../../../components/ui/Disclosure";
import type { DiagnosticEvent, DiagnosticSource } from "../../../../db/models/diagnostic/repo";
import { useMutate } from "../../../../lib/mutate";
import { toastError } from "../../../../lib/toast";
import { buildLabel } from "../../../../lib/version";
import { clearDiagnostics } from "../../../../server/fns/diagnostics";
import { SettingRow, SettingsColumn, SettingsPanel } from "../SettingsPanel";

const SOURCE_LABELS: Record<DiagnosticSource, string> = { server: "Server", browser: "Browser", ai: "AI" };

const DAY_MS = 24 * 60 * 60 * 1000;

/** How many events fell in the last seven days: the tab's badge. Pure. */
export function recentCount(events: readonly Pick<DiagnosticEvent, "occurredAt">[], now: Date): number {
  const since = now.getTime() - 7 * DAY_MS;
  return events.filter((event) => Date.parse(event.occurredAt) >= since).length;
}

/** When an event happened, in the household's words: the time alone for today, the date and time before that. Pure. */
export function eventTime(occurredAt: string, now: Date, timeZone?: string): string {
  const at = new Date(occurredAt);
  const day = (date: Date) => date.toLocaleDateString("en-AU", { timeZone });
  const time = at.toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit", timeZone });
  if (day(at) === day(now)) return `Today ${time}`;
  return `${at.toLocaleDateString("en-AU", { day: "numeric", month: "short", timeZone })}, ${time}`;
}

/** The summary's quiet line: when, from where, and what failed there. Pure. */
export function eventHint(event: Pick<DiagnosticEvent, "occurredAt" | "source" | "name">, now: Date, timeZone?: string): string {
  return `${eventTime(event.occurredAt, now, timeZone)} · ${SOURCE_LABELS[event.source]} · ${event.name}`;
}

/** The detail as the expanded event shows it: the stack on its own, the rest as indented JSON. Pure. */
export function detailBlocks(detail: DiagnosticEvent["detail"]): { stack: string | null; rest: string | null } {
  if (detail === null) return { stack: null, rest: null };
  const { stack, ...rest } = detail;
  return {
    stack: typeof stack === "string" ? stack : null,
    rest: Object.keys(rest).length > 0 ? JSON.stringify(rest, null, 2) : null,
  };
}

function EventRow({ event, now }: { event: DiagnosticEvent; now: Date }) {
  const { stack, rest } = detailBlocks(event.detail);
  return (
    <li data-testid="diagnostic-event">
      <Disclosure title={event.message} hint={eventHint(event, now)} className="[&_summary>span:first-child]:flex-col [&_summary>span:first-child]:items-start">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="soft" intent={event.level === "error" ? "danger" : "warning"}>
            {event.level === "error" ? "Error" : "Warning"}
          </Badge>
          <Muted as="span" className="text-xs">
            {`${new Date(event.occurredAt).toLocaleString("en-AU")} · Garnish ${event.version}`}
          </Muted>
        </div>
        {rest !== null && <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-bg-subtle p-3 text-xs">{rest}</pre>}
        {stack !== null && <pre className="max-h-72 overflow-auto whitespace-pre rounded-lg bg-bg-subtle p-3 text-xs">{stack}</pre>}
      </Disclosure>
    </li>
  );
}

/**
 * Settings › Diagnostics: what went wrong, readable on the phone (decisions.md
 * row 166). Every failure a server function, an /api route, a browser or a
 * model call ran into, newest first, each opening onto its detail — the stack,
 * the check report, the build that saw it. The same events are lines in the
 * server's log.
 */
export function DiagnosticsTab({ events, now = new Date() }: { events: DiagnosticEvent[]; now?: Date }) {
  const mutate = useMutate();
  const [clearing, setClearing] = useState(false);

  const clear = async () => {
    setClearing(true);
    try {
      await mutate(() => clearDiagnostics());
    } catch (error) {
      toastError("Could not clear the problems", error);
    } finally {
      setClearing(false);
    }
  };

  return (
    <SettingsColumn>
      <SettingsPanel title="This build">
        <SettingRow label="Version" description="The release and the commit it was built from.">
          <code className="text-sm" data-testid="diagnostics-build">
            {buildLabel()}
          </code>
        </SettingRow>
      </SettingsPanel>

      <section className="flex flex-col gap-2" aria-label="Recent problems">
        <div className="flex items-center justify-between gap-2">
          <SectionTitle as="h2">Recent problems</SectionTitle>
          {events.length > 0 && (
            <Button type="button" variant="ghost" intent="neutral" size="sm" loading={clearing} onClick={clear}>
              Clear
            </Button>
          )}
        </div>
        <Muted as="p" className="text-sm">
          Failures the server, a browser or a model call ran into, newest first; the server's log (docker logs) has the same lines. The newest 500 are kept.
        </Muted>
        {events.length === 0 ? (
          <Muted as="p" className="rounded-xl border border-border-normal px-4 py-3 text-sm" data-testid="diagnostics-empty">
            Nothing has gone wrong.
          </Muted>
        ) : (
          <ul className="flex flex-col gap-2">
            {events.map((event) => (
              <EventRow key={event.id} event={event} now={now} />
            ))}
          </ul>
        )}
      </section>
    </SettingsColumn>
  );
}
