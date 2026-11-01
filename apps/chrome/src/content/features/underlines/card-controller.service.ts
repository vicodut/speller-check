import type { Issue } from "@gc/protocol";
import { type CardRenderer, canAddToDictionary, createCardRenderer, placeCard } from "../card";
import { attachCardDismissal } from "./field-listeners.service";
import type { OverlayHost } from "./overlay-host.service";
import type { Rect } from "./rect.util";

export type CardActions = {
  /** Writes the fix back; false switches the card to the Copy fallback. */
  accept(issue: Issue): Promise<boolean>;
  dismiss(issue: Issue): void;
  addToDictionary(issue: Issue): void;
};

const copyText = (text: string): Promise<boolean> =>
  navigator.clipboard.writeText(text).then(
    () => true,
    () => false,
  );

/** Opens, places and closes the suggestion card for one issue at a time. */
export class CardController {
  private readonly renderer: CardRenderer;
  private state: { issue: Issue; fallback: boolean } | null = null;
  private detachDismissal: (() => void) | null = null;

  constructor(
    private readonly overlay: OverlayHost,
    private readonly actions: CardActions,
  ) {
    this.renderer = createCardRenderer(overlay.cardSlot);
  }

  /** The issue the card shows, if open. */
  current(): Issue | null {
    return this.state?.issue ?? null;
  }

  /** Marks the card open for `issue`; it appears on the next `place`. */
  open(issue: Issue): void {
    if (this.state?.issue === issue) return;
    this.state = { issue, fallback: false };
    this.detachDismissal ??= attachCardDismissal(this.overlay.host, () => this.close());
  }

  /** Moves the card under `anchor`; closes it when the underline is no longer visible. */
  place(anchor: Rect | undefined): void {
    if (!this.state) return;
    if (!anchor) {
      this.close();
      return;
    }
    const { left, top } = placeCard(anchor, { width: innerWidth, height: innerHeight });
    const slot = this.overlay.cardSlot;
    slot.style.left = `${left}px`;
    slot.style.top = `${top}px`;
    slot.hidden = false;
    this.render();
  }

  close(): void {
    this.state = null;
    this.detachDismissal?.();
    this.detachDismissal = null;
    this.overlay.cardSlot.hidden = true;
    this.renderer.hide();
  }

  dispose(): void {
    this.close();
    this.renderer.dispose();
  }

  private async accept(issue: Issue): Promise<void> {
    const applied = await this.actions.accept(issue);
    // The card may have moved on to another issue (or closed) while the edit settled.
    if (this.state?.issue !== issue) return;
    if (applied) {
      this.close();
      return;
    }
    this.state = { issue, fallback: true };
    this.render();
  }

  private closeThen(action: (issue: Issue) => void, issue: Issue): void {
    this.close();
    action(issue);
  }

  private render(): void {
    if (!this.state) return;
    const { issue, fallback } = this.state;
    this.renderer.render({
      issue,
      fallback,
      showAddToDictionary: canAddToDictionary(issue),
      onAccept: () => void this.accept(issue),
      onDismiss: () => this.closeThen(this.actions.dismiss, issue),
      onAddToDictionary: () => this.closeThen(this.actions.addToDictionary, issue),
      onCopy: () => copyText(issue.suggestion),
    });
  }
}
