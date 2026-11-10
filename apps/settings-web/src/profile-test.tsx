import { LoaderCircle, PlugZap } from "lucide-react";
import { Button } from "./components/ui/button";
import { cn } from "./components/ui/cn.util";
import { probeErrorText, testPassedText } from "./probe-text.util";
import type { TestState } from "./profile-probe.reducer";

type Props = { test: TestState; onTest: () => void };

const TONE: Record<TestState["phase"], string> = {
  idle: "",
  testing: "text-muted-foreground",
  passed: "text-success",
  failed: "text-destructive",
};

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
    <Button variant="outline" disabled={test.phase === "testing"} onClick={onTest}>
      {test.phase === "testing" ? (
        <LoaderCircle aria-hidden="true" className="animate-spin" />
      ) : (
        <PlugZap aria-hidden="true" />
      )}
      Test
    </Button>
    <output className={cn("text-sm tabular-nums", TONE[test.phase])} aria-live="polite">
      {result(test)}
    </output>
  </>
);
