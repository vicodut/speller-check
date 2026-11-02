import { describe, expect, test } from "bun:test";
import type { NodeLike } from "../../shared/text-model";
import { skipMatcherFor } from "./skip-matcher.service";

/** An element with class names, written like `div.gmail_quote`. */
const el = (tag: string): NodeLike => {
  const [name = "", ...classes] = tag.split(".");
  return {
    nodeType: 1,
    nodeName: name.toUpperCase(),
    nodeValue: null,
    childNodes: [],
    classList: { contains: (token: string) => classes.includes(token) },
  };
};

describe("skipMatcherFor", () => {
  test("skips blockquote on every site", () => {
    expect(skipMatcherFor("example.com")(el("blockquote"))).toBe(true);
    expect(skipMatcherFor("mail.google.com")(el("blockquote"))).toBe(true);
  });

  test("keeps ordinary elements", () => {
    expect(skipMatcherFor("mail.google.com")(el("div.a3s"))).toBe(false);
    expect(skipMatcherFor("example.com")(el("p"))).toBe(false);
  });

  test("on Gmail, skips quote and signature containers", () => {
    const skip = skipMatcherFor("mail.google.com");
    for (const tag of [
      "div.gmail_quote",
      "div.gmail_quote_container",
      "div.gmail_extra",
      "div.gmail_attr",
      "div.gmail_signature",
      "span.gmail_signature_prefix",
    ]) {
      expect(skip(el(tag))).toBe(true);
    }
  });

  test("Gmail rules don't apply on other sites", () => {
    expect(skipMatcherFor("example.com")(el("div.gmail_quote"))).toBe(false);
    expect(skipMatcherFor("notmail.google.com.evil.io")(el("div.gmail_signature"))).toBe(false);
  });

  test("handles elements without class names", () => {
    const bare: NodeLike = { nodeType: 1, nodeName: "DIV", nodeValue: null, childNodes: [] };
    expect(skipMatcherFor("mail.google.com")(bare)).toBe(false);
  });
});
