import type { BusinessEmailCategory } from './contact-types'

const PREFIX_RULES: Array<{ category: BusinessEmailCategory; prefixes: string[] }> = [
  { category: 'support', prefixes: ['support', 'help', 'care', 'service', 'customerservice'] },
  { category: 'sales', prefixes: ['sales', 'wholesale', 'orders', 'b2b'] },
  { category: 'privacy', prefixes: ['privacy', 'dpo', 'dataprotection'] },
  { category: 'legal', prefixes: ['legal', 'compliance', 'counsel'] },
  { category: 'press', prefixes: ['press', 'media', 'pr'] },
  { category: 'general', prefixes: ['info', 'hello', 'contact', 'hi', 'team', 'office', 'mail'] },
]

/**
 * Classify a public business email by local-part conventions.
 * Does not alter the address or confidence.
 */
export function classifyBusinessEmail(email: string): BusinessEmailCategory {
  const local = email.split('@')[0]?.toLowerCase() ?? ''
  const base = local.split(/[._+-]/)[0] ?? local

  for (const rule of PREFIX_RULES) {
    if (rule.prefixes.includes(base) || rule.prefixes.some((p) => local.startsWith(p))) {
      return rule.category
    }
  }

  // firstname.lastname style on a business domain is still only a public address if published;
  // label conservatively as personal_business_contact when it looks like a person local-part.
  if (/^[a-z]+[._-][a-z]+$/.test(local) && !PREFIX_RULES.some((r) => r.prefixes.includes(base))) {
    return 'personal_business_contact'
  }

  return 'unknown'
}
