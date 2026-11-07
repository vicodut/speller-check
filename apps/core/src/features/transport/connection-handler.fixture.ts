// Test fixture: a ConnectionHandler with recording fakes for the socket, session and rephraser.
import type { CheckRequest, CoreMessage } from "@gc/protocol";
import { Logger } from "../../shared/logger";
import { ok } from "../../shared/result";
import { ConnectionHandler } from "./connection.handler";
import type { ServerDeps } from "./server-deps.types";

export const TOKEN = "t".repeat(43);
export const hello = JSON.stringify({ type: "hello", token: TOKEN });

export const setup = (overrides: Partial<ServerDeps> = {}, helloTimeoutMs = 5000) => {
  const sent: CoreMessage[] = [];
  const closes: number[] = [];
  const updates: CheckRequest[] = [];
  const closedFields: string[] = [];
  const logs: string[] = [];
  let disposed = 0;
  const rephraseCalls: string[] = [];
  let publish: ((message: CoreMessage) => void) | undefined;
  let publishRephrase: ((message: CoreMessage) => void) | undefined;
  const deps: ServerDeps = {
    settingsView: () => {
      throw new Error("the WebSocket handler never reads settings");
    },
    createSession: (p) => {
      publish = p;
      return {
        update: (request) => updates.push(request),
        close: (fieldId) => closedFields.push(fieldId),
        dispose: () => disposed++,
      };
    },
    addDictionaryTerm: async () => ok(undefined),
    createRephraser: (p) => {
      publishRephrase = p;
      return {
        request: async (m) => {
          rephraseCalls.push(`request ${m.fieldId} ${m.requestId}`);
        },
        edited: (fieldId) => rephraseCalls.push(`edited ${fieldId}`),
        cancel: (fieldId) => rephraseCalls.push(`cancel ${fieldId}`),
        dispose: () => rephraseCalls.push("dispose"),
      };
    },
    ...overrides,
  };
  const socket = {
    send: (m: CoreMessage) => sent.push(m),
    close: (code: number) => closes.push(code),
  };
  const logger = new Logger((line) => logs.push(line));
  const handler = new ConnectionHandler({ token: TOKEN, helloTimeoutMs }, deps, socket, logger);
  return {
    handler,
    sent,
    closes,
    updates,
    closedFields,
    logs,
    disposed: () => disposed,
    publish: (m: CoreMessage) => publish?.(m),
    rephraseCalls,
    publishRephrase: (m: CoreMessage) => publishRephrase?.(m),
  };
};
