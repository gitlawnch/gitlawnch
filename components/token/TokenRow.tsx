import Link from 'next/link'
import { fmtUsd, fmtAge, fmtAddr } from '@/hooks/useWallet'
import type { Token } from '@/lib/supabase'

interface Props { token: Token; rank: number }

export default function TokenRow({ token, rank }: Props) {
  return (
    <div className="token-row flex items-center px-4 py-2.5 w-full min-w-[640px]">

      {/* Rank */}
      <div className="w-6 shrink-0 text-[11px] font-mono text-center" style={{ color: '#2a2a2a' }}>{rank}</div>

      {/* Token cell — name + symbol + creator CA */}
      <Link href={`/token/${token.id}`}
        className="flex-1 min-w-0 flex items-center gap-2.5 hover:opacity-90 transition-opacity" style={{ marginRight: 8 }}>
        <div className="token-avatar shrink-0" style={{ width: 34, height: 34, fontSize: 13 }}>
          {token.logo_url
            ? <img src={token.logo_url} alt={token.symbol} className="w-full h-full rounded-full object-cover" />
            : <span>{token.symbol[0]}</span>}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 160 }}>
            {token.name}
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontFamily: 'JetBrains Mono, monospace', lineHeight: 1.3 }}>
            ${token.symbol}
          </div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', fontFamily: 'JetBrains Mono, monospace', lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 160 }}>
            {fmtAddr(token.creator)}
          </div>
        </div>
      </Link>

      {/* MCap */}
      <div style={{ width: 110, flexShrink: 0, textAlign: 'right', paddingRight: 12 }}>
        <span style={{ fontSize: 13, fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, color: token.market_cap_usd > 0 ? '#fff' : '#2a2a2a' }}>
          {token.market_cap_usd > 0 ? fmtUsd(token.market_cap_usd) : 'N/A'}
        </span>
      </div>

      {/* Volume */}
      <div style={{ width: 110, flexShrink: 0, textAlign: 'right', paddingRight: 12 }}>
        <span style={{
          fontSize: 13, fontFamily: 'JetBrains Mono, monospace', fontWeight: 600,
          color: token.volume_24h_usd > 0 ? '#33ff80' : '#2a2a2a',
          textShadow: token.volume_24h_usd > 0 ? '0 0 10px rgba(26,255,110,0.25)' : 'none',
        }}>
          {token.volume_24h_usd > 0 ? fmtUsd(token.volume_24h_usd) : 'N/A'}
        </span>
      </div>

      {/* Txns */}
      <div style={{ width: 70, flexShrink: 0, textAlign: 'center' }}>
        <span style={{ fontSize: 13, fontFamily: 'JetBrains Mono, monospace', fontWeight: 500, color: token.txns_24h > 0 ? '#e8e8e8' : '#2a2a2a' }}>
          {token.txns_24h > 0 ? token.txns_24h : 'N/A'}
        </span>
      </div>

      {/* Age */}
      <div style={{ width: 70, flexShrink: 0, textAlign: 'center' }}>
        <span style={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: 'rgba(255,255,255,0.65)' }}>
          {fmtAge(token.launch_time)}
        </span>
      </div>

      {/* Trade */}
      <div style={{ width: 90, flexShrink: 0, textAlign: 'right' }}>
        <Link href={`/token/${token.id}`}
          style={{ fontSize: 13, fontWeight: 600, color: '#1aff6e', textDecoration: 'none', transition: 'all 0.15s' }}
          onMouseEnter={e => {
            e.currentTarget.style.color = '#4dff99'
            e.currentTarget.style.textShadow = '0 0 10px rgba(26,255,110,0.5)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.color = '#1aff6e'
            e.currentTarget.style.textShadow = 'none'
          }}>
          Trade →
        </Link>
      </div>
    </div>
  )
}
