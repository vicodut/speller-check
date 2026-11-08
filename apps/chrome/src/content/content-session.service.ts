// One checking session for this frame: field watcher, underlines/card, badge, rephrase and core port.
import type { FeatureModel } from "@gc/protocol";
import type { BackgroundMessage, ConnectionStatus } from "../shared/port-messages";
import { FieldWatcher } from "./features/field-watcher";
import { REPHRASE_CSS, RephraseController, renderRephraseSection } from "./features/rephrase";
import type { StopSession } from "./features/site-gate";
import { StatusBadge } from "./features/status-badge";
import { canSendRephrase } from "./features/text-cap";
import { createIssueView } from "./features/underlines";
import { applyFix } from "./features/write-back";
import { FieldChecks } from "./field-checks.service";
import { CorePort } from "./shared/core-port";
import { fieldCaret, fieldText } from "./shared/field-text";
import type { WatchedField } from "./shared/issue-view";

const copyText = (text: string): Promise<boolean> =>
  navigator.clipboard.writeText(text).then(
    () => true,
    () => false,
  );

/** Where a feature's text goes: its host (or "the cloud" if unnamed) when the model is not local. */
const cloudHost = (model: FeatureModel): string | undefined =>
  model.local ? undefined : (model.provider ?? "the cloud");

/** Starts watching fields; the returned function removes all UI and closes the port. */
export const startSession = (doc: Document): StopSession => {
  const port = new CorePort((message) => onBackground(message));
  let status: ConnectionStatus | undefined;
  /** The host rephrase text goes to, while its model is a cloud one. */
  let rephraseCloud: string | undefined;
  const view = createIssueView({
    addToDictionary: (term) => {
      checks.dictionaryChanged();
      port.send({ type: "dictionary.add", term });
    },
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
    // Same write-back as Accept; the edit's input events then get the new text checked.
    apply: applyFix,
    changed: (field) => badge.refreshPanel(field),
  });
  const badge = new StatusBadge({
    select: (field, issue) => view.open(field, issue),
    section: {
      css: REPHRASE_CSS,
      render: (container, field) => {
        rephrase.seen(field);
        renderRephraseSection(
          container,
          rephrase.state(field),
          {
            rephrase: (tone) => rephrase.request(field, tone),
            replace: (tone, segment) => void rephrase.replace(field, tone, segment),
            copy: copyText,
          },
          rephraseCloud,
        );
      },
      hasNews: (field) => rephrase.hasNews(field),
    },
  });
  // Focus, edits, blur and results; refocusing an unchanged field reuses its last result.
  const checks = new FieldChecks({
    send: (message) => port.send(message),
    view,
    badge,
    status: () => status,
  });
  const watcher = new FieldWatcher(doc, {
    changed: (field, fieldId, version, text, cause) => {
      rephrase.track(field, fieldId, version);
      checks.changed(field, fieldId, version, text, cause);
    },
    // A blur keeps the field's rephrase: its tones still arrive and are shown on the next open.
    closed: (field, fieldId) => checks.closed(field, fieldId),
  });

  const onBackground = (message: BackgroundMessage): void => {
    if (message.type === "core.status") {
      status = message.status;
      if (status === "auth_failed" || status === "unreachable") badge.offline(status);
      return;
    }
    if (message.type === "core.models") {
      rephraseCloud = cloudHost(message.rephrase);
      badge.setCloud(cloudHost(message.check));
      return;
    }
    if (message.type === "core.ready") {
      checks.coreReady();
      watcher.resendFocused();
      return;
    }
    if (message.type === "core.model_changed") {
      checks.modelChanged();
      watcher.resendFocused();
      return;
    }
    if (message.type === "issues") {
      // Only the current version is drawn; a blurred field's result is only remembered.
      checks.issues(message, watcher.currentField(message.fieldId, message.version));
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
    if (message.fieldId === undefined) return;
    if (message.code === "resync_needed") {
      // The core lost the edit's base: resend the full text as a new version, not a failure.
      const field = watcher.openField(message.fieldId);
      checks.resyncNeeded(message.fieldId, field);
      if (field) watcher.resendFocused();
      return;
    }
    checks.failed(message.fieldId, message.code, watcher.openField(message.fieldId));
  };

  // The port opens lazily on the first focused field, so idle pages don't wake the worker.
  watcher.start();
  return () => {
    // Stopping the watcher closes the focused field (no text), then the port goes for good.
    watcher.stop();
    port.close();
    checks.dispose();
    view.dispose();
    badge.dispose();
  };
};
