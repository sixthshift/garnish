// Picks a recipe image. Shows the stored image (by file name, served from
// /api/images), a local preview of a just-chosen file, or a placeholder. It
// never uploads: the parent gets the File from `onSelect` and decides when to
// POST it (M5.2). The preview is an object URL, revoked when it is replaced or
// the component unmounts.
//
// With `onUrl` it also takes a pasted address (M13.5). The fetch itself is the
// parent's — this is a UI primitive and does not call the server — so `onUrl`
// resolves with the File and rejects with a message this shows beside the
// field.
import { Button } from "@sixthshift/design-system/button";
import { Input } from "@sixthshift/design-system/input";
import { Message } from "@sixthshift/design-system/message";
import { cn } from "@sixthshift/design-system/utils";
import { useEffect, useId, useRef, useState } from "react";
import { recipeImageUrl } from "../../lib/images";
import { messageFrom } from "../../lib/notify";

export type ImageUploadProps = {
  /** Stored image file name, as on the recipe row. */
  image?: string | null;
  onSelect: (file: File) => void;
  /** When given, a "Remove image" button shows while there is an image. */
  onRemove?: () => void;
  /** When given, a URL field shows; it resolves with the fetched File, or rejects with a message to display. */
  onUrl?: (url: string) => Promise<File>;
  disabled?: boolean;
  className?: string;
};

/** The URL to show: a local preview wins over the stored image; null means placeholder. Pure. */
export function imageSrc(preview: string | null, image: string | null | undefined): string | null {
  return preview ?? recipeImageUrl(image);
}

export function ImageUpload({ image, onSelect, onRemove, onUrl, disabled, className }: ImageUploadProps) {
  const inputId = useId();
  const urlId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [fetching, setFetching] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);

  useEffect(() => {
    if (preview === null) return;
    return () => URL.revokeObjectURL(preview);
  }, [preview]);

  const src = imageSrc(preview, image);
  const hasImage = src !== null;

  const choose = (file: File | undefined) => {
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    onSelect(file);
  };

  const fetchUrl = async () => {
    const address = url.trim();
    if (onUrl === undefined || address === "" || fetching) return;
    setFetching(true);
    setUrlError(null);
    try {
      choose(await onUrl(address));
      setUrl("");
    } catch (error) {
      setUrlError(messageFrom(error));
    } finally {
      setFetching(false);
    }
  };

  const remove = () => {
    setPreview(null);
    if (inputRef.current) inputRef.current.value = "";
    onRemove?.();
  };

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {hasImage ? (
        <img src={src} alt="" className="aspect-video w-full rounded-xl object-cover" data-preview={preview !== null ? "true" : undefined} />
      ) : (
        <div data-placeholder="image" aria-hidden="true" className="flex aspect-video w-full items-center justify-center rounded-xl bg-bg-subtle text-fg-subtle">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <circle cx="8.5" cy="10" r="1.5" />
            <path d="m21 16-4.5-4.5L9 19" />
          </svg>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept="image/*"
          className="sr-only"
          disabled={disabled}
          onChange={(event) => choose(event.target.files?.[0])}
        />
        <Button type="button" variant="outline" intent="neutral" size="sm" disabled={disabled} onClick={() => inputRef.current?.click()}>
          {hasImage ? "Change image" : "Choose image"}
        </Button>
        {hasImage && onRemove !== undefined && (
          <Button type="button" variant="ghost" intent="danger" size="sm" disabled={disabled} onClick={remove}>
            Remove image
          </Button>
        )}
      </div>
      {onUrl !== undefined && (
        <div className="flex flex-col gap-2" data-testid="image-url">
          <label htmlFor={urlId} className="text-sm font-medium">
            Or paste an image URL
          </label>
          <div className="flex items-center gap-2">
            <Input
              id={urlId}
              type="url"
              inputMode="url"
              placeholder="https://example.com/photo.jpg"
              value={url}
              autoComplete="off"
              disabled={disabled || fetching}
              onChange={(event) => setUrl(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                void fetchUrl();
              }}
            />
            <Button type="button" variant="outline" intent="neutral" size="sm" disabled={disabled || fetching || url.trim() === ""} onClick={() => void fetchUrl()}>
              {fetching ? "Fetching…" : "Fetch"}
            </Button>
          </div>
          {urlError !== null && (
            <Message intent="danger" data-testid="image-url-error">
              {urlError}
            </Message>
          )}
        </div>
      )}
    </div>
  );
}
