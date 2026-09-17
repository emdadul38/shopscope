# ShopScope – Shopify Store Inspector

A Chrome Extension (Manifest V3) for inspecting Shopify stores directly from your browser.

## Phase 2 Scope

Phase 2 adds a multi-signal **Shopify Store Detection Engine**:

- Content-script DOM and resource inspection on the active HTTP(S) tab
- Weighted confidence scoring with independent-signal confirmation safeguards
- Sanitized evidence displayed in the popup
- Short-lived in-memory detection cache (tab + URL, 30s)
- Auto-run on popup open; **Rescan** forces a fresh inspection

Phase 1 foundation (popup page info, preferences, typed messaging, storage) is preserved.

## Public Contact Information (user-triggered)

When detection is **Confirmed Shopify Store**, the user may click **Find Public Contact Information**.

This is a single-store, user-triggered inspector of **public business contact details** published on the storefront. It is **not** a bulk lead-harvesting tool.

### What it collects (when published)

- Business / store name from reliable public sources
- Public business emails (`mailto:`, contact sections, JSON-LD)
- Public phone numbers and social profile URLs when linked
- Contact-page links discovered on the current page
- Source URL, evidence, and confidence for each result

### What it never does

- Guess emails (`info@…`, `firstname@…`)
- Search for the store owner’s private identity
- Collect customer / review / blog incidental contacts
- Read cookies, tokens, checkout data, or Admin pages
- Decode Cloudflare / anti-harvesting email protection
- Crawl external domains or more than five same-origin pages
- Upload results, sync history, or auto-outreach
- Run automatically after Shopify detection

### Same-origin crawl limits

| Limit | Value |
| --- | --- |
| Additional pages | ≤ 5 |
| Request concurrency | 1 |
| Body size | ≤ 1 MB |
| Per-request timeout | 5 s |
| Total scan timeout | 15 s |
| Redirects | ≤ 1, same origin |
| Credentials | `omit` |

Fetches run from the **content script** (page origin) under `activeTab`. No `<all_urls>` host permission is added. If fetches fail, results are limited to the current page with a warning.

### Retention

- Cache key: `tabId + origin`
- TTL: ≤ 30 minutes (in-memory service worker)
- Cleared on tab close / origin change
- Not written to `chrome.storage.sync`

### Explicitly deferred (later)

- Theme name / version detection
- Installed Shopify app detection
- Product or variant extraction
- Pixel / SEO / performance auditing
- Report export, accounts, billing, backend APIs
- Remote signature updates or browsing-history collection
- Bulk export or automatic outreach
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

| Command              | Description                           |
| -------------------- | ------------------------------------- |
| `pnpm dev`           | Watch mode — rebuilds on file changes |
| `pnpm typecheck`     | TypeScript type check (no emit)       |
| `pnpm lint`          | ESLint                                |
| `pnpm lint:fix`      | ESLint with auto-fix                  |
| `pnpm format`        | Prettier (write)                      |
| `pnpm format:check`  | Prettier (check only)                 |
| `pnpm test`          | Vitest (single run)                   |
| `pnpm test:coverage` | Vitest with coverage report           |
| `pnpm build`         | Production build → `dist/` (popup + SW + content script) |
| `pnpm verify`        | typecheck + lint + test + build       |

---

## Loading in Chrome

1. Run `pnpm build`
2. Open Chrome → `chrome://extensions`
3. Enable **Developer mode**
4. Click **Load unpacked**
5. Select the `dist/` folder
6. Open a normal `http://` or `https://` page
7. Click the ShopScope icon

After changes: `pnpm build`, then reload the extension card.

### Manual verification (Phase 2)

1. Open a known Shopify storefront (custom domain or `*.myshopify.com`) → expect Confirmed or Highly Likely with confidence and evidence.
2. Open a non-Shopify site (news, blog, WooCommerce) → expect Shopify Not Detected (not an error).
3. Click **Rescan** → duration updates; no uncaught popup errors.
4. Navigate the tab to another URL, reopen popup → stale cache is not reused.
5. Open `chrome://extensions` → popup shows unsupported-page message; no crash.

---

## Detection Architecture

```
Popup
  → RUN_SHOPIFY_DETECTION (force?)
Service worker
  → ensure content script (scripting.executeScript)
  → content script collects PageInspectionSnapshot (DOM/resources)
  → MAIN-world probe for allowlisted window.Shopify fields
  → detectShopifyFromSnapshot()
  → validate + short-lived cache
  → DetectionMessageResponse → popup
```

### Signal categories

| Signal                           | Category   | Weight |
| -------------------------------- | ---------- | ------ |
| Valid `*.myshopify.com` hostname | domain     | 30     |
| Public `window.Shopify`          | javascript | 22     |
| Shopify CDN assets               | resource   | 18     |
| Generator / metadata             | metadata   | 18     |
| Storefront / analytics scripts   | resource   | 16     |
| Cart form actions                | markup     | 10     |
| Section / payment markup         | markup     | 8      |
| Combined route patterns          | network    | 4      |

### Confidence algorithm

```text
confidence = round(min(100, (matchedScore / 55) * 100))
```

Levels: `90+` confirmed · `70–89` highly likely · `40–69` possible · `<40` not detected.

`detected = confirmed || highly_likely`.

**Confirmation safeguard:** confirmed requires either one very-high signal plus another independent category, or three medium+ signals from distinct categories. A single weak signal never confirms.

### Evidence sanitization

- No full HTML, cookies, tokens, storage, or checkout/customer data
- Query parameters stripped from URLs
- Deduplicated, length-limited, max entries per signal

See [docs/detector-development.md](docs/detector-development.md) for adding signals safely.

### Cache behavior

- Key: `tabId + normalized URL`
- TTL: 30 seconds (in-memory service-worker state)
- Invalidated on navigation, reload, tab close, Rescan (`force: true`), or expiry
- If the service worker suspends, cache is lost and the next open re-inspects (safe fallback; no long-term history)

### Privacy guarantees

- No host permissions beyond user-gesture `activeTab`
- No external network calls for detection
- No merchant-sensitive payloads persisted to `chrome.storage`
- Production logs never include page HTML or secrets

---

## Project Architecture

```
src/
  background/        Service worker — detection orchestration + cache
  content/           Content script + document/resource inspectors
  detectors/shopify/ Pure detection engine (signals, confidence, sanitizer)
  popup/             React popup
  components/        UI including ShopifyDetectionCard
  messaging/         Typed messages + timeout wrapper
  storage/           Preferences only
  tests/             Unit, fixture, component, integration tests
```

---

## Permission Justification

| Permission  | Reason                                              |
| ----------- | --------------------------------------------------- |
| `activeTab` | Read the current tab after the user opens the popup |
| `storage`   | Persist UI preferences only                         |
| `scripting` | Inject content script and MAIN-world Shopify probe  |

No `<all_urls>` host permission. No remote scripts.

---

## Known Limitations

- Heavily customized storefronts that remove CDN/generator markers may score lower
- Password / storefront-login walls may block inspection until unlocked
- MAIN-world `window.Shopify` probe can miss if the object is absent or renamed
- Service-worker cache does not survive process suspension
- Generic `/products/` routes alone never confirm Shopify
- Manual accuracy targets require a human test matrix (aggregate only)

---

## Troubleshooting

**Detection timeout** — reload the tab and click Rescan.

**Content script injection failed** — page may be restricted (Chrome Web Store, PDF, etc.).

**Background Unavailable** — close and reopen the popup.

**False “Not Detected” on a real Shopify shop** — open evidence; customized themes may need Phase 3 theme signals.

---

## Phase 2 Acceptance Checklist

- [ ] Phase 1 page info and preferences still work
- [ ] Multi-signal detection returns confidence + evidence
- [ ] Rescan and 30s cache behave as documented
- [ ] Navigation invalidates stale results
- [ ] Fixtures: Shopify / non-Shopify / blog / query false-positive pass
- [ ] `pnpm verify` succeeds
- [ ] `dist/` loads without manifest errors
- [ ] No extra Chrome permissions
