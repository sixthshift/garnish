import { describe, expect, test } from "vitest";
import { openGraphStub, openGraphTags } from "../../src/domain/openGraph";

const full = `<html><head>
  <meta property="og:title" content="Anzac biscuits">
  <meta property="og:description" content="Chewy and golden.">
  <meta property="og:image" content="https://x.test/a.jpg">
</head><body></body></html>`;

describe("openGraphTags", () => {
  test("reads og: values, keyed without the prefix", () => {
    const tags = openGraphTags(full);
    expect(tags.get("title")).toBe("Anzac biscuits");
    expect(tags.get("description")).toBe("Chewy and golden.");
    expect(tags.get("image")).toBe("https://x.test/a.jpg");
  });

  test("`name` is accepted where a site uses it instead of `property`", () => {
    expect(openGraphTags('<meta name="og:title" content="Toast">').get("title")).toBe("Toast");
  });

  test("twitter: tags are not mistaken for og:", () => {
    const html = '<meta name="twitter:title" content="Wrong"><meta property="og:title" content="Right">';
    const tags = openGraphTags(html);
    expect(tags.get("title")).toBe("Right");
    expect([...tags.keys()]).toEqual(["title"]);
  });

  test("the first of a repeated tag wins, as OpenGraph specifies", () => {
    const html = '<meta property="og:image" content="https://x.test/a.jpg"><meta property="og:image" content="https://x.test/b.jpg">';
    expect(openGraphTags(html).get("image")).toBe("https://x.test/a.jpg");
  });

  test("attribute order, quoting and casing do not matter", () => {
    const html = `<META CONTENT='Toast' PROPERTY=og:title data-x>`;
    expect(openGraphTags(html).get("title")).toBe("Toast");
  });

  test("entities are decoded and whitespace collapsed", () => {
    expect(openGraphTags('<meta property="og:title" content="Salt &amp;  pepper">').get("title")).toBe("Salt & pepper");
  });

  test("a tag with no content, or blank content, is skipped", () => {
    expect(openGraphTags('<meta property="og:title">').size).toBe(0);
    expect(openGraphTags('<meta property="og:title" content="   ">').size).toBe(0);
  });
});

describe("openGraphStub", () => {
  test("a page with all three", () => {
    expect(openGraphStub(full)).toEqual({
      name: "Anzac biscuits",
      description: "Chewy and golden.",
      image: "https://x.test/a.jpg",
    });
  });

  test("a title alone is enough; the rest come back empty", () => {
    expect(openGraphStub('<meta property="og:title" content="Toast">')).toEqual({ name: "Toast", description: "", image: null });
  });

  test("no title is null: there is nothing to build a recipe around", () => {
    expect(openGraphStub('<meta property="og:description" content="Only a description">')).toBeNull();
    expect(openGraphStub("<html><body><p>Nothing at all.</p></body></html>")).toBeNull();
    expect(openGraphStub("")).toBeNull();
  });
});
