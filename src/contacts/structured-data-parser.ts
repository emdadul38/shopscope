export interface StructuredContactData {
  organizationNames: string[]
  storeNames: string[]
  emails: string[]
  phones: string[]
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function typeList(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string')
  return []
}

function collectStringField(obj: Record<string, unknown>, key: string): string[] {
  const v = obj[key]
  if (typeof v === 'string' && v.trim()) return [v.trim()]
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
  return []
}

function walkNode(node: unknown, into: StructuredContactData): void {
  if (Array.isArray(node)) {
    for (const item of node) walkNode(item, into)
    return
  }
  const obj = asRecord(node)
  if (!obj) return

  // @graph
  if (Array.isArray(obj['@graph'])) {
    for (const item of obj['@graph']) walkNode(item, into)
  }

  const types = typeList(obj['@type']).map((t) => t.toLowerCase())
  const isOrg = types.some((t) => t === 'organization' || t.endsWith('/organization'))
  const isStore = types.some(
    (t) => t === 'store' || t === 'onlinestore' || t.endsWith('/store') || t.endsWith('/onlinestore'),
  )
  const isContactPoint = types.some((t) => t === 'contactpoint' || t.endsWith('/contactpoint'))

  if (isOrg) {
    into.organizationNames.push(...collectStringField(obj, 'name'))
    into.emails.push(...collectStringField(obj, 'email'))
    into.phones.push(...collectStringField(obj, 'telephone'))
  }
  if (isStore) {
    into.storeNames.push(...collectStringField(obj, 'name'))
    into.emails.push(...collectStringField(obj, 'email'))
    into.phones.push(...collectStringField(obj, 'telephone'))
  }
  if (isContactPoint) {
    into.emails.push(...collectStringField(obj, 'email'))
    into.phones.push(...collectStringField(obj, 'telephone'))
  }

  // Nested contactPoint
  if (obj.contactPoint) walkNode(obj.contactPoint, into)
}

/**
 * Parse JSON-LD blocks safely. Malformed blocks are skipped.
 */
export function parseJsonLdBlocks(blocks: unknown[]): StructuredContactData {
  const into: StructuredContactData = {
    organizationNames: [],
    storeNames: [],
    emails: [],
    phones: [],
  }

  for (const block of blocks) {
    try {
      const parsed = typeof block === 'string' ? (JSON.parse(block) as unknown) : block
      walkNode(parsed, into)
    } catch {
      // skip malformed
    }
  }

  return into
}
