import Link from 'next/link'
import { fmtUsd, fmtAge, fmtAddr } from '@/hooks/useWallet'
import type { Token } from '@/lib/supabase'

interface Props { token: Token; rank: number }

export default function TokenRow({ token, rank }: Props) {
  return (
    <div className="token-row flex items-center px-4 py-2.5 w-full min-w-[700px]"
      style={{ borderBottom: '1px solid rgba(26,255,110,0.06)' }}>

      {/* Rank */}
      <div className="w-6 shrink-0 text-[11px] font-mono" style={{ color: '#333' }}>{rank}</div>

      {/* Token cell — name + symbol + creator */}
      <Link href={`/token/${token.id}`}
        className="flex-1 min-w-0 flex items-center gap-2.5 hover:opacity-90 transition-opacity mr-2">
        <div className="token-avatar shrink-0" style={{ width: 32, height: 32, fontSize: 12 }}>
          {token.logo_url
            ? <img src={token.logo_url} alt={token.symbol} className="w-full h-full rounded-full object-cover" />
            : <span>{token.symbol[0]}</span>}
        </div>
        <div className="min-w-0">
          <div className="text-[13px] font-semibold truncate leading-tight" style={{ color: '#fff', fontWeight: 600 }}>
            {token.name}
          </div>
          <div className="text-[11px] font-mono leading-tight" style={{ color: 'rgba(255,255,255,0.5)' }}>
            ${token.symbol}
          </div>
          <div className="text-[10px] font-mono leading-tight truncate" style={{ color: 'rgba(255,255,255,0.35)', maxWidth: 130 }}>
            {fmtAddr(token.creator)}
          </div>
        </div>
      </Link>

      {/* MCap */}
      <div className="w-[120px] shrink-0 text-right pr-3">
        <span className="text-[13px] font-mono font-semibold" style={{ color: token.market_cap_usd > 0 ? '#fff' : '#333', fontWeight: 600 }}>
          {token.market_cap_usd > 0 ? fmtUsd(token.market_cap_usd) : 'N/A'}
        </span>
      </div>

      {/* Volume */}
      <div className="w-[120px] shrink-0 text-right pr-3">
        <span className="text-[13px] font-mono font-semibold"
          style={{ color: token.volume_24h_usd > 0 ? '#33ff80' : '#333', fontWeight: 600, textShadow: token.volume_24h_usd > 0 ? '0 0 12px rgba(26,255,110,0.3)' : 'none' }}>
          {token.volume_24h_usd > 0 ? fmtUsd(token.volume_24h_usd) : 'N/A'}
        </span>
      </div>

      {/* Txns */}
      <div className="w-[80px] shrink-0 text-center">
        <span className="text-[13px] font-mono" style={{ color: token.txns_24h > 0 ? '#fff' : '#333', fontWeight: 500 }}>
          {token.txns_24h > 0 ? token.txns_24h : 'N/A'}
        </span>
      </div>

      {/* Age */}
      <div className="w-[80px] shrink-0 text-center">
        <span className="text-[12px] font-mono" style={{ color: 'rgba(255,255,255,0.7)' }}>
          {fmtAge(token.launch_time)}
        </span>
      </div>

      {/* Trade */}
      <div className="w-[100px] shrink-0 text-right">
        <Link href={`/token/${token.id}`}
          className="inline-flex items-center gap-1 text-[13px] font-semibold transition-all"
          style={{ color: '#1aff6e', fontWeight: 600 }}
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
