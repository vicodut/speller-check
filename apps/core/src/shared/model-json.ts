/** Removes reasoning blocks and code fences from a model reply, then keeps the outermost JSON value. */
export const extractJson = (raw: string): string => {
  const text = raw
    .replace(/<think>[\s\S]*?<\/think>/g, "")
    .replace(/```(?:json)?/g, "")
    .trim();
  const first = text.search(/[[{]/);
  const last = Math.max(text.lastIndexOf("}"), text.lastIndexOf("]"));
  return first === -1 || last < first ? text : text.slice(first, last + 1);
};
