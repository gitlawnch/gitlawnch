import Link from 'next/link'
import { fmtUsd, fmtAge, fmtAddr, fmtNum } from '@/hooks/useWallet'
import type { Token } from '@/lib/supabase'

interface Props { token: Token; rank: number }

export default function TokenRow({ token, rank }: Props) {
  return (
    <div className="token-row flex items-center px-4 py-2.5 w-full min-w-[860px]">

      {/* Rank */}
      <div className="w-7 shrink-0 text-[11px] font-mono" style={{ color: '#2a2a2a' }}>{rank}</div>

      {/* Token — 190px */}
      <Link href={`/token/${token.id}`}
        className="w-[190px] shrink-0 flex items-center gap-2.5 hover:opacity-80 transition-opacity">
        <div className="token-avatar shrink-0" style={{ width: 30, height: 30, fontSize: 12 }}>
          {token.logo_url
            ? <img src={token.logo_url} alt={token.symbol} className="w-full h-full rounded-full object-cover" />
            : <span>{token.symbol[0]}</span>}
        </div>
        <div className="min-w-0">
          <div className="text-[13px] font-semibold truncate leading-tight" style={{ color: '#e8e8e8' }}>{token.name}</div>
          <div className="text-[10px] font-mono leading-tight" style={{ color: '#3a3a3a' }}>${token.symbol}</div>
        </div>
      </Link>

      {/* MCap — 110px — PRIMARY METRIC */}
      <div className="w-[110px] shrink-0 text-right pr-3">
        <div className="text-[13px] font-mono font-semibold" style={{ color: token.market_cap_usd > 0 ? '#e8e8e8' : '#2a2a2a' }}>
          {token.market_cap_usd > 0 ? fmtUsd(token.market_cap_usd) : '--'}
        </div>
      </div>

      {/* Volume — 110px — PRIMARY METRIC */}
      <div className="w-[110px] shrink-0 text-right pr-3">
        <div className="text-[13px] font-mono font-semibold" style={{ color: token.volume_24h_usd > 0 ? '#1aff6e' : '#2a2a2a', textShadow: token.volume_24h_usd > 0 ? '0 0 10px rgba(26,255,110,0.2)' : 'none' }}>
          {token.volume_24h_usd > 0 ? fmtUsd(token.volume_24h_usd) : '--'}
        </div>
      </div>

      {/* Creator — 110px */}
      <div className="w-[110px] shrink-0">
        <Link href={`/profile/${token.creator}`}
          onClick={e => e.stopPropagation()}
          className="text-[11px] font-mono transition-colors"
          style={{ color: '#3a3a3a' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#1aff6e')}
          onMouseLeave={e => (e.currentTarget.style.color = '#3a3a3a')}>
          {fmtAddr(token.creator)}
        </Link>
      </div>

      {/* Age — 80px */}
      <div className="w-[80px] shrink-0 text-[11px] font-mono" style={{ color: '#3a3a3a' }}>
        {fmtAge(token.launch_time)}
      </div>

      {/* Txns — 60px */}
      <div className="w-[60px] shrink-0 text-[12px] font-mono text-right pr-3" style={{ color: token.txns_24h > 0 ? '#666' : '#2a2a2a' }}>
        {token.txns_24h > 0 ? token.txns_24h : '--'}
      </div>

      {/* Fees — 100px */}
      <div className="w-[100px] shrink-0 text-[12px] font-mono text-right pr-3"
        style={{ color: (token.creator_fees_earned || 0) > 0 ? '#ffc832' : '#2a2a2a' }}>
        {(token.creator_fees_earned || 0) > 0 ? fmtUsd(token.creator_fees_earned) : '--'}
      </div>

      {/* Trade */}
      <div className="flex-1 text-right">
        <Link href={`/token/${token.id}`}
          className="text-[12px] font-semibold"
          style={{ color: '#1aff6e' }}
          onMouseEnter={e => { e.currentTarget.style.color = '#4dff99'; (e.currentTarget as HTMLElement).style.transform = 'translateX(2px)' }}
          onMouseLeave={e => { e.currentTarget.style.color = '#1aff6e'; (e.currentTarget as HTMLElement).style.transform = 'translateX(0)' }}>
          Trade →
        </Link>
      </div>
    </div>
  )
}
