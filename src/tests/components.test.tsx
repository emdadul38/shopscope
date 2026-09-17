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
