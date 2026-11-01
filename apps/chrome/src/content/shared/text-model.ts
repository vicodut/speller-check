/** The DOM surface the model reads; real Nodes satisfy it, tests use plain objects. */
export type NodeLike = {
  readonly nodeType: number;
  readonly nodeName: string;
  readonly nodeValue: string | null;
  readonly childNodes: ArrayLike<NodeLike>;
};

/** A run of the model's text: from a text node, or a synthetic newline (`node` null). */
type Segment<N> = { readonly start: number; readonly end: number; readonly node: N | null };

/** Plain text of a contenteditable region, with UTF-16 offsets mapped back to text nodes. */
export type TextModel<N extends NodeLike = NodeLike> = {
  readonly text: string;
  readonly segments: readonly Segment<N>[];
};

export type Point<N> = { node: N; offset: number };

const TEXT_NODE = 3;
const ELEMENT_NODE = 1;
const SKIPPED = new Set(["SCRIPT", "STYLE", "TEMPLATE", "NOSCRIPT"]);
const BLOCKS = new Set([
  ...["ADDRESS", "ARTICLE", "ASIDE", "BLOCKQUOTE", "DD", "DIV", "DL", "DT", "FIGURE", "FOOTER"],
  ...["FORM", "H1", "H2", "H3", "H4", "H5", "H6", "HEADER", "HR", "LI", "MAIN", "NAV", "OL"],
  ...["P", "PRE", "SECTION", "TABLE", "TR", "UL"],
]);

/** Builds the model: text nodes in order, `<br>` as "\n", one "\n" between blocks. */
export const buildTextModel = <N extends NodeLike>(root: N): TextModel<N> => {
  const segments: Segment<N>[] = [];
  let text = "";
  // A block boundary only becomes a newline once more text follows it.
  let pendingBreak = false;
  const push = (value: string, node: N | null) => {
    if (pendingBreak && text !== "" && !text.endsWith("\n")) {
      segments.push({ start: text.length, end: text.length + 1, node: null });
      text += "\n";
    }
    pendingBreak = false;
    segments.push({ start: text.length, end: text.length + value.length, node });
    text += value;
  };
  /** `endsBlock`: the node is the last child of a block or of the root. */
  const walk = (node: N, isRoot: boolean, endsBlock: boolean): void => {
    if (node.nodeType === TEXT_NODE) {
      if (node.nodeValue) push(node.nodeValue, node);
      return;
    }
    if (node.nodeType !== ELEMENT_NODE || SKIPPED.has(node.nodeName)) return;
    if (node.nodeName === "BR") {
      // A <br> ending a non-empty block only keeps the line open; it adds no line of its own.
      const emptyLine = text === "" || text.endsWith("\n") || pendingBreak;
      if (!endsBlock || emptyLine) push("\n", null);
      return;
    }
    const block = isRoot || BLOCKS.has(node.nodeName);
    if (block && !isRoot) pendingBreak = true;
    const children = Array.from(node.childNodes as ArrayLike<N>);
    children.forEach((child, i) => {
      walk(child, false, i === children.length - 1 && (block || endsBlock));
    });
    if (block && !isRoot) pendingBreak = true;
  };
  walk(root, true, true);
  return { text, segments };
};

/** The DOM point for a text offset; null when it falls in a synthetic newline or out of range. */
export const pointAt = <N extends NodeLike>(
  model: TextModel<N>,
  offset: number,
  edge: "start" | "end",
): Point<N> | null => {
  const segment = model.segments.find((s) =>
    edge === "start" ? s.start <= offset && offset < s.end : s.start < offset && offset <= s.end,
  );
  if (!segment?.node) return null;
  return { node: segment.node, offset: offset - segment.start };
};

/** The text offset of a point inside one of the model's text nodes; null otherwise. */
export const offsetOf = <N extends NodeLike>(
  model: TextModel<N>,
  node: NodeLike,
  offset: number,
): number | null => {
  const segment = model.segments.find((s) => s.node === node);
  return segment ? segment.start + Math.min(offset, segment.end - segment.start) : null;
};
