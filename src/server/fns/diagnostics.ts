import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import diagnosticEvents from "../../db/models/diagnostic/repo";
import diagnostics from "../core/diagnostics";

/** How many events Settings › Diagnostics shows: the newest. */
export const DIAGNOSTICS_SHOWN = 200;

/** The newest events first, for Settings › Diagnostics. */
export const listDiagnostics = createServerFn({ method: "GET" }).handler(async () => diagnosticEvents.list(DIAGNOSTICS_SHOWN));

/** Forget every event. */
export const clearDiagnostics = createServerFn({ method: "POST" }).handler(async () => {
  diagnosticEvents.clear();
  return { cleared: true };
});

export const ClientErrorInput = z.object({
  /** Where the browser caught it: an error view, the shell's boundary, or the window's own handlers. */
  where: z.enum(["route", "shell", "window", "promise"]),
  message: z.string().max(4_000),
  stack: z.string().max(16_000).default(""),
  /** The page's address when it happened, path and search only. */
  page: z.string().max(2_000).default(""),
  /** The browser's own build, which after a deploy can be older than the server's. */
  build: z.string().max(64),
  userAgent: z.string().max(400).default(""),
});

/**
 * An error a browser caught, written down beside the server's own (decisions.md
 * row 166). The browser holds the stack and the page; the server never saw the
 * failure, so without this it is gone when the tab closes.
 */
export const reportClientError = createServerFn({ method: "POST" })
  .validator(ClientErrorInput)
  .handler(async ({ data }) => {
    diagnostics.record({
      source: "browser",
      level: "error",
      name: data.page === "" ? data.where : data.page,
      message: data.message === "" ? "An error with no message" : data.message,
      detail: { where: data.where, ...(data.stack ? { stack: data.stack } : {}), ...(data.userAgent ? { userAgent: data.userAgent } : {}) },
      version: data.build,
    });
    return { recorded: true };
  });
