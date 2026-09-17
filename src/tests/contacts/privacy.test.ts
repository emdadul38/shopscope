import { describe, expect, it } from 'vitest'
import { extractPublicEmails, extractBusinessIdentity } from '../../contacts'
import { parseHtmlToContactDocument } from '../../content/public-contact-inspector'
import type { PageContactDocument } from '../../contacts/contact-types'

import contactHtml from '../fixtures/store-with-contact.html?raw'
import jsonLdHtml from '../fixtures/store-with-jsonld.html?raw'
import noContactHtml from '../fixtures/store-with-no-contact.html?raw'
import incidentalHtml from '../fixtures/store-with-incidental-emails.html?raw'

describe('privacy: contact extraction boundaries', () => {
  it('extracts visible mailto from footer fixture', () => {
    const doc = parseHtmlToContactDocument(contactHtml, 'https://store.example/', 'homepage')
    const emails = extractPublicEmails(doc)
    expect(emails.some((e) => e.email === 'support@example-store.com')).toBe(true)
  })

  it('extracts JSON-LD organization email', () => {
    const doc = parseHtmlToContactDocument(jsonLdHtml, 'https://jsonld.example/', 'homepage')
    const emails = extractPublicEmails(doc)
    expect(emails.map((e) => e.email)).toContain('hello@jsonld-merchants.test')
    const business = extractBusinessIdentity(doc)
    expect(business?.name).toBe('JSONLD Merchants')
  })

  it('does not invent emails when none are published', () => {
    const doc = parseHtmlToContactDocument(noContactHtml, 'https://quiet.example/', 'homepage')
    expect(extractPublicEmails(doc)).toHaveLength(0)
  })

  it('does not extract script, comment, review, or tracking emails', () => {
    const doc = parseHtmlToContactDocument(
      incidentalHtml,
      'https://blog.example/',
      'homepage',
    )
    const emails = extractPublicEmails(doc)
    const values = emails.map((e) => e.email)
    expect(values).not.toContain('leak@hidden-script.test')
    expect(values).not.toContain('leaked@comment.test')
    expect(values).not.toContain('jane.customer@gmail.com')
    expect(values).not.toContain('reviewer@personal.example')
    expect(values).not.toContain('track@pixels.example')
  })

  it('does not treat form field names as business emails', () => {
    const doc: PageContactDocument = parseHtmlToContactDocument(
      noContactHtml,
      'https://quiet.example/',
      'homepage',
    )
    expect(doc.mailtoHrefs).toHaveLength(0)
    expect(extractPublicEmails(doc)).toHaveLength(0)
  })

  it('does not extract names from testimonials as business identity beyond title fallback', () => {
    const doc = parseHtmlToContactDocument(
      incidentalHtml,
      'https://blog.example/',
      'homepage',
    )
    const business = extractBusinessIdentity(doc)
    expect(business?.name?.toLowerCase().includes('jane')).toBeFalsy()
  })
})
