# ShopScope – Shopify Store Inspector

Chrome extension (Manifest V3) that inspects the active tab for Shopify storefront signals, classifies storefront type, and—when confirmed—lets you scan **publicly published** business contact details.

**Version:** 0.3.0 · **Stack:** React, TypeScript, Vite, Vitest, Tailwind

---

## Features

| Feature | Behavior |
| --- | --- |
| **Commerce detection** | Multi-signal Shopify detection with confidence, evidence, and storefront type (`theme`, `Hydrogen`, `headless`, etc.) |
| **Deep scan** | Optional, user-triggered re-inspection for ambiguous results (resource observation + SPA awareness, ≤15s, cancellable) |
| **Connected store** | Discover linked Shopify storefront candidates from marketing / headless pages |
| **Public contacts** | Manual scan for business name, emails, phones, social links, and contact pages—only when Shopify is **confirmed** |
| **Page info & prefs** | Active-tab URL/title, theme preference, technical details toggle |

Detection runs when the popup opens on supported `http(s)` pages. Contact and deep scans start only after an explicit click.

---

## Quick start

```bash
pnpm install
pnpm build
```

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. **Load unpacked** → select the `dist/` folder
4. Open any normal website and click the ShopScope icon

After code changes: `pnpm build`, then reload the extension.

---

## Requirements

- Node.js 20+
- pnpm 9+
- Chrome 120+

---

## Scripts

| Command | Description |
| --- | --- |
| `pnpm dev` | Watch rebuild (popup entry) |
| `pnpm build` | Production build → `dist/` (popup + service worker + content script) |
| `pnpm verify` | typecheck + lint + test + build |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` / `pnpm lint:fix` | ESLint |
| `pnpm format` / `pnpm format:check` | Prettier |
| `pnpm test` / `pnpm test:coverage` | Vitest |

---

## Architecture

```text
Popup (React)
  → typed messages
Service worker
  → inject / message content script
  → MAIN-world probe (allowlisted window.Shopify fields)
  → short-lived in-memory caches
Content script
  → DOM / resource inspection
  → same-origin contact fetches (activeTab)
  → deep scan / connected-store discovery
Pure engines
  → src/detectors/shopify   signal matching + confidence
  → src/detectors/commerce  status / storefront resolution
  → src/contacts            public contact extraction
```

```text
src/
  background/     Service worker (orchestration, cache, gating)
  content/        Inspectors, deep scan, contact page fetch
  detectors/      Shopify + commerce detection (pure, testable)
  contacts/       Public contact scanner (pure, testable)
  popup/          React entry + theme
  components/     UI cards and controls
  messaging/      Typed chrome.runtime messaging + timeouts
  storage/        UI preferences only (chrome.storage.local)
  tests/          Unit, fixture, component, integration
```

Build note: service worker and content script are bundled as self-contained IIFEs (`vite.sw.config.ts`, `vite.content.config.ts`) so injected scripts do not rely on ES module chunks.

---

## Permissions

| Permission | Why |
| --- | --- |
| `activeTab` | Read the active tab after the user opens the popup; enable same-origin fetches from the content script |
| `scripting` | Inject the content script and run a MAIN-world Shopify probe |
| `storage` | Persist UI preferences only |

No `<all_urls>` host permission. No remote scripts. No backend upload of detection or contact results.

---

## Shopify detection

Signals are weighted and combined into a 0–100 confidence score. Classification uses independent categories so one weak match cannot “confirm” a store.

| Signal | Category | Weight |
| --- | --- | --- |
| Valid `*.myshopify.com` hostname | domain | 30 |
| Public `window.Shopify` | javascript | 22 |
| Shopify CDN assets | resource | 18 |
| Generator / metadata | metadata | 18 |
| Storefront / analytics scripts | resource | 16 |
| Cart form actions | markup | 10 |
| Section / payment markup | markup | 8 |
| Combined route patterns | network | 4 |

```text
confidence = round(min(100, (matchedScore / 55) * 100))
```

Commerce statuses include confirmed / likely Shopify, possible headless, connected store, unknown, and confirmed-other. Evidence is sanitized (no full HTML, cookies, or tokens).

**Detection cache:** `tabId + normalized URL`, ~30s, in-memory. Invalidated on navigation, tab close, or Rescan.

See [docs/detector-development.md](docs/detector-development.md) to add signals safely.

---

## Public contact scan

Available only when detection status is **confirmed Shopify**. Always user-initiated.

**Sources (public only):** JSON-LD Organization/Store, `mailto:` / `tel:`, labeled contact sections, footer text, `og:site_name`, linked social profiles, same-origin contact/about/policy links already present on the page.

**Hard limits**

| Limit | Value |
| --- | --- |
| Extra pages | ≤ 5, same origin, serial |
| Body size | ≤ 1 MB |
| Per-request / total timeout | 5s / 15s |
| Redirects | ≤ 1, same origin |
| Credentials | `omit` |

**Never:** guess emails, scrape reviews/scripts/comments, decode anti-harvesting protections, crawl external domains, access Admin/auth data, upload or sync contact history, or bulk-harvest leads.

**Contact cache:** `tabId + origin`, ≤ 30 minutes, in-memory; cleared on tab close or origin change.

---

## Privacy

- Works on the **active tab** after a user gesture—no broad host access.
- Detection needs no network calls beyond the page already loaded.
- Contact fetches stay on the current origin under `activeTab`.
- Results are not uploaded; preferences are the only `chrome.storage.local` data.
- Evidence strings are bounded and URL query params are stripped.

---

## Manual smoke test

1. Known Shopify storefront → confirmed or likely, with evidence.
2. Non-Shopify site → not treated as an error; contacts hidden.
3. Confirmed store → **Find Public Contact Information** works; no guessed emails.
4. Ambiguous page → Deep scan optional; Cancel stops it.
5. `chrome://` / Web Store → unsupported message, no crash.
6. Navigate the tab → stale detection/contact cache is not reused.

---

## Out of scope

Theme/app fingerprinting, product extraction, SEO/performance scores, report export, accounts/billing, remote signature updates, automatic outreach, and browsing-history collection.

---

## Known limitations

- Customized themes that strip CDN/generator markers may score lower.
- Password walls block inspection until unlocked.
- MAIN-world `Shopify` probe misses renamed/absent globals.
- Service worker caches die on suspension (safe; next open re-inspects).
- Same-origin contact fetches can fail under CSP/network limits → current-page-only + warning.
- Generic `/products/` routes alone never confirm Shopify.

---

## Troubleshooting

| Symptom | What to try |
| --- | --- |
| Detection / contact timeout | Reload the tab, reopen popup, Rescan |
| Content script injection failed | Restricted page type (PDF, Chrome Web Store, etc.) |
| Background unavailable | Close and reopen the popup |
| False negative on a real shop | Check evidence; theme may omit standard signals |

---

## License

Private project (`package.json`). Add a license file if you publish the repository.
