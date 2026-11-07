import { Badge } from "@sixthshift/design-system/badge";
import { Heading } from "@sixthshift/design-system/heading";
import { SectionTitle } from "@sixthshift/design-system/section-title";
import { cn } from "@sixthshift/design-system/utils";
import type { ReactNode } from "react";

/** One place in the menu: what it is called, its count if it has one, and what it shows. */
export type SettingsSection = {
  value: string;
  label: string;
  badge?: number;
  content: ReactNode;
  /**
   * Lays out to the page's width: a table of the library. The rest are a
   * column of settings, which keep a reading measure however wide the screen.
   */
  wide?: boolean;
};

export type SettingsGroup = { label: string; sections: SettingsSection[] };

/**
 * A desktop's Settings (decisions.md row 207): the places as a menu down the
 * left, grouped, and the one chosen filling the rest of the width. The phone's
 * tabs become this rather than a row of twelve. The choice is the address's
 * (`?section=`, as the phone's list), so a link or the command bar opens a
 * place, a reload keeps it and Back walks the places: `value` is it, and
 * `onChange` asks the page to move. `footer` sits at the menu's foot (the build).
 */
export function SettingsMenu({
  groups,
  footer,
  value,
  onChange,
}: {
  groups: SettingsGroup[];
  footer?: ReactNode;
  value?: string;
  onChange: (value: string) => void;
}) {
  const all = groups.flatMap((group) => group.sections);
  const current = all.find((section) => section.value === value) ?? all[0];

  return (
    <div className="grid min-h-[calc(100dvh-var(--top-bar))] grid-cols-[230px_minmax(0,1fr)]">
      <nav
        aria-label="Settings"
        className="sticky top-[var(--top-bar)] flex h-[calc(100dvh-var(--top-bar))] flex-col gap-5 overflow-y-auto border-r border-border-normal bg-bg-normal px-3 py-5"
      >
        <Heading as="h1" className="px-2">
          Settings
        </Heading>
        {groups.map((group) => (
          <div key={group.label} className="flex flex-col gap-0.5">
            <SectionTitle as="h2" className="px-2 pb-1">
              {group.label}
            </SectionTitle>
            {group.sections.map((section) => {
              const on = section.value === current?.value;
              return (
                <button
                  key={section.value}
                  type="button"
                  aria-current={on ? "page" : undefined}
                  className={cn(
                    "flex cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm",
                    on ? "bg-bg-subtle-pressed font-medium text-fg-strong" : "text-fg-normal hover:bg-bg-subtle-hovered"
                  )}
                  onClick={() => onChange(section.value)}
                >
                  {section.label}
                  {section.badge !== undefined && (
                    <Badge variant="soft" intent="neutral" size="sm">
                      {section.badge}
                    </Badge>
                  )}
                </button>
              );
            })}
          </div>
        ))}
        {footer !== undefined && <div className="mt-auto px-2">{footer}</div>}
      </nav>
      {current !== undefined && (
        <section aria-labelledby="settings-section" className="flex min-w-0 flex-col gap-4 px-8 py-6" data-section={current.value}>
          <Heading as="h2" id="settings-section">
            {current.label}
          </Heading>
          <div className={cn("min-w-0", !current.wide && "max-w-3xl")}>{current.content}</div>
        </section>
      )}
    </div>
  );
}
