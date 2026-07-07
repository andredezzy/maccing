// A type→renderer registry with single-block dispatch. ONE implementation, instantiated per domain
// (blocks, database views). Imports nothing — a runtime sink, so neither engine forms an import cycle.

export type Renderer<TNode> = (node: TNode, width: number, depth: number, ordinal: number) => string[];

export interface Registry<TNode extends { type: string }> {
  register: <T extends TNode["type"]>(type: T, render: Renderer<Extract<TNode, { type: T }>>) => void;
  render: (node: TNode, width: number, depth: number, ordinal: number) => string[];
}

/** Create a fresh registry for a node union. `register` narrows the node to its `type` at the call site. */
export function createRegistry<TNode extends { type: string }>(): Registry<TNode> {
  const registry = new Map<string, Renderer<TNode>>();
  return {
    register(type, render) {
      registry.set(type, render as Renderer<TNode>);
    },
    render(node, width, depth, ordinal) {
      return registry.get(node.type)?.(node, width, depth, ordinal) ?? [];
    },
  };
}
