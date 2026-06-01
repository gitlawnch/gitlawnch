'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

const MIN_USD = 10

interface TickerEvent {
  id: string
  type: 'buy' | 'sell' | 'claim' | 'launch'
  symbol: string
  logo_url?: string
  wallet: string
  usd: number
  token_id: string
}

const CFG = {
  buy:    { emoji: '🟢', label: 'Buy',      color: '#1aff6e', bg: 'rgba(26,255,110,0.08)',  border: 'rgba(26,255,110,0.2)'  },
  sell:   { emoji: '🔴', label: 'Sell',     color: '#ff4646', bg: 'rgba(255,70,70,0.07)',   border: 'rgba(255,70,70,0.2)'   },
  claim:  { emoji: '🟣', label: 'Claimed',  color: '#a064ff', bg: 'rgba(160,100,255,0.08)', border: 'rgba(160,100,255,0.2)' },
  launch: { emoji: '🚀', label: 'Launched', color: '#00d4ff', bg: 'rgba(0,212,255,0.07)',   border: 'rgba(0,212,255,0.2)'   },
}

function fmtShort(v: number) {
  if (v >= 1000) return '$' + (v / 1000).toFixed(1) + 'K'
  return '$' + v.toFixed(2)
}

export default function ActivityTicker() {
  const [events, setEvents] = useState<TickerEvent[]>([])
  const [wethUsd, setWethUsd] = useState(2000)

  useEffect(() => {
    loadInitial()
    const sub = supabase.channel('ticker-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'swaps' },
        async (payload) => {
          const s = payload.new as any
          const amt = Number(s.amount_in) / 1e18
          const usd = s.is_buy ? amt * wethUsd : amt * (s.price_usd || 0)
          if (usd < MIN_USD) return
          const { data: tok } = await supabase
            .from('tokens').select('symbol, token_metadata(logo_url)').eq('id', s.token_id).single()
          const ev: TickerEvent = {
            id: s.id,
            type: s.is_buy ? 'buy' : 'sell',
            symbol: (tok as any)?.symbol || '???',
            logo_url: (tok as any)?.token_metadata?.logo_url,
            wallet: s.sender || '0x????',
            usd, token_id: s.token_id,
          }
          setEvents(prev => [ev, ...prev].slice(0, 30))
        })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tokens' },
        (payload) => {
          const t = payload.new as any
          const ev: TickerEvent = {
            id: 'launch-' + t.id,
            type: 'launch',
            symbol: t.symbol || '???',
            logo_url: undefined,
            wallet: t.creator || '0x????',
            usd: 0, token_id: t.id,
          }
          setEvents(prev => [ev, ...prev].slice(0, 30))
        })
      .subscribe()
    return () => { supabase.removeChannel(sub) }
  }, [wethUsd])

  async function loadInitial() {
    try {
      const { data: wd } = await supabase.from('weth_price').select('price_usd').eq('id', 'latest').single()
      const wp = (wd as any)?.price_usd ?? 2000
      setWethUsd(wp)

      const { data: swaps } = await supabase
        .from('swaps')
        .select('id, token_id, is_buy, sender, amount_in, price_usd, tokens(symbol, token_metadata(logo_url))')
        .order('timestamp', { ascending: false })
        .limit(100)

      const { data: launches } = await supabase
        .from('tokens')
        .select('id, symbol, creator, token_metadata(logo_url)')
        .order('launch_time', { ascending: false })
        .limit(10)

      const evts: TickerEvent[] = []

      for (const s of (swaps || [])) {
        const amt = Number(s.amount_in) / 1e18
        const usd = s.is_buy ? amt * wp : amt * ((s.price_usd as number) || 0)
        if (usd < MIN_USD) continue
        evts.push({
          id: s.id,
          type: s.is_buy ? 'buy' : 'sell',
          symbol: (s.tokens as any)?.symbol || '???',
          logo_url: (s.tokens as any)?.token_metadata?.logo_url,
          wallet: (s.sender as string) || '0x????',
          usd, token_id: s.token_id,
        })
      }

      for (const t of (launches || [])) {
        evts.push({
          id: 'launch-' + t.id,
          type: 'launch',
          symbol: t.symbol || '???',
          logo_url: (t.token_metadata as any)?.logo_url,
          wallet: t.creator || '0x????',
          usd: 0, token_id: t.id,
        })
      }

      setEvents(evts.slice(0, 30))
    } catch (e) { console.warn('ticker load failed:', e) }
  }

  if (events.length === 0) return null

  // Duplicate for seamless loop
  const items = [...events, ...events]

  return (
    <>
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0,
        height: 32, zIndex: 100,
        background: 'rgba(10,10,10,0.95)',
        borderBottom: '1px solid rgba(26,255,110,0.08)',
        backdropFilter: 'blur(10px)',
        overflow: 'hidden',
        display: 'flex', alignItems: 'center',
      }}>
        {/* Fade left */}
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 48, background: 'linear-gradient(90deg, rgba(10,10,10,1), transparent)', zIndex: 2, pointerEvents: 'none' }} />
        {/* Fade right */}
        <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 48, background: 'linear-gradient(-90deg, rgba(10,10,10,1), transparent)', zIndex: 2, pointerEvents: 'none' }} />

        <div
          style={{
            display: 'flex', alignItems: 'center',
            animation: 'tickerMove 40s linear infinite',
            whiteSpace: 'nowrap', willChange: 'transform',
          }}
          onMouseEnter={e => (e.currentTarget.style.animationPlayState = 'paused')}
          onMouseLeave={e => (e.currentTarget.style.animationPlayState = 'running')}
        >
          {items.map((ev, i) => {
            const cfg = CFG[ev.type]
            const wallet = ev.wallet.slice(0, 6) + '...' + ev.wallet.slice(-4)
            return (
              <a
                key={`${ev.id}-${i}`}
                href={`/token/${ev.token_id}`}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '3px 10px', margin: '0 4px',
                  background: cfg.bg, border: `1px solid ${cfg.border}`,
                  borderRadius: 20, textDecoration: 'none',
                  cursor: 'pointer', flexShrink: 0,
                  transition: 'opacity 0.2s',
                }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '0.75')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
              >
                <span style={{ fontSize: 11 }}>{cfg.emoji}</span>
                {ev.logo_url
                  ? <img src={ev.logo_url} alt={ev.symbol} style={{ width: 16, height: 16, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                  : <div style={{ width: 16, height: 16, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: cfg.color, fontWeight: 700, flexShrink: 0 }}>{ev.symbol[0]}</div>
                }
                <span style={{ fontSize: 11, fontWeight: 700, color: cfg.color, fontFamily: 'JetBrains Mono, monospace' }}>
                  {ev.symbol}
                </span>
                <span style={{ fontSize: 11, color: '#555', fontFamily: 'JetBrains Mono, monospace' }}>
                  {wallet}
                </span>
                <span style={{ fontSize: 11, color: '#444', fontFamily: 'JetBrains Mono, monospace' }}>
                  {cfg.label}
                </span>
                {ev.usd >= MIN_USD && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: cfg.color, fontFamily: 'JetBrains Mono, monospace' }}>
                    {fmtShort(ev.usd)}
                  </span>
                )}
              </a>
            )
          })}
        </div>
      </div>

      <style>{`
        @keyframes tickerMove {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </>
  )
}
