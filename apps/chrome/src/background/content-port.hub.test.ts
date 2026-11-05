import { describe, expect, test } from "bun:test";
import type { ClientMessage } from "@gc/protocol";
import type { BackgroundMessage } from "../shared/port-messages";
import { type ContentPort, ContentPortHub } from "./content-port.hub";

class FakePort implements ContentPort {
  readonly received: BackgroundMessage[] = [];
  private messageListener: (message: unknown) => void = () => {};
  private disconnectListener: () => void = () => {};
  onMessage = {
    addListener: (listener: (message: unknown) => void) => {
      this.messageListener = listener;
    },
  };
  onDisconnect = {
    addListener: (listener: () => void) => {
      this.disconnectListener = listener;
    },
  };
  postMessage(message: BackgroundMessage): void {
    this.received.push(message);
  }
  send(message: unknown): void {
    this.messageListener(message);
  }
  disconnect(): void {
    this.disconnectListener();
  }
}

const setup = () => {
  const toCore: ClientMessage[] = [];
  const hub = new ContentPortHub((message) => toCore.push(message) > 0);
  const a = new FakePort();
  const b = new FakePort();
  hub.attach(a);
  hub.attach(b);
  // Each port gets the current status on attach; tested on its own below.
  a.received.length = 0;
  b.received.length = 0;
  return { hub, toCore, a, b };
};

const changed = (fieldId: string, version = 1) => ({
  type: "text.changed",
  fieldId,
  version,
  text: "Hi.",
});

describe("ContentPortHub", () => {
  test("prefixes field ids with the port id", () => {
    const { toCore, a, b } = setup();
    a.send(changed("f1"));
    b.send(changed("f1"));
    b.send({ type: "field.closed", fieldId: "f1" });
    expect(toCore.map((m) => ("fieldId" in m ? m.fieldId : ""))).toEqual([
      "p1/f1",
      "p2/f1",
      "p2/f1",
    ]);
  });

  test("forwards text.edit with the prefix and routes resync_needed back", () => {
    const { hub, toCore, a } = setup();
    const edit = { fieldId: "f1", version: 2, baseVersion: 1, start: 0, deleteCount: 0 };
    a.send({ type: "text.edit", ...edit, insert: "x" });
    expect(toCore).toEqual([{ type: "text.edit", ...edit, fieldId: "p1/f1", insert: "x" }]);
    hub.fromCore({ type: "error", code: "resync_needed", fieldId: "p1/f1" });
    expect(a.received).toEqual([{ type: "error", code: "resync_needed", fieldId: "f1" }]);
  });

  test("routes issues and errors to the owning port with the prefix stripped", () => {
    const { hub, a, b } = setup();
    a.send(changed("f1"));
    b.send(changed("f1"));
    hub.fromCore({ type: "issues", fieldId: "p2/f1", version: 1, issues: [] });
    hub.fromCore({ type: "error", code: "provider_timeout", fieldId: "p1/f1" });
    expect(a.received).toEqual([{ type: "error", code: "provider_timeout", fieldId: "f1" }]);
    expect(b.received).toEqual([{ type: "issues", fieldId: "f1", version: 1, issues: [] }]);
  });

  test("drops replies for closed or unknown fields", () => {
    const { hub, a } = setup();
    a.send(changed("f1"));
    a.send({ type: "field.closed", fieldId: "f1" });
    hub.fromCore({ type: "issues", fieldId: "p1/f1", version: 1, issues: [] });
    hub.fromCore({ type: "issues", fieldId: "p7/f1", version: 1, issues: [] });
    hub.fromCore({ type: "error", code: "message_invalid" });
    expect(a.received).toEqual([]);
  });

  test("closes a port's open fields when it disconnects", () => {
    const { toCore, a } = setup();
    a.send(changed("f1"));
    a.send(changed("f2"));
    toCore.length = 0;
    a.disconnect();
    expect(toCore).toEqual([
      { type: "field.closed", fieldId: "p1/f1" },
      { type: "field.closed", fieldId: "p1/f2" },
    ]);
  });

  test("ignores invalid content messages and forbids hello from content", () => {
    const { toCore, a } = setup();
    a.send({ type: "hello", token: "stolen" });
    a.send({ type: "text.changed", fieldId: "f1", version: -1, text: "" });
    a.send("garbage");
    expect(toCore).toEqual([]);
  });

  test("passes dictionary additions through and broadcasts core readiness", () => {
    const { hub, toCore, a, b } = setup();
    a.send({ type: "dictionary.add", term: "NestJS" });
    hub.fromCore({ type: "ready" });
    expect(toCore).toEqual([{ type: "dictionary.add", term: "NestJS" }]);
    expect(a.received).toEqual([{ type: "core.ready" }]);
    expect(b.received).toEqual([{ type: "core.ready" }]);
  });

  test("sends the current status on attach and broadcasts changes", () => {
    const hub = new ContentPortHub(() => true);
    const early = new FakePort();
    hub.attach(early);
    hub.setStatus("unreachable");
    const late = new FakePort();
    hub.attach(late);
    expect(early.received).toEqual([
      { type: "core.status", status: "connecting" },
      { type: "core.status", status: "unreachable" },
    ]);
    expect(late.received).toEqual([{ type: "core.status", status: "unreachable" }]);
  });

  const rephraseRequest = (requestId: number) => ({
    type: "rephrase.request" as const,
    fieldId: "f1",
    version: 2,
    requestId,
    text: "Hi.",
    caret: 0,
  });

  const tone = (requestId: number) => ({
    type: "rephrase.tone" as const,
    fieldId: "p1/f1",
    version: 2,
    requestId,
    passage: { start: 0, end: 3 },
    sentences: [{ text: "Hi.", start: 0, end: 3 }],
    language: "en" as const,
    tone: "casual" as const,
    segments: [{ from: 0, to: 0, keep: true as const }],
  });

  const done = (requestId: number) => ({
    type: "rephrase.done" as const,
    fieldId: "p1/f1",
    version: 2,
    requestId,
    count: 1,
  });

  test("routes every tone of a rephrase to its port, even after the field closed", () => {
    const { hub, toCore, a } = setup();
    a.send(rephraseRequest(1));
    expect(toCore).toEqual([{ ...rephraseRequest(1), fieldId: "p1/f1" }]);
    hub.fromCore(tone(1));
    a.send({ type: "field.closed", fieldId: "f1" });
    hub.fromCore({ ...tone(1), tone: "concise" });
    hub.fromCore(done(1));
    expect(a.received).toEqual([
      { ...tone(1), fieldId: "f1" },
      { ...tone(1), tone: "concise", fieldId: "f1" },
      { ...done(1), fieldId: "f1" },
    ]);
    hub.fromCore(tone(1));
    expect(a.received).toHaveLength(3);
  });

  test("drops replies to a superseded rephrase, whose error doesn't end the newer one", () => {
    const { hub, a } = setup();
    a.send(rephraseRequest(1));
    a.send(rephraseRequest(2));
    const cancelled = {
      type: "error" as const,
      code: "rephrase_cancelled",
      fieldId: "p1/f1",
      request: "rephrase" as const,
      requestId: 1,
    };
    hub.fromCore(cancelled);
    hub.fromCore(tone(2));
    expect(a.received).toEqual([{ ...tone(2), fieldId: "f1" }]);
  });

  test("a frame going away cancels its running rephrase", () => {
    const { toCore, a } = setup();
    a.send(rephraseRequest(1));
    toCore.length = 0;
    a.disconnect();
    expect(toCore).toContainEqual({ type: "rephrase.cancel", fieldId: "p1/f1" });
  });

  test("a rephrase the core can't take fails at once", () => {
    const hub = new ContentPortHub(() => false);
    const port = new FakePort();
    hub.attach(port);
    port.received.length = 0;
    port.send(rephraseRequest(4));
    expect(port.received).toEqual([
      { type: "error", code: "core_unavailable", fieldId: "f1", request: "rephrase", requestId: 4 },
    ]);
  });
});
