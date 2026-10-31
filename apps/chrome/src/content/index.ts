// Content script: watches text fields and shows the core's issues. Never logs field text.
import { loadSettings } from "../shared/extension-settings";
import type { BackgroundMessage } from "../shared/port-messages";
import { isSiteBlocked } from "../shared/site-blocklist";
import { FieldWatcher } from "./features/field-watcher";
import { createIssueView } from "./features/underlines";
import { CorePort } from "./shared/core-port";

/** This frame's host and its ancestors' hosts, so an embedded frame on a blocked site stays off. */
const frameHostnames = (): string[] => {
  const ancestors = Array.from(location.ancestorOrigins ?? [], (origin) => {
    try {
      return new URL(origin).hostname;
    } catch {
      return "";
    }
  });
  return [location.hostname, ...ancestors];
};

const start = async (): Promise<void> => {
  // Blocklist first: nothing is watched or connected on a blocked site.
  const { blockedSites } = await loadSettings();
  if (frameHostnames().some((host) => isSiteBlocked(host, blockedSites))) return;

  const port = new CorePort((message) => onBackground(message));
  const view = createIssueView({
    addToDictionary: (term) => port.send({ type: "dictionary.add", term }),
  });
  const watcher = new FieldWatcher(document, {
    changed: (_field, fieldId, version, text) =>
      port.send({ type: "text.changed", fieldId, version, text }),
    closed: (field, fieldId) => {
      view.clear(field);
      port.send({ type: "field.closed", fieldId });
    },
  });

  const onBackground = (message: BackgroundMessage): void => {
    if (message.type === "core.ready") {
      watcher.resendFocused();
      return;
    }
    if (message.type === "issues") {
      // Only the current version is drawn; anything older is stale and dropped.
      const field = watcher.currentField(message.fieldId, message.version);
      if (field) view.show(field, message.issues);
      return;
    }
    const field = message.fieldId === undefined ? undefined : watcher.openField(message.fieldId);
    if (field) view.clear(field);
  };

  // The port opens lazily on the first focused field, so idle pages don't wake the worker.
  watcher.start();
};

void start();
