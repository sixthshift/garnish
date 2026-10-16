import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { microdataNodes, recipeNodeFromMicrodata } from "../../../../src/domain/import/page/microdata";

/** A recorded-style page whose recipe is microdata only, no `ld+json`. */
const MICRODATA_PAGE = readFileSync(join(import.meta.dirname, "../../../fixtures/importUrl/microdata-page.html"), "utf8");

describe("microdataNodes", () => {
  test("a page without itemscope has no items", () => {
    expect(microdataNodes("<html><body><p itemprop='name'>Loose</p></body></html>")).toEqual([]);
  });

  test("text, attribute and repeated properties", () => {
    const [node] = microdataNodes(`<div itemscope itemtype="https://schema.org/Recipe">
      <h1 itemprop="name"> Scones </h1>
      <a itemprop="url" href="https://x.test/scones">link</a>
      <meta itemprop="totalTime" content="PT25M">
      <time itemprop="cookTime" datetime="PT12M">12 minutes</time>
      <span itemprop="recipeIngredient">3 cups self-raising flour</span>
      <span itemprop="recipeIngredient">1 cup cream</span>
    </div>`);
    expect(node).toEqual({
      "@type": "Recipe",
      name: "Scones",
      url: "https://x.test/scones",
      totalTime: "PT25M",
      cookTime: "PT12M",
      recipeIngredient: ["3 cups self-raising flour", "1 cup cream"],
    });
  });

  test("a nested item is its parent's value and an item of its own", () => {
    const nodes = microdataNodes(`<div itemscope itemtype="https://schema.org/Recipe">
      <div itemprop="recipeInstructions" itemscope itemtype="https://schema.org/HowToStep"><p itemprop="text">Mix.</p></div>
    </div>`);
    expect(nodes).toEqual([
      { "@type": "Recipe", recipeInstructions: { "@type": "HowToStep", text: "Mix." } },
      { "@type": "HowToStep", text: "Mix." },
    ]);
  });

  test("one element can carry several properties", () => {
    const [node] = microdataNodes(`<div itemscope itemtype="https://schema.org/Recipe"><span itemprop="name alternateName">Pav</span></div>`);
    expect(node).toMatchObject({ name: "Pav", alternateName: "Pav" });
  });

  test("unclosed list items close at the next one, and script bodies are never read as markup", () => {
    const [node] = microdataNodes(`<script>var s = '<div itemscope itemtype="Thing">';</script>
      <ul itemscope itemtype="https://schema.org/Recipe">
        <li itemprop="recipeIngredient">2 eggs
        <li itemprop="recipeIngredient">1 cup milk
      </ul>`);
    expect(node?.["@type"]).toBe("Recipe");
    expect(node?.recipeIngredient).toEqual(["2 eggs", "1 cup milk"]);
  });
});

describe("recipeNodeFromMicrodata", () => {
  test("finds the Recipe nested inside a BlogPosting on a recorded-style page", () => {
    const node = recipeNodeFromMicrodata(MICRODATA_PAGE);
    expect(node).toMatchObject({
      "@type": "Recipe",
      name: "Lemon delicious pudding",
      image: "https://example.test/lemon.jpg?w=800&h=600",
      prepTime: "PT15M",
      cookTime: "PT45M",
      keywords: "dessert, winter, lemon",
    });
    expect(node?.recipeIngredient).toHaveLength(4);
    expect(node?.recipeInstructions).toHaveLength(3);
  });

  test("null when the page has items but no Recipe", () => {
    expect(recipeNodeFromMicrodata(`<div itemscope itemtype="https://schema.org/Person"><span itemprop="name">Marg</span></div>`)).toBeNull();
  });
});
