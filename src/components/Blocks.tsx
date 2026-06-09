import type { Block } from "../lib/types";
import { Callout } from "./Callout";
import { CommandBlock } from "./CommandBlock";

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
        return <Callout key={i} data={block.data} />;
      })}
    </div>
  );
}
