import type { Block } from "../lib/types";
import { Callout } from "./Callout";
import { CommandBlock } from "./CommandBlock";
import { ChevronDown } from "./Icons";

export function Blocks({ blocks }: { blocks: Block[] }) {
  return (
    <div className="space-y-3">
      {blocks.map((block, i) => {
        if (block.type === "prose") {
          return (
            <div
              key={i}
              className="prose-rb"
              dangerouslySetInnerHTML={{ __html: block.html }}
            />
          );
        }
        if (block.type === "command") {
          return <CommandBlock key={i} language={block.language} code={block.code} />;
        }
        if (block.type === "details") {
          return <DetailsBlock key={i} title={block.title} blocks={block.blocks} />;
        }
        return <Callout key={i} data={block.data} />;
      })}
    </div>
  );
}

/**
 * Collapsed-by-default disclosure for granular how-to depth. Native
 * <details>/<summary> so keyboard and screen-reader behavior come for free;
 * defined here (not its own file) because it recursively renders <Blocks>.
 */
function DetailsBlock({ title, blocks }: { title: string; blocks: Block[] }) {
  return (
    <details className="rb-details">
      <summary>
        <ChevronDown size={16} className="rb-details-chev shrink-0" />
        <span>{title}</span>
      </summary>
      <div className="rb-details-body">
        <Blocks blocks={blocks} />
      </div>
    </details>
  );
}
