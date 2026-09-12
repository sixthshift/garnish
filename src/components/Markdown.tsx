// Renders the safe markdown subset (src/domain/markdown.ts) as React elements.
// Deliberately not `dangerouslySetInnerHTML`: the parser never produces HTML,
// and every text node goes through React, so anything HTML-shaped a cook typed
// into a step renders as the characters they typed.
import { Fragment } from "react";
import { cn } from "@sixthshift/design-system/utils";
import type { Block, Inline } from "../domain/markdown";
import { parseMarkdown } from "../domain/markdown";

function InlineNodes({ nodes }: { nodes: Inline[] }) {
  return (
    <>
      {nodes.map((node, index) => {
        const key = index;
        if (node.type === "text") return <Fragment key={key}>{node.value}</Fragment>;
        if (node.type === "strong")
          return (
            <strong key={key} className="font-semibold">
              <InlineNodes nodes={node.children} />
            </strong>
          );
        return (
          <em key={key}>
            <InlineNodes nodes={node.children} />
          </em>
        );
      })}
    </>
  );
}

function BlockNode({ block }: { block: Block }) {
  if (block.type === "paragraph") {
    return (
      <p className="whitespace-pre-line">
        <InlineNodes nodes={block.children} />
      </p>
    );
  }
  const items = block.items.map((item, index) => (
    <li key={index}>
      <InlineNodes nodes={item} />
    </li>
  ));
  return block.ordered ? (
    <ol className="list-decimal pl-5" start={block.start}>
      {items}
    </ol>
  ) : (
    <ul className="list-disc pl-5">{items}</ul>
  );
}

/**
 * `source` parsed and rendered. Renders nothing when the source is blank.
 * Nothing is spliced into the text: M29.1 moved the timer chips out of the
 * prose and into the step card's footer, and the `decorate` seam that carried
 * them went with them.
 */
export function Markdown({ source, className }: { source: string; className?: string }) {
  const blocks = parseMarkdown(source);
  if (blocks.length === 0) return null;
  return (
    <div className={cn("flex flex-col gap-2", className)} data-testid="markdown">
      {blocks.map((block, index) => (
        <BlockNode key={index} block={block} />
      ))}
    </div>
  );
}
