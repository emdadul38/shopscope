import type { PageContactDocument, PublicSocialContact } from './contact-types'
import { sanitizeEvidenceUrl } from './evidence-sanitizer'

const SOCIAL_HOSTS: Array<{ platform: string; hosts: string[] }> = [
  { platform: 'linkedin', hosts: ['linkedin.com', 'www.linkedin.com'] },
  { platform: 'facebook', hosts: ['facebook.com', 'www.facebook.com', 'fb.com'] },
  { platform: 'instagram', hosts: ['instagram.com', 'www.instagram.com'] },
  { platform: 'x', hosts: ['twitter.com', 'www.twitter.com', 'x.com', 'www.x.com'] },
  { platform: 'youtube', hosts: ['youtube.com', 'www.youtube.com', 'youtu.be'] },
  { platform: 'tiktok', hosts: ['tiktok.com', 'www.tiktok.com'] },
  { platform: 'pinterest', hosts: ['pinterest.com', 'www.pinterest.com'] },
]

export function extractSocialProfiles(
  doc: PageContactDocument,
  pageOrigin: string,
): PublicSocialContact[] {
  const seen = new Set<string>()
  const out: PublicSocialContact[] = []
  let originHost = ''
  try {
    originHost = new URL(pageOrigin).hostname.toLowerCase()
  } catch {
    return out
  }

  for (const link of doc.linkHrefs) {
    let url: URL
    try {
      url = new URL(link.href, pageOrigin)
    } catch {
      continue
    }
    // Only capture outbound social profile URLs linked from the storefront
    const host = url.hostname.toLowerCase()
    if (host === originHost) continue

    const match = SOCIAL_HOSTS.find((s) => s.hosts.includes(host) || s.hosts.some((h) => host.endsWith(`.${h}`)))
    if (!match) continue

    url.search = ''
    url.hash = ''
    const profileUrl = url.toString()
    const key = profileUrl.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push({
      platform: match.platform,
      profileUrl,
      sourceUrl: sanitizeEvidenceUrl(doc.url),
    })
  }

  return out
}
