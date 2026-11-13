/** Told when a profile is deleted, with the last name it had. */
export type RemovedListener = (profile: { id: string; name: string }) => void;

/** The listeners told when a profile is deleted, in the order they were added. */
export class RemovalListeners {
  private readonly listeners: RemovedListener[] = [];

  add(listener: RemovedListener): void {
    this.listeners.push(listener);
  }

  notify(profile: { id: string; name: string }): void {
    for (const listener of this.listeners) listener(profile);
  }
}
