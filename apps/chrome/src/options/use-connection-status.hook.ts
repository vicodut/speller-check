import { useEffect, useState } from "react";
import { type ConnectionStatus, StatusResponse } from "../shared/port-messages";

const POLL_MS = 1000;

const fetchStatus = async (): Promise<ConnectionStatus | undefined> => {
  try {
    const parsed = StatusResponse.safeParse(await chrome.runtime.sendMessage({ type: "status" }));
    return parsed.success ? parsed.data.status : undefined;
  } catch {
    return undefined;
  }
};

/** Asks the background for the core connection status, once a second. */
export const useConnectionStatus = (): ConnectionStatus | undefined => {
  const [status, setStatus] = useState<ConnectionStatus | undefined>(undefined);
  useEffect(() => {
    let active = true;
    const poll = async () => {
      const next = await fetchStatus();
      if (active) setStatus(next);
    };
    void poll();
    const timer = setInterval(() => void poll(), POLL_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);
  return status;
};
