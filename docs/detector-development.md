# Detector Development Guide

How to add a new Shopify detection signal safely in ShopScope.

## Principles

1. Prefer deterministic URL, attribute, or metadata matches over fuzzy text.
2. Keep weights centralized in `src/detectors/shopify/shopify-signals.ts`.
3. Never return full HTML, cookies, tokens, or storage values as evidence.
4. One failed matcher must not fail the whole detection run.
5. Treat all DOM and message input as untrusted; validate at boundaries.

## Steps

### 1. Define the signal

Add a definition to `SHOPIFY_SIGNAL_DEFINITIONS` and a weight key to `SHOPIFY_SIGNAL_WEIGHTS`.

Choose a category (`resource` | `markup` | `metadata` | `javascript` | `network` | `domain`) that reflects the independence of the evidence. Multiple matches from the same resource URL must share one category so they do not inflate the confirmation safeguard.

### 2. Collect only what you need

Extend `document-inspector.ts` or `resource-inspector.ts` with **targeted selectors**. Do not serialize `innerHTML`. Cap the number of nodes inspected.

If you need a page-world value, prefer `chrome.scripting.executeScript({ world: 'MAIN', func })` from the service worker with an allowlisted return shape. Do not inject arbitrary strings as code and do not serialize entire objects.

### 3. Implement a pure matcher

Add a matcher in `signal-matchers.ts` that:

- Operates on `PageInspectionSnapshot` (pure / testable)
- Returns `matched: false` with empty evidence when unsure
- Passes evidence through `sanitizeEvidenceList`

### 4. Wire confidence carefully

Do not raise a single weak weight so high that it can confirm alone. After changing weights, re-check:

- Boundary tests in `confidence-calculator.test.ts`
- Confirmation safeguard (very-high + independent, or three medium categories)
- Fixture suite under `src/tests/fixtures/`

### 5. Tests required for every signal

- Positive fixture containing only the minimal synthetic markers
- Negative fixture that mentions related words without real signals
- Evidence sanitizer coverage if new evidence formats are introduced
- Ensure `isShopifyDetectionResult` still validates outputs

### 6. Docs

Update the signal table in `README.md` and note any weight changes.

## Anti-patterns

- Matching the substring `"shopify"` in visible copy
- Treating a single CSS class as confirmation
- Scanning arbitrary inline `<script>` bodies
- Persisting detection history or page contents to `chrome.storage`
- Adding host permissions “just in case”
