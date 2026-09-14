import { describe, expect, test } from "vitest";
import { findRecipeNode, isRecipeNode, jsonLdNodes, recipeNodeFromHtml, typesOf, unwrapScriptBody } from "../../../src/domain/import/jsonLd";

/** A page carrying `blocks` as ld+json scripts, with ordinary markup around them. */
function page(...blocks: string[]): string {
  return `<!DOCTYPE html><html><head><title>x</title>${blocks
    .map((block) => `<script type="application/ld+json">${block}</script>`)
    .join("")}</head><body><h1>x</h1></body></html>`;
}

describe("unwrapScriptBody", () => {
  test("plain JSON comes back trimmed", () => {
    expect(unwrapScriptBody('\n  {"a":1}  \n')).toBe('{"a":1}');
  });

  test("a CDATA wrapper is removed, with or without the comment guard", () => {
    expect(unwrapScriptBody('<![CDATA[{"a":1}]]>')).toBe('{"a":1}');
    expect(unwrapScriptBody('/* <![CDATA[ */{"a":1}/* ]]> */')).toBe('{"a":1}');
  });

  test("an HTML comment wrapper is removed", () => {
    expect(unwrapScriptBody('<!--{"a":1}-->')).toBe('{"a":1}');
  });
});

describe("typesOf and isRecipeNode", () => {
  test("a string type, an array type, and neither", () => {
    expect(typesOf({ "@type": "Recipe" })).toEqual(["Recipe"]);
    expect(typesOf({ "@type": ["Recipe", "NewsArticle"] })).toEqual(["Recipe", "NewsArticle"]);
    expect(typesOf({ "@type": [1, "Recipe"] })).toEqual(["Recipe"]);
    expect(typesOf({})).toEqual([]);
  });

  test("a node typed as several things still counts as a recipe", () => {
    expect(isRecipeNode({ "@type": ["Recipe", "NewsArticle"] })).toBe(true);
  });

  test("case and a fully qualified type are both accepted", () => {
    expect(isRecipeNode({ "@type": "recipe" })).toBe(true);
    expect(isRecipeNode({ "@type": "https://schema.org/Recipe" })).toBe(true);
  });

  test("other types are not recipes", () => {
    expect(isRecipeNode({ "@type": "Organization" })).toBe(false);
    expect(isRecipeNode({ "@type": "HowTo" })).toBe(false);
    expect(isRecipeNode({})).toBe(false);
  });
});

describe("jsonLdNodes", () => {
  test("a single node", () => {
    expect(jsonLdNodes(page('{"@type":"Recipe","name":"Toast"}'))).toEqual([{ "@type": "Recipe", name: "Toast" }]);
  });

  test("a top-level array is flattened", () => {
    const nodes = jsonLdNodes(page('[{"@type":"Organization"},{"@type":"Recipe","name":"Toast"}]'));
    expect(nodes).toHaveLength(2);
    expect(nodes[1]).toMatchObject({ name: "Toast" });
  });

  test("an @graph is flattened, the way Yoast emits it", () => {
    const nodes = jsonLdNodes(page('{"@context":"https://schema.org","@graph":[{"@type":"WebSite"},{"@type":"Recipe","name":"Toast"}]}'));
    expect(nodes).toHaveLength(2);
    expect(findRecipeNode(nodes)).toMatchObject({ name: "Toast" });
  });

  test("two blocks stay two blocks, in document order", () => {
    const nodes = jsonLdNodes(page('{"@type":"Organization","name":"Site"}', '{"@type":"Recipe","name":"Toast"}'));
    expect(nodes.map((node) => node.name)).toEqual(["Site", "Toast"]);
  });

  test("a broken block costs only itself", () => {
    const nodes = jsonLdNodes(page('{"@type":"Organization",}', '{"@type":"Recipe","name":"Toast"}'));
    expect(nodes).toHaveLength(1);
    expect(nodes[0]).toMatchObject({ name: "Toast" });
  });

  test("attribute order, quoting and casing do not matter", () => {
    const html = `<SCRIPT id="x" TYPE='application/ld+json' data-y>{"@type":"Recipe","name":"Toast"}</SCRIPT>`;
    expect(jsonLdNodes(html)).toEqual([{ "@type": "Recipe", name: "Toast" }]);
  });

  test("other script tags are left alone", () => {
    const html = `<script>var recipe = {"@type":"Recipe"}</script><script type="application/json">{"@type":"Recipe"}</script>`;
    expect(jsonLdNodes(html)).toEqual([]);
  });

  test("a page with no structured data is empty, not an error", () => {
    expect(jsonLdNodes("<html><body><p>A recipe, in prose.</p></body></html>")).toEqual([]);
    expect(jsonLdNodes("")).toEqual([]);
  });

  test("an empty block is skipped", () => {
    expect(jsonLdNodes(page("   "))).toEqual([]);
  });
});

describe("findRecipeNode and recipeNodeFromHtml", () => {
  test("the recipe is found beside the site's other nodes", () => {
    const html = page('{"@type":"Organization","name":"Site"}', '{"@graph":[{"@type":"BreadcrumbList"},{"@type":"Recipe","name":"Toast"}]}');
    expect(recipeNodeFromHtml(html)).toMatchObject({ name: "Toast" });
  });

  test("the first recipe wins where a page somehow has two", () => {
    const html = page('[{"@type":"Recipe","name":"First"},{"@type":"Recipe","name":"Second"}]');
    expect(recipeNodeFromHtml(html)).toMatchObject({ name: "First" });
  });

  test("a page with structured data but no recipe is null", () => {
    expect(recipeNodeFromHtml(page('{"@type":"Article","name":"Not a recipe"}'))).toBeNull();
    expect(findRecipeNode([])).toBeNull();
  });
});
