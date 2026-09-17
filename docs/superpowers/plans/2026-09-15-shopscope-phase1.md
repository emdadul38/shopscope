# ShopScope Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a production-ready Chrome Extension (MV3) foundation with React, TypeScript, Vite, Tailwind, typed messaging, storage, popup UI, and a full Vitest test suite.

**Architecture:** Multi-entry Vite build producing `popup.html`, `service-worker.js`, and `content-script.js`. Popup collects page info directly from the `chrome.tabs.query` tab object (no content-script injection needed for Phase 1). Chrome APIs are wrapped in typed adapters. A single centralised mock in `src/tests/setup.ts` covers all Chrome globals for Vitest.

**Tech Stack:** React 18, TypeScript 5 (strict), Vite 5, Tailwind CSS 3, Vitest 2, React Testing Library 16, ESLint 9 (flat config), Prettier 3, pnpm, @types/chrome

**Spec:** `docs/superpowers/specs/2026-09-15-shopscope-phase1-design.md`

## Global Constraints

- TypeScript strict mode — zero `any`, zero `@ts-ignore`
- Permissions: `activeTab`, `storage`, `scripting` only — no `<all_urls>`
- No remote scripts; everything bundled locally
- ESLint and Prettier zero warnings
- `popup.html` lives at project root (not `src/popup/`) so Vite outputs clean `dist/popup.html`; spec's `src/popup/popup.html` path is adjusted for build correctness
- Content script built for Phase 2 readiness; page info comes from tab object in Phase 1
- `pnpm verify` = typecheck → lint → test → build (must all pass)

---

### Task 1: Project Bootstrap

**Files:**

- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.gitignore`
- Create: `.prettierignore`

**Interfaces:**

- Produces: `pnpm install` succeeds; `node_modules` present; TypeScript compiler available

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "shopscope",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
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
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@eslint/js": "^9.11.1",
    "@testing-library/jest-dom": "^6.5.0",
    "@testing-library/react": "^16.0.1",
    "@testing-library/user-event": "^14.5.2",
    "@types/chrome": "^0.0.278",
    "@types/react": "^18.3.1",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.1",
    "@vitest/coverage-v8": "^2.1.1",
    "autoprefixer": "^10.4.20",
    "eslint": "^9.11.1",
    "eslint-plugin-react": "^7.37.1",
    "eslint-plugin-react-hooks": "^4.6.2",
    "jsdom": "^25.0.1",
    "postcss": "^8.4.47",
    "prettier": "^3.3.3",
    "tailwindcss": "^3.4.13",
    "typescript": "^5.6.2",
    "typescript-eslint": "^8.7.0",
    "vite": "^5.4.8",
    "vite-plugin-static-copy": "^1.0.6",
    "vitest": "^2.1.1"
  }
}
```

- [ ] **Step 2: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist", "scripts"]
}
```

- [ ] **Step 3: Write `.gitignore`**

```
node_modules/
dist/
.DS_Store
*.local
coverage/
```

- [ ] **Step 4: Write `.prettierignore`**

```
dist/
node_modules/
public/icons/
```

- [ ] **Step 5: Install dependencies**

```bash
pnpm install
```

Expected: installs ~300MB of packages, no errors.

- [ ] **Step 6: Commit**

```bash
git init
git add package.json tsconfig.json .gitignore .prettierignore
git commit -m "chore: initialise project with pnpm and TypeScript"
```

---

### Task 2: Build Toolchain Configuration

**Files:**

- Create: `vite.config.ts`
- Create: `vitest.config.ts`
- Create: `tailwind.config.ts`
- Create: `postcss.config.js`
- Create: `eslint.config.js`
- Create: `prettier.config.js`

**Interfaces:**

- Produces: `pnpm typecheck`, `pnpm lint`, `pnpm test` all runnable (will find no files yet — that is acceptable at this stage)

- [ ] **Step 1: Write `vite.config.ts`**

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { viteStaticCopy } from 'vite-plugin-static-copy'

export default defineConfig({
  plugins: [
    react(),
    viteStaticCopy({
      targets: [
        { src: 'manifest.json', dest: '.' },
        { src: 'public/icons', dest: '.' },
      ],
    }),
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'popup.html'),
        'service-worker': resolve(__dirname, 'src/background/service-worker.ts'),
        'content-script': resolve(__dirname, 'src/content/content-script.ts'),
      },
      output: {
        entryFileNames: (chunk) => {
          if (['service-worker', 'content-script'].includes(chunk.name)) {
            return '[name].js'
          }
          return 'assets/[name]-[hash].js'
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
  },
})
```

- [ ] **Step 2: Write `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/tests/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      reporter: ['text', 'html'],
      exclude: ['src/tests/**'],
    },
  },
})
```

- [ ] **Step 3: Write `tailwind.config.ts`**

```ts
import type { Config } from 'tailwindcss'

export default {
  content: ['./src/**/*.{ts,tsx}', './popup.html'],
  theme: {
    extend: {},
  },
  plugins: [],
} satisfies Config
```

- [ ] **Step 4: Write `postcss.config.js`**

```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

- [ ] **Step 5: Write `eslint.config.js`**

```js
import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: {
      react,
      'react-hooks': reactHooks,
    },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
    },
    settings: {
      react: { version: 'detect' },
    },
    languageOptions: {
      globals: { chrome: 'readonly' },
    },
  },
  {
    ignores: ['dist/**', 'node_modules/**', 'scripts/**', '*.config.*'],
  },
)
```

- [ ] **Step 6: Write `prettier.config.js`**

```js
export default {
  semi: false,
  singleQuote: true,
  tabWidth: 2,
  trailingComma: 'all',
  printWidth: 100,
}
```

- [ ] **Step 7: Verify toolchain loads**

```bash
pnpm typecheck
```

Expected: "error TS18003: No inputs were found" or similar — acceptable because `src/` is empty. If it errors differently, fix tsconfig.

- [ ] **Step 8: Commit**

```bash
git add vite.config.ts vitest.config.ts tailwind.config.ts postcss.config.js eslint.config.js prettier.config.js
git commit -m "chore: add build toolchain (Vite, Vitest, Tailwind, ESLint, Prettier)"
```

---

### Task 3: Placeholder Icon Generator

**Files:**

- Create: `scripts/generate-icons.mjs`
- Creates at runtime: `public/icons/icon-{16,32,48,128}.png`

**Interfaces:**

- Produces: four valid PNG files; `pnpm prebuild` runs without error

- [ ] **Step 1: Write `scripts/generate-icons.mjs`**

```mjs
import { writeFileSync, mkdirSync } from 'fs'
import { deflateSync } from 'zlib'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SIZES = [16, 32, 48, 128]
// Indigo #6366f1
const R = 0x63,
  G = 0x66,
  B = 0xf1

function crc32(buf) {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[i] = c
  }
  let crc = 0xffffffff
  for (const byte of buf) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function u32(n) {
  const b = Buffer.allocUnsafe(4)
  b.writeUInt32BE(n, 0)
  return b
}

function pngChunk(type, data) {
  const t = Buffer.from(type, 'ascii')
  const crcBuf = Buffer.concat([t, data])
  return Buffer.concat([u32(data.length), t, data, u32(crc32(crcBuf))])
}

function makePng(size) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

  const ihdr = Buffer.allocUnsafe(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // color type: RGB
  ihdr[10] = ihdr[11] = ihdr[12] = 0

  const rowLen = 1 + size * 3
  const raw = Buffer.allocUnsafe(size * rowLen)
  for (let y = 0; y < size; y++) {
    raw[y * rowLen] = 0 // filter: None
    for (let x = 0; x < size; x++) {
      const p = y * rowLen + 1 + x * 3
      raw[p] = R
      raw[p + 1] = G
      raw[p + 2] = B
    }
  }

  return Buffer.concat([
    sig,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

const outDir = join(__dirname, '..', 'public', 'icons')
mkdirSync(outDir, { recursive: true })

for (const size of SIZES) {
  writeFileSync(join(outDir, `icon-${size}.png`), makePng(size))
  console.log(`  ✓ icon-${size}.png`)
}
console.log('Icons generated.')
```

- [ ] **Step 2: Run the script and verify output**

```bash
node scripts/generate-icons.mjs
ls -lh public/icons/
```

Expected: four files, each several hundred bytes.

- [ ] **Step 3: Commit**

```bash
git add scripts/generate-icons.mjs public/icons/
git commit -m "chore: add placeholder icon generator (solid indigo PNGs)"
```

---

### Task 4: Manifest + Popup HTML Shell

**Files:**

- Create: `manifest.json`
- Create: `popup.html` (project root)

**Interfaces:**

- Produces: `dist/manifest.json` and `dist/popup.html` after build; Chrome can load the extension

- [ ] **Step 1: Write `manifest.json`**

```json
{
  "manifest_version": 3,
  "name": "ShopScope – Shopify Store Inspector",
  "version": "0.1.0",
  "description": "Inspect Shopify stores directly from your browser.",
  "permissions": ["activeTab", "storage", "scripting"],
  "action": {
    "default_popup": "popup.html",
    "default_title": "ShopScope",
    "default_icon": {
      "16": "icons/icon-16.png",
      "32": "icons/icon-32.png",
      "48": "icons/icon-48.png",
      "128": "icons/icon-128.png"
    }
  },
  "background": {
    "service_worker": "service-worker.js",
    "type": "module"
  },
  "icons": {
    "16": "icons/icon-16.png",
    "32": "icons/icon-32.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png"
  },
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'"
  }
}
```

- [ ] **Step 2: Write `popup.html` (at project root)**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>ShopScope</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./src/popup/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 3: Commit**

```bash
git add manifest.json popup.html
git commit -m "chore: add manifest.json and popup HTML shell"
```

---

### Task 5: Domain Types and Message Types

**Files:**

- Create: `src/types/page.ts`
- Create: `src/types/chrome.d.ts`
- Create: `src/messaging/message-types.ts`

**Interfaces:**

- Produces: `PageInformation`, `UserPreferences`, `ExtensionError`, `Result<T>`, `ERROR_CODES`, `ExtensionMessage`, `PingResponse` — imported by all other modules

- [ ] **Step 1: Create directories**

```bash
mkdir -p src/types src/messaging src/storage src/background src/content src/popup src/components src/styles src/tests
```

- [ ] **Step 2: Write `src/types/page.ts`**

```ts
export interface PageInformation {
  url: string
  title: string
  hostname: string
  faviconUrl?: string
  collectedAt: string
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system'
  showTechnicalDetails: boolean
}

export interface ExtensionError {
  code: string
  message: string
}

export type Result<T> = { success: true; data: T } | { success: false; error: ExtensionError }

export const ERROR_CODES = {
  ACTIVE_TAB_NOT_FOUND: 'ACTIVE_TAB_NOT_FOUND',
  UNSUPPORTED_URL: 'UNSUPPORTED_URL',
  BACKGROUND_UNAVAILABLE: 'BACKGROUND_UNAVAILABLE',
  CONTENT_SCRIPT_UNAVAILABLE: 'CONTENT_SCRIPT_UNAVAILABLE',
  MESSAGE_TIMEOUT: 'MESSAGE_TIMEOUT',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const

export type ErrorCode = keyof typeof ERROR_CODES
```

- [ ] **Step 3: Write `src/types/chrome.d.ts`**

```ts
// @types/chrome provides all Chrome API types globally.
// Add custom augmentations here in future phases.
export {}
```

- [ ] **Step 4: Write `src/messaging/message-types.ts`**

```ts
import type { PageInformation } from '../types/page'

export type ExtensionMessage =
  { type: 'GET_PAGE_INFORMATION' } | { type: 'PING_BACKGROUND' } | { type: 'PING_CONTENT_SCRIPT' }

export interface PingResponse {
  alive: boolean
}

export interface ContentScriptResponse {
  pageInfo: PageInformation
}
```

- [ ] **Step 5: Verify types compile**

```bash
pnpm typecheck
```

Expected: exits 0 (or reports only "no inputs" for files not yet created — acceptable).

- [ ] **Step 6: Commit**

```bash
git add src/types/ src/messaging/message-types.ts
git commit -m "feat: add domain types and message type definitions"
```

---

### Task 6: Storage Layer (TDD)

**Files:**

- Create: `src/storage/storage-types.ts`
- Create: `src/tests/setup.ts`
- Create: `src/tests/storage.test.ts`
- Create: `src/storage/storage.ts`

**Interfaces:**

- Consumes: `UserPreferences`, `ExtensionError` from `../types/page`
- Produces:
  - `getUserPreferences(): Promise<UserPreferences>`
  - `setUserPreferences(prefs: UserPreferences): Promise<void>`
  - `resetUserPreferences(): Promise<void>`
  - `DEFAULT_PREFERENCES: UserPreferences`
  - `STORAGE_KEY: string` (value: `'userPreferences'`)
  - `mockChrome` export from `setup.ts` for use in all tests

- [ ] **Step 1: Write `src/storage/storage-types.ts`**

```ts
import type { UserPreferences } from '../types/page'

export const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'system',
  showTechnicalDetails: false,
}

export const STORAGE_KEY = 'userPreferences'
```

- [ ] **Step 2: Write `src/tests/setup.ts`** (Chrome mock hub for all tests)

```ts
import '@testing-library/jest-dom'
import { vi, beforeEach } from 'vitest'

const chromeMock = {
  tabs: {
    query: vi.fn(),
  },
  runtime: {
    sendMessage: vi.fn(),
    lastError: null as chrome.runtime.LastError | null,
    onMessage: {
      addListener: vi.fn(),
    },
    onInstalled: {
      addListener: vi.fn(),
    },
  },
  storage: {
    local: {
      get: vi.fn(),
      set: vi.fn(),
    },
  },
  scripting: {
    executeScript: vi.fn(),
  },
}

vi.stubGlobal('chrome', chromeMock)

beforeEach(() => {
  vi.clearAllMocks()
  chromeMock.runtime.lastError = null
})

export { chromeMock as mockChrome }
```

- [ ] **Step 3: Write `src/tests/storage.test.ts`** (failing — storage.ts does not exist yet)

```ts
import { describe, it, expect } from 'vitest'
import { mockChrome } from './setup'
import { getUserPreferences, setUserPreferences, resetUserPreferences } from '../storage/storage'
import { DEFAULT_PREFERENCES } from '../storage/storage-types'

describe('getUserPreferences', () => {
  it('returns defaults when storage is empty', async () => {
    mockChrome.storage.local.get.mockImplementation(
      (_key: string, cb: (r: Record<string, unknown>) => void) => cb({}),
    )
    const prefs = await getUserPreferences()
    expect(prefs).toEqual(DEFAULT_PREFERENCES)
  })

  it('returns stored preferences when valid', async () => {
    const stored = { theme: 'dark', showTechnicalDetails: true }
    mockChrome.storage.local.get.mockImplementation(
      (_key: string, cb: (r: Record<string, unknown>) => void) => cb({ userPreferences: stored }),
    )
    const prefs = await getUserPreferences()
    expect(prefs).toEqual(stored)
  })

  it('returns defaults when stored theme is invalid', async () => {
    mockChrome.storage.local.get.mockImplementation(
      (_key: string, cb: (r: Record<string, unknown>) => void) =>
        cb({ userPreferences: { theme: 'rainbow', showTechnicalDetails: true } }),
    )
    const prefs = await getUserPreferences()
    expect(prefs).toEqual(DEFAULT_PREFERENCES)
  })

  it('returns defaults when showTechnicalDetails is not boolean', async () => {
    mockChrome.storage.local.get.mockImplementation(
      (_key: string, cb: (r: Record<string, unknown>) => void) =>
        cb({ userPreferences: { theme: 'light', showTechnicalDetails: 'yes' } }),
    )
    const prefs = await getUserPreferences()
    expect(prefs).toEqual(DEFAULT_PREFERENCES)
  })

  it('returns defaults when stored value is null', async () => {
    mockChrome.storage.local.get.mockImplementation(
      (_key: string, cb: (r: Record<string, unknown>) => void) => cb({ userPreferences: null }),
    )
    const prefs = await getUserPreferences()
    expect(prefs).toEqual(DEFAULT_PREFERENCES)
  })
})

describe('setUserPreferences', () => {
  it('calls chrome.storage.local.set with the correct key', async () => {
    mockChrome.storage.local.set.mockImplementation(
      (_data: Record<string, unknown>, cb?: () => void) => cb?.(),
    )
    await setUserPreferences({ theme: 'light', showTechnicalDetails: true })
    expect(mockChrome.storage.local.set).toHaveBeenCalledWith(
      { userPreferences: { theme: 'light', showTechnicalDetails: true } },
      expect.any(Function),
    )
  })
})

describe('resetUserPreferences', () => {
  it('saves DEFAULT_PREFERENCES to storage', async () => {
    mockChrome.storage.local.set.mockImplementation(
      (_data: Record<string, unknown>, cb?: () => void) => cb?.(),
    )
    await resetUserPreferences()
    expect(mockChrome.storage.local.set).toHaveBeenCalledWith(
      { userPreferences: DEFAULT_PREFERENCES },
      expect.any(Function),
    )
  })
})
```

- [ ] **Step 4: Run tests to confirm they fail**

```bash
pnpm test
```

Expected: fails with "Cannot find module '../storage/storage'".

- [ ] **Step 5: Write `src/storage/storage.ts`**

```ts
import type { UserPreferences } from '../types/page'
import { DEFAULT_PREFERENCES, STORAGE_KEY } from './storage-types'

function isValidPreferences(value: unknown): value is UserPreferences {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  if (!(['light', 'dark', 'system'] as const).includes(v.theme as 'light' | 'dark' | 'system'))
    return false
  if (typeof v.showTechnicalDetails !== 'boolean') return false
  return true
}

export function getUserPreferences(): Promise<UserPreferences> {
  return new Promise((resolve) => {
    chrome.storage.local.get(STORAGE_KEY, (result) => {
      const stored = result[STORAGE_KEY]
      resolve(isValidPreferences(stored) ? stored : { ...DEFAULT_PREFERENCES })
    })
  })
}

export function setUserPreferences(preferences: UserPreferences): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEY]: preferences }, resolve)
  })
}

export function resetUserPreferences(): Promise<void> {
  return setUserPreferences({ ...DEFAULT_PREFERENCES })
}
```

- [ ] **Step 6: Run tests to confirm they pass**

```bash
pnpm test
```

Expected: all storage tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/storage/ src/tests/setup.ts src/tests/storage.test.ts
git commit -m "feat: add storage layer with validation and defaults (TDD)"
```

---

### Task 7: Messaging Layer (TDD)

**Files:**

- Create: `src/tests/messenger.test.ts`
- Create: `src/messaging/chrome-messenger.ts`

**Interfaces:**

- Consumes: `ExtensionError`, `Result<T>`, `ERROR_CODES` from `../types/page`
- Produces:
  - `sendMessage<TReq, TRes>(message: TReq, timeoutMs?: number): Promise<Result<TRes>>`

- [ ] **Step 1: Write `src/tests/messenger.test.ts`** (failing)

```ts
import { describe, it, expect, vi } from 'vitest'
import { mockChrome } from './setup'
import { sendMessage } from '../messaging/chrome-messenger'

describe('sendMessage', () => {
  it('resolves with success result on normal response', async () => {
    mockChrome.runtime.sendMessage.mockImplementation((_msg: unknown, cb: (r: unknown) => void) =>
      cb({ alive: true }),
    )
    const result = await sendMessage<{ type: 'PING_BACKGROUND' }, { alive: boolean }>({
      type: 'PING_BACKGROUND',
    })
    expect(result).toEqual({ success: true, data: { alive: true } })
  })

  it('resolves with error when runtime.lastError is set', async () => {
    mockChrome.runtime.sendMessage.mockImplementation((_msg: unknown, cb: (r: unknown) => void) => {
      mockChrome.runtime.lastError = { message: 'Extension context invalid' }
      cb(undefined)
    })
    const result = await sendMessage({ type: 'PING_BACKGROUND' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.code).toBe('BACKGROUND_UNAVAILABLE')
      expect(result.error.message).toBe('Extension context invalid')
    }
  })

  it('resolves with MESSAGE_TIMEOUT when callback is never called', async () => {
    mockChrome.runtime.sendMessage.mockImplementation(() => {
      // never calls callback
    })
    const result = await sendMessage({ type: 'PING_BACKGROUND' }, 50)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.code).toBe('MESSAGE_TIMEOUT')
    }
  }, 1000)

  it('resolves with UNKNOWN_ERROR when sendMessage throws', async () => {
    mockChrome.runtime.sendMessage.mockImplementation(() => {
      throw new Error('Unexpected crash')
    })
    const result = await sendMessage({ type: 'PING_BACKGROUND' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.code).toBe('UNKNOWN_ERROR')
    }
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
pnpm test
```

Expected: fails with "Cannot find module '../messaging/chrome-messenger'".

- [ ] **Step 3: Write `src/messaging/chrome-messenger.ts`**

```ts
import type { ExtensionError, Result } from '../types/page'
import { ERROR_CODES } from '../types/page'

const DEFAULT_TIMEOUT_MS = 5000

function makeError(code: keyof typeof ERROR_CODES, message: string): ExtensionError {
  return { code, message }
}

export function sendMessage<TReq, TRes = unknown>(
  message: TReq,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<Result<TRes>> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      resolve({
        success: false,
        error: makeError('MESSAGE_TIMEOUT', 'Message timed out after ' + timeoutMs + 'ms'),
      })
    }, timeoutMs)

    try {
      chrome.runtime.sendMessage(message, (response: unknown) => {
        clearTimeout(timer)
        if (chrome.runtime.lastError) {
          resolve({
            success: false,
            error: makeError(
              'BACKGROUND_UNAVAILABLE',
              chrome.runtime.lastError.message ?? 'Background unavailable',
            ),
          })
          return
        }
        resolve({ success: true, data: response as TRes })
      })
    } catch (err) {
      clearTimeout(timer)
      resolve({
        success: false,
        error: makeError('UNKNOWN_ERROR', err instanceof Error ? err.message : 'Unknown error'),
      })
    }
  })
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
pnpm test
```

Expected: all messenger tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/messaging/chrome-messenger.ts src/tests/messenger.test.ts
git commit -m "feat: add typed chrome messenger with timeout and error handling (TDD)"
```

---

### Task 8: Background Service Worker

**Files:**

- Create: `src/background/service-worker.ts`

**Interfaces:**

- Consumes: `ExtensionMessage`, `PingResponse` from `../messaging/message-types`
- Produces: responds to `PING_BACKGROUND` with `{ alive: true }`

- [ ] **Step 1: Write `src/background/service-worker.ts`**

```ts
import type { ExtensionMessage } from '../messaging/message-types'
import type { PingResponse } from '../messaging/message-types'

chrome.runtime.onInstalled.addListener(() => {
  if (import.meta.env.DEV) {
    console.log('[ShopScope] Service worker installed')
  }
})

chrome.runtime.onMessage.addListener(
  (message: unknown, _sender, sendResponse: (response: unknown) => void): boolean => {
    if (!isExtensionMessage(message)) return false

    if (message.type === 'PING_BACKGROUND') {
      const response: PingResponse = { alive: true }
      sendResponse(response)
    }

    return false
  },
)

function isExtensionMessage(value: unknown): value is ExtensionMessage {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Record<string, unknown>).type === 'string'
  )
}
```

- [ ] **Step 2: Verify types**

```bash
pnpm typecheck
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add src/background/service-worker.ts
git commit -m "feat: add background service worker with PING_BACKGROUND handler"
```

---

### Task 9: Content Script

**Files:**

- Create: `src/content/content-script.ts`

**Interfaces:**

- Produces: responds to `PING_CONTENT_SCRIPT` with `{ alive: true }` when injected

Note: in Phase 1 the content script is built but not injected. Page info comes from the tab object. This file is Phase 2 infrastructure.

- [ ] **Step 1: Write `src/content/content-script.ts`**

```ts
import type { ExtensionMessage } from '../messaging/message-types'

chrome.runtime.onMessage.addListener(
  (message: unknown, _sender, sendResponse: (response: unknown) => void): boolean => {
    if (!isExtensionMessage(message)) return false

    if (message.type === 'PING_CONTENT_SCRIPT') {
      sendResponse({ alive: true })
    }

    return false
  },
)

function isExtensionMessage(value: unknown): value is ExtensionMessage {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Record<string, unknown>).type === 'string'
  )
}
```

- [ ] **Step 2: Verify types**

```bash
pnpm typecheck
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add src/content/content-script.ts
git commit -m "feat: add content script with PING_CONTENT_SCRIPT handler (Phase 2 ready)"
```

---

### Task 10: UI Components (TDD)

**Files:**

- Create: `src/styles/globals.css`
- Create: `src/tests/components.test.tsx`
- Create: `src/components/StatusBadge.tsx`
- Create: `src/components/ErrorState.tsx`
- Create: `src/components/ExtensionHeader.tsx`
- Create: `src/components/PageInformation.tsx`

**Interfaces:**

- Consumes: `PageInformation`, `UserPreferences`, `ExtensionError` from `../types/page`
- Produces:
  - `<StatusBadge label variant>` — renders a coloured badge
  - `<ErrorState error onRetry?>` — renders friendly error message with optional retry
  - `<ExtensionHeader>` — renders logo placeholder + name
  - `<PageInformationView pageInfo backgroundAlive prefs onRefresh onThemeChange onTechDetailsToggle>` — full info panel

- [ ] **Step 1: Write `src/styles/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 2: Write `src/tests/components.test.tsx`** (failing)

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { StatusBadge } from '../components/StatusBadge'
import { ErrorState } from '../components/ErrorState'
import { ExtensionHeader } from '../components/ExtensionHeader'
import { PageInformationView } from '../components/PageInformation'
import type { PageInformation, UserPreferences } from '../types/page'

const samplePage: PageInformation = {
  url: 'https://store.example.com/products',
  title: 'Example Store',
  hostname: 'store.example.com',
  faviconUrl: 'https://store.example.com/favicon.ico',
  collectedAt: '2026-09-15T10:00:00.000Z',
}

const defaultPrefs: UserPreferences = {
  theme: 'system',
  showTechnicalDetails: false,
}

describe('StatusBadge', () => {
  it('renders the label text', () => {
    render(<StatusBadge label="Connected" variant="success" />)
    expect(screen.getByText('Connected')).toBeInTheDocument()
  })

  it('renders different variants without crashing', () => {
    const { rerender } = render(<StatusBadge label="x" variant="success" />)
    rerender(<StatusBadge label="x" variant="error" />)
    rerender(<StatusBadge label="x" variant="warning" />)
    rerender(<StatusBadge label="x" variant="info" />)
  })
})

describe('ErrorState', () => {
  it('shows friendly message for UNSUPPORTED_URL', () => {
    render(<ErrorState error={{ code: 'UNSUPPORTED_URL', message: 'raw' }} />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText(/only works on regular web pages/i)).toBeInTheDocument()
  })

  it('calls onRetry when try-again button clicked', () => {
    const onRetry = vi.fn()
    render(<ErrorState error={{ code: 'UNKNOWN_ERROR', message: 'oops' }} onRetry={onRetry} />)
    fireEvent.click(screen.getByRole('button', { name: /try again/i }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('hides retry button when onRetry not provided', () => {
    render(<ErrorState error={{ code: 'UNKNOWN_ERROR', message: 'oops' }} />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})

describe('ExtensionHeader', () => {
  it('renders the extension name', () => {
    render(<ExtensionHeader />)
    expect(screen.getByRole('heading', { name: /shopscope/i })).toBeInTheDocument()
  })
})

describe('PageInformationView', () => {
  it('renders page title, hostname, and URL', () => {
    render(
      <PageInformationView
        pageInfo={samplePage}
        backgroundAlive={true}
        prefs={defaultPrefs}
        showTechnicalDetails={false}
        onRefresh={vi.fn()}
        onThemeChange={vi.fn()}
        onTechDetailsToggle={vi.fn()}
      />,
    )
    expect(screen.getByText('Example Store')).toBeInTheDocument()
    expect(screen.getByText('store.example.com')).toBeInTheDocument()
    expect(screen.getByText('https://store.example.com/products')).toBeInTheDocument()
  })

  it('shows Connected badge when background is alive', () => {
    render(
      <PageInformationView
        pageInfo={samplePage}
        backgroundAlive={true}
        prefs={defaultPrefs}
        showTechnicalDetails={false}
        onRefresh={vi.fn()}
        onThemeChange={vi.fn()}
        onTechDetailsToggle={vi.fn()}
      />,
    )
    expect(screen.getByText('Connected')).toBeInTheDocument()
  })

  it('shows Unavailable badge when background is down', () => {
    render(
      <PageInformationView
        pageInfo={samplePage}
        backgroundAlive={false}
        prefs={defaultPrefs}
        showTechnicalDetails={false}
        onRefresh={vi.fn()}
        onThemeChange={vi.fn()}
        onTechDetailsToggle={vi.fn()}
      />,
    )
    expect(screen.getByText('Unavailable')).toBeInTheDocument()
  })

  it('shows technical details section when showTechnicalDetails is true', () => {
    render(
      <PageInformationView
        pageInfo={samplePage}
        backgroundAlive={true}
        prefs={defaultPrefs}
        showTechnicalDetails={true}
        onRefresh={vi.fn()}
        onThemeChange={vi.fn()}
        onTechDetailsToggle={vi.fn()}
      />,
    )
    expect(screen.getByText('Technical Details')).toBeInTheDocument()
  })

  it('hides technical details when showTechnicalDetails is false', () => {
    render(
      <PageInformationView
        pageInfo={samplePage}
        backgroundAlive={true}
        prefs={defaultPrefs}
        showTechnicalDetails={false}
        onRefresh={vi.fn()}
        onThemeChange={vi.fn()}
        onTechDetailsToggle={vi.fn()}
      />,
    )
    expect(screen.queryByText('Technical Details')).not.toBeInTheDocument()
  })

  it('calls onRefresh when refresh button clicked', () => {
    const onRefresh = vi.fn()
    render(
      <PageInformationView
        pageInfo={samplePage}
        backgroundAlive={true}
        prefs={defaultPrefs}
        showTechnicalDetails={false}
        onRefresh={onRefresh}
        onThemeChange={vi.fn()}
        onTechDetailsToggle={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /refresh/i }))
    expect(onRefresh).toHaveBeenCalledTimes(1)
  })

  it('calls onThemeChange when theme selector changes', () => {
    const onThemeChange = vi.fn()
    render(
      <PageInformationView
        pageInfo={samplePage}
        backgroundAlive={true}
        prefs={defaultPrefs}
        showTechnicalDetails={false}
        onRefresh={vi.fn()}
        onThemeChange={onThemeChange}
        onTechDetailsToggle={vi.fn()}
      />,
    )
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'dark' } })
    expect(onThemeChange).toHaveBeenCalledWith('dark')
  })
})
```

- [ ] **Step 3: Run tests to confirm they fail**

```bash
pnpm test
```

Expected: cannot find component modules.

- [ ] **Step 4: Write `src/components/StatusBadge.tsx`**

```tsx
interface StatusBadgeProps {
  label: string
  variant: 'success' | 'warning' | 'error' | 'info'
}

const variantClasses: Record<StatusBadgeProps['variant'], string> = {
  success: 'bg-green-100 text-green-800',
  warning: 'bg-yellow-100 text-yellow-800',
  error: 'bg-red-100 text-red-800',
  info: 'bg-blue-100 text-blue-800',
}

export function StatusBadge({ label, variant }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${variantClasses[variant]}`}
    >
      {label}
    </span>
  )
}
```

- [ ] **Step 5: Write `src/components/ErrorState.tsx`**

```tsx
import type { ExtensionError } from '../types/page'

interface ErrorStateProps {
  error: ExtensionError
  onRetry?: () => void
}

const FRIENDLY: Record<string, string> = {
  ACTIVE_TAB_NOT_FOUND: 'No active tab found. Click on a webpage first.',
  UNSUPPORTED_URL: 'ShopScope only works on regular web pages (http:// and https://).',
  BACKGROUND_UNAVAILABLE: 'Extension background is unavailable. Try reloading the extension.',
  CONTENT_SCRIPT_UNAVAILABLE: 'Could not connect to the page. Try refreshing the tab.',
  MESSAGE_TIMEOUT: 'Connection timed out. Please try again.',
  UNKNOWN_ERROR: 'Something went wrong. Please try again.',
}

export function ErrorState({ error, onRetry }: ErrorStateProps) {
  const message = FRIENDLY[error.code] ?? FRIENDLY['UNKNOWN_ERROR']

  return (
    <div role="alert" className="p-4 text-center space-y-3">
      <p className="text-sm text-gray-600">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-3 py-1.5 text-xs font-medium text-indigo-600 border border-indigo-200 rounded hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          Try again
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 6: Write `src/components/ExtensionHeader.tsx`**

```tsx
export function ExtensionHeader() {
  return (
    <header className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
      <div
        className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white text-sm font-bold"
        aria-hidden="true"
      >
        S
      </div>
      <h1 className="text-sm font-semibold text-gray-900">ShopScope</h1>
    </header>
  )
}
```

- [ ] **Step 7: Write `src/components/PageInformation.tsx`**

```tsx
import type { PageInformation, UserPreferences } from '../types/page'
import { StatusBadge } from './StatusBadge'

interface PageInformationViewProps {
  pageInfo: PageInformation
  backgroundAlive: boolean
  prefs: UserPreferences
  showTechnicalDetails: boolean
  onRefresh: () => void
  onThemeChange: (theme: UserPreferences['theme']) => void
  onTechDetailsToggle: () => void
}

export function PageInformationView({
  pageInfo,
  backgroundAlive,
  prefs,
  showTechnicalDetails,
  onRefresh,
  onThemeChange,
  onTechDetailsToggle,
}: PageInformationViewProps) {
  return (
    <div className="space-y-3">
      <div aria-live="polite">
        <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Page Title</p>
        <p className="text-sm text-gray-900 break-words">{pageInfo.title}</p>
      </div>

      <div>
        <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Hostname</p>
        <p className="text-sm text-gray-900">{pageInfo.hostname}</p>
      </div>

      <div>
        <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">URL</p>
        <p className="text-sm text-gray-900 break-all">{pageInfo.url}</p>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">Background</span>
        <StatusBadge
          label={backgroundAlive ? 'Connected' : 'Unavailable'}
          variant={backgroundAlive ? 'success' : 'error'}
        />
      </div>

      <button
        onClick={onRefresh}
        className="w-full px-3 py-2 text-sm font-medium text-white bg-indigo-600 rounded hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      >
        Refresh Page Information
      </button>

      <div className="border-t border-gray-100 pt-3 space-y-2">
        <div className="flex items-center justify-between">
          <label htmlFor="tech-toggle" className="text-xs text-gray-600 cursor-pointer">
            Show technical details
          </label>
          <button
            id="tech-toggle"
            role="switch"
            aria-checked={showTechnicalDetails}
            onClick={onTechDetailsToggle}
            className={`relative w-9 h-5 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
              showTechnicalDetails ? 'bg-indigo-600' : 'bg-gray-200'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                showTechnicalDetails ? 'translate-x-4' : ''
              }`}
            />
            <span className="sr-only">Show technical details</span>
          </button>
        </div>

        <div>
          <label htmlFor="theme-select" className="text-xs text-gray-600">
            Theme
          </label>
          <select
            id="theme-select"
            value={prefs.theme}
            onChange={(e) => onThemeChange(e.target.value as UserPreferences['theme'])}
            className="mt-1 w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>
      </div>

      {showTechnicalDetails && (
        <div className="border-t border-gray-100 pt-3 space-y-1">
          <p className="text-xs font-medium text-gray-700">Technical Details</p>
          <p className="text-xs text-gray-500">
            Collected: {new Date(pageInfo.collectedAt).toLocaleString()}
          </p>
          <p className="text-xs text-gray-500">
            Background: {backgroundAlive ? 'Online' : 'Offline'}
          </p>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 8: Run tests to confirm they pass**

```bash
pnpm test
```

Expected: all component tests pass.

- [ ] **Step 9: Commit**

```bash
git add src/styles/ src/components/ src/tests/components.test.tsx
git commit -m "feat: add UI components (StatusBadge, ErrorState, ExtensionHeader, PageInformation)"
```

---

### Task 11: Popup App Entry (TDD)

**Files:**

- Create: `src/popup/main.tsx`
- Create: `src/popup/App.tsx`
- Create: `src/tests/popup.test.tsx`

**Interfaces:**

- Consumes: all components, storage functions, sendMessage, chrome globals
- Produces: fully functional `<App>` component; popup.html renders the extension

- [ ] **Step 1: Write `src/tests/popup.test.tsx`** (failing — App does not exist yet)

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { mockChrome } from './setup'
import { App } from '../popup/App'

function setupTab(overrides: Partial<chrome.tabs.Tab> = {}) {
  const tab: Partial<chrome.tabs.Tab> = {
    id: 1,
    url: 'https://example.com/products',
    title: 'Example Store',
    favIconUrl: 'https://example.com/favicon.ico',
    ...overrides,
  }
  mockChrome.tabs.query.mockResolvedValue([tab])
}

function setupBackground(alive: boolean) {
  if (alive) {
    mockChrome.runtime.sendMessage.mockImplementation((_msg: unknown, cb: (r: unknown) => void) =>
      cb({ alive: true }),
    )
  } else {
    mockChrome.runtime.sendMessage.mockImplementation((_msg: unknown, cb: (r: unknown) => void) => {
      mockChrome.runtime.lastError = { message: 'Unavailable' }
      cb(undefined)
    })
  }
}

function setupStorage(stored: Record<string, unknown> = {}) {
  mockChrome.storage.local.get.mockImplementation(
    (_key: string, cb: (r: Record<string, unknown>) => void) => cb(stored),
  )
  mockChrome.storage.local.set.mockImplementation(
    (_data: Record<string, unknown>, cb?: () => void) => cb?.(),
  )
}

describe('App', () => {
  it('shows loading spinner initially', () => {
    mockChrome.tabs.query.mockReturnValue(new Promise(() => {}))
    setupStorage()
    setupBackground(true)
    render(<App />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('renders page information on a supported page', async () => {
    setupTab()
    setupBackground(true)
    setupStorage()
    render(<App />)
    await waitFor(() => {
      expect(screen.getByText('Example Store')).toBeInTheDocument()
      expect(screen.getByText('example.com')).toBeInTheDocument()
      expect(screen.getByText('https://example.com/products')).toBeInTheDocument()
    })
  })

  it('shows unsupported-page error for chrome:// URLs', async () => {
    setupTab({ url: 'chrome://extensions/', title: 'Extensions' })
    setupBackground(true)
    setupStorage()
    render(<App />)
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
      expect(screen.getByText(/only works on regular web pages/i)).toBeInTheDocument()
    })
  })

  it('shows unsupported-page error for new tab URL', async () => {
    setupTab({ url: 'chrome://newtab/', title: 'New Tab' })
    setupBackground(true)
    setupStorage()
    render(<App />)
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })
  })

  it('shows error state when no active tab is returned', async () => {
    mockChrome.tabs.query.mockResolvedValue([])
    setupBackground(true)
    setupStorage()
    render(<App />)
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })
  })

  it('shows Unavailable badge when background service worker is down', async () => {
    setupTab()
    setupBackground(false)
    setupStorage()
    render(<App />)
    await waitFor(() => {
      expect(screen.getByText('Unavailable')).toBeInTheDocument()
    })
  })

  it('calls chrome.tabs.query again on refresh button click', async () => {
    setupTab()
    setupBackground(true)
    setupStorage()
    render(<App />)
    await waitFor(() => screen.getByRole('button', { name: /refresh/i }))

    setupTab({ title: 'Refreshed Title' })
    fireEvent.click(screen.getByRole('button', { name: /refresh/i }))

    await waitFor(() => {
      expect(screen.getByText('Refreshed Title')).toBeInTheDocument()
    })
  })

  it('loads system theme as default when storage is empty', async () => {
    setupTab()
    setupBackground(true)
    setupStorage({})
    render(<App />)
    await waitFor(() => screen.getByRole('combobox'))
    expect(screen.getByRole('combobox')).toHaveValue('system')
  })

  it('loads saved dark theme from storage', async () => {
    setupTab()
    setupBackground(true)
    setupStorage({ userPreferences: { theme: 'dark', showTechnicalDetails: false } })
    render(<App />)
    await waitFor(() => screen.getByRole('combobox'))
    expect(screen.getByRole('combobox')).toHaveValue('dark')
  })

  it('falls back to defaults for corrupt stored preferences', async () => {
    setupTab()
    setupBackground(true)
    setupStorage({ userPreferences: { theme: 42, showTechnicalDetails: 'yes' } })
    render(<App />)
    await waitFor(() => screen.getByRole('combobox'))
    expect(screen.getByRole('combobox')).toHaveValue('system')
  })

  it('toggles technical details panel when switch is clicked', async () => {
    setupTab()
    setupBackground(true)
    setupStorage()
    render(<App />)
    await waitFor(() => screen.getByRole('switch'))

    expect(screen.queryByText('Technical Details')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('switch'))

    await waitFor(() => {
      expect(screen.getByText('Technical Details')).toBeInTheDocument()
    })
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
pnpm test
```

Expected: fails with "Cannot find module '../popup/App'".

- [ ] **Step 3: Write `src/popup/App.tsx`**

```tsx
import { useState, useEffect, useCallback } from 'react'
import type { PageInformation, UserPreferences, ExtensionError } from '../types/page'
import { ERROR_CODES } from '../types/page'
import { getUserPreferences, setUserPreferences } from '../storage/storage'
import { sendMessage } from '../messaging/chrome-messenger'
import { ExtensionHeader } from '../components/ExtensionHeader'
import { PageInformationView } from '../components/PageInformation'
import { StatusBadge } from '../components/StatusBadge'
import { ErrorState } from '../components/ErrorState'
import type { PingResponse } from '../messaging/message-types'

type AppState =
  | { status: 'loading' }
  | { status: 'unsupported'; error: ExtensionError }
  | { status: 'error'; error: ExtensionError }
  | { status: 'loaded'; pageInfo: PageInformation; backgroundAlive: boolean }

const UNSUPPORTED_PREFIXES = [
  'chrome://',
  'chrome-extension://',
  'edge://',
  'about:',
  'data:',
  'javascript:',
]

function isUnsupportedUrl(url: string): boolean {
  if (UNSUPPORTED_PREFIXES.some((p) => url.startsWith(p))) return true
  try {
    if (new URL(url).hostname === 'chrome.google.com') return true
  } catch {
    return true
  }
  return !/^https?:\/\//i.test(url)
}

async function loadPageInfo(): Promise<{ pageInfo: PageInformation; backgroundAlive: boolean }> {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
  const tab = tabs[0]

  if (!tab?.id || !tab.url) {
    throw { code: ERROR_CODES.ACTIVE_TAB_NOT_FOUND, message: 'No active tab found' }
  }

  if (isUnsupportedUrl(tab.url)) {
    throw { code: ERROR_CODES.UNSUPPORTED_URL, message: 'Page type not supported' }
  }

  const pageInfo: PageInformation = {
    url: tab.url,
    title: tab.title ?? new URL(tab.url).hostname,
    hostname: new URL(tab.url).hostname,
    faviconUrl: tab.favIconUrl,
    collectedAt: new Date().toISOString(),
  }

  const pingResult = await sendMessage<{ type: 'PING_BACKGROUND' }, PingResponse>({
    type: 'PING_BACKGROUND',
  })
  const backgroundAlive = pingResult.success && pingResult.data.alive

  return { pageInfo, backgroundAlive }
}

export function App() {
  const [state, setState] = useState<AppState>({ status: 'loading' })
  const [prefs, setPrefs] = useState<UserPreferences>({
    theme: 'system',
    showTechnicalDetails: false,
  })

  const load = useCallback(async () => {
    setState({ status: 'loading' })
    try {
      const [result, savedPrefs] = await Promise.all([loadPageInfo(), getUserPreferences()])
      setPrefs(savedPrefs)
      setState({ status: 'loaded', ...result })
    } catch (err) {
      const e = err as Partial<ExtensionError>
      const error: ExtensionError = {
        code: e.code ?? ERROR_CODES.UNKNOWN_ERROR,
        message: e.message ?? 'Unknown error',
      }
      if (error.code === ERROR_CODES.UNSUPPORTED_URL) {
        setState({ status: 'unsupported', error })
      } else {
        setState({ status: 'error', error })
      }
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const handleThemeChange = async (theme: UserPreferences['theme']) => {
    const updated: UserPreferences = { ...prefs, theme }
    setPrefs(updated)
    await setUserPreferences(updated)
  }

  const handleTechDetailsToggle = async () => {
    const updated: UserPreferences = { ...prefs, showTechnicalDetails: !prefs.showTechnicalDetails }
    setPrefs(updated)
    await setUserPreferences(updated)
  }

  return (
    <div className="w-[380px] min-h-[200px] bg-white text-gray-900 font-sans">
      <ExtensionHeader />
      <div className="px-4 pt-2">
        <StatusBadge label="Foundation Ready" variant="success" />
      </div>

      <main className="p-4">
        {state.status === 'loading' && (
          <div
            role="status"
            aria-live="polite"
            className="flex flex-col items-center justify-center py-8 gap-2"
          >
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
            <span className="sr-only">Loading page information…</span>
          </div>
        )}

        {(state.status === 'error' || state.status === 'unsupported') && (
          <ErrorState error={state.error} onRetry={state.status === 'error' ? load : undefined} />
        )}

        {state.status === 'loaded' && (
          <PageInformationView
            pageInfo={state.pageInfo}
            backgroundAlive={state.backgroundAlive}
            prefs={prefs}
            showTechnicalDetails={prefs.showTechnicalDetails}
            onRefresh={load}
            onThemeChange={(t) => void handleThemeChange(t)}
            onTechDetailsToggle={() => void handleTechDetailsToggle()}
          />
        )}
      </main>
    </div>
  )
}
```

- [ ] **Step 4: Write `src/popup/main.tsx`**

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import '../styles/globals.css'

const root = document.getElementById('root')
if (!root) throw new Error('Root element not found')

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

- [ ] **Step 5: Run all tests**

```bash
pnpm test
```

Expected: all tests pass (storage + messenger + components + popup).

- [ ] **Step 6: Run type check**

```bash
pnpm typecheck
```

Expected: exits 0.

- [ ] **Step 7: Commit**

```bash
git add src/popup/ src/tests/popup.test.tsx
git commit -m "feat: add popup App with page info display, preferences, and integration tests"
```

---

### Task 12: README

**Files:**

- Create: `README.md`

- [ ] **Step 1: Write `README.md`**

````markdown
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
| `pnpm build`         | Production build → `dist/`            |
| `pnpm verify`        | typecheck + lint + test + build       |

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

| Permission  | Reason                                                     |
| ----------- | ---------------------------------------------------------- |
| `activeTab` | Read the current tab's URL, title, and favicon             |
| `storage`   | Persist user preferences (theme, technical details toggle) |
| `scripting` | Reserved for Phase 2 content-script injection              |

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
````

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add Phase 1 README with setup, architecture, and acceptance checklist"
```

---

### Task 13: Final Verification

**Goal:** Confirm `pnpm verify` passes end-to-end and `dist/` is loadable in Chrome.

- [ ] **Step 1: Generate icons (if not already present)**

```bash
node scripts/generate-icons.mjs
```

- [ ] **Step 2: Run full verify**

```bash
pnpm verify
```

Expected output (all must pass):

- `tsc --noEmit` → exit 0
- `eslint src` → 0 warnings, 0 errors
- `vitest run` → all tests pass
- `vite build` → `dist/` written

- [ ] **Step 3: Inspect dist/**

```bash
ls -lh dist/
ls -lh dist/icons/
ls -lh dist/assets/
```

Expected:

```
dist/
  manifest.json
  popup.html
  service-worker.js
  content-script.js
  assets/      (popup JS + CSS with hashed names)
  icons/       (icon-16.png, icon-32.png, icon-48.png, icon-128.png)
```

- [ ] **Step 4: Validate manifest references**

Manually confirm these filenames exist in dist/:

- `manifest.json` → `"service_worker": "service-worker.js"` → `dist/service-worker.js` ✓
- `manifest.json` → `"default_popup": "popup.html"` → `dist/popup.html` ✓
- `manifest.json` → `"16": "icons/icon-16.png"` → `dist/icons/icon-16.png` ✓

- [ ] **Step 5: Load in Chrome and smoke test**

1. Open `chrome://extensions`, enable Developer mode
2. Click **Load unpacked**, select `dist/`
3. Confirm: no manifest errors shown
4. Navigate to `https://example.com`
5. Click the ShopScope toolbar icon
6. Confirm: popup opens, page title and hostname are displayed, "Connected" badge shows
7. Click **Refresh Page Information** — data updates
8. Toggle **Show technical details** — section appears
9. Change theme selector to **Dark** — preference saved
10. Close and reopen popup — Dark theme still selected

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "chore: verify Phase 1 complete — all tests pass, dist/ loads in Chrome"
```
