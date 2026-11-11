# Chrome extension (Manifest V3, TypeScript)

Status: working (milestone 2 onward): field watching, underlines, card, badge panel, rephrase, options page.

## Role
Same as the Swift helper, for web pages: watch `input`, `textarea` and `contenteditable`, draw underlines and the card, write fixes back.
Talks to the core over `ws://127.0.0.1` with the install token. No checking logic here.

## Layout
```
src/
  background/        service worker, WebSocket connection to the core
  content/
    features/
      field-watcher/
      underlines/
      card/          React
      write-back/
    shared/          cross-feature content code, incl. ui.styles.ts (base styles for shadow roots)
  options/           options page (React, Tailwind, @gc/ui components)
  shared/
```

## Conventions
- Never read `input[type=password]`. Check the site blocklist first.
- Injected UI lives in a Shadow DOM so page CSS can't leak in.
- Styling: the options page uses `@gc/ui` components and Tailwind (`src/options/options.css`). Injected UI uses plain CSS on the `--gc-*` palette variables from `UI_BASE_CSS` (`content/shared/ui.styles.ts`) and its `.gc-btn` variants; no Tailwind in the content script, no hard-coded theme colours.
- Write-back: select the range and dispatch `beforeinput`/`input` events. Never assign `.value` directly on framework-controlled inputs. Re-read the text afterwards; on mismatch, fall back to Copy.
- Same file-size and feature rules as the root CLAUDE.md.
