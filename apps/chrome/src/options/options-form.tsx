import { type FormEvent, useEffect, useState } from "react";
import { loadSettings, saveSettings } from "../shared/extension-settings";
import type { ConnectionStatus } from "../shared/port-messages";
import { parseBlockedSites } from "../shared/site-blocklist";
import { useConnectionStatus } from "./use-connection-status.hook";

const statusLabels: Record<ConnectionStatus, string> = {
  connecting: "Connecting…",
  ready: "Connected",
  auth_failed: "Token missing or rejected",
  unreachable: "Core not reachable",
};

const parsePort = (text: string): number | undefined => {
  const port = Number(text.trim());
  return Number.isInteger(port) && port >= 1 && port <= 65535 ? port : undefined;
};

export const OptionsForm = () => {
  const [token, setToken] = useState("");
  const [port, setPort] = useState("");
  const [sites, setSites] = useState("");
  const [message, setMessage] = useState("");
  const status = useConnectionStatus();

  useEffect(() => {
    void loadSettings().then((settings) => {
      setToken(settings.token);
      setPort(String(settings.port));
      setSites(settings.blockedSites.join("\n"));
    });
  }, []);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const portNumber = parsePort(port);
    if (portNumber === undefined) return setMessage("Port must be a number from 1 to 65535.");
    const blockedSites = parseBlockedSites(sites);
    await saveSettings({ token: token.trim(), port: portNumber, blockedSites });
    setSites(blockedSites.join("\n"));
    setMessage("Saved.");
  };

  return (
    <form onSubmit={onSubmit}>
      <h1>Grammar Checker</h1>
      <p>Status: {status ? statusLabels[status] : "Unknown"}</p>
      <label>
        Token
        <input type="password" value={token} onChange={(e) => setToken(e.target.value)} />
      </label>
      <p>
        Run <code>bun run --cwd apps/core cli token</code> and paste the token.
      </p>
      <label>
        Port
        <input inputMode="numeric" value={port} onChange={(e) => setPort(e.target.value)} />
      </label>
      <label>
        Blocked sites (one per line, subdomains included)
        <textarea rows={6} value={sites} onChange={(e) => setSites(e.target.value)} />
      </label>
      <button type="submit">Save</button>
      {message && <p>{message}</p>}
    </form>
  );
};
