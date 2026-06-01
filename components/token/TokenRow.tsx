import Link from 'next/link'
import { fmtUsd, fmtAge, fmtAddr } from '@/hooks/useWallet'
import type { Token } from '@/lib/supabase'

interface Props { token: Token; rank: number }

export default function TokenRow({ token, rank }: Props) {
  return (
    <div className="token-row flex items-center px-6 py-4 w-full min-w-[900px]">

      {/* Rank */}
      <div className="w-8 shrink-0 text-[12px] text-muted font-mono">{rank}</div>

      {/* Token — clickable */}
      <Link href={`/token/${token.id}`} className="w-[200px] shrink-0 flex items-center gap-3 hover:opacity-80 transition-opacity">
        <div className="token-avatar shrink-0">
          {token.logo_url
            ? <img src={token.logo_url} alt={token.symbol} className="w-full h-full rounded-full object-cover" />
            : <span>{token.symbol[0]}</span>}
        </div>
        <div className="min-w-0">
          <div className="text-[14px] font-medium text-white truncate leading-snug">{token.name}</div>
          <div className="text-[12px] text-second font-mono">${token.symbol}</div>
        </div>
      </Link>

      {/* Creator — links to profile */}
      <div className="w-[130px] shrink-0">
        <Link href={`/profile/${token.creator}`}
          onClick={e => e.stopPropagation()}
          className="text-[12px] font-mono text-second hover:text-green transition-colors">
          {fmtAddr(token.creator)}
        </Link>
      </div>

      {/* Age */}
      <div className="w-[100px] shrink-0 text-[13px] text-second font-mono">
        {fmtAge(token.launch_time)}
      </div>

      {/* MCap */}
      <div className="w-[120px] shrink-0 text-[13px] font-mono text-white text-right pr-4">
        {fmtUsd(token.market_cap_usd)}
      </div>

      {/* Volume */}
      <div className={`w-[120px] shrink-0 text-[13px] font-mono text-right pr-4 ${token.volume_24h_usd > 0 ? 'text-green' : 'text-muted'}`}>
        {fmtUsd(token.volume_24h_usd)}
      </div>

      {/* Txns */}
      <div className="w-[70px] shrink-0 text-[13px] font-mono text-second text-right pr-4">
        {token.txns_24h > 0 ? token.txns_24h : '--'}
      </div>

      {/* Fees */}
      <div className={`w-[120px] shrink-0 text-[13px] font-mono text-right pr-4 ${(token.creator_fees_earned || 0) > 0 ? 'text-second' : 'text-muted'}`}>
        {fmtUsd(token.creator_fees_earned)}
      </div>

      {/* Trade */}
      <div className="flex-1 text-right">
        <Link href={`/token/${token.id}`} className="text-[13px] text-green font-medium hover:text-white transition-colors">
          Trade →
        </Link>
      </div>
    </div>
  )
}
