'use client'

import { useState, useEffect, useRef } from 'react'

interface Property {
  id: string
  source: string
  title: string
  priceDisplay: string
  bhk: number | null
  areaSqft: number | null
  locality: string
  city: string
  url: string
  urlType: 'listing' | 'project' | 'search'
}

interface PropertyReviews {
  placeId?: string
  rating: number | null
  reviewCount: number | null
  pros: string[]
  cons: string[]
  summary: string
  reviewsUrl: string
}

interface Session {
  sessionId: string
  status: 'pending' | 'running' | 'complete' | 'error'
  results: Property[]
  reviews?: PropertyReviews
  query: string
  error?: string
}

interface SearchUrls {
  magicbricks: string
  acres99: string
  nobroker: string
  maps: string
}

const SOURCE_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  magicbricks: { label: 'MagicBricks', color: '#b91c1c', dot: '#ef4444' },
  '99acres': { label: '99Acres', color: '#92400e', dot: '#f59e0b' },
  nobroker: { label: 'NoBroker', color: '#065f46', dot: '#10b981' },
}

const URL_TYPE_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  listing: { label: 'Direct Listing', color: '#065f46', bg: '#ecfdf5', border: '#6ee7b7' },
  project: { label: 'Project Page', color: '#92400e', bg: '#fffbeb', border: '#fcd34d' },
  search: { label: 'Search Results', color: '#6b7280', bg: '#f9fafb', border: '#e5e7eb' },
}

const ALL_SOURCES = ['magicbricks', '99acres', 'nobroker']

const CITIES = ['Bangalore', 'Mumbai', 'Delhi', 'Hyderabad', 'Pune', 'Chennai']
const BHK_OPTIONS = ['Any', '1', '2', '3', '4', '4+']

const PORTAL_LIST = [
  { key: 'magicbricks', label: 'MagicBricks', urlKey: 'magicbricks' },
  { key: 'acres99', label: '99Acres', urlKey: 'acres99' },
  { key: 'nobroker', label: 'NoBroker', urlKey: 'nobroker' },
  { key: 'maps', label: 'Google Maps', urlKey: 'maps' },
]

function StarRating({ rating }: { rating: number }) {
  const full = Math.floor(rating)
  const half = rating - full >= 0.4
  const empty = 5 - full - (half ? 1 : 0)
  return (
    <span style={{ color: '#f59e0b', fontSize: 15, letterSpacing: 1 }}>
      {'★'.repeat(full)}
      {half ? '½' : ''}
      {'☆'.repeat(empty)}
    </span>
  )
}

/** Properties-available comparison table derived from session.results */
function PropertiesTable({ results }: { results: Property[] }) {
  // Build per-source best price (highest confidence = listing first)
  const bySource: Record<string, Property[]> = {}
  for (const p of results) {
    if (!bySource[p.source]) bySource[p.source] = []
    bySource[p.source].push(p)
  }

  return (
    <div className="hs-props-table-wrap">
      <div className="hs-section-eyebrow">Properties available</div>
      <table className="hs-props-table">
        <thead>
          <tr>
            <th>Platform</th>
            <th>Found</th>
            <th>Best Price</th>
            <th>URL Type</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {ALL_SOURCES.map(source => {
            const src = SOURCE_CONFIG[source]
            const listings = bySource[source] || []
            // prefer listing-type, then project, then search
            const rank = { listing: 0, project: 1, search: 2 }
            const sorted = [...listings].sort((a, b) =>
              (rank[a.urlType] ?? 2) - (rank[b.urlType] ?? 2)
            )
            const best = sorted[0] || null
            const urlCfg = best ? URL_TYPE_CONFIG[best.urlType] : null

            return (
              <tr key={source} className={best ? '' : 'hs-props-row-absent'}>
                <td>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: src.dot, display: 'inline-block' }} />
                    <span style={{ color: src.color, fontSize: 12, fontWeight: 500, letterSpacing: '0.04em' }}>{src.label}</span>
                  </span>
                </td>
                <td>{best ? <span className="hs-tick">✓</span> : <span className="hs-cross">—</span>}</td>
                <td style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 17, fontWeight: 400 }}>
                  {best?.priceDisplay || '—'}
                </td>
                <td>
                  {urlCfg && (
                    <span className="hs-url-badge" style={{ color: urlCfg.color, background: urlCfg.bg, borderColor: urlCfg.border }}>
                      {urlCfg.label}
                    </span>
                  )}
                </td>
                <td>
                  {best && (
                    <a href={best.url} target="_blank" rel="noopener noreferrer" className="hs-table-view-btn">
                      View →
                    </a>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/** Reviews panel */
function ReviewsPanel({ reviews }: { reviews: PropertyReviews }) {
  const [open, setOpen] = useState(true)

  return (
    <div className="hs-reviews-panel">
      <button className="hs-reviews-toggle" onClick={() => setOpen(o => !o)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="hs-section-eyebrow" style={{ marginBottom: 0 }}>Google Reviews Summary</span>
          {reviews.rating && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <StarRating rating={reviews.rating} />
              <span style={{ fontSize: 13, color: '#3a3a3a', fontWeight: 500 }}>{reviews.rating}</span>
              {reviews.reviewCount && (
                <span style={{ fontSize: 12, color: '#888' }}>({reviews.reviewCount.toLocaleString()} reviews)</span>
              )}
            </span>
          )}
        </div>
        <span style={{ color: '#888', fontSize: 13 }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="hs-reviews-body">
          <p className="hs-reviews-summary">{reviews.summary}</p>

          {(reviews.pros.length > 0 || reviews.cons.length > 0) && (
            <div className="hs-reviews-chips-row">
              {reviews.pros.length > 0 && (
                <div className="hs-chips-group">
                  <span className="hs-chips-label hs-chips-label--pro">Pros</span>
                  <div className="hs-chips">
                    {reviews.pros.map(p => (
                      <span key={p} className="hs-chip hs-chip--pro">{p}</span>
                    ))}
                  </div>
                </div>
              )}
              {reviews.cons.length > 0 && (
                <div className="hs-chips-group">
                  <span className="hs-chips-label hs-chips-label--con">Cons</span>
                  <div className="hs-chips">
                    {reviews.cons.map(c => (
                      <span key={c} className="hs-chip hs-chip--con">{c}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <a href={reviews.reviewsUrl} target="_blank" rel="noopener noreferrer" className="hs-reviews-link">
            View on Google Maps →
          </a>
        </div>
      )}
    </div>
  )
}

export default function Home() {
  const [query, setQuery] = useState('')
  const [city, setCity] = useState('Bangalore')
  const [bhk, setBhk] = useState('Any')
  const [session, setSession] = useState<Session | null>(null)
  const [searchUrls, setSearchUrls] = useState<SearchUrls | null>(null)
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => { if (pollRef.current) clearTimeout(pollRef.current) }
  }, [])

  const pollForResults = (sessionId: string) => {
    const poll = async () => {
      try {
        const res = await fetch(`http://localhost:3001/v1/search/${sessionId}`)
        const data: Session = await res.json()
        setSession(data)
        if (data.status === 'running' || data.status === 'pending') {
          pollRef.current = setTimeout(poll, 2000)
        } else {
          setLoading(false)
        }
      } catch {
        setLoading(false)
      }
    }
    poll()
  }

  const startSearch = async () => {
    if (!query.trim() || loading) return
    if (pollRef.current) clearTimeout(pollRef.current)
    setLoading(true)
    setSearched(true)
    setSession(null)
    setSearchUrls(null)

    try {
      const res = await fetch('http://localhost:3001/v1/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim(), city, bhk: bhk === 'Any' ? undefined : bhk }),
      })

      if (!res.ok) { setLoading(false); return }

      const data = await res.json()

      if (data.searchUrls) {
        setSearchUrls(data.searchUrls)
        const urls: string[] = [
          data.searchUrls.magicbricks,
          data.searchUrls.acres99,
          data.searchUrls.nobroker,
          data.searchUrls.maps,
        ].filter(Boolean)
        urls.forEach(url => window.open(url, '_blank', 'noopener,noreferrer'))
      }

      if (data.sessionId) pollForResults(data.sessionId)
      else setLoading(false)

    } catch {
      setLoading(false)
    }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400&family=DM+Sans:wght@300;400;500&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          --ink:       #0f0f0f;
          --ink-mid:   #3a3a3a;
          --ink-soft:  #888;
          --paper:     #faf8f5;
          --paper-mid: #f0ede8;
          --rule:      #e2ddd6;
          --accent:    #8b6c42;
          --accent-lt: #c4a882;
          --white:     #ffffff;
        }

        html, body { background: var(--paper); color: var(--ink); }

        .hs-wrap {
          font-family: 'DM Sans', sans-serif;
          min-height: 100vh;
          background: var(--paper);
        }

        /* ── Header ── */
        .hs-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 28px 48px;
          border-bottom: 1px solid var(--rule);
          background: var(--white);
        }
        .hs-logo {
          font-family: 'Cormorant Garamond', serif;
          font-size: 26px;
          font-weight: 500;
          letter-spacing: 0.04em;
          color: var(--ink);
        }
        .hs-logo span { color: var(--accent); }
        .hs-tagline {
          font-size: 12px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--ink-soft);
          font-weight: 300;
        }

        /* ── Hero ── */
        .hs-hero {
          padding: 72px 48px 56px;
          max-width: 860px;
        }
        .hs-hero-eyebrow {
          font-size: 11px;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: var(--accent);
          font-weight: 400;
          margin-bottom: 18px;
        }
        .hs-hero-title {
          font-family: 'Cormorant Garamond', serif;
          font-size: clamp(40px, 5vw, 62px);
          font-weight: 300;
          line-height: 1.1;
          color: var(--ink);
          margin-bottom: 20px;
          letter-spacing: -0.01em;
        }
        .hs-hero-title em { font-style: italic; color: var(--accent); }
        .hs-hero-sub {
          font-size: 15px;
          color: var(--ink-mid);
          font-weight: 300;
          line-height: 1.6;
          max-width: 520px;
        }

        /* ── Search Form ── */
        .hs-form-wrap {
          padding: 0 48px 64px;
          max-width: 860px;
        }
        .hs-input-row {
          display: flex;
          gap: 0;
          border: 1.5px solid var(--ink);
          background: var(--white);
          margin-bottom: 16px;
        }
        .hs-input-row input {
          flex: 1;
          padding: 18px 24px;
          font-family: 'DM Sans', sans-serif;
          font-size: 15px;
          font-weight: 300;
          color: var(--ink);
          background: transparent;
          border: none;
          outline: none;
        }
        .hs-input-row input::placeholder { color: var(--ink-soft); }
        .hs-search-btn {
          padding: 18px 36px;
          background: var(--ink);
          color: var(--white);
          font-family: 'DM Sans', sans-serif;
          font-size: 12px;
          font-weight: 500;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          border: none;
          cursor: pointer;
          transition: background 0.2s;
          white-space: nowrap;
          flex-shrink: 0;
        }
        .hs-search-btn:hover  { background: var(--accent); }
        .hs-search-btn:disabled { background: var(--ink-soft); cursor: not-allowed; }

        .hs-filters { display: flex; align-items: center; gap: 32px; }
        .hs-filter-group { display: flex; align-items: center; gap: 10px; }
        .hs-filter-label {
          font-size: 11px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--ink-soft);
          font-weight: 400;
        }
        .hs-city-select {
          font-family: 'DM Sans', sans-serif;
          font-size: 13px;
          color: var(--ink);
          background: transparent;
          border: none;
          border-bottom: 1px solid var(--rule);
          padding: 4px 24px 4px 0;
          cursor: pointer;
          outline: none;
          appearance: none;
          -webkit-appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23888'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 4px center;
        }
        .hs-bhk-pills { display: flex; gap: 6px; }
        .hs-bhk-pill {
          padding: 5px 13px;
          font-family: 'DM Sans', sans-serif;
          font-size: 12px;
          font-weight: 400;
          color: var(--ink-mid);
          background: transparent;
          border: 1px solid var(--rule);
          cursor: pointer;
          transition: all 0.15s;
          letter-spacing: 0.02em;
        }
        .hs-bhk-pill:hover   { border-color: var(--ink-mid); color: var(--ink); }
        .hs-bhk-pill.active  { background: var(--ink); color: var(--white); border-color: var(--ink); }

        /* ── Divider ── */
        .hs-divider {
          border: none;
          border-top: 1px solid var(--rule);
          margin: 0 48px;
        }

        /* ── Portal Strip ── */
        .hs-portals {
          padding: 28px 48px;
          display: flex;
          align-items: center;
          gap: 40px;
        }
        .hs-portals-label {
          font-size: 10px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: var(--ink-soft);
          white-space: nowrap;
          flex-shrink: 0;
        }
        .hs-portal-links { display: flex; gap: 8px; flex-wrap: wrap; }
        .hs-portal-link {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 7px 16px;
          font-size: 12px;
          font-weight: 400;
          color: var(--ink-mid);
          text-decoration: none;
          border: 1px solid var(--rule);
          background: var(--white);
          transition: all 0.15s;
          letter-spacing: 0.02em;
        }
        .hs-portal-link:hover { border-color: var(--ink); color: var(--ink); }
        .hs-portal-dot {
          width: 6px; height: 6px;
          border-radius: 50%;
          background: var(--ink-soft);
          flex-shrink: 0;
        }

        /* ── Results ── */
        .hs-results { padding: 0 48px 80px; }
        .hs-results-header {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          margin-bottom: 32px;
          padding-bottom: 16px;
          border-bottom: 1px solid var(--rule);
        }
        .hs-results-count {
          font-family: 'Cormorant Garamond', serif;
          font-size: 28px;
          font-weight: 400;
          color: var(--ink);
        }
        .hs-results-count span {
          font-size: 14px;
          font-family: 'DM Sans', sans-serif;
          font-weight: 300;
          color: var(--ink-soft);
          margin-left: 10px;
        }
        .hs-status-badge {
          font-size: 10px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          padding: 5px 14px;
          border: 1px solid currentColor;
        }
        .hs-status-badge.running  { color: var(--accent); }
        .hs-status-badge.complete { color: #065f46; }
        .hs-status-badge.error    { color: #b91c1c; }

        /* ── Section eyebrow ── */
        .hs-section-eyebrow {
          font-size: 10px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: var(--ink-soft);
          margin-bottom: 16px;
          font-weight: 400;
        }

        /* ── Reviews Panel ── */
        .hs-reviews-panel {
          border: 1px solid var(--rule);
          background: var(--white);
          margin-bottom: 40px;
          border-radius: 2px;
          overflow: hidden;
        }
        .hs-reviews-toggle {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 18px 24px;
          background: none;
          border: none;
          cursor: pointer;
          gap: 16px;
          border-bottom: 1px solid transparent;
          transition: border-color 0.15s;
        }
        .hs-reviews-toggle:hover { border-bottom-color: var(--rule); background: var(--paper); }
        .hs-reviews-body {
          padding: 20px 24px 24px;
          border-top: 1px solid var(--rule);
        }
        .hs-reviews-summary {
          font-size: 14px;
          color: var(--ink-mid);
          font-weight: 300;
          line-height: 1.65;
          margin-bottom: 20px;
          font-style: italic;
        }
        .hs-reviews-chips-row {
          display: flex;
          gap: 32px;
          flex-wrap: wrap;
          margin-bottom: 20px;
        }
        .hs-chips-group { display: flex; flex-direction: column; gap: 8px; }
        .hs-chips-label {
          font-size: 10px;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          font-weight: 500;
        }
        .hs-chips-label--pro { color: #065f46; }
        .hs-chips-label--con { color: #b91c1c; }
        .hs-chips { display: flex; flex-wrap: wrap; gap: 6px; }
        .hs-chip {
          padding: 4px 12px;
          font-size: 12px;
          border-radius: 100px;
          font-weight: 400;
          letter-spacing: 0.02em;
        }
        .hs-chip--pro { background: #ecfdf5; color: #065f46; border: 1px solid #6ee7b7; }
        .hs-chip--con { background: #fef2f2; color: #b91c1c; border: 1px solid #fca5a5; }
        .hs-reviews-link {
          font-size: 12px;
          color: var(--accent);
          text-decoration: none;
          letter-spacing: 0.06em;
          font-weight: 400;
        }
        .hs-reviews-link:hover { color: var(--ink); }

        /* ── Properties Available Table ── */
        .hs-props-table-wrap {
          margin-bottom: 48px;
        }
        .hs-props-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }
        .hs-props-table th {
          font-size: 10px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--ink-soft);
          font-weight: 400;
          padding: 0 0 12px;
          text-align: left;
          border-bottom: 1px solid var(--rule);
        }
        .hs-props-table td {
          padding: 14px 0;
          border-bottom: 1px solid var(--rule);
          vertical-align: middle;
        }
        .hs-props-row-absent td { opacity: 0.4; }
        .hs-tick { color: #10b981; font-size: 15px; font-weight: 600; }
        .hs-cross { color: var(--ink-soft); }
        .hs-url-badge {
          display: inline-block;
          padding: 3px 10px;
          font-size: 11px;
          border-radius: 100px;
          border: 1px solid;
          font-weight: 400;
          letter-spacing: 0.03em;
        }
        .hs-table-view-btn {
          font-size: 12px;
          color: var(--accent);
          text-decoration: none;
          letter-spacing: 0.06em;
          font-weight: 400;
          white-space: nowrap;
        }
        .hs-table-view-btn:hover { color: var(--ink); }

        /* ── Cards ── */
        .hs-cards { display: flex; flex-direction: column; gap: 0; }
        .hs-cards-header {
          margin-bottom: 20px;
        }
        .hs-card {
          display: grid;
          grid-template-columns: 1fr auto;
          align-items: start;
          gap: 24px;
          padding: 28px 0;
          border-bottom: 1px solid var(--rule);
          transition: background 0.15s;
          cursor: pointer;
          text-decoration: none;
          color: inherit;
        }
        .hs-card:first-child { border-top: none; }
        .hs-card:hover { background: var(--paper-mid); margin: 0 -16px; padding-left: 16px; padding-right: 16px; }

        .hs-card-source {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 10px;
        }
        .hs-card-source-dot { width: 5px; height: 5px; border-radius: 50%; }
        .hs-card-source-name {
          font-size: 10px;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          font-weight: 400;
        }
        .hs-card-url-badge {
          display: inline-block;
          padding: 2px 9px;
          font-size: 10px;
          border-radius: 100px;
          border: 1px solid;
          font-weight: 400;
          letter-spacing: 0.03em;
          vertical-align: middle;
        }

        .hs-card-title {
          font-family: 'Cormorant Garamond', serif;
          font-size: 22px;
          font-weight: 400;
          line-height: 1.2;
          color: var(--ink);
          margin-bottom: 6px;
        }
        .hs-card-locality {
          font-size: 13px;
          color: var(--ink-soft);
          font-weight: 300;
          margin-bottom: 14px;
        }
        .hs-card-meta { display: flex; gap: 24px; }
        .hs-card-meta-item {
          font-size: 12px;
          color: var(--ink-mid);
          font-weight: 300;
          letter-spacing: 0.02em;
        }
        .hs-card-meta-item strong { font-weight: 500; color: var(--ink); }

        .hs-card-price { text-align: right; flex-shrink: 0; }
        .hs-card-price-main {
          font-family: 'Cormorant Garamond', serif;
          font-size: 26px;
          font-weight: 400;
          color: var(--ink);
          line-height: 1;
          margin-bottom: 8px;
        }
        .hs-card-cta {
          font-size: 10px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--accent);
          font-weight: 400;
          display: flex;
          align-items: center;
          gap: 6px;
          justify-content: flex-end;
        }
        .hs-card-cta::after { content: '→'; font-size: 12px; }

        /* ── Shimmer ── */
        .hs-shimmer { display: flex; flex-direction: column; gap: 0; }
        .hs-shimmer-row {
          padding: 28px 0;
          border-bottom: 1px solid var(--rule);
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 24px;
          align-items: start;
        }
        .hs-shimmer-block {
          background: linear-gradient(90deg, var(--rule) 25%, var(--paper-mid) 50%, var(--rule) 75%);
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
          border-radius: 1px;
        }
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

        /* ── Empty ── */
        .hs-empty { padding: 64px 0; text-align: center; }
        .hs-empty-title {
          font-family: 'Cormorant Garamond', serif;
          font-size: 28px;
          font-weight: 300;
          color: var(--ink-mid);
          margin-bottom: 12px;
        }
        .hs-empty-sub {
          font-size: 13px;
          color: var(--ink-soft);
          font-weight: 300;
          line-height: 1.6;
        }

        /* ── Popup warning ── */
        .hs-popup-warn {
          font-size: 11px;
          color: var(--ink-soft);
          margin-top: 12px;
          letter-spacing: 0.02em;
          font-weight: 300;
        }

        @media (max-width: 640px) {
          .hs-header, .hs-hero, .hs-form-wrap, .hs-divider, .hs-portals, .hs-results { padding-left: 20px; padding-right: 20px; }
          .hs-hero { padding-top: 40px; }
          .hs-card:hover { margin: 0; padding-left: 0; padding-right: 0; }
          .hs-filters { flex-wrap: wrap; gap: 16px; }
          .hs-reviews-chips-row { flex-direction: column; gap: 20px; }
        }
      `}</style>

      <div className="hs-wrap">

        {/* Header */}
        <header className="hs-header">
          <div className="hs-logo">Home<span>Stack</span></div>
          <div className="hs-tagline">Property Intelligence Platform</div>
        </header>

        {/* Hero */}
        {!searched && (
          <section className="hs-hero">
            <p className="hs-hero-eyebrow">Real time search across all portals</p>
            <h1 className="hs-hero-title">
              Find your home<br />
              <em>without the noise.</em>
            </h1>
            <p className="hs-hero-sub">
              Search once. We surface listings from MagicBricks, 99Acres, and NoBroker side by side — with Google Reviews, pros, cons, and cross-platform pricing.
            </p>
          </section>
        )}

        {/* Search Form */}
        <section className="hs-form-wrap" style={searched ? { paddingTop: '40px' } : {}}>
          <div className="hs-input-row">
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && startSearch()}
              placeholder="Search a project, society, or locality..."
            />
            <button
              className="hs-search-btn"
              onClick={startSearch}
              disabled={loading || !query.trim()}
            >
              {loading ? 'Searching' : 'Search'}
            </button>
          </div>

          <div className="hs-filters">
            <div className="hs-filter-group">
              <span className="hs-filter-label">City</span>
              <select
                className="hs-city-select"
                value={city}
                onChange={e => setCity(e.target.value)}
              >
                {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="hs-filter-group">
              <span className="hs-filter-label">BHK</span>
              <div className="hs-bhk-pills">
                {BHK_OPTIONS.map(b => (
                  <button
                    key={b}
                    className={`hs-bhk-pill${bhk === b ? ' active' : ''}`}
                    onClick={() => setBhk(b)}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {searchUrls && (
            <p className="hs-popup-warn">
              Tabs did not open? Allow popups for localhost, or use the portal links below.
            </p>
          )}
        </section>

        {/* Portal links */}
        {searchUrls && (
          <>
            <hr className="hs-divider" />
            <div className="hs-portals">
              <span className="hs-portals-label">View on</span>
              <div className="hs-portal-links">
                {PORTAL_LIST.map(p => {
                  const url = searchUrls[p.urlKey as keyof SearchUrls]
                  const cfg = SOURCE_CONFIG[p.key] || { dot: '#888' }
                  return (
                    <a key={p.key} href={url} target="_blank" rel="noopener noreferrer" className="hs-portal-link">
                      <span className="hs-portal-dot" style={{ background: cfg.dot }} />
                      {p.label}
                    </a>
                  )
                })}
              </div>
            </div>
          </>
        )}

        {/* Results */}
        {session && (
          <>
            <hr className="hs-divider" />
            <section className="hs-results" style={{ paddingTop: '40px' }}>

              {/* Status header */}
              <div className="hs-results-header">
                <div className="hs-results-count">
                  {session.status === 'complete'
                    ? <>{session.results.length}<span>{session.results.length === 1 ? 'listing found' : 'listings found'}</span></>
                    : <span style={{ fontFamily: 'DM Sans', fontSize: 14, fontWeight: 300 }}>Searching portals...</span>
                  }
                </div>
                <span className={`hs-status-badge ${session.status}`}>
                  {session.status}
                </span>
              </div>

              {/* Shimmer while loading */}
              {(session.status === 'pending' || session.status === 'running') && (
                <div className="hs-shimmer">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="hs-shimmer-row">
                      <div>
                        <div className="hs-shimmer-block" style={{ height: 10, width: 80, marginBottom: 14 }} />
                        <div className="hs-shimmer-block" style={{ height: 22, width: '60%', marginBottom: 10 }} />
                        <div className="hs-shimmer-block" style={{ height: 10, width: '35%' }} />
                      </div>
                      <div className="hs-shimmer-block" style={{ height: 28, width: 100 }} />
                    </div>
                  ))}
                </div>
              )}

              {/* ── Reviews Panel ── */}
              {session.status === 'complete' && session.reviews && (
                <ReviewsPanel reviews={session.reviews} />
              )}

              {/* ── Properties Available Table ── */}
              {session.status === 'complete' && session.results.length > 0 && (
                <PropertiesTable results={session.results} />
              )}

              {/* ── Listing Cards ── */}
              {session.results.length > 0 && (
                <>
                  <div className="hs-cards-header">
                    <div className="hs-section-eyebrow">All listings</div>
                  </div>
                  <div className="hs-cards">
                    {session.results.map(property => {
                      const src = SOURCE_CONFIG[property.source] || { label: property.source, color: '#888', dot: '#888' }
                      const urlCfg = URL_TYPE_CONFIG[property.urlType] || URL_TYPE_CONFIG.search
                      return (
                        <a
                          key={property.id}
                          href={property.url || '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hs-card"
                        >
                          <div>
                            <div className="hs-card-source">
                              <span className="hs-card-source-dot" style={{ background: src.dot }} />
                              <span className="hs-card-source-name" style={{ color: src.color }}>{src.label}</span>
                              <span
                                className="hs-card-url-badge"
                                style={{ color: urlCfg.color, background: urlCfg.bg, borderColor: urlCfg.border }}
                              >
                                {urlCfg.label}
                              </span>
                            </div>
                            <div className="hs-card-title">{property.title}</div>
                            {(property.locality || property.city) && (
                              <div className="hs-card-locality">
                                {property.locality}{property.locality && property.city ? ', ' : ''}{property.city}
                              </div>
                            )}
                            <div className="hs-card-meta">
                              {property.bhk && (
                                <div className="hs-card-meta-item">
                                  <strong>{property.bhk}</strong> BHK
                                </div>
                              )}
                              {property.areaSqft && (
                                <div className="hs-card-meta-item">
                                  <strong>{property.areaSqft.toLocaleString()}</strong> sq.ft
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="hs-card-price">
                            <div className="hs-card-price-main">{property.priceDisplay}</div>
                            <div className="hs-card-cta">
                              {property.urlType === 'listing' ? 'View listing' : property.urlType === 'project' ? 'View project' : 'Search results'}
                            </div>
                          </div>
                        </a>
                      )
                    })}
                  </div>
                </>
              )}

              {/* Empty state */}
              {session.status === 'complete' && session.results.length === 0 && (
                <div className="hs-empty">
                  <div className="hs-empty-title">No listings extracted</div>
                  <div className="hs-empty-sub">
                    Portal protection blocked automated extraction.<br />
                    Use the portal links above to view full results directly.
                  </div>
                </div>
              )}

            </section>
          </>
        )}

      </div>
    </>
  )
}