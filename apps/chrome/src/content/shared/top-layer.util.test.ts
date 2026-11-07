import { describe, expect, test } from "bun:test";
import { placeHost } from "./top-layer.util";

/** Just enough of an element for placeHost: a parent link, children, and a popover state. */
class FakeNode {
  parentNode: FakeNode | null = null;
  popover: string | null = null;
  open = false;
  shows = 0;
  constructor(
    readonly name: string,
    private readonly modal: FakeNode | null = null,
  ) {}
  appendChild(child: FakeNode): FakeNode {
    // Like the DOM: moving a shown popover hides it.
    child.open = false;
    child.parentNode = this;
    return child;
  }
  closest(selector: string): FakeNode | null {
    return selector === "dialog:modal" ? this.modal : null;
  }
  matches(selector: string): boolean {
    return selector === ":popover-open" && this.open;
  }
  showPopover(): void {
    if (this.popover === null || this.open) throw new Error("InvalidStateError");
    this.open = true;
    this.shows++;
  }
  hidePopover(): void {
    if (!this.open) throw new Error("InvalidStateError");
    this.open = false;
  }
  removeAttribute(name: string): void {
    if (name === "popover") this.popover = null;
  }
}

const place = (host: FakeNode, field: FakeNode, root: FakeNode) =>
  placeHost(host as unknown as HTMLElement, field as unknown as Element, root as unknown as Node);

/** What a page re-render does to our host: removed, so no longer a shown popover. */
const dropFromPage = (host: FakeNode) => {
  host.parentNode = null;
  host.open = false;
};

describe("placeHost", () => {
  test("a field on the page keeps the host on the root, not as a popover", () => {
    const root = new FakeNode("html");
    const host = new FakeNode("host");
    place(host, new FakeNode("field"), root);
    expect(host.parentNode).toBe(root);
    expect(host.popover).toBeNull();
  });

  test("a field in a modal dialog moves the host into it and shows it in the top layer", () => {
    const root = new FakeNode("html");
    const dialog = new FakeNode("dialog");
    const host = new FakeNode("host");
    place(host, new FakeNode("field", dialog), root);
    expect(host.parentNode).toBe(dialog);
    expect(host.popover).toBe("manual");
    expect(host.open).toBe(true);
  });

  test("placing again in the same dialog does nothing", () => {
    const dialog = new FakeNode("dialog");
    const host = new FakeNode("host");
    const field = new FakeNode("field", dialog);
    place(host, field, new FakeNode("html"));
    place(host, field, new FakeNode("html"));
    expect(host.shows).toBe(1);
  });

  test("a host the page dropped (dialog re-rendered) goes back in and is shown again", () => {
    const dialog = new FakeNode("dialog");
    const host = new FakeNode("host");
    const field = new FakeNode("field", dialog);
    place(host, field, new FakeNode("html"));
    dropFromPage(host);
    place(host, field, new FakeNode("html"));
    expect(host.parentNode).toBe(dialog);
    expect(host.open).toBe(true);
  });

  test("leaving the dialog for a page field returns the host to the root as a plain element", () => {
    const root = new FakeNode("html");
    const host = new FakeNode("host");
    const dialog = new FakeNode("dialog");
    place(host, new FakeNode("field", dialog), root);
    place(host, new FakeNode("field"), root);
    expect(host.parentNode).toBe(root);
    expect(host.popover).toBeNull();
    expect(host.open).toBe(false);
  });
});
