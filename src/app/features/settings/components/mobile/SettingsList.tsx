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
 * Each place's tile: a glyph on the page's one step up (`docs/mockups/desktop.html`,
 * `mSettings`). Neutral, all of them: colour is identity and state (design-language
 * rule 5), and the theme's subtle tints sank into dark holes on a dark card.
 * Pure decoration, so hidden.
 */
const TILE: Record<SettingsSectionId, { glyph: string }> = {
  foods: { glyph: "❦" },
  units: { glyph: "⚖" },
  aisles: { glyph: "▤" },
  tags: { glyph: "#" },
  style: { glyph: "✎" },
  planner: { glyph: "▦" },
  backup: { glyph: "⇩" },
  ai: { glyph: "✦" },
  mcp: { glyph: "⌘" },
  appearance: { glyph: "◐" },
  alerts: { glyph: "♪" },
  diagnostics: { glyph: "!" },
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
                    <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-lg bg-bg-subtle-pressed text-base text-fg-strong">
                      {TILE[row.value].glyph}
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
