import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PublicContactCard } from '../../components/PublicContactCard'
import type { PublicContactScanResult } from '../../contacts/contact-types'

const sampleResult: PublicContactScanResult = {
  status: 'completed',
  business: {
    name: 'Example Store',
    sourceUrl: 'https://store.example/',
    sourceType: 'og_site_name',
    confidence: 'medium',
    evidence: 'Found in Open Graph site name metadata',
  },
  emails: [
    {
      email: 'support@store.example',
      category: 'support',
      confidence: 'high',
      sourceType: 'mailto',
      sourceUrl: 'https://store.example/',
      evidence: 'Found in a visible mailto link',
    },
    {
      email: 'sales@store.example',
      category: 'sales',
      confidence: 'medium',
      sourceType: 'visible_text',
      sourceUrl: 'https://store.example/pages/contact',
      evidence: 'Found in visible text on a contact or about page',
    },
  ],
  phones: [
    {
      phone: '+1 555 000 0000',
      confidence: 'high',
      sourceType: 'visible_text',
      sourceUrl: 'https://store.example/',
      evidence: 'Found in a visible tel: link',
    },
  ],
  socialProfiles: [
    {
      platform: 'instagram',
      profileUrl: 'https://instagram.com/examplestore',
      sourceUrl: 'https://store.example/',
    },
  ],
  contactPages: [{ url: 'https://store.example/pages/contact', label: 'Contact' }],
  inspectedPages: ['https://store.example/'],
  warnings: [],
  scannedAt: '2026-09-15T10:00:00.000Z',
  durationMs: 120,
  scannerVersion: '1.0.0',
}

describe('PublicContactCard', () => {
  it('hides scanner for unknown', () => {
    const { container } = render(
      <PublicContactCard
        detectionStatus="unknown"
        state={{ status: 'idle' }}
        websiteUrl="https://x.test"
        onScan={vi.fn()}
        onCancel={vi.fn()}
      />,
    )
    expect(screen.getByText(/could not be confirmed/i)).toBeInTheDocument()
    expect(container.querySelector('button')).not.toBeInTheDocument()
  })

  it('enables scanning for likely_shopify and shows a warning', () => {
    const onScan = vi.fn()
    render(
      <PublicContactCard
        detectionStatus="likely_shopify"
        state={{ status: 'idle' }}
        websiteUrl="https://x.test"
        onScan={onScan}
        onCancel={vi.fn()}
      />,
    )
    expect(screen.getByRole('note')).toHaveTextContent(/could not be fully confirmed/i)
    fireEvent.click(screen.getByRole('button', { name: /Find Public Contact Information/i }))
    expect(onScan).toHaveBeenCalledWith(false)
  })

  it('shows unavailable message for possible_headless', () => {
    render(
      <PublicContactCard
        detectionStatus="possible_headless"
        state={{ status: 'idle' }}
        websiteUrl="https://x.test"
        onScan={vi.fn()}
        onCancel={vi.fn()}
      />,
    )
    expect(screen.getByText(/could not be confirmed/i)).toBeInTheDocument()
  })

  it('enables scanner for confirmed_shopify and shows privacy notice', () => {
    const onScan = vi.fn()
    render(
      <PublicContactCard
        detectionStatus="confirmed_shopify"
        state={{ status: 'idle' }}
        websiteUrl="https://x.test"
        onScan={onScan}
        onCancel={vi.fn()}
      />,
    )
    expect(screen.getByText(/does not search for or infer private/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Find Public Contact Information/i }))
    expect(onScan).toHaveBeenCalledWith(false)
  })

  it('offers a choice for shopify_connected: scan current site or open the connected storefront', () => {
    const onScan = vi.fn()
    const onOpen = vi.fn()
    render(
      <PublicContactCard
        detectionStatus="shopify_connected"
        state={{ status: 'idle' }}
        websiteUrl="https://www.example.com"
        connectedStoreUrl="https://shop.example.com"
        onScan={onScan}
        onCancel={vi.fn()}
        onOpenConnectedStore={onOpen}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /current site/i }))
    expect(onScan).toHaveBeenCalledWith(false)
    fireEvent.click(screen.getByRole('button', { name: /open.*scan connected storefront/i }))
    expect(onOpen).toHaveBeenCalledWith('https://shop.example.com')
  })

  it('shows loading and cancel', () => {
    const onCancel = vi.fn()
    render(
      <PublicContactCard
        detectionStatus="confirmed_shopify"
        state={{ status: 'loading' }}
        websiteUrl="https://x.test"
        onScan={vi.fn()}
        onCancel={onCancel}
      />,
    )
    expect(screen.getByText(/Scanning public contact/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }))
    expect(onCancel).toHaveBeenCalled()
  })

  it('renders successful multi-email result and copy summary', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })

    render(
      <PublicContactCard
        detectionStatus="confirmed_shopify"
        state={{ status: 'ready', result: sampleResult }}
        websiteUrl="https://store.example/"
        onScan={vi.fn()}
        onCancel={vi.fn()}
      />,
    )
    expect(screen.getByText('Example Store')).toBeInTheDocument()
    expect(screen.getByText('support@store.example')).toBeInTheDocument()
    expect(screen.getByText('sales@store.example')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Copy Contact Summary/i }))
    expect(writeText).toHaveBeenCalled()
    expect(String(writeText.mock.calls[0][0])).toContain('support@store.example')
  })

  it('shows not-found email message', () => {
    render(
      <PublicContactCard
        detectionStatus="confirmed_shopify"
        state={{
          status: 'ready',
          result: { ...sampleResult, emails: [], status: 'not_found', business: undefined },
        }}
        websiteUrl="https://store.example/"
        onScan={vi.fn()}
        onCancel={vi.fn()}
      />,
    )
    expect(
      screen.getByText(/No public business email was found/i),
    ).toBeInTheDocument()
  })

  it('shows partial warnings and fetch error', () => {
    render(
      <PublicContactCard
        detectionStatus="confirmed_shopify"
        state={{
          status: 'ready',
          result: {
            ...sampleResult,
            status: 'partial',
            warnings: ['Same-origin contact pages could not be fetched'],
          },
        }}
        websiteUrl="https://store.example/"
        onScan={vi.fn()}
        onCancel={vi.fn()}
      />,
    )
    expect(screen.getByText(/could not be fetched/i)).toBeInTheDocument()

    const { rerender } = render(
      <PublicContactCard
        detectionStatus="confirmed_shopify"
        state={{
          status: 'error',
          error: { code: 'CONTACT_SCAN_TIMEOUT', message: 'timeout' },
        }}
        websiteUrl="https://store.example/"
        onScan={vi.fn()}
        onCancel={vi.fn()}
      />,
    )
    expect(screen.getByRole('alert')).toBeInTheDocument()
    rerender(
      <PublicContactCard
        detectionStatus="confirmed_shopify"
        detectionError
        state={{ status: 'idle' }}
        websiteUrl="https://store.example/"
        onScan={vi.fn()}
        onCancel={vi.fn()}
        onRetryDetection={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: /Retry detection/i })).toBeInTheDocument()
  })
})
