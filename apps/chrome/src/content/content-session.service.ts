// One checking session for this frame: field watcher, underlines/card, badge, rephrase and core port.
import type { BackgroundMessage, ConnectionStatus } from "../shared/port-messages";
import { FieldWatcher } from "./features/field-watcher";
import { REPHRASE_CSS, RephraseController, renderRephraseSection } from "./features/rephrase";
import type { StopSession } from "./features/site-gate";
import { StatusBadge } from "./features/status-badge";
import { canSendRephrase, messageForChange } from "./features/text-cap";
import { createIssueView } from "./features/underlines";
import { CorePort } from "./shared/core-port";
import { fieldCaret, fieldText } from "./shared/field-text";
import type { WatchedField } from "./shared/issue-view";

/** Starts watching fields; the returned function removes all UI and closes the port. */
export const startSession = (doc: Document): StopSession => {
  const port = new CorePort((message) => onBackground(message));
  let status: ConnectionStatus | undefined;
  const view = createIssueView({
    addToDictionary: (term) => port.send({ type: "dictionary.add", term }),
    visibleChanged: (field, issues) => badge.issues(field, issues),
  });
  // Rephrase lives in the badge panel only; it never feeds the issue count.
  const rephrase = new RephraseController<WatchedField>({
    // Over the cap the panel can't open; this guards a request racing the field growing.
    send: (message) => {
      if (canSendRephrase(message)) port.send(message);
      else rephrase.fail(message.fieldId, message.requestId);
    },
    readText: fieldText,
    readCaret: fieldCaret,
    changed: (field) => badge.refreshPanel(field),
  });
  const badge = new StatusBadge({
    select: (field, issue) => view.open(field, issue),
    section: {
      css: REPHRASE_CSS,
      render: (container, field) => {
        rephrase.seen(field);
        renderRephraseSection(container, rephrase.state(field), () => rephrase.request(field));
      },
      hasNews: (field) => rephrase.hasNews(field),
    },
  });
  const watcher = new FieldWatcher(doc, {
    changed: (field, fieldId, version, text) => {
      rephrase.track(field, fieldId, version);
      const message = messageForChange({ fieldId, version, text });
      if (message.type === "field.closed") {
        // Over the cap: no text is sent and the old underlines no longer match.
        view.clear(field);
        badge.tooLong(field);
      } else if (status === "auth_failed" || status === "unreachable") {
        // While the core is unusable the background drops the text; say so instead of spinning.
        badge.offline(status, field);
      } else badge.checking(field);
      port.send(message);
    },
    // A blur keeps the field's rephrase: its tones still arrive and are shown on the next open.
    closed: (field, fieldId) => {
      badge.hide(field);
      view.clear(field);
      port.send({ type: "field.closed", fieldId });
    },
  });

  const onBackground = (message: BackgroundMessage): void => {
    if (message.type === "core.status") {
      status = message.status;
      if (status === "auth_failed" || status === "unreachable") badge.offline(status);
      return;
    }
    if (message.type === "core.ready") {
      watcher.resendFocused();
      return;
    }
    if (message.type === "issues") {
      // Only the current version is drawn; anything older is stale and dropped.
      const field = watcher.currentField(message.fieldId, message.version);
      if (!field) return;
      view.show(field, message.issues);
      badge.done(field);
      return;
    }
    // Rephrase replies may concern a closed (blurred) field; the controller knows its fields.
    if (message.type === "rephrase.tone" || message.type === "rephrase.done") {
      rephrase.receive(message);
      return;
    }
    if (message.request === "rephrase") {
      if (message.fieldId !== undefined) rephrase.fail(message.fieldId, message.requestId);
      return;
    }
    const field = message.fieldId === undefined ? undefined : watcher.openField(message.fieldId);
    if (!field) return;
    view.clear(field);
    badge.failed(field, message.code);
  };

  // The port opens lazily on the first focused field, so idle pages don't wake the worker.
  watcher.start();
  return () => {
    // Stopping the watcher closes the focused field (no text), then the port goes for good.
    watcher.stop();
    port.close();
    view.dispose();
    badge.dispose();
  };
};
