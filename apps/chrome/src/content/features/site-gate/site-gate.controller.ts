import type { ExtensionSettings } from "../../../shared/extension-settings.schema";

/** Stops a running session: removes its UI, stops watching and closes its port. */
export type StopSession = () => void;

export type SiteGateDeps = {
  /** True when this frame (or an ancestor frame) is on a blocked site. */
  isBlocked(settings: ExtensionSettings): boolean;
  /** Starts watching fields in this frame. */
  start(): StopSession;
  /** Reads the stored settings once. */
  load(): Promise<ExtensionSettings>;
  /** Calls `listener` with fresh settings on every change. */
  subscribe(listener: (settings: ExtensionSettings) => void): void;
};

/**
 * Runs the session only while the site is not blocked, and follows blocklist changes live.
 * A change seen before the initial load resolves wins over the (older) loaded value.
 */
export class SiteGate {
  private stop: StopSession | undefined;
  private changed = false;

  constructor(private readonly deps: SiteGateDeps) {}

  async init(): Promise<void> {
    this.deps.subscribe((settings) => {
      this.changed = true;
      this.apply(settings);
    });
    const settings = await this.deps.load();
    if (!this.changed) this.apply(settings);
  }

  get running(): boolean {
    return this.stop !== undefined;
  }

  private apply(settings: ExtensionSettings): void {
    const blocked = this.deps.isBlocked(settings);
    if (blocked && this.stop) {
      const stop = this.stop;
      this.stop = undefined;
      stop();
    } else if (!blocked && !this.stop) {
      this.stop = this.deps.start();
    }
  }
}
