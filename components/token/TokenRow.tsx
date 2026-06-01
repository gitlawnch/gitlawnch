import Link from 'next/link'
import { fmtUsd, fmtAge, fmtAddr } from '@/hooks/useWallet'
import type { Token } from '@/lib/supabase'

interface Props { token: Token; rank: number; sortCol?: string }

export default function TokenRow({ token, rank }: Props) {
  return (
    <div className="token-row flex items-center px-4 py-2.5 w-full min-w-[680px]">

      {/* Rank */}
      <div style={{ width: 24, flexShrink: 0, fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: '#2a2a2a', textAlign: 'center' }}>{rank}</div>

      {/* Token cell */}
      <Link href={`/token/${token.id}`}
        className="hover:opacity-90 transition-opacity"
        style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10, marginRight: 12, textDecoration: 'none' }}>
        <div className="token-avatar" style={{ width: 34, height: 34, fontSize: 13, flexShrink: 0 }}>
          {token.logo_url
            ? <img src={token.logo_url} alt={token.symbol} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
            : <span>{token.symbol[0]}</span>}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', lineHeight: 1.25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 160 }}>
            {token.name}
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.42)', fontFamily: 'JetBrains Mono, monospace', lineHeight: 1.25 }}>
            ${token.symbol}
          </div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.22)', fontFamily: 'JetBrains Mono, monospace', lineHeight: 1.25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 140 }}>
            {fmtAddr(token.creator)}
          </div>
        </div>
      </Link>

      {/* MCap — 120px */}
      <div style={{ width: 120, flexShrink: 0, textAlign: 'right', paddingRight: 16 }}>
        <span style={{ fontSize: 13, fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, color: token.market_cap_usd > 0 ? '#fff' : '#252525' }}>
          {token.market_cap_usd > 0 ? fmtUsd(token.market_cap_usd) : 'N/A'}
        </span>
      </div>

      {/* Volume — 120px */}
      <div style={{ width: 120, flexShrink: 0, textAlign: 'right', paddingRight: 16 }}>
        <span style={{
          fontSize: 13, fontFamily: 'JetBrains Mono, monospace', fontWeight: 600,
          color: token.volume_24h_usd > 0 ? '#33ff80' : '#252525',
          textShadow: token.volume_24h_usd > 0 ? '0 0 8px rgba(26,255,110,0.22)' : 'none',
        }}>
          {token.volume_24h_usd > 0 ? fmtUsd(token.volume_24h_usd) : 'N/A'}
        </span>
      </div>

      {/* Txns — 80px */}
      <div style={{ width: 80, flexShrink: 0, textAlign: 'center' }}>
        {token.txns_24h > 0
          ? <span style={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, color: '#e8e8e8' }}>
              {token.txns_24h} <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: 400 }}>tx</span>
            </span>
          : <span style={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: '#252525' }}>N/A</span>
        }
      </div>

      {/* Age — 80px */}
      <div style={{ width: 80, flexShrink: 0, textAlign: 'center' }}>
        <span style={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, color: 'rgba(255,255,255,0.82)' }}>
          {fmtAge(token.launch_time)}
        </span>
      </div>

      {/* Trade — 90px */}
      <div style={{ width: 90, flexShrink: 0, textAlign: 'right' }}>
        <Link href={`/token/${token.id}`}
          style={{ fontSize: 13, fontWeight: 600, color: '#1aff6e', textDecoration: 'none', transition: 'all 0.15s', display: 'inline-block' }}
          onMouseEnter={e => { e.currentTarget.style.color = '#4dff99'; e.currentTarget.style.textShadow = '0 0 10px rgba(26,255,110,0.45)' }}
          onMouseLeave={e => { e.currentTarget.style.color = '#1aff6e'; e.currentTarget.style.textShadow = 'none' }}>
          Trade →
        </Link>
      </div>
    </div>
  )
}
