import { useState } from "react";

type Props = {
  token: string;
  busy: boolean;
  /** Rotates the token; true once the page holds the new one. */
  onRotate: () => Promise<boolean>;
};

const MASK = "•".repeat(24);

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
    <section aria-labelledby="extension-token">
      <h2 id="extension-token">Chrome extension</h2>
      <p className="hint">
        Copy this token and paste it into the extension's options page to connect it.
      </p>
      <div className="token-row">
        <code className="token">{shown ? token : MASK}</code>
        <button type="button" onClick={() => setShown(!shown)}>
          {shown ? "Hide" : "Show"}
        </button>
        <button type="button" onClick={() => void copy()}>
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      {rotated && (
        <p className="done" role="status">
          New token generated. Paste it into the extension's options page to reconnect it.
        </p>
      )}
      {confirming ? (
        <div className="confirm" role="alert">
          <p>
            Connected extensions will disconnect until you paste the new token into their options
            page. Generate a new token?
          </p>
          <button type="button" disabled={busy} onClick={() => void rotate()}>
            Generate new token
          </button>
          <button type="button" onClick={() => setConfirming(false)}>
            Cancel
          </button>
        </div>
      ) : (
        <button type="button" disabled={busy} onClick={() => setConfirming(true)}>
          Generate new token…
        </button>
      )}
    </section>
  );
};
