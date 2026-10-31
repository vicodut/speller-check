export type RoutedField = { readonly portId: string; readonly fieldId: string };

const separator = "/";

/** Global field id sent to the core: `<portId>/<frame-local fieldId>`. Port ids never contain "/". */
export const toGlobalFieldId = (portId: string, fieldId: string): string =>
  `${portId}${separator}${fieldId}`;

/** Splits a global field id back into port id and frame-local field id. */
export const fromGlobalFieldId = (globalId: string): RoutedField | undefined => {
  const at = globalId.indexOf(separator);
  if (at <= 0 || at === globalId.length - 1) return undefined;
  return { portId: globalId.slice(0, at), fieldId: globalId.slice(at + 1) };
};

/** Tracks which port owns which open field, so core replies reach the right frame. */
export class FieldOwnershipRouter {
  private readonly fieldsByPort = new Map<string, Set<string>>();

  /** Records that `portId` has `fieldId` open and returns its global id. */
  open(portId: string, fieldId: string): string {
    let fields = this.fieldsByPort.get(portId);
    if (!fields) {
      fields = new Set();
      this.fieldsByPort.set(portId, fields);
    }
    fields.add(fieldId);
    return toGlobalFieldId(portId, fieldId);
  }

  /** Forgets one field and returns its global id. */
  close(portId: string, fieldId: string): string {
    this.fieldsByPort.get(portId)?.delete(fieldId);
    return toGlobalFieldId(portId, fieldId);
  }

  /** Forgets a port and returns the global ids of the fields it still had open. */
  closePort(portId: string): string[] {
    const fields = this.fieldsByPort.get(portId);
    this.fieldsByPort.delete(portId);
    return fields ? [...fields].map((fieldId) => toGlobalFieldId(portId, fieldId)) : [];
  }

  /** Resolves a global id from the core to its owner, if that field is still open. */
  resolve(globalId: string): RoutedField | undefined {
    const routed = fromGlobalFieldId(globalId);
    if (!routed || !this.fieldsByPort.get(routed.portId)?.has(routed.fieldId)) return undefined;
    return routed;
  }
}
