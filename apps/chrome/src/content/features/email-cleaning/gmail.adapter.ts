import type { EmailAdapter } from "./email-adapter.types";

/**
 * Gmail compose markup: the quoted thread sits in `div.gmail_quote` (newer builds wrap it in
 * `div.gmail_quote_container`, older ones in `div.gmail_extra`), its "On … wrote:" line in
 * `div.gmail_attr`; the signature in `div.gmail_signature` after `span.gmail_signature_prefix`.
 */
const SKIPPED_CLASSES = [
  "gmail_quote",
  "gmail_quote_container",
  "gmail_extra",
  "gmail_attr",
  "gmail_signature",
  "gmail_signature_prefix",
];

export const gmailAdapter: EmailAdapter = {
  handles: (hostname) => hostname === "mail.google.com",
  skips: (element) => SKIPPED_CLASSES.some((name) => element.classList?.contains(name) === true),
};
