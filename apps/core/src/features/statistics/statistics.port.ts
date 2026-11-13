import type { CallSample } from "./call-sample.util";

/** Where the model calls report their samples. Recording never delays or fails a call. */
export type SampleSink = {
  record(samples: readonly CallSample[]): void;
};

/** For a stack that keeps no statistics: the CLI check and the tests that don't use them. */
export const NO_STATISTICS: SampleSink = { record: () => {} };
