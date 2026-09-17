# ShopScope – Phase 1 Design Spec

**Date:** 2026-09-15  
**Scope:** Chrome Extension foundation (Manifest V3)  
**Status:** Approved for implementation

---

## Purpose

Build the foundational Chrome Extension scaffold for ShopScope – a Shopify Store Inspector. Phase 1 establishes the project structure, build pipeline, communication architecture, storage layer, popup UI, and test suite. No Shopify-specific detection, backend, authentication, or billing is included.

---

## Technology Stack

| Concern         | Choice                         |
| --------------- | ------------------------------ |
| Framework       | React 18                       |
| Language        | TypeScript (strict)            |
| Build tool      | Vite                           |
| Extension API   | Chrome Manifest V3             |
| Styling         | Tailwind CSS                   |
| Tests           | Vitest + React Testing Library |
| Linting         | ESLint (flat config)           |
| Formatting      | Prettier                       |
| Package manager | pnpm                           |

---

## Project Structure

```
shopscope/
├── public/
│   └── icons/                  # Generated placeholder PNGs
├── scripts/
│   └── generate-icons.mjs      # Node script: writes minimal valid PNGs
├── src/
│   ├── background/
│   │   └── service-worker.ts   # MV3 service worker
│   ├── content/
│   │   └── content-script.ts   # Injected on demand via scripting API
│   ├── popup/
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── popup.html
│   ├── components/
│   │   ├── ExtensionHeader.tsx
│   │   ├── PageInformation.tsx
│   │   ├── StatusBadge.tsx
│   │   └── ErrorState.tsx
│   ├── messaging/
│   │   ├── message-types.ts
│   │   └── chrome-messenger.ts
│   ├── storage/
│   │   ├── storage.ts
│   │   └── storage-types.ts
│   ├── types/
│   │   ├── page.ts
│   │   └── chrome.d.ts
│   ├── styles/
│   │   └── globals.css
│   └── tests/
│       ├── setup.ts
│       └── popup.test.tsx
├── manifest.json
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.ts
├── postcss.config.js
├── eslint.config.js
├── prettier.config.js
└── README.md
```

---

## Manifest (MV3)

**Permissions:** `activeTab`, `storage`, `scripting` — no broad host permissions.

The content script is **not** statically registered. The popup injects it on demand using `chrome.scripting.executeScript` after the user opens the extension. This avoids requiring `<all_urls>` or `http://*/*`.

Service worker is registered as an ES module (`"type": "module"`).

CSP: default MV3 policy (no `unsafe-eval`, no remote scripts).

---

## Domain Types

```ts
interface PageInformation {
  url: string
  title: string
  hostname: string
  faviconUrl?: string
  collectedAt: string // ISO 8601
}

interface UserPreferences {
  theme: 'light' | 'dark' | 'system'
  showTechnicalDetails: boolean
}

interface ExtensionError {
  code: string
  message: string
}

type Result<T> = { success: true; data: T } | { success: false; error: ExtensionError }
```

No `any`. `unknown` + type narrowing at all untrusted boundaries.

---

## Messaging Architecture

Three message types:

```ts
type ExtensionMessage =
  { type: 'GET_PAGE_INFORMATION' } | { type: 'PING_BACKGROUND' } | { type: 'PING_CONTENT_SCRIPT' }
```

`chrome-messenger.ts` provides a generic `sendMessage<TReq, TRes>` that:

- Returns `Promise<Result<TRes>>` (never throws)
- Races against a 5-second timeout
- Handles `chrome.runtime.lastError` inside the callback (no unhandled rejections)
- Always resolves — callers pattern-match on `result.success`

---

## Page Information Flow

1. Popup mounts → `chrome.tabs.query({ active: true, currentWindow: true })`
2. Validate URL: http/https only — surface `UNSUPPORTED_URL` error otherwise
3. Inject content script via `chrome.scripting.executeScript` (returns `PageInformation`)
4. Send `PING_BACKGROUND` to confirm service worker is alive
5. Render `PageInformation` + background connection status
6. Refresh button repeats steps 1–4

Unsupported pages: `chrome://`, Chrome Web Store, new tab, extension pages, missing tab → friendly `ErrorState` component.

---

## Storage Layer

Three exported pure async functions:

- `getUserPreferences(): Promise<UserPreferences>`
- `setUserPreferences(prefs: UserPreferences): Promise<void>`
- `resetUserPreferences(): Promise<void>`

Defaults: `{ theme: "system", showTechnicalDetails: false }`

Validation: structural check of stored value — if any required key is missing or has wrong type, fall back to full defaults (no partial merge).

---

## Popup UI (380px wide)

States:

- **Loading** — spinner while querying tab
- **Unsupported** — `ErrorState` with friendly message (chrome://, new tab, etc.)
- **Error** — `ErrorState` for unexpected failures
- **Loaded** — full `PageInformation` display

Always shown: logo placeholder, extension name, "Foundation Ready" badge.

Loaded state shows: page title, hostname, full URL (safe wrap), background status, Refresh button, "Show technical details" toggle, theme selector.

Technical details (hidden by default): collection timestamp, tab availability, background status.

Accessibility: semantic HTML, keyboard-navigable controls, visible focus, proper labels, sufficient contrast, `aria-live` on async status regions.

---

## Error Codes

| Code                         | Trigger                             |
| ---------------------------- | ----------------------------------- |
| `ACTIVE_TAB_NOT_FOUND`       | No active tab returned              |
| `UNSUPPORTED_URL`            | Non-http/https tab                  |
| `BACKGROUND_UNAVAILABLE`     | PING_BACKGROUND times out or errors |
| `CONTENT_SCRIPT_UNAVAILABLE` | executeScript fails                 |
| `MESSAGE_TIMEOUT`            | sendMessage 5s timeout              |
| `UNKNOWN_ERROR`              | Catch-all                           |

Stack traces never surface in the popup. Dev-only logging gated on `import.meta.env.DEV`.

---

## Build Configuration

Vite multi-entry build producing:

```
dist/
├── manifest.json
├── popup.html
├── assets/          (popup JS/CSS chunks)
├── icons/
├── service-worker.js
└── content-script.js
```

Key Vite settings:

- `rollupOptions.input`: popup HTML + service-worker + content-script
- `rollupOptions.output.manualChunks: {}` — disable chunk splitting for non-popup entries
- Service worker and content script built as IIFE or ES module (MV3 supports ES module service workers)
- A small Vite plugin copies `manifest.json` and rewrites entry filenames to match build output

---

## Placeholder Icon Generation

`scripts/generate-icons.mjs` — pure Node.js, no external dependencies. Writes minimal valid PNG binary (solid indigo `#6366F1` squares) at 16×16, 32×32, 48×48, 128×128. Run via `prebuild` script hook.

---

## Package Scripts

```json
{
  "prebuild": "node scripts/generate-icons.mjs",
  "dev": "vite build --watch",
  "build": "vite build",
  "typecheck": "tsc --noEmit",
  "lint": "eslint src",
  "lint:fix": "eslint src --fix",
  "format": "prettier --write .",
  "format:check": "prettier --check .",
  "test": "vitest run",
  "test:coverage": "vitest run --coverage",
  "verify": "pnpm typecheck && pnpm lint && pnpm test && pnpm build"
}
```

---

## Testing

`src/tests/setup.ts` installs a complete `chrome` global mock (tabs, runtime, scripting, storage) with `vi.fn()` stubs. `beforeEach` resets mock state.

Test cases:

- Popup loading state
- Successful PageInformation render
- Unsupported URL handling
- Background connection failure
- Refresh action
- Default preferences loaded
- Stored preference retrieval
- Invalid stored data fallback to defaults
- Technical-details toggle

---

## Acceptance Criteria

- `pnpm install` succeeds
- `pnpm verify` succeeds (typecheck + lint + tests + build)
- `dist/` loads in Chrome without manifest errors
- Popup opens without console errors
- Active page info is displayed
- Refresh retrieves current info
- Popup communicates with service worker
- Preferences persist after popup closes
- Unsupported pages show friendly message
- No broad Chrome permissions
- No remote executable code
- No `any` or suppressed TypeScript errors

---

## Out of Scope (Phase 1)

- Shopify detection, theme/app detection
- Authentication or billing
- Backend or remote API calls
- Analytics
- Any permission beyond `activeTab`, `storage`, `scripting`
