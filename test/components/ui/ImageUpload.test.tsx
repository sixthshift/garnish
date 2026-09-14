import { renderToString } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { ImageUpload } from "../../../src/components/ui/ImageUpload";
import { imageSrc } from "../../../src/components/ui/ImageUpload";

describe("imageSrc", () => {
  test("a local preview wins over the stored image", () => {
    expect(imageSrc("blob:x", "abc.jpg")).toBe("blob:x");
  });

  test("falls back to the stored image URL, then to null", () => {
    expect(imageSrc(null, "abc.jpg")).toBe("/api/images/abc.jpg");
    expect(imageSrc(null, null)).toBeNull();
    expect(imageSrc(null, undefined)).toBeNull();
    expect(imageSrc(null, "")).toBeNull();
  });
});

describe("ImageUpload", () => {
  test("shows the stored image with change and remove buttons", () => {
    const html = renderToString(<ImageUpload image="abc.jpg" onSelect={() => {}} onRemove={() => {}} />);
    expect(html).toContain('src="/api/images/abc.jpg"');
    expect(html).not.toContain('data-placeholder="image"');
    expect(html).toContain("Change image");
    expect(html).toContain("Remove image");
    expect(html).toMatch(/<input[^>]*type="file"[^>]*accept="image\/\*"/);
  });

  test("shows the placeholder and no remove button without an image", () => {
    const html = renderToString(<ImageUpload image={null} onSelect={() => {}} onRemove={() => {}} />);
    expect(html).toContain('data-placeholder="image"');
    expect(html).not.toContain("<img");
    expect(html).toContain("Choose image");
    expect(html).not.toContain("Remove image");
  });

  test("no remove button when onRemove is not given", () => {
    const html = renderToString(<ImageUpload image="abc.jpg" onSelect={() => {}} />);
    expect(html).not.toContain("Remove image");
  });
});
