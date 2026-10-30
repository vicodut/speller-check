# Chrome extension (Manifest V3, TypeScript)

Status: not started (milestone 2). Don't scaffold anything here until asked.

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
  shared/
```

## Conventions
- Never read `input[type=password]`. Check the site blocklist first.
- Injected UI lives in a Shadow DOM so page CSS can't leak in.
- Write-back: select the range and dispatch `beforeinput`/`input` events. Never assign `.value` directly on framework-controlled inputs. Re-read the text afterwards; on mismatch, fall back to Copy.
- Same file-size and feature rules as the root CLAUDE.md.
