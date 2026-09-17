import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CommerceDetectionCard } from '../../components/CommerceDetectionCard'
import { ConfidenceMeter } from '../../components/ConfidenceMeter'
import { DetectionStatusBadge } from '../../components/DetectionStatusBadge'
import { DetectionEvidence } from '../../components/DetectionEvidence'
import type { CommerceDetectionResult } from '../../detectors/commerce/commerce-types'

const baseResult: CommerceDetectionResult = {
  platform: 'shopify',
  status: 'confirmed_shopify',
  storefrontType: 'shopify_theme',
  confidence: 100,
  inspectedAt: '2026-09-15T12:00:00.000Z',
  durationMs: 42,
  detectorVersion: '2.0.0',
  evidence: [
    {
      signalName: 'Shopify CDN assets',
      category: 'resource',
      weight: 18,
      explanation: 'Resource loaded from cdn.shopify.com',
      confidenceLevel: 'medium',
    },
    {
      signalName: 'myshopify.com hostname',
      category: 'domain',
      weight: 30,
      explanation: 'Validated myshopify.com hostname reference: demo.myshopify.com',
      confidenceLevel: 'high',
    },
  ],
}

describe('DetectionStatusBadge', () => {
  it('renders confirmed label', () => {
    render(<DetectionStatusBadge status="confirmed_shopify" />)
    expect(screen.getByText('Confirmed Shopify Store')).toBeInTheDocument()
  })

  it('renders likely, possible headless, connected, other, and unknown labels', () => {
    const { rerender } = render(<DetectionStatusBadge status="likely_shopify" />)
    expect(screen.getByText('Likely Shopify Store')).toBeInTheDocument()
    rerender(<DetectionStatusBadge status="possible_headless" />)
    expect(screen.getByText('Possible Headless Commerce')).toBeInTheDocument()
    rerender(<DetectionStatusBadge status="shopify_connected" />)
    expect(screen.getByText('Shopify-Connected Website')).toBeInTheDocument()
    rerender(<DetectionStatusBadge status="confirmed_other" />)
    expect(screen.getByText('Confirmed Non-Shopify Platform')).toBeInTheDocument()
    rerender(<DetectionStatusBadge status="unknown" />)
    expect(screen.getByText('Platform Unknown')).toBeInTheDocument()
  })
})

describe('ConfidenceMeter', () => {
  it('exposes textual confidence value and meter role', () => {
    render(<ConfidenceMeter confidence={87} status="likely_shopify" />)
    expect(screen.getByText('87%')).toBeInTheDocument()
    expect(screen.getByRole('meter')).toHaveAttribute('aria-valuenow', '87')
  })
})

describe('DetectionEvidence', () => {
  it('expands matched evidence', () => {
    render(<DetectionEvidence evidence={baseResult.evidence} />)
    expect(screen.getByText(/Evidence \(2 matched signals\)/)).toBeInTheDocument()
    fireEvent.click(screen.getByText(/Evidence/))
    expect(screen.getByText(/cdn.shopify.com/)).toBeInTheDocument()
  })
})

const noopDeepScan = { state: { status: 'idle' as const }, onStart: vi.fn(), onCancel: vi.fn() }

describe('CommerceDetectionCard', () => {
  it('shows loading state with accessible text', () => {
    render(
      <CommerceDetectionCard
        state={{ status: 'loading' }}
        onRunDetection={vi.fn()}
        hasScanned={false}
        deepScanState={noopDeepScan.state}
        onStartDeepScan={noopDeepScan.onStart}
        onCancelDeepScan={noopDeepScan.onCancel}
      />,
    )
    expect(screen.getByText(/Inspecting page/i)).toBeInTheDocument()
  })

  it('shows confirmed result details', () => {
    render(
      <CommerceDetectionCard
        state={{ status: 'ready', result: baseResult }}
        onRunDetection={vi.fn()}
        hasScanned
        deepScanState={noopDeepScan.state}
        onStartDeepScan={noopDeepScan.onStart}
        onCancelDeepScan={noopDeepScan.onCancel}
      />,
    )
    expect(screen.getByText('Confirmed Shopify Store')).toBeInTheDocument()
    expect(screen.getByText('42 ms')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('shows likely_shopify result', () => {
    render(
      <CommerceDetectionCard
        state={{
          status: 'ready',
          result: { ...baseResult, status: 'likely_shopify', confidence: 80 },
        }}
        onRunDetection={vi.fn()}
        hasScanned
        deepScanState={noopDeepScan.state}
        onStartDeepScan={noopDeepScan.onStart}
        onCancelDeepScan={noopDeepScan.onCancel}
      />,
    )
    expect(screen.getByText('Likely Shopify Store')).toBeInTheDocument()
  })

  it('shows possible_headless result with the honest limitation message', () => {
    render(
      <CommerceDetectionCard
        state={{
          status: 'ready',
          result: {
            ...baseResult,
            status: 'possible_headless',
            storefrontType: 'shopify_headless',
            confidence: 44,
          },
        }}
        onRunDetection={vi.fn()}
        hasScanned
        deepScanState={noopDeepScan.state}
        onStartDeepScan={noopDeepScan.onStart}
        onCancelDeepScan={noopDeepScan.onCancel}
      />,
    )
    expect(screen.getByText('Possible Headless Commerce')).toBeInTheDocument()
    expect(
      screen.getByText(/does not expose sufficient client-side evidence/i),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /deep scan/i })).toBeInTheDocument()
  })

  it('shows unknown result without an alert (not an error)', () => {
    render(
      <CommerceDetectionCard
        state={{
          status: 'ready',
          result: {
            ...baseResult,
            status: 'unknown',
            storefrontType: 'unknown',
            confidence: 0,
            evidence: [],
          },
        }}
        onRunDetection={vi.fn()}
        hasScanned
        deepScanState={noopDeepScan.state}
        onStartDeepScan={noopDeepScan.onStart}
        onCancelDeepScan={noopDeepScan.onCancel}
      />,
    )
    expect(screen.getByText('Platform Unknown')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('does not show Deep Scan for a confirmed result', () => {
    render(
      <CommerceDetectionCard
        state={{ status: 'ready', result: baseResult }}
        onRunDetection={vi.fn()}
        hasScanned
        deepScanState={noopDeepScan.state}
        onStartDeepScan={noopDeepScan.onStart}
        onCancelDeepScan={noopDeepScan.onCancel}
      />,
    )
    expect(screen.queryByRole('button', { name: /deep scan/i })).not.toBeInTheDocument()
  })

  it('shows timeout error state', () => {
    render(
      <CommerceDetectionCard
        state={{
          status: 'error',
          error: { code: 'DETECTION_TIMEOUT', message: 'timed out' },
        }}
        onRunDetection={vi.fn()}
        hasScanned
        deepScanState={noopDeepScan.state}
        onStartDeepScan={noopDeepScan.onStart}
        onCancelDeepScan={noopDeepScan.onCancel}
      />,
    )
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText(/took too long/i)).toBeInTheDocument()
  })

  it('invokes rescan action', () => {
    const onRun = vi.fn()
    render(
      <CommerceDetectionCard
        state={{ status: 'ready', result: baseResult }}
        onRunDetection={onRun}
        hasScanned
        deepScanState={noopDeepScan.state}
        onStartDeepScan={noopDeepScan.onStart}
        onCancelDeepScan={noopDeepScan.onCancel}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /rescan/i }))
    expect(onRun).toHaveBeenCalledTimes(1)
  })

  it('invokes onStartDeepScan when Deep Scan is clicked', () => {
    const onStart = vi.fn()
    render(
      <CommerceDetectionCard
        state={{ status: 'ready', result: { ...baseResult, status: 'unknown', evidence: [] } }}
        onRunDetection={vi.fn()}
        hasScanned
        deepScanState={{ status: 'idle' }}
        onStartDeepScan={onStart}
        onCancelDeepScan={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /deep scan/i }))
    expect(onStart).toHaveBeenCalledTimes(1)
  })
})
