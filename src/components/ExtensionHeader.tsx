export function ExtensionHeader() {
  return (
    <header className="flex items-center gap-2.5 border-b border-border bg-surface-raised px-4 py-3">
      <div
        className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-500 text-sm font-semibold text-white"
        aria-hidden="true"
      >
        S
      </div>
      <h1 className="text-sm font-semibold text-ink">ShopScope</h1>
    </header>
  )
}
