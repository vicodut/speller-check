// Content script: watches text fields and shows the core's issues. Never logs field text.
import { loadSettings, onSettingsChanged } from "../shared/extension-settings";
import { isSiteBlocked } from "../shared/site-blocklist";
import { startSession } from "./content-session.service";
import { SiteGate } from "./features/site-gate";

/** This frame's host and its ancestors' hosts, so an embedded frame on a blocked site stays off. */
const frameHostnames = (): string[] => {
  const ancestors = Array.from(location.ancestorOrigins ?? [], (origin) => {
    try {
      return new URL(origin).hostname;
    } catch {
      return "";
    }
  });
  return [location.hostname, ...ancestors];
};

// Blocklist first: nothing is watched or connected on a blocked site, and changes apply live.
const gate = new SiteGate({
  isBlocked: ({ blockedSites }) =>
    frameHostnames().some((host) => isSiteBlocked(host, blockedSites)),
  start: () => startSession(document),
  load: loadSettings,
  subscribe: (listener) => {
    try {
      onSettingsChanged(listener);
    } catch {
      // Extension context invalidated: keep the state from the initial load.
    }
  },
});

void gate.init();
