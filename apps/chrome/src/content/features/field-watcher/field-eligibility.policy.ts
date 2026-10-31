/** What the eligibility check needs to know about an element. */
export type FieldTraits = {
  readonly tagName: string;
  /** The input's `type` attribute; null or empty when absent. */
  readonly type: string | null;
  readonly readOnly: boolean;
  readonly disabled: boolean;
};

/** Input types that hold free text. Never `password`, nor any other type. */
const textInputTypes = new Set(["text", "search", "email", "url"]);

/** True for an editable textarea or text-like input. Password fields are never watchable. */
export const isWatchableField = ({ tagName, type, readOnly, disabled }: FieldTraits): boolean => {
  if (readOnly || disabled) return false;
  const tag = tagName.toLowerCase();
  if (tag === "textarea") return true;
  if (tag !== "input") return false;
  const inputType = (type ?? "").trim().toLowerCase();
  return inputType === "" || textInputTypes.has(inputType);
};
