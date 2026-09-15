import { Button } from "@sixthshift/design-system/button";
import { FormField } from "@sixthshift/design-system/form-field";
import { Input } from "@sixthshift/design-system/input";
import { Message } from "@sixthshift/design-system/message";
import { SectionTitle } from "@sixthshift/design-system/section-title";
import type { FormEvent } from "react";

export type UrlSourceProps = {
  url: string;
  busy?: boolean;
  error?: string | null;
  onUrlChange: (url: string) => void;
  onFetch: () => void;
  onBack: () => void;
};

/** The second stage: one address. */
export function UrlSource({ url, busy, error, onUrlChange, onFetch, onBack }: UrlSourceProps) {
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (url.trim() !== "") onFetch();
  };
  return (
    <form className="flex flex-col gap-4" data-source-stage="url" onSubmit={submit}>
      <SectionTitle as="h2">From a web page</SectionTitle>
      <FormField label="Address">
        <Input
          name="url"
          type="url"
          inputMode="url"
          autoComplete="off"
          placeholder="https://"
          aria-label="Recipe address"
          value={url}
          disabled={busy}
          onChange={(event) => onUrlChange(event.target.value)}
        />
      </FormField>
      {error != null && (
        <Message intent="danger" title="That page could not be read" data-testid="import-error">
          {error}
        </Message>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="solid" intent="brand" disabled={busy || url.trim() === ""}>
          {busy ? "Reading…" : "Read the page"}
        </Button>
        <Button type="button" variant="ghost" intent="neutral" disabled={busy} onClick={onBack}>
          Back
        </Button>
      </div>
    </form>
  );
}
