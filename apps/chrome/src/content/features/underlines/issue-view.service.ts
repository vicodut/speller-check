import type { Issue } from "@gc/protocol";
import { fieldText, isTextControl } from "../../shared/field-text";
import { createFrameScheduler } from "../../shared/frame-scheduler.util";
import { colourForType } from "../../shared/issue-colour.util";
import type { IssueView, IssueViewCallbacks, WatchedField } from "../../shared/issue-view";
import { applyFix, issuesAfterFix, matchesText } from "../write-back";
import { CardController } from "./card-controller.service";
import { createEditableMeasurer } from "./editable-measure.service";
import { attachFieldListeners } from "./field-listeners.service";
import {
  emptyHidden,
  type HiddenIssues,
  issueAtOffset,
  issueKey,
  sameOccurrence,
  visibleIssues,
} from "./issue-filter.util";
import { createMirrorMeasurer, type FieldMeasurer } from "./mirror-measure.service";
import { createOverlayHost, type OverlayHost } from "./overlay-host.service";
import { drawUnderlines } from "./underline-layer.service";

type Session = { field: WatchedField; issues: readonly Issue[]; detach: () => void };
type Ui = { overlay: OverlayHost; card: CardController };

/** Draws underlines for the shown field and opens the card when the caret lands on one. */
export class IssueViewService implements IssueView {
  private readonly hidden = new WeakMap<WatchedField, HiddenIssues>();
  private readonly scheduler = createFrameScheduler(() => this.redraw());
  private ui: Ui | null = null;
  private session: Session | null = null;

  constructor(private readonly callbacks: IssueViewCallbacks) {}

  show(field: WatchedField, issues: readonly Issue[]): void {
    this.ensureUi();
    if (this.session?.field === field) {
      this.session.issues = issues;
      this.keepCardOpen(issues);
    } else {
      if (this.session) this.clear(this.session.field);
      this.session = { field, issues, detach: this.attach(field) };
    }
    this.redraw();
  }

  open(field: WatchedField, issue: Issue): void {
    if (!this.session || this.session.field !== field || !this.ui) return;
    const target = sameOccurrence(this.visible(this.session), issue);
    if (!target) return;
    this.ui.card.open(target);
    this.redraw();
  }

  clear(field: WatchedField): void {
    if (this.session?.field !== field) return;
    this.session.detach();
    this.session = null;
    this.scheduler.cancel();
    this.ui?.card.close();
    if (this.ui) drawUnderlines(this.ui.overlay.underlines, []);
  }

  dispose(): void {
    if (this.session) this.clear(this.session.field);
    this.ui?.card.dispose();
    this.ui?.overlay.remove();
    this.ui = null;
  }

  private ensureUi(): void {
    if (this.ui) return;
    const overlay = createOverlayHost();
    const card = new CardController(overlay, {
      accept: (issue) => this.accept(issue),
      dismiss: (issue) => this.hide((h, text) => h.keys.add(issueKey(issue, text))),
      addToDictionary: (issue) => {
        this.callbacks.addToDictionary(issue.original);
        this.hide((h) => h.originals.add(issue.original));
      },
    });
    this.ui = { overlay, card };
  }

  private attach(field: WatchedField): () => void {
    return attachFieldListeners(field, {
      reposition: () => this.scheduler.schedule(),
      caret: (offset) => this.onCaret(offset),
      blur: () => this.ui?.card.close(),
    });
  }

  private hiddenFor(field: WatchedField): HiddenIssues {
    const existing = this.hidden.get(field);
    if (existing) return existing;
    const created = emptyHidden();
    this.hidden.set(field, created);
    return created;
  }

  /** Issues to draw. Stale ones (text changed since the check) wait for the next result. */
  private visible({ field, issues }: Session): Issue[] {
    const text = fieldText(field);
    return visibleIssues(issues, this.hiddenFor(field), text).filter((i) => matchesText(text, i));
  }

  private hide(change: (hidden: HiddenIssues, text: string) => void): void {
    if (!this.session) return;
    change(this.hiddenFor(this.session.field), fieldText(this.session.field));
    this.redraw();
  }

  private async accept(issue: Issue): Promise<boolean> {
    const session = this.session;
    if (!session) return false;
    // Computed before the edit: `visible` checks each issue against the current text.
    const remaining = issuesAfterFix(this.visible(session), issue);
    if (!(await applyFix(session.field, issue))) return false;
    // The edit triggers a new check, whose result replaces these; until then keep the others.
    if (this.session === session) {
      session.issues = remaining;
      this.redraw();
    }
    return true;
  }

  private onCaret(offset: number): void {
    if (!this.session || !this.ui) return;
    const issue = issueAtOffset(this.visible(this.session), offset);
    if (!issue) {
      this.ui.card.close();
      return;
    }
    this.ui.card.open(issue);
    this.redraw();
  }

  /** A fresh result keeps the card open when it still holds the same occurrence. */
  private keepCardOpen(issues: readonly Issue[]): void {
    const open = this.ui?.card.current();
    const fresh = open ? sameOccurrence(issues, open) : undefined;
    if (fresh) this.ui?.card.retarget(fresh);
  }

  private measurer(field: WatchedField, scratch: HTMLElement): FieldMeasurer {
    return isTextControl(field)
      ? createMirrorMeasurer(field, scratch)
      : createEditableMeasurer(field);
  }

  private redraw(): void {
    if (!this.session || !this.ui) return;
    const issues = this.visible(this.session);
    this.callbacks.visibleChanged(this.session.field, issues);
    const measurer = this.measurer(this.session.field, this.ui.overlay.scratch);
    const segments = issues.flatMap((issue) =>
      measurer
        .rangeRects(issue.start, issue.end)
        .map((rect) => ({ rect, colour: colourForType(issue.type) })),
    );
    const open = this.ui.card.current();
    const anchor =
      open && issues.includes(open) ? measurer.rangeRects(open.start, open.end)[0] : undefined;
    measurer.remove();
    drawUnderlines(this.ui.overlay.underlines, segments);
    this.ui.card.place(anchor);
  }
}
