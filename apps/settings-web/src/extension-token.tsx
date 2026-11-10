import { Check, CircleCheck, Copy, Eye, EyeOff, RefreshCw, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { Alert, AlertDescription } from "./components/ui/alert";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./components/ui/card";

type Props = {
  token: string;
  busy: boolean;
  /** Rotates the token; true once the page holds the new one. */
  onRotate: () => Promise<boolean>;
};

const MASK = "•".repeat(24);

type ConfirmProps = { busy: boolean; onYes: () => void; onNo: () => void };

/** Asked inline before rotating: connected extensions disconnect until the new token is pasted. */
const ConfirmRotate = ({ busy, onYes, onNo }: ConfirmProps) => (
  <Alert variant="warning" role="alert">
    <TriangleAlert aria-hidden="true" />
    <AlertDescription className="gap-3">
      <p className="m-0 text-foreground">
        Connected extensions will disconnect until you paste the new token into their options page.
        Generate a new token?
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="destructive" size="sm" disabled={busy} onClick={onYes}>
          Generate new token
        </Button>
        <Button variant="outline" size="sm" onClick={onNo}>
          Cancel
        </Button>
      </div>
    </AlertDescription>
  </Alert>
);

type RowProps = {
  token: string;
  shown: boolean;
  copied: boolean;
  onToggle: () => void;
  onCopy: () => void;
};

const TokenRow = ({ token, shown, copied, onToggle, onCopy }: RowProps) => (
  <div className="flex items-center gap-2">
    <code className="min-w-0 flex-1 rounded-md border border-input bg-muted/50 px-3 py-2 font-mono text-xs [overflow-wrap:anywhere]">
      {shown ? token : MASK}
    </code>
    <Button variant="outline" size="sm" onClick={onToggle}>
      {shown ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
      {shown ? "Hide" : "Show"}
    </Button>
    <Button variant="outline" size="sm" onClick={onCopy}>
      {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
      {copied ? "Copied" : "Copy"}
    </Button>
  </div>
);

/**
 * The install token the Chrome extension needs. The user copies it here and pastes it into the
 * extension's options page; nothing sends it to the extension. Hidden until "Show".
 */
export const ExtensionToken = ({ token, busy, onRotate }: Props) => {
  const [shown, setShown] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [rotated, setRotated] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
    } catch {
      setShown(true); // Clipboard refused: show it so it can be selected by hand.
    }
  };

  const rotate = async () => {
    setConfirming(false);
    setCopied(false);
    const done = await onRotate();
    setRotated(done);
    if (done) setShown(true);
  };

  return (
    <Card aria-labelledby="extension-token">
      <CardHeader>
        <CardTitle id="extension-token" className="m-0 text-base">
          Chrome extension
        </CardTitle>
        <CardDescription className="m-0">
          Copy this token and paste it into the extension's options page to connect it.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <TokenRow
          token={token}
          shown={shown}
          copied={copied}
          onToggle={() => setShown(!shown)}
          onCopy={() => void copy()}
        />
        {rotated && (
          <Alert variant="success" role="status">
            <CircleCheck aria-hidden="true" />
            <AlertDescription>
              New token generated. Paste it into the extension's options page to reconnect it.
            </AlertDescription>
          </Alert>
        )}
        {confirming ? (
          <ConfirmRotate
            busy={busy}
            onYes={() => void rotate()}
            onNo={() => setConfirming(false)}
          />
        ) : (
          <Button
            variant="outline"
            className="self-start"
            disabled={busy}
            onClick={() => setConfirming(true)}
          >
            <RefreshCw aria-hidden="true" /> Generate new token…
          </Button>
        )}
      </CardContent>
    </Card>
  );
};
