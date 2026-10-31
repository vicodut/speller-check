const normalizeHost = (host: string): string => host.trim().toLowerCase().replace(/\.+$/, "");

/** True when `hostname` is a blocked site or a subdomain of one. Case-insensitive. */
export const isSiteBlocked = (hostname: string, blockedSites: readonly string[]): boolean => {
  const host = normalizeHost(hostname);
  if (host === "") return false;
  return blockedSites.some((site) => {
    const blocked = normalizeHost(site);
    return blocked !== "" && (host === blocked || host.endsWith(`.${blocked}`));
  });
};

/** Hostname from a user-typed line: accepts a bare host or a URL, drops paths and ports. */
const toHostname = (line: string): string => {
  const trimmed = line.trim();
  if (trimmed === "" || /\s/.test(trimmed)) return "";
  try {
    const url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    return normalizeHost(url.hostname);
  } catch {
    return "";
  }
};

/** Parses the options textarea (one site per line) into unique hostnames. */
export const parseBlockedSites = (text: string): string[] => {
  const hosts = text
    .split(/\r?\n/)
    .map(toHostname)
    .filter((host) => host !== "");
  return [...new Set(hosts)];
};
