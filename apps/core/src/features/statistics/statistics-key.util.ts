/**
 * The composite key the statistics are held under, built from its parts (a feature, a profile
 * id, a model). One encoding for every key, so the parts can't be joined two different ways.
 */
export const statisticsKey = (...parts: readonly string[]): string => JSON.stringify(parts);
