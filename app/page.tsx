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
  const [volume24h,  setVolume24h]  = useState(0)
  const [creatorFees, setCreatorFees] = useState(0)
  const [counted, setCounted] = useState(false)

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

  // Count-up animation trigger
  useEffect(() => {
    if (stats.totalTokens > 0 && !counted) setCounted(true)
  }, [stats])

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
    // Fetch 24h volume and creator fees
    try {
      const { data: volData } = await supabase
        .from('tokens')
        .select('volume_24h_usd, creator_fees_earned')
      if (volData) {
        const totalVol = volData.reduce((sum: number, t: any) => sum + (t.volume_24h_usd || 0), 0)
        const totalFees = volData.reduce((sum: number, t: any) => sum + (t.creator_fees_earned || 0), 0)
        setVolume24h(totalVol)
        setCreatorFees(totalFees)
      }
    } catch {}
  }

  const tabs = [
    { id: 'new'      as Tab, label: 'New',        emoji: '🌱' },
    { id: 'trending' as Tab, label: 'Trending',   emoji: '🔥' },
    { id: 'volume'   as Tab, label: 'Top Volume', emoji: '📊' },
  ]


  function fmtStatUsd(v: number) {
    if (!v || v < 1) return '--'
    if (v >= 1000000) return '$' + (v / 1000000).toFixed(2) + 'M'
    if (v >= 1000) return '$' + (v / 1000).toFixed(2) + 'K'
    return '$' + v.toFixed(2)
  }

  const GRID = '24px 1fr 120px 120px 80px 80px 100px'

  return (
    <div className="min-h-screen">

      {/* ── Hero ── */}
      <div style={{
        textAlign: 'center',
        padding: '18px 24px 14px',
        borderBottom: '1px solid rgba(26,255,110,0.06)',
        position: 'relative', zIndex: 1,
      }}>
        {/* Live badge */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 7,
          background: 'rgba(26,255,110,0.07)', border: '1px solid rgba(26,255,110,0.18)',
          borderRadius: 20, padding: '5px 14px', fontSize: 12,
          color: '#1aff6e', fontWeight: 500, marginBottom: 16,
          boxShadow: '0 0 16px rgba(26,255,110,0.07)',
        }}>
          <div className="live-dot" style={{ width: 6, height: 6 }} />
          Live on Base Mainnet
        </div>

        <h1 style={{
          fontSize: 18, fontWeight: 700, color: '#e8e8e8',
          lineHeight: 1.18, letterSpacing: '-2px', marginBottom: 18,
        }}>
          Launch tokens on{' '}
          <span style={{ color: '#1aff6e', textShadow: '0 0 28px rgba(26,255,110,0.35)' }}>Base</span>
          {' '}in seconds
        </h1>

        <p style={{
          fontSize: 15, color: '#555', lineHeight: 1.6,
          maxWidth: 500, margin: '0 auto 16px',
        }}>
          Instant Uniswap V4 pool. 100B fixed supply.<br />
          1% trading fee — 80% goes to you, forever.
        </p>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button
            onClick={() => document.dispatchEvent(new CustomEvent('open-launch'))}
            className="btn-green"
            style={{ fontSize: 13, padding: '8px 22px' }}>
            🚀 Launch a Token
          </button>
          <a href="/about" style={{
            fontSize: 14, padding: '11px 28px', borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.08)', color: '#666',
            background: 'transparent', cursor: 'pointer', textDecoration: 'none',
            display: 'inline-flex', alignItems: 'center', transition: 'all 0.2s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.18)'; (e.currentTarget as HTMLElement).style.color = '#aaa' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)'; (e.currentTarget as HTMLElement).style.color = '#666' }}>
            How it works
          </a>
        </div>
      </div>

      {/* ── Stats cards ── */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3,1fr)',
        gap: 8, padding: '8px 24px 0',
        maxWidth: 1400, margin: '0 auto',
        position: 'relative', zIndex: 1,
      }}>
        {[
        {
          label: 'Total Tokens Created',
          value: stats.totalTokens > 0 ? stats.totalTokens.toLocaleString() : '--',
          sub: 'All time on Base',
          color: '#e8e8e8', glow: false,
        },
        {
          label: '24h Volume',
          value: fmtStatUsd(volume24h),
          sub: 'Trading volume today',
          color: '#1aff6e', glow: true,
        },
        {
          label: 'Creator Earnings',
          value: fmtStatUsd(creatorFees),
          sub: '80% fees to creators',
          color: '#ffc832', glow: false,
        },
        ].map(s => (
          <div key={s.label} style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 10, padding: '10px 14px',
            backdropFilter: 'blur(12px)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 4px 24px rgba(0,0,0,0.3)',
            transition: 'all 0.3s',
            position: 'relative', overflow: 'hidden',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = 'rgba(26,255,110,0.3)'
            e.currentTarget.style.boxShadow = 'inset 0 1px 0 rgba(26,255,110,0.1), 0 4px 24px rgba(26,255,110,0.08)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
            e.currentTarget.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.06), 0 4px 24px rgba(0,0,0,0.3)'
          }}>
            <div style={{
              fontSize: 10, color: '#555', textTransform: 'uppercase',
              letterSpacing: '0.12em', marginBottom: 8, fontWeight: 600,
            }}>{s.label}</div>
            <div style={{
              fontSize: 18, fontWeight: 700, letterSpacing: '-0.5px',
              fontVariantNumeric: 'tabular-nums',
              color: s.color || '#e8e8e8',
              textShadow: s.glow ? '0 0 20px rgba(26,255,110,0.3)' : 'none',
            }}>
              {s.value || '--'}
            </div>
          </div>
        ))}
      </div>
      {/* ── Feed ── */}
      <div className="max-w-[1400px] mx-auto px-4 pt-3 pb-4" style={{ position: 'relative', zIndex: 1 }}>
        {/* Tabs */}
        <div className="flex items-center justify-between mb-2 flex-wrap gap-4">
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
        <div className="glass overflow-hidden overflow-x-auto" style={{border:"1px solid rgba(26,255,110,0.15)"}}>
          <div className="grid items-center px-4 py-2.5 min-w-[700px]" style={{borderBottom:"1px solid rgba(26,255,110,0.08)",background:"rgba(255,255,255,0.03)", gridTemplateColumns: GRID}}>
            <span />
            <span style={{fontSize:10,color:'rgba(255,255,255,0.75)',textTransform:'uppercase',letterSpacing:'0.09em',fontWeight:600,fontFamily:'JetBrains Mono,monospace'}}>Token</span>
            <span style={{fontSize:10,color:'rgba(255,255,255,0.75)',textTransform:'uppercase',letterSpacing:'0.09em',fontWeight:600,fontFamily:'JetBrains Mono,monospace',textAlign:'right',paddingRight:12}}>MCap</span>
            <span style={{fontSize:10,color:'rgba(255,255,255,0.75)',textTransform:'uppercase',letterSpacing:'0.09em',fontWeight:600,fontFamily:'JetBrains Mono,monospace',textAlign:'right',paddingRight:12}}>Volume</span>
            <span style={{fontSize:10,color:'rgba(255,255,255,0.75)',textTransform:'uppercase',letterSpacing:'0.09em',fontWeight:600,fontFamily:'JetBrains Mono,monospace',textAlign:'center'}}>Txns</span>
            <span style={{fontSize:10,color:'rgba(255,255,255,0.75)',textTransform:'uppercase',letterSpacing:'0.09em',fontWeight:600,fontFamily:'JetBrains Mono,monospace',textAlign:'center'}}>Age</span>
            <span style={{fontSize:10,color:'rgba(255,255,255,0.75)',textTransform:'uppercase',letterSpacing:'0.09em',fontWeight:600,fontFamily:'JetBrains Mono,monospace',textAlign:'right'}}>Trade</span>
          </div>

          {loading ? (
            <div className="py-20 text-center">
              <div className="inline-flex items-center gap-2 text-second text-[13px]">
                <div className="w-4 h-4 border-2 border-[#1aff6e] border-t-transparent rounded-full animate-spin" />
                Loading tokens...
              </div>
            </div>
          ) : tokens.length === 0 ? (
            <div className="py-20 text-center">
              <div className="text-4xl mb-3">🌱</div>
              <div className="text-[14px] text-second">No tokens yet. Be the first to launch!</div>
            </div>
          ) : (
            <div className="min-w-[700px]">
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
