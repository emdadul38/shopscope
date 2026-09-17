# ShopScope Phase 2 – Shopify Detection Engine Implementation Plan

> **For agentic workers:** Implement task-by-task. Steps use checkbox syntax.

**Goal:** Detect whether the active HTTP(S) page is a Shopify storefront via multi-signal weighted confidence scoring, and display results in the popup.

**Architecture:** Popup requests detection → service worker injects/contacts content script → document/resource inspection + page-context bridge → validated `ShopifyDetectionResult` → short-lived in-memory cache → popup UI. Permissions remain `activeTab`, `storage`, `scripting`.

**Tech Stack:** React 18, TypeScript, Vite MV3, Vitest, jsdom, Tailwind

**Spec:** User Phase 2 brief + Phase 1 codebase conventions

## Global Constraints

- No `any`; validate all messaging boundaries
- No host permissions beyond existing set
- No theme/app/product/SEO/perf/auth/billing
- Evidence sanitized and bounded
- Confirmation requires independent signals
- Auto-run detection on popup open for supported pages; Rescan forces fresh inspect
- Cache: tabId + normalized URL, 30s TTL, invalidate on navigate/close/rescan

---

### Task 1: Detector types, weights, confidence, evidence sanitizer

- [ ] Types in `src/detectors/shopify/detector-types.ts`
- [ ] Weights + thresholds in `shopify-signals.ts`
- [ ] `confidence-calculator.ts` + tests (boundaries, safeguard)
- [ ] `evidence-sanitizer.ts` + tests

### Task 2: Signal matching + detector orchestration

- [ ] Pure signal matchers operating on inspected page snapshot
- [ ] `shopify-detector.ts` orchestration + fixture tests
- [ ] HTML fixtures (confirmed, highly likely, possible, non-shopify, blog mention, query false-positive, malformed, empty)

### Task 3: Content script inspectors + page bridge

- [ ] `document-inspector.ts`, `resource-inspector.ts`
- [ ] Minimal `window.Shopify` page bridge with timeout/cleanup
- [ ] Extend `content-script.ts` for `RUN_SHOPIFY_DETECTION` payload handling

### Task 4: Messaging + service worker cache

- [ ] Extend `message-types.ts` + error codes
- [ ] Service worker: inject, relay, cache, tab listeners
- [ ] Integration tests for messaging/cache/validation

### Task 5: Popup UI

- [ ] Detection components + App wiring (auto-run + rescan)
- [ ] Component tests for all detection states
- [ ] Preserve Phase 1 page info / prefs

### Task 6: Docs + verify

- [ ] README Phase 2 + detector guide
- [ ] `pnpm format` + `pnpm verify`
