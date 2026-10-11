// What went wrong, written down (decisions.md row 166). Every failure the app
// notices goes through `diagnostics.record`: one JSON line on stdout, which is
// what `docker logs` shows, and one row in `diagnostic_event`, which is what
// Settings › Diagnostics lists. Recording never throws — a log that fails must
// not turn into a second failure for the request that was already failing — so
// a store that cannot be written still leaves the stdout line.

import { isNotFound, isRedirect } from "@tanstack/react-router";
import type { DiagnosticInput, DiagnosticLevel, DiagnosticRepository, DiagnosticSource } from "../../db/models/diagnostic/repo";
import diagnosticEvents from "../../db/models/diagnostic/repo";
import { buildLabel } from "../../lib/version";
import { isNotFoundError } from "./errors";

/** One failure as a caller reports it; the version and the time are filled in. */
export type DiagnosticReport = {
  source: DiagnosticSource;
  level: DiagnosticLevel;
  /** What failed: a server function's name, an /api path, a page, a model call. */
  name: string;
  message: string;
  detail?: Record<string, unknown>;
  /** The build that saw it, when that is not this server's: a browser still running an older page says its own. */
  version?: string;
};

/** The longest message kept; a model's whole answer pasted into an error stays in `detail`, trimmed. */
export const MESSAGE_LIMIT = 1_000;
/** The most `detail` may weigh as JSON before its longest strings are cut. */
export const DETAIL_LIMIT = 16_000;

function clip(text: string, limit: number): string {
  return text.length <= limit ? text : `${text.slice(0, limit - 1)}…`;
}

/** `detail` cut to fit: every string value past a share of the limit is trimmed, then the whole is replaced if still too big. Pure. */
export function fitDetail(detail: Record<string, unknown>, limit = DETAIL_LIMIT): Record<string, unknown> {
  let text: string;
  try {
    text = JSON.stringify(detail);
  } catch {
    return { unserialisable: true };
  }
  if (text.length <= limit) return detail;
  const share = Math.floor(limit / 4);
  const trimmed = JSON.parse(text, (_key, value: unknown) => (typeof value === "string" ? clip(value, share) : value)) as Record<string, unknown>;
  const again = JSON.stringify(trimmed);
  return again.length <= limit ? trimmed : { truncated: clip(again, limit - 32) };
}

/** A thrown value as a message and the detail worth keeping: its kind, its stack, and its cause's message. Pure. */
export function describeThrown(error: unknown): { message: string; detail: Record<string, unknown> } {
  if (error instanceof Error) {
    const detail: Record<string, unknown> = { error: error.name };
    if (error.stack) detail.stack = error.stack;
    const kind = (error as { kind?: unknown }).kind;
    if (typeof kind === "string") detail.kind = kind;
    if (error.cause !== undefined) detail.cause = error.cause instanceof Error ? error.cause.message : String(error.cause);
    return { message: error.message || error.name, detail };
  }
  return { message: typeof error === "string" ? error : (JSON.stringify(error) ?? String(error)), detail: {} };
}

/**
 * Whether a thrown value is the app working as designed rather than failing:
 * a redirect, or a not-found — the router's, or a repository's before the
 * middleware turns it into the router's. Those are answers, not faults. Pure.
 */
export function isExpected(error: unknown): boolean {
  return isRedirect(error) || isNotFound(error) || isNotFoundError(error);
}

export type DiagnosticsDeps = {
  store: () => Pick<DiagnosticRepository, "record">;
  write: (line: string) => void;
  version: string;
  now: () => string;
};

export function createDiagnostics(deps: DiagnosticsDeps) {
  function record(report: DiagnosticReport): void {
    const event: DiagnosticInput & { occurredAt: string } = {
      occurredAt: deps.now(),
      source: report.source,
      level: report.level,
      name: clip(report.name, 200),
      message: clip(report.message, MESSAGE_LIMIT),
      detail: report.detail && Object.keys(report.detail).length > 0 ? fitDetail(report.detail) : null,
      version: report.version ? clip(report.version, 64) : deps.version,
    };
    try {
      deps.write(
        JSON.stringify({
          at: event.occurredAt,
          level: event.level,
          source: event.source,
          name: event.name,
          message: event.message,
          version: event.version,
          detail: event.detail ?? undefined,
        })
      );
    } catch {
      // stdout closed: nothing more to do, and the row below may still land.
    }
    try {
      deps.store().record(event);
    } catch (cause) {
      try {
        deps.write(
          JSON.stringify({
            at: event.occurredAt,
            level: "warning",
            source: "server",
            name: "diagnostics",
            message: `Could not keep the event above: ${describeThrown(cause).message}`,
          })
        );
      } catch {
        // As above.
      }
    }
  }

  return {
    record,
    /** A line on stdout and nothing kept: how a call that went fine is logged, so the log shows what ran and how long it took. */
    note(fields: Record<string, unknown>): void {
      try {
        deps.write(JSON.stringify({ at: deps.now(), level: "info", version: deps.version, ...fields }));
      } catch {
        // As above.
      }
    },
    /** A thrown value, recorded as an error under `name`; `extra` joins its detail. */
    failure(source: DiagnosticSource, name: string, error: unknown, extra: Record<string, unknown> = {}): void {
      const { message, detail } = describeThrown(error);
      record({ source, level: "error", name, message, detail: { ...extra, ...detail } });
    },
  };
}

export type Diagnostics = ReturnType<typeof createDiagnostics>;

/** The server's: stdout and the application database, stamped with this build. */
const diagnostics: Diagnostics = createDiagnostics({
  store: () => diagnosticEvents,
  write: (line) => console.error(line),
  version: buildLabel(),
  now: () => new Date().toISOString(),
});

export default diagnostics;
