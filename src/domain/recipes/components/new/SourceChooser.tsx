import { Button } from "@sixthshift/design-system/button";
import { Card, cardVariants } from "@sixthshift/design-system/card";
import { Input } from "@sixthshift/design-system/input";
import { Muted } from "@sixthshift/design-system/muted";
import { SectionTitle } from "@sixthshift/design-system/section-title";
import { cn } from "@sixthshift/design-system/utils";
import { type FormEvent, type ReactNode, useState } from "react";
import type { SourceKind } from "./importSummary";

export type SourceChooserProps = {
  onChoose: (kind: SourceKind) => void;
  /** Read a web page's address typed here, without a stage of its own first. Without it, the web page's stage opens. */
  onReadUrl?: (url: string) => void;
  disabled?: boolean;
  /** Whether a model is configured on the server; without one, Paste takes a page's HTML only. */
  aiAvailable?: boolean;
};

const icon = (path: ReactNode) => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {path}
  </svg>
);

/** The other ways in, below the address field: each a row you press. */
function otherWays(aiAvailable: boolean): { kind: SourceKind; title: string; blurb: string; icon: ReactNode }[] {
  return [
    {
      kind: "paste",
      title: "Paste the recipe",
      blurb: aiAvailable
        ? "Text from an email or a photo, or a page's HTML when a site blocks the import."
        : "Text from an email or a book, to sort into ingredients and steps, or a page's HTML when a site blocks the import.",
      icon: icon(
        <>
          <rect x="8" y="3" width="8" height="4" rx="1" />
          <path d="M8 5H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
        </>
      ),
    },
    {
      kind: "file",
      title: "Upload a recipe file",
      blurb: "One recipe exported from Mealie or Tandoor. A whole backup is Settings › Backup's.",
      icon: icon(<path d="M12 16V4m0 0l-4 4m4-4l4 4M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />),
    },
    {
      kind: "manual",
      title: "Start from scratch",
      blurb: "A blank recipe to type in.",
      icon: icon(<path d="M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4" />),
    },
  ];
}

const chevron = (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    aria-hidden="true"
    className="shrink-0"
  >
    <path d="M9 6l6 6-6 6" />
  </svg>
);

/**
 * The first stage, one column. A web page is how most recipes arrive, so its
 * address field comes first and reads at once; the other ways in sit below it,
 * three tiles across a desktop and a row each on a phone. Paste is always
 * offered: a page's HTML is read without a model. The Save to Garnish bookmark
 * is part of the web page's card, not a tile: it is another way to get the
 * same page, not another source.
 */
export function SourceChooser({ onChoose, onReadUrl, disabled, aiAvailable = false }: SourceChooserProps) {
  const [url, setUrl] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (url.trim() === "") return;
    if (onReadUrl) onReadUrl(url.trim());
    else onChoose("url");
  };

  return (
    <div className="flex flex-col gap-8 mobile:gap-6" data-source-stage="choose">
      {/* A phone takes the medium card's padding, so every way in fits above the tab bar. */}
      <Card size="lg" className="mobile:p-4">
        <form className="flex flex-col gap-4 mobile:gap-3" onSubmit={submit} data-source="url">
          <div className="flex flex-col gap-1">
            <label htmlFor="source-url" className="text-lg font-medium">
              Import from a web page
            </label>
            <Muted as="p" className="text-sm">
              The recipe is read off the page and shown to you before anything is saved. On a phone, share the page to Garnish instead.
            </Muted>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="source-url"
              name="url"
              type="url"
              inputMode="url"
              autoComplete="off"
              placeholder="https://"
              className="grow"
              value={url}
              disabled={disabled}
              onChange={(event) => setUrl(event.target.value)}
            />
            <Button type="submit" variant="solid" intent="brand" disabled={disabled || url.trim() === ""}>
              Import
            </Button>
          </div>
          {/* Not another way in: the same web page, its markup sent by the reader's browser instead of fetched here (decisions.md row 200). */}
          <div className="flex flex-wrap items-center gap-x-1 text-sm">
            <Muted as="span">Site blocks the import?</Muted>
            <Button type="button" variant="ghost" intent="neutral" size="sm" disabled={disabled} data-source="browser" onClick={() => onChoose("browser")}>
              <span aria-hidden="true">🌿</span> Send it from your browser
              {chevron}
            </Button>
          </div>
        </form>
      </Card>

      <section className="flex flex-col gap-3" aria-label="Other ways in">
        <SectionTitle as="h2">Other ways in</SectionTitle>
        <ul className="grid gap-3 desktop:grid-cols-3">
          {otherWays(aiAvailable).map((option) => (
            <li key={option.kind}>
              <button
                type="button"
                disabled={disabled}
                data-source={option.kind}
                // `cardVariants` with `interactive`: each tile is something you press (design-language rule 2).
                className={cn(
                  cardVariants({ size: "sm", interactive: true }),
                  "flex h-full w-full items-center gap-3 text-left disabled:opacity-50",
                  "desktop:flex-col desktop:items-start desktop:gap-2 desktop:p-4"
                )}
                onClick={() => onChoose(option.kind)}
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-bg-subtle text-fg-subtle">{option.icon}</span>
                <span className="flex min-w-0 grow flex-col">
                  <span className="font-medium">{option.title}</span>
                  <Muted as="span" className="text-sm">
                    {option.blurb}
                  </Muted>
                </span>
                <span className="text-fg-subtle desktop:hidden">{chevron}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
