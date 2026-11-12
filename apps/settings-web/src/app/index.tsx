import { createRoot } from "react-dom/client";
import { forgetStoredToken, takeToken } from "../features/auth";
import { SettingsPage } from "../features/settings";

/** Storage can be blocked (private window, cleared site data); then there is nothing to forget. */
const storage = (): Storage | null => {
  try {
    return localStorage;
  } catch {
    return null;
  }
};

// The token lives in memory only: drop any copy an older page stored.
forgetStoredToken(storage());
const { token, clearHash } = takeToken(location.hash);
// Out of the address bar (and most history) right away.
if (clearHash) history.replaceState(null, "", location.pathname + location.search);

const root = document.getElementById("root");
if (root) createRoot(root).render(<SettingsPage token={token} />);
