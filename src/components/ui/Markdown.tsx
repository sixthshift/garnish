// Never dangerouslySetInnerHTML: the parser produces no HTML and every text node goes through React.

import { cn } from "@sixthshift/design-system/utils";
import { Fragment } from "react";
import type { Block, Inline } from "../../lib/markdown";
import { parseMarkdown } from "../../lib/markdown";

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
 * Nothing is spliced into the text: timer chips live in the step card's footer, not the prose.
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
