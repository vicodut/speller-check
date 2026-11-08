import { useEffect, useState } from "react";
import { StatusResponse } from "../shared/port-messages";

const POLL_MS = 1000;

const fetchStatus = async (): Promise<StatusResponse | undefined> => {
  try {
    const parsed = StatusResponse.safeParse(await chrome.runtime.sendMessage({ type: "status" }));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
};

/** Asks the background for the core connection status and check model, once a second. */
export const useConnectionStatus = (): StatusResponse | undefined => {
  const [status, setStatus] = useState<StatusResponse | undefined>(undefined);
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
