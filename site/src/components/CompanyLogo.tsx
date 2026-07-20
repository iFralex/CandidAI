'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'

const logoCache = new Map<string, string | null>()

function getCachedLogo(company: string) {
  if (typeof window === 'undefined') return null
  const item = localStorage.getItem(`logo_${company}`)
  if (!item) return null
  try {
    const parsed = JSON.parse(item)
    if (Date.now() - parsed.timestamp > 24 * 60 * 60 * 1000) {
      localStorage.removeItem(`logo_${company}`)
      return null
    }
    return parsed.url as string
  } catch {
    localStorage.removeItem(`logo_${company}`)
    return null
  }
}

function cacheLogo(company: string, url: string) {
  localStorage.setItem(`logo_${company}`, JSON.stringify({ url, timestamp: Date.now() }))
}

async function isUrlValid(url: string) {
  try {
    return (await fetch(url, { method: 'HEAD' })).ok
  } catch {
    return false
  }
}

async function fetchLogo(domain: string) {
  if (logoCache.has(domain)) return logoCache.get(domain) || null
  try {
    const response = await fetch(`https://api.brandfetch.io/v2/search/${encodeURIComponent(domain)}?limit=1`, { cache: 'force-cache' })
    if (response.ok) {
      const data = await response.json()
      const icon = Array.isArray(data) && data[0]?.icon ? String(data[0].icon) : null
      logoCache.set(domain, icon)
      return icon
    }
  } catch (error) {
    console.error('Company logo fetch failed:', error)
  }
  logoCache.set(domain, null)
  return null
}

export function CompanyLogo({ company, link = null, maxSize = 12, minSize = 12 }: { company?: string; link?: string | null; maxSize?: number; minSize?: number }) {
  const [logo, setLogo] = useState<string | null>(link)

  useEffect(() => {
    setLogo(link)
    if (!company || link) return
    let cancelled = false
    const loadLogo = async () => {
      const cached = getCachedLogo(company)
      if (cached && await isUrlValid(cached)) {
        if (!cancelled) setLogo(cached)
        return
      }
      const icon = await fetchLogo(company)
      if (icon) cacheLogo(company, icon)
      if (!cancelled) setLogo(icon)
    }
    void loadLogo()
    return () => { cancelled = true }
  }, [company, link])

  return <div className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 font-semibold text-white" style={{ maxWidth: `calc(var(--spacing) * ${maxSize})`, minWidth: `calc(var(--spacing) * ${minSize})` }}>
    {logo ? <Image src={logo} alt={`${company || 'Company'} logo`} className="h-full w-full object-contain" fill /> : company?.charAt(0).toUpperCase()}
  </div>
}
