import { Button } from "@sixthshift/design-system/button";
import { cn } from "@sixthshift/design-system/utils";
import { useEffect, useId, useRef, useState } from "react";

import { recipeImageUrl } from "../../lib/images";

export type ImageUploadProps = {
  /** Stored image file name, as on the recipe row. */
  image?: string | null;
  /** An image that exists only as a remote URL — one an import found, before it has been fetched and stored. Shown when nothing local or stored is. */
  previewUrl?: string | null;
  onSelect: (file: File) => void;
  /** When given, a "Remove image" button shows while there is an image. */
  onRemove?: () => void;
  disabled?: boolean;
  className?: string;
  /**
   * `stacked` (the default): the picture, the buttons under it. `hero`: the
   * picture fills its box edge to edge and the buttons sit on it, frosted, as
   * the recipe editor's photo does where the recipe page's is (decisions.md
   * row 211). The box's size is the caller's, through `className`.
   */
  variant?: "stacked" | "hero";
};

export function ImageUpload({ image, previewUrl, onSelect, onRemove, disabled, className, variant = "stacked" }: ImageUploadProps) {
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

  const hero = variant === "hero";
  return (
    <div className={cn(hero ? "relative overflow-hidden bg-bg-subtle-pressed" : "flex flex-col gap-3", className)} data-image-upload={variant}>
      {hasImage ? (
        <img
          src={src}
          alt=""
          className={hero ? "absolute inset-0 size-full object-cover" : "aspect-video w-full rounded-xl object-cover"}
          data-preview={preview !== null ? "true" : undefined}
        />
      ) : (
        <div
          data-placeholder="image"
          aria-hidden="true"
          className={cn("flex w-full items-center justify-center text-fg-subtle", hero ? "absolute inset-0" : "aspect-video rounded-xl bg-bg-subtle")}
        >
          <svg
            aria-hidden="true"
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <circle cx="8.5" cy="10" r="1.5" />
            <path d="m21 16-4.5-4.5L9 19" />
          </svg>
        </div>
      )}
      <div className={cn("flex flex-wrap items-center gap-2", hero && "absolute right-3 bottom-3 z-10")}>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept="image/*"
          className="sr-only"
          disabled={disabled}
          onChange={(event) => choose(event.target.files?.[0])}
        />
        <Button
          type="button"
          variant="outline"
          intent="neutral"
          size="sm"
          disabled={disabled}
          className={cn(hero && FROSTED)}
          onClick={() => inputRef.current?.click()}
        >
          {hasImage ? "Change image" : "Choose image"}
        </Button>
        {/* Neutral (rule 5): nothing is lost until the form it sits in is saved, and Cancel keeps the image. */}
        {hasImage && onRemove !== undefined && (
          <Button
            type="button"
            variant={hero ? "outline" : "ghost"}
            intent="neutral"
            size="sm"
            disabled={disabled}
            className={cn(hero && FROSTED)}
            onClick={remove}
          >
            Remove image
          </Button>
        )}
      </div>
    </div>
  );
}

/** A button over the photo, frosted so it reads on light and dark alike. */
const FROSTED = "border-transparent bg-bg-normal/85 backdrop-blur-sm hover:bg-bg-normal";

/** The URL to show, most local first: a just-picked file, the stored image, then a remote one an import found. Null means placeholder. Pure. */
export function imageSrc(preview: string | null, image: string | null | undefined, previewUrl?: string | null): string | null {
  return preview ?? recipeImageUrl(image) ?? previewUrl ?? null;
}
