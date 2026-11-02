import { describe, expect, test } from "bun:test";
import { buildTextModel, type NodeLike, offsetOf, pointAt, type SkipMatcher } from "./text-model";

const text = (value: string): NodeLike => ({
  nodeType: 3,
  nodeName: "#text",
  nodeValue: value,
  childNodes: [],
});
/** An element with class names, written like `div.gmail_quote`. */
const el = (tag: string, ...children: NodeLike[]): NodeLike => {
  const [name = "", ...classes] = tag.split(".");
  return {
    nodeType: 1,
    nodeName: name.toUpperCase(),
    nodeValue: null,
    childNodes: children,
    classList: { contains: (token: string) => classes.includes(token) },
  };
};

const SKIPPED_CLASSES = ["gmail_quote", "gmail_signature"];
const skip: SkipMatcher = (node) =>
  node.nodeName === "BLOCKQUOTE" || SKIPPED_CLASSES.some((c) => node.classList?.contains(c));

// A Gmail reply: own text, a signature, then the quoted thread.
const went = text("went");
const home = text(" home.");
const thanks = text("Thank you");
const quoted = text("Teh old mail");
const gmailReply = el(
  "div",
  el("div", text("I has "), el("b", went), home),
  el("div", el("br")),
  el("div", thanks),
  el("div.gmail_signature", el("div", text("Jon Smyth, Acme"))),
  el("div.gmail_quote", el("div.gmail_attr", text("On Mon, Ann wrote:")), el("blockquote", quoted)),
);

describe("buildTextModel with a skip matcher", () => {
  test("leaves out the signature and the quoted thread", () => {
    expect(buildTextModel(gmailReply, skip).text).toBe("I has went home.\n\nThank you");
  });

  test("leaves out a blockquote between paragraphs, keeping one line break", () => {
    const root = el("div", el("p", text("a")), el("blockquote", text("q")), el("p", text("b")));
    expect(buildTextModel(root, skip).text).toBe("a\nb");
  });

  test("a skipped block between inline text still breaks the line", () => {
    const root = el("div", text("a"), el("blockquote", text("q")), text("b"));
    expect(buildTextModel(root, skip).text).toBe("a\nb");
  });

  test("a skipped inline element is dropped without a break", () => {
    const root = el("div", text("a"), el("span.gmail_signature", text("sig")), text("b"));
    expect(buildTextModel(root, skip).text).toBe("ab");
  });

  test("never skips the root itself", () => {
    expect(buildTextModel(el("blockquote", text("mine")), skip).text).toBe("mine");
  });

  test("without a matcher nothing extra is skipped", () => {
    expect(buildTextModel(gmailReply).text).toContain("Teh old mail");
  });
});

describe("offset mapping around skipped parts", () => {
  const model = buildTextModel(gmailReply, skip);

  test("pointAt lands on the writer's text nodes", () => {
    const start = model.text.indexOf("went");
    expect(pointAt(model, start, "start")).toEqual({ node: went, offset: 0 });
    expect(pointAt(model, start + 4, "end")).toEqual({ node: went, offset: 4 });
    expect(pointAt(model, model.text.length, "end")).toEqual({ node: thanks, offset: 9 });
  });

  test("offsets past the writer's text map to nothing", () => {
    expect(pointAt(model, model.text.length, "start")).toBeNull();
  });

  test("offsetOf maps the writer's nodes and ignores skipped ones", () => {
    expect(offsetOf(model, home, 1)).toBe(model.text.indexOf(" home.") + 1);
    expect(offsetOf(model, thanks, 0)).toBe(model.text.indexOf("Thank"));
    expect(offsetOf(model, quoted, 0)).toBeNull();
  });

  test("text after a skipped quote keeps its offsets", () => {
    const after = text("Bye.");
    const root = el("div", el("div", text("Hi.")), el("blockquote", text("q")), el("div", after));
    const reply = buildTextModel(root, skip);
    expect(reply.text).toBe("Hi.\nBye.");
    expect(pointAt(reply, 4, "start")).toEqual({ node: after, offset: 0 });
    expect(offsetOf(reply, after, 2)).toBe(6);
  });
});
