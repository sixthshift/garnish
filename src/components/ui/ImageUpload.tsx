// Picks a recipe image. Shows the stored image (by file name, served from
// /api/images), a local preview of a just-chosen file, or a placeholder. It
// never uploads: the parent gets the File from `onSelect` and decides when to
// POST it (M5.2). The preview is an object URL, revoked when it is replaced or
// the component unmounts.
import { Button } from "@sixthshift/design-system/button";
import { cn } from "@sixthshift/design-system/utils";
import { useEffect, useId, useRef, useState } from "react";

import { recipeImageUrl } from "../../lib/images";

export type ImageUploadProps = {
  /** Stored image file name, as on the recipe row. */
  image?: string | null;
  /** An image that exists only as a remote URL — one an import found, before it has been fetched and stored (M23.6). Shown when nothing local or stored is. */
  previewUrl?: string | null;
  onSelect: (file: File) => void;
  /** When given, a "Remove image" button shows while there is an image. */
  onRemove?: () => void;
  disabled?: boolean;
  className?: string;
};

export function ImageUpload({ image, previewUrl, onSelect, onRemove, disabled, className }: ImageUploadProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (preview === null) return;
    return () => URL.revokeObjectURL(preview);
  }, [preview]);

  const src = imageSrc(preview, image, previewUrl);
  const hasImage = src !== null;

  const choose = (file: File | undefined) => {
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    onSelect(file);
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
        <div
          data-placeholder="image"
          aria-hidden="true"
          className="flex aspect-video w-full items-center justify-center rounded-xl bg-bg-subtle text-fg-subtle"
        >
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
    </div>
  );
}

/** The URL to show, most local first: a just-picked file, the stored image, then a remote one an import found. Null means placeholder. Pure. */
export function imageSrc(preview: string | null, image: string | null | undefined, previewUrl?: string | null): string | null {
  return preview ?? recipeImageUrl(image) ?? previewUrl ?? null;
}
