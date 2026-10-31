/** 0 success, 1 runtime failure, 2 bad usage or settings. */
export type ExitCode = 0 | 1 | 2;

export const EXIT_FAILURE = 1;
export const EXIT_USAGE = 2;
