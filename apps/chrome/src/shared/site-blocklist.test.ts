import { describe, expect, test } from "bun:test";
import { isSiteBlocked, parseBlockedSites } from "./site-blocklist";

describe("isSiteBlocked", () => {
  const blocked = ["bank.com", "Mail.Example.org"];

  test("matches the exact host", () => {
    expect(isSiteBlocked("bank.com", blocked)).toBe(true);
  });

  test("matches subdomains", () => {
    expect(isSiteBlocked("online.bank.com", blocked)).toBe(true);
    expect(isSiteBlocked("a.b.bank.com", blocked)).toBe(true);
  });

  test("is case-insensitive", () => {
    expect(isSiteBlocked("ONLINE.Bank.COM", blocked)).toBe(true);
    expect(isSiteBlocked("mail.example.org", blocked)).toBe(true);
  });

  test("does not match lookalike or parent hosts", () => {
    expect(isSiteBlocked("notbank.com", blocked)).toBe(false);
    expect(isSiteBlocked("bank.com.evil.net", blocked)).toBe(false);
    expect(isSiteBlocked("example.org", blocked)).toBe(false);
  });

  test("ignores empty entries and empty hosts", () => {
    expect(isSiteBlocked("bank.com", ["", "  "])).toBe(false);
    expect(isSiteBlocked("", blocked)).toBe(false);
  });
});

describe("parseBlockedSites", () => {
  test("parses one host per line, dropping blanks and duplicates", () => {
    expect(parseBlockedSites("bank.com\n\n  Bank.com \nmail.example.org\r\n")).toEqual([
      "bank.com",
      "mail.example.org",
    ]);
  });

  test("accepts URLs and keeps only the hostname", () => {
    expect(parseBlockedSites("https://online.bank.com:8443/login?x=1\nbank.fr/path")).toEqual([
      "online.bank.com",
      "bank.fr",
    ]);
  });

  test("drops lines that are not hostnames", () => {
    expect(parseBlockedSites("not a host\n:::")).toEqual([]);
  });
});
