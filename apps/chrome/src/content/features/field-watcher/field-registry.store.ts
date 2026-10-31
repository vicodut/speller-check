export type FieldSnapshot = { readonly fieldId: string; readonly version: number };

type FieldState = { readonly fieldId: string; version: number };

/**
 * Frame-local field ids and versions. Ids come from a counter held in a WeakMap, so
 * removed elements are garbage-collected. Versions only ever increase for a given element.
 */
export class FieldRegistry<F extends object> {
  private readonly states = new WeakMap<F, FieldState>();
  private readonly open = new Map<string, F>();
  private counter = 0;

  /** Marks the field open and bumps its version. */
  bump(field: F): FieldSnapshot {
    const state = this.stateOf(field);
    state.version += 1;
    this.open.set(state.fieldId, field);
    return { fieldId: state.fieldId, version: state.version };
  }

  /** Marks the field closed; returns its id if it was open. */
  close(field: F): string | undefined {
    const state = this.states.get(field);
    if (!state || !this.open.has(state.fieldId)) return undefined;
    this.open.delete(state.fieldId);
    return state.fieldId;
  }

  /** The open field with this id, if `version` is its current version (else stale). */
  current(fieldId: string, version: number): F | undefined {
    const field = this.open.get(fieldId);
    if (!field || this.states.get(field)?.version !== version) return undefined;
    return field;
  }

  /** The open field with this id, whatever its version. */
  openField(fieldId: string): F | undefined {
    return this.open.get(fieldId);
  }

  private stateOf(field: F): FieldState {
    let state = this.states.get(field);
    if (!state) {
      this.counter += 1;
      state = { fieldId: `f${this.counter}`, version: 0 };
      this.states.set(field, state);
    }
    return state;
  }
}
