# ShopScope – Shopify Store Inspector

A Chrome Extension (Manifest V3) for inspecting Shopify stores directly from your browser.

## Phase 1 Scope

This release establishes the extension foundation:

- Chrome Manifest V3 structure
- React popup with page information display
- Typed messaging between popup and background service worker
- Persistent user preferences via `chrome.storage.local`
- Full Vitest test suite

### Explicitly excluded from Phase 1

- Shopify detection or theme/app analysis
- Authentication or billing
- Backend or remote API calls
- Analytics
- Any permission beyond `activeTab`, `storage`, `scripting`

---

## Prerequisites

- Node.js 20+
- pnpm 9+
- Google Chrome 120+

## Installation

```bash
pnpm install
```

## Development Commands

| Command | Description |
|---|---|
| `pnpm dev` | Watch mode — rebuilds on file changes |
| `pnpm typecheck` | TypeScript type check (no emit) |
| `pnpm lint` | ESLint |
| `pnpm lint:fix` | ESLint with auto-fix |
| `pnpm format` | Prettier (write) |
| `pnpm format:check` | Prettier (check only) |
| `pnpm test` | Vitest (single run) |
| `pnpm test:coverage` | Vitest with coverage report |
| `pnpm build` | Production build → `dist/` |
| `pnpm verify` | typecheck + lint + test + build |

## Loading in Chrome

1. Run `pnpm build`
2. Open Chrome → `chrome://extensions`
3. Enable **Developer mode** (top right toggle)
4. Click **Load unpacked**
5. Select the `dist/` folder
6. Click the ShopScope icon in the toolbar

After making changes, run `pnpm build` again and click the reload icon on the extension card in `chrome://extensions`.

## Running Tests

```bash
pnpm test
pnpm test:coverage   # with coverage report in coverage/
```

---

## Project Architecture

```
src/
  background/        Background service worker — handles PING_BACKGROUND
  content/           Content script — Phase 2 readiness (not injected in Phase 1)
  popup/             React popup entry (App.tsx, main.tsx)
  components/        Pure UI components
  messaging/         chrome.runtime.sendMessage wrapper with generics + timeout
  storage/           chrome.storage.local wrapper with validation
  types/             Shared TypeScript types (PageInformation, UserPreferences, …)
  styles/            Tailwind globals
  tests/             Vitest setup + test files
```

### Data flow

```
Popup opens
  → chrome.tabs.query (activeTab)
  → validate URL (http/https only)
  → derive PageInformation from tab object
  → sendMessage(PING_BACKGROUND) → service worker responds
  → render UI
```

---

## Permission Justification

| Permission | Reason |
|---|---|
| `activeTab` | Read the current tab's URL, title, and favicon |
| `storage` | Persist user preferences (theme, technical details toggle) |
| `scripting` | Reserved for Phase 2 content-script injection |

No host permissions (`<all_urls>` or `http://*/*`) are requested.

---

## Troubleshooting

**Popup shows "No active tab found"** — click on a regular webpage before opening the popup.

**Popup shows "only works on regular web pages"** — the extension cannot inspect `chrome://`, new-tab, or extension pages.

**Extension shows "Background: Unavailable"** — the service worker may have gone idle. Close and reopen the popup.

**`pnpm verify` fails at typecheck** — check for `any` types or missing imports.

**Build fails with "Cannot find popup.html"** — ensure `popup.html` exists at the project root.

---

## Phase 1 Acceptance Checklist

- [ ] `pnpm install` succeeds
- [ ] `pnpm verify` succeeds (typecheck + lint + test + build)
- [ ] `dist/` loads in Chrome without manifest errors
- [ ] Popup opens without console errors
- [ ] Active page information is displayed
- [ ] Refresh retrieves current information
- [ ] Background connection status shows "Connected"
- [ ] Preferences persist after closing the popup
- [ ] Unsupported pages show a friendly message
- [ ] No broad Chrome permissions requested
- [ ] No remote scripts used
- [ ] No TypeScript `any` or suppressed errors

---

## Planned Phase 2 Features

- Shopify store detection (theme, platform, app detection)
- Content script DOM inspection
- Store technology fingerprinting
- Export / share reports
