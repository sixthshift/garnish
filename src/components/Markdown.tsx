// Renders the safe markdown subset (src/domain/markdown.ts) as React elements.
// Deliberately not `dangerouslySetInnerHTML`: the parser never produces HTML,
// and every text node goes through React, so anything HTML-shaped a cook typed
// into a step renders as the characters they typed.
import { Fragment, type ReactNode } from "react";
import { cn } from "@sixthshift/design-system/utils";
import type { Block, Inline } from "../domain/markdown";
import { parseMarkdown } from "../domain/markdown";

/** Splices something into a text run — a timer chip inline in a step, say. Applied to every text node, including one nested inside bold or italics; the subset has no code or link markup to carve out. */
export type Decorate = (text: string) => ReactNode;

function InlineNodes({ nodes, decorate }: { nodes: Inline[]; decorate?: Decorate }) {
  return (
    <>
      {nodes.map((node, index) => {
        const key = index;
        if (node.type === "text") return <Fragment key={key}>{decorate ? decorate(node.value) : node.value}</Fragment>;
        if (node.type === "strong")
          return (
            <strong key={key} className="font-semibold">
              <InlineNodes nodes={node.children} decorate={decorate} />
            </strong>
          );
        return (
          <em key={key}>
            <InlineNodes nodes={node.children} decorate={decorate} />
          </em>
        );
      })}
    </>
  );
}

function BlockNode({ block, decorate }: { block: Block; decorate?: Decorate }) {
  if (block.type === "paragraph") {
    return (
      <p className="whitespace-pre-line">
        <InlineNodes nodes={block.children} decorate={decorate} />
      </p>
    );
  }
  const items = block.items.map((item, index) => (
    <li key={index}>
      <InlineNodes nodes={item} decorate={decorate} />
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
 * `decorate`, when given, wraps every run of literal text (src/domain/timers.ts's
 * `decorateDurations` is the one caller today) so a caller can splice inline
 * elements — a `TimerChip` — into the middle of a paragraph or list item
 * without reimplementing the walk over the parsed tree.
 */
export function Markdown({ source, className, decorate }: { source: string; className?: string; decorate?: Decorate }) {
  const blocks = parseMarkdown(source);
  if (blocks.length === 0) return null;
  return (
    <div className={cn("flex flex-col gap-2", className)} data-testid="markdown">
      {blocks.map((block, index) => (
        <BlockNode key={index} block={block} decorate={decorate} />
      ))}
    </div>
  );
}
