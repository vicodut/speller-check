import { describe, expect, test } from "bun:test";
import { buildTextModel, type NodeLike, offsetOf, pointAt } from "./text-model";

const text = (value: string): NodeLike => ({
  nodeType: 3,
  nodeName: "#text",
  nodeValue: value,
  childNodes: [],
});
const el = (name: string, ...children: NodeLike[]): NodeLike => ({
  nodeType: 1,
  nodeName: name.toUpperCase(),
  nodeValue: null,
  childNodes: children,
});

describe("buildTextModel", () => {
  test("concatenates inline text", () => {
    const root = el("div", text("I has "), el("b", text("went")), text(" home."));
    expect(buildTextModel(root).text).toBe("I has went home.");
  });

  test("turns <br> and block boundaries into single newlines", () => {
    const root = el("div", el("p", text("One.")), el("p", text("Two"), el("br"), text("three.")));
    expect(buildTextModel(root).text).toBe("One.\nTwo\nthree.");
  });

  test("keeps an empty paragraph as a blank line", () => {
    const root = el("div", el("p", text("a")), el("p", el("br")), el("p", text("b")));
    expect(buildTextModel(root).text).toBe("a\n\nb");
  });

  test("ignores a trailing <br> at the end of a block", () => {
    const root = el("div", el("div", text("a"), el("br")), el("div", text("b")));
    expect(buildTextModel(root).text).toBe("a\nb");
  });

  test("skips script, style and template content", () => {
    const root = el("div", text("a"), el("style", text("p{}")), el("script", text("x")), text("b"));
    expect(buildTextModel(root).text).toBe("ab");
  });
});

describe("pointAt", () => {
  const went = text("went");
  const root = el("div", el("p", text("I has ")), el("p", went, text(" home.")));
  const model = buildTextModel(root);

  test("maps an offset to its text node", () => {
    const start = model.text.indexOf("went");
    expect(pointAt(model, start, "start")).toEqual({ node: went, offset: 0 });
    expect(pointAt(model, start + 4, "end")).toEqual({ node: went, offset: 4 });
  });

  test("returns null inside a synthetic newline", () => {
    expect(pointAt(model, model.text.indexOf("\n"), "start")).toBeNull();
  });

  test("returns null out of range", () => {
    expect(pointAt(model, 999, "start")).toBeNull();
  });
});

describe("offsetOf", () => {
  test("maps a text node point back to a text offset", () => {
    const home = text(" home.");
    const model = buildTextModel(el("div", text("ab"), el("br"), home));
    expect(offsetOf(model, home, 3)).toBe(6);
  });

  test("returns null for an unknown node", () => {
    expect(offsetOf(buildTextModel(el("div", text("a"))), text("z"), 0)).toBeNull();
  });
});
