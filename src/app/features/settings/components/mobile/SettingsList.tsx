import { Button } from "@sixthshift/design-system/button";
import { Card } from "@sixthshift/design-system/card";
import { Heading } from "@sixthshift/design-system/heading";
import { SectionTitle } from "@sixthshift/design-system/section-title";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { ChevronRight } from "../../../../../components/ui/icons";
import type { SettingsSectionId } from "../settingsSections";

/** One row of the list: the place, its tile, and the number beside it, if it has one. */
export type SettingsListRow = { value: SettingsSectionId; label: string; count?: number };

export type SettingsListGroup = { label: string; rows: SettingsListRow[] };

/**
 * Each place's tile: a line icon on the page's one step up (`docs/mockups/desktop.html`,
 * `mSettings`), drawn as the app's other icons are (`components/ui/icons`) rather
 * than the type symbols it began with, which each font drew differently. Neutral,
 * all of them: colour is identity and state (design-language rule 5), and the
 * theme's subtle tints sank into dark holes on a dark card. Pure decoration, so hidden.
 */
const TILE: Record<SettingsSectionId, ReactNode> = {
  foods: (
    <>
      <path d="M12 7.5c-3-2.2-8-1.2-8 4.8 0 4.9 3 8.7 5 8.7 1 0 2-.8 3-.8s2 .8 3 .8c2 0 5-3.8 5-8.7 0-6-5-7-8-4.8z" />
      <path d="M12 7.5c0-2.2 1.2-4 3.5-4.5" />
    </>
  ),
  units: (
    <>
      <path d="M12 3v17M8 20h8M5 7h14" />
      <path d="M5 7 2.5 13a2.5 2.5 0 0 0 5 0zM19 7l-2.5 6a2.5 2.5 0 0 0 5 0z" />
    </>
  ),
  aisles: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M4 9.5h16M4 15h16M9 4v16" />
    </>
  ),
  tags: <path d="M9.5 4 7.5 20M16.5 4l-2 16M4.5 9h16M3.5 15h16" />,
  style: <path d="M4 20h4L19 9l-4-4L4 16zM14 6l4 4" />,
  planner: (
    <>
      <rect x="4" y="5.5" width="16" height="15" rx="2" />
      <path d="M4 10h16M8.5 3v4M15.5 3v4M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01" />
    </>
  ),
  backup: <path d="M12 4v10m0 0-4-4m4 4 4-4M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />,
  ai: (
    <>
      <path d="M11 3.5 12.6 8 17 9.6 12.6 11.2 11 15.6 9.4 11.2 5 9.6 9.4 8z" />
      <path d="M18 14.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" />
    </>
  ),
  mcp: <path d="M9 3v5M15 3v5M7 8h10v3a5 5 0 0 1-10 0zM12 16v5" />,
  appearance: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" stroke="none" />
    </>
  ),
  alerts: <path d="M6 16v-5a6 6 0 1 1 12 0v5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0" />,
  diagnostics: <path d="M3 12h4l2.5-6.5 4.5 13 2.5-6.5H21" />,
};

/**
 * A phone's Settings (decisions.md row 208): one grouped list, each place a
 * row with its tile, its count and a chevron, opening as its own screen at
 * `?section=`, so it has an address and Back comes back here. Home is the way
 * out, at the top, since Settings has left the tab bar for a gear on Home.
 */
export function SettingsList({ groups, footer }: { groups: SettingsListGroup[]; footer?: ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 p-4">
      <div className="flex items-center gap-3">
        <Button asChild variant="outline" intent="neutral" size="lg" iconOnly className="shrink-0 rounded-full text-xl">
          <Link to="/" aria-label="Home">
            <span aria-hidden="true">‹</span>
          </Link>
        </Button>
        <Heading as="h1">Settings</Heading>
      </div>
      {groups.map((group) => (
        <section key={group.label} className="flex flex-col gap-1.5" aria-labelledby={`settings-group-${group.label}`}>
          <SectionTitle as="h2" id={`settings-group-${group.label}`} className="px-1.5">
            {group.label}
          </SectionTitle>
          <Card size="sm" className="overflow-hidden p-0">
            <ul className="divide-y divide-border-subtle">
              {group.rows.map((row) => (
                <li key={row.value}>
                  <Link
                    to="/settings"
                    search={{ section: row.value }}
                    className="flex min-h-14 items-center gap-3 px-3.5 py-2.5 text-base hover:bg-bg-normal-hovered"
                    data-section-link={row.value}
                  >
                    <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-lg bg-bg-subtle-pressed text-fg-strong">
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        {TILE[row.value]}
                      </svg>
                    </span>
                    <span className="min-w-0 flex-1 text-fg-strong">{row.label}</span>
                    {row.count !== undefined && <span className="text-sm text-fg-subtle tabular-nums">{row.count}</span>}
                    <span className="text-fg-subtle">
                      <ChevronRight />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ))}
      {footer !== undefined && <div className="text-center">{footer}</div>}
    </div>
  );
}

/**
 * One place on a phone, as its own screen: "‹ Settings" back to the list,
 * its name, and what it holds. Foods brings its own header (its + and its
 * search held at the top), so it passes `bare`.
 */
export function SettingsSectionScreen({ label, bare = false, children }: { label: string; bare?: boolean; children: ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 p-4" data-section-screen>
      <Link to="/settings" className="flex min-h-10 items-center gap-1 self-start font-medium text-fg-brand" data-back-to-settings>
        <span aria-hidden="true" className="text-xl leading-none">
          ‹
        </span>
        Settings
      </Link>
      {!bare && <Heading as="h1">{label}</Heading>}
      {children}
    </div>
  );
}
