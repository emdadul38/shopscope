import { describe, expect, it } from 'vitest'
import {
  classifyBusinessEmail,
  extractBusinessIdentity,
  extractPublicEmails,
  extractPublicPhones,
  extractSocialProfiles,
  discoverContactPages,
  isSameOrigin,
  normalizeSameOriginUrl,
  validateRedirectSameOrigin,
  isValidBusinessEmail,
  normalizeEmailCandidate,
  parseJsonLdBlocks,
  runPublicContactScan,
  sanitizeContactEvidence,
  sanitizeEvidenceUrl,
} from '../../contacts'
import type { PageContactDocument } from '../../contacts/contact-types'

function doc(partial: Partial<PageContactDocument> = {}): PageContactDocument {
  return {
    url: 'https://store.example/',
    title: 'Store Example',
    pageKind: 'homepage',
    meta: {},
    headerText: '',
    footerText: '',
    contactSectionText: '',
    bodyContactText: '',
    mailtoHrefs: [],
    telHrefs: [],
    linkHrefs: [],
    jsonLdBlocks: [],
    ...partial,
  }
}

describe('email validator', () => {
  it('normalizes and validates emails', () => {
    expect(normalizeEmailCandidate(' Mailto:Support@Example.COM?subject=Hi ')).toBe(
      'support@example.com',
    )
    expect(isValidBusinessEmail('support@example.com')).toBe(true)
  })

  it('rejects placeholders and invalids', () => {
    expect(isValidBusinessEmail('example@example.com')).toBe(false)
    expect(isValidBusinessEmail('user@domain.com')).toBe(false)
    expect(isValidBusinessEmail('not-an-email')).toBe(false)
    expect(isValidBusinessEmail('a@b')).toBe(false)
  })
})

describe('email classifier', () => {
  it('classifies common prefixes', () => {
    expect(classifyBusinessEmail('info@x.com')).toBe('general')
    expect(classifyBusinessEmail('support@x.com')).toBe('support')
    expect(classifyBusinessEmail('sales@x.com')).toBe('sales')
    expect(classifyBusinessEmail('privacy@x.com')).toBe('privacy')
    expect(classifyBusinessEmail('legal@x.com')).toBe('legal')
    expect(classifyBusinessEmail('press@x.com')).toBe('press')
  })
})

describe('business name priority', () => {
  it('prefers Organization JSON-LD over title', () => {
    const identity = extractBusinessIdentity(
      doc({
        title: 'Title Fallback Shop',
        meta: { ogSiteName: 'OG Shop' },
        jsonLdBlocks: [
          { '@type': 'Organization', name: 'Org Shop', email: 'info@org.test' },
        ],
      }),
    )
    expect(identity?.name).toBe('Org Shop')
    expect(identity?.sourceType).toBe('json_ld_organization')
    expect(identity?.confidence).toBe('high')
  })

  it('falls back to og:site_name', () => {
    const identity = extractBusinessIdentity(doc({ meta: { ogSiteName: 'OG Only' }, title: 'x' }))
    expect(identity?.name).toBe('OG Only')
    expect(identity?.confidence).toBe('medium')
  })
})

describe('JSON-LD parsing', () => {
  it('parses Organization and Store and skips malformed blocks', () => {
    const parsed = parseJsonLdBlocks([
      { '@type': 'Store', name: 'Store Name', email: 'store@x.test' },
      '{not-json',
      {
        '@graph': [{ '@type': 'ContactPoint', email: 'help@x.test', telephone: '+1 555' }],
      },
    ])
    expect(parsed.storeNames).toContain('Store Name')
    expect(parsed.emails).toEqual(expect.arrayContaining(['store@x.test', 'help@x.test']))
  })
})

describe('email extraction', () => {
  it('extracts mailto and json-ld emails with confidence', () => {
    const emails = extractPublicEmails(
      doc({
        pageKind: 'footer',
        mailtoHrefs: ['mailto:Support@Brand.test'],
        jsonLdBlocks: [{ '@type': 'Organization', email: 'hello@brand.test' }],
      }),
    )
    expect(emails.map((e) => e.email).sort()).toEqual(['hello@brand.test', 'support@brand.test'])
    expect(emails.find((e) => e.email === 'hello@brand.test')?.confidence).toBe('high')
  })

  it('does not invent guessed emails', () => {
    const emails = extractPublicEmails(doc({ title: 'Acme', meta: { ogSiteName: 'Acme' } }))
    expect(emails).toHaveLength(0)
    expect(emails.some((e) => e.email.includes('info@'))).toBe(false)
  })
})

describe('phone and social', () => {
  it('extracts tel links and social profiles', () => {
    const phones = extractPublicPhones(doc({ telHrefs: ['tel:+1-555-0100'] }))
    expect(phones[0]?.phone).toContain('555')
    const social = extractSocialProfiles(
      doc({
        linkHrefs: [
          { href: 'https://instagram.com/brand', text: 'IG' },
          { href: '/products/x', text: 'Product' },
        ],
      }),
      'https://store.example/',
    )
    expect(social).toHaveLength(1)
    expect(social[0]?.platform).toBe('instagram')
  })
})

describe('same-origin discovery and redirects', () => {
  it('enforces same origin and discovers contact links', () => {
    expect(isSameOrigin('https://evil.test/contact', 'https://store.example/')).toBe(false)
    expect(normalizeSameOriginUrl('https://evil.test/x', 'https://store.example/')).toBeNull()
    expect(validateRedirectSameOrigin('https://store.example/a', 'https://other.test/b')).toBe(
      false,
    )
    const pages = discoverContactPages(
      doc({
        linkHrefs: [
          { href: '/pages/contact', text: 'Contact us' },
          { href: 'https://other.test/contact', text: 'External' },
          { href: '/products/a', text: 'Product' },
        ],
      }),
      'https://store.example/',
    )
    expect(pages).toHaveLength(1)
    expect(pages[0]?.url).toContain('/pages/contact')
  })

  it('limits discovered pages to five', () => {
    const links = Array.from({ length: 10 }, (_, i) => ({
      href: `/pages/contact-${i}`,
      text: 'Contact',
    }))
    const pages = discoverContactPages(doc({ linkHrefs: links }), 'https://store.example/')
    expect(pages.length).toBeLessThanOrEqual(5)
  })
})

describe('evidence sanitizer', () => {
  it('strips query params and limits length', () => {
    expect(sanitizeEvidenceUrl('https://a.test/p?token=secret#x')).toBe('https://a.test/p')
    expect(sanitizeContactEvidence('a'.repeat(300)).length).toBeLessThanOrEqual(160)
  })
})

describe('runPublicContactScan', () => {
  it('returns not_found when empty', async () => {
    const result = await runPublicContactScan(doc({ title: '' }), {
      fetchPageHtml: async () => '',
      parseHtmlToDocument: () => doc({ title: '' }),
    })
    expect(result.status).toBe('not_found')
  })

  it('cancels outstanding work', async () => {
    const controller = new AbortController()
    controller.abort()
    const result = await runPublicContactScan(
      doc({
        linkHrefs: [{ href: '/pages/contact', text: 'Contact' }],
        mailtoHrefs: [],
      }),
      {
        fetchPageHtml: async () => {
          throw new Error('should not fetch')
        },
        parseHtmlToDocument: () => doc(),
      },
      { signal: controller.signal },
    )
    expect(result.warnings.some((w) => /cancel/i.test(w)) || result.status !== 'completed').toBe(
      true,
    )
  })

  it('fetches at most five additional pages serially', async () => {
    const fetched: string[] = []
    const links = Array.from({ length: 8 }, (_, i) => ({
      href: `/pages/contact-${i}`,
      text: 'Contact',
    }))
    await runPublicContactScan(
      doc({ linkHrefs: links, mailtoHrefs: ['mailto:info@store.example'] }),
      {
        fetchPageHtml: async (url) => {
          fetched.push(url)
          return '<html></html>'
        },
        parseHtmlToDocument: (_html, url) =>
          doc({ url, pageKind: 'contact_page', mailtoHrefs: [] }),
      },
    )
    expect(fetched.length).toBeLessThanOrEqual(5)
  })
})
