import { Card } from "@sixthshift/design-system/card";
import { Muted } from "@sixthshift/design-system/muted";
import { SectionTitle } from "@sixthshift/design-system/section-title";
import type { ReactNode } from "react";

/**
 * The small tabs' one layout: a section label on the page, then a card of
 * rows, each a setting — what it is on the left, its value or control on the
 * right. The card holds the settings themselves, never prose (design-language
 * rule 2); anything explanatory goes in `lead` above it or `foot` below it.
 */
export function SettingsPanel({ title, lead, foot, children }: { title: string; lead?: ReactNode; foot?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2" aria-label={title}>
      <SectionTitle as="h2">{title}</SectionTitle>
      {lead && (
        <Muted as="p" className="text-sm">
          {lead}
        </Muted>
      )}
      <Card size="sm" className="divide-y divide-border-subtle p-0">
        {children}
      </Card>
      {foot && (
        <Muted as="p" className="text-sm">
          {foot}
        </Muted>
      )}
    </section>
  );
}

/** One setting: label and a line of description, then whatever it holds, which wraps under on a phone. */
export function SettingRow({ label, description, children }: { label: ReactNode; description?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-3 py-3">
      <div className="flex min-w-0 flex-1 basis-56 flex-col gap-0.5">
        <span className="text-sm font-medium">{label}</span>
        {description && (
          <Muted as="span" className="text-sm">
            {description}
          </Muted>
        )}
      </div>
      {children && <div className="flex min-w-0 max-w-full items-center gap-2">{children}</div>}
    </div>
  );
}

/** The small tabs' measure: a settings column, not the width the reference tables need. */
export function SettingsColumn({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-6">{children}</div>;
}
