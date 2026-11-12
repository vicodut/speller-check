import { createRoot } from "react-dom/client";
import { takeToken } from "../features/auth";
import { SettingsPage } from "../features/settings";

const STORAGE_KEY = "gc.installToken";

/** Storage can be blocked (private window, cleared site data); the page then needs a fresh link. */
const stored = (): string | null => {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};

const store = (token: string): void => {
  try {
    localStorage.setItem(STORAGE_KEY, token);
  } catch {
    // Not stored: this tab still works, a reload needs `core settings` again.
  }
};

const { token, clearHash } = takeToken(location.hash, stored());
if (token) store(token);
// Out of the address bar (and most history) right away.
if (clearHash) history.replaceState(null, "", location.pathname + location.search);

const root = document.getElementById("root");
if (root) createRoot(root).render(<SettingsPage token={token} onTokenChange={store} />);
