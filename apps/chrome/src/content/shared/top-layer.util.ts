/**
 * Puts an injected UI host where the user can see and click it next to `field`.
 *
 * A modal `<dialog>` (LinkedIn's post composer) is drawn in the browser's top layer, above any
 * z-index, and makes everything outside it inert. So for a field inside one, the host moves
 * into that dialog (no longer inert) and is shown as a manual popover (top layer, above the
 * dialog, with `position: fixed` relative to the viewport even if the dialog is transformed).
 * Anywhere else it stays a plain child of `root`. Cheap to call on every redraw, which also
 * puts the host back if the page re-rendered the dialog and dropped it.
 */
export const placeHost = (
  host: HTMLElement,
  field: Element,
  root: Node = document.documentElement,
): void => {
  const modal = field.closest("dialog:modal");
  const parent = modal ?? root;
  // Moving an element hides it if it was a shown popover; it is shown again below.
  if (host.parentNode !== parent) parent.appendChild(host);
  if (modal) {
    host.popover = "manual";
    if (!host.matches(":popover-open")) host.showPopover();
    return;
  }
  if (host.popover === null) return;
  if (host.matches(":popover-open")) host.hidePopover();
  host.removeAttribute("popover");
};
