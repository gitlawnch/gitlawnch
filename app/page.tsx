'use client'
import { useState, useEffect } from 'react'
import { getNewTokens, getTrendingTokens, getTopVolumeTokens, getStats, supabase, type Token } from '@/lib/supabase'
import TokenRow from '@/components/token/TokenRow'

type Tab = 'new' | 'trending' | 'volume'

export default function FeedPage() {
  const [tab,     setTab]     = useState<Tab>('new')
  const [tokens,  setTokens]  = useState<Token[]>([])
  const [loading, setLoading] = useState(true)
  const [stats,   setStats]   = useState({ totalTokens: 0, totalSwaps: 0, wethPrice: 0, lastBlock: 0 })

  useEffect(() => {
    loadTokens()
    loadStats()

    const sub = supabase.channel('tokens-feed')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tokens' },
        async payload => {
          if (tab !== 'new') return
          const { getToken } = await import('@/lib/supabase')
          const t = await getToken(payload.new.id)
          if (t) setTokens(prev => [t, ...prev.filter(x => x.id !== t.id)].slice(0, 50))
        })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tokens' },
        payload => setTokens(prev => prev.map(t => t.id === payload.new.id ? { ...t, ...payload.new } : t)))
      .subscribe()
    return () => { supabase.removeChannel(sub) }
  }, [tab])

  async function loadTokens() {
    setLoading(true)
    let data: Token[] = []
    if (tab === 'new')      data = await getNewTokens(50)
    if (tab === 'trending') data = await getTrendingTokens(50)
    if (tab === 'volume')   data = await getTopVolumeTokens(50)
    setTokens(data)
    setLoading(false)
  }

  async function loadStats() {
    const s = await getStats()
    setStats(s)
  }

  const tabs = [
    { id: 'new'      as Tab, label: 'New',        emoji: '🌱' },
    { id: 'trending' as Tab, label: 'Trending',   emoji: '🔥' },
    { id: 'volume'   as Tab, label: 'Top Volume', emoji: '📊' },
  ]

  return (
    <div className="min-h-screen pt-20">

      {/* Stats bar */}
      <div className="border-b border-[rgba(0,255,135,0.06)] bg-[rgba(10,21,32,0.5)]">
        <div className="max-w-[1400px] mx-auto px-4 py-3 flex items-center gap-8 overflow-x-auto">
          <div className="flex items-center gap-2 shrink-0">
            <div className="live-dot" />
            <span className="text-[11px] text-second font-mono">LIVE · Base Mainnet</span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-[11px] text-muted font-mono">TOKENS</span>
            <span className="text-[11px] text-white font-mono ml-1">{stats.totalTokens.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-[11px] text-muted font-mono">TRADES</span>
            <span className="text-[11px] text-white font-mono ml-1">{stats.totalSwaps.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-[11px] text-muted font-mono">ETH</span>
            <span className="text-[11px] text-green font-mono ml-1">
              {stats.wethPrice > 0 ? `$${stats.wethPrice.toFixed(2)}` : '--'}
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0 ml-auto">
            <span className="text-[11px] text-muted font-mono">BLOCK</span>
            <span className="text-[11px] text-second font-mono ml-1">#{stats.lastBlock.toLocaleString()}</span>
          </div>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-4 py-6">

        {/* Tabs */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div className="flex items-center gap-2">
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-medium transition-all ${
                  tab === t.id ? 'tab-active' : 'tab-inactive'
                }`}>
                <span>{t.emoji}</span>{t.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 text-[12px] text-second font-mono">
            <div className="live-dot" /> Real-time
          </div>
        </div>

        {/* Table */}
        <div className="glass overflow-x-auto">

          {/* Header — must exactly match TokenRow widths */}
          <div className="flex items-center px-6 py-2.5 border-b border-[rgba(255,255,255,0.04)] min-w-[900px]">
            <div className="w-8 shrink-0" />
            <div className="w-[200px] shrink-0 text-[11px] text-muted uppercase tracking-wider font-mono">Token</div>
            <div className="w-[130px] shrink-0 text-[11px] text-muted uppercase tracking-wider font-mono">Creator</div>
            <div className="w-[100px] shrink-0 text-[11px] text-muted uppercase tracking-wider font-mono">Age</div>
            <div className="w-[120px] shrink-0 text-[11px] text-muted uppercase tracking-wider font-mono text-right pr-4">MCap</div>
            <div className="w-[120px] shrink-0 text-[11px] text-muted uppercase tracking-wider font-mono text-right pr-4">Volume</div>
            <div className="w-[70px] shrink-0 text-[11px] text-muted uppercase tracking-wider font-mono text-right pr-4">Txns</div>
            <div className="w-[120px] shrink-0 text-[11px] text-muted uppercase tracking-wider font-mono text-right pr-4">Fees</div>
            <div className="flex-1 text-[11px] text-muted uppercase tracking-wider font-mono text-right">Trade</div>
          </div>

          {loading ? (
            <div className="py-20 text-center min-w-[900px]">
              <div className="inline-flex items-center gap-2 text-second text-[13px]">
                <div className="w-4 h-4 border-2 border-[#00ff87] border-t-transparent rounded-full animate-spin" />
                Loading tokens…
              </div>
            </div>
          ) : tokens.length === 0 ? (
            <div className="py-20 text-center min-w-[900px]">
              <div className="text-4xl mb-3">🌱</div>
              <div className="text-[14px] text-second">No tokens yet. Be the first to launch!</div>
            </div>
          ) : (
            <div className="min-w-[900px]">
              {tokens.map((t, i) => <TokenRow key={t.id} token={t} rank={i + 1} />)}
            </div>
          )}
        </div>

        <div className="mt-2 text-[11px] text-muted font-mono">
          {tab === 'new'       ? 'New Pairs · Latest tokens launched on gitlawnch'
          : tab === 'trending' ? 'Trending · Most active in 24h'
          : 'Top Volume · Highest all-time volume'}
        </div>
      </div>
    </div>
  )
}
