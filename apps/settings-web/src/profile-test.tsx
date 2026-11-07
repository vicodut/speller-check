import { probeErrorText, testPassedText } from "./probe-text.util";
import type { TestState } from "./profile-probe.reducer";

type Props = { test: TestState; onTest: () => void };

const result = (test: TestState): string | null => {
  switch (test.phase) {
    case "testing":
      return "Testing…";
    case "passed":
      return testPassedText(test.ms);
    case "failed":
      return `Failed: ${probeErrorText(test.error, test.status)}`;
    default:
      return null;
  }
};

/** Sends one short request with the form as it is now, saved or not, and shows how it went. */
export const ProfileTest = ({ test, onTest }: Props) => (
  <>
    <button type="button" disabled={test.phase === "testing"} onClick={onTest}>
      Test
    </button>
    <output className={`test-result ${test.phase}`} aria-live="polite">
      {result(test)}
    </output>
  </>
);
