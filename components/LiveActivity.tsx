'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { fmtAddr, fmtAge } from '@/hooks/useWallet'

const MIN_USD = 10

interface Event {
  id: string
  type: 'buy' | 'sell' | 'claim' | 'launch'
  symbol: string
  logo_url?: string
  wallet: string
  usd: number
  time: number
  isNew?: boolean
}

function fmtUsdShort(v: number) {
  if (v >= 1000) return '$' + (v / 1000).toFixed(1) + 'K'
  return '$' + v.toFixed(2)
}

const TYPE_CONFIG = {
  buy:    { label: 'BUY',    color: '#1aff6e', bg: 'rgba(26,255,110,0.08)',  border: 'rgba(26,255,110,0.2)',  dot: '#1aff6e' },
  sell:   { label: 'SELL',   color: '#ff4646', bg: 'rgba(255,70,70,0.07)',   border: 'rgba(255,70,70,0.2)',   dot: '#ff4646' },
  claim:  { label: 'CLAIM',  color: '#a064ff', bg: 'rgba(160,100,255,0.07)', border: 'rgba(160,100,255,0.2)', dot: '#a064ff' },
  launch: { label: 'LAUNCH', color: '#00d4ff', bg: 'rgba(0,212,255,0.07)',   border: 'rgba(0,212,255,0.2)',   dot: '#00d4ff' },
}

export default function LiveActivity() {
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadEvents()

    const sub = supabase.channel('live-activity')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'swaps' },
        async payload => {
          const s = payload.new as any
          const { data: wethData } = await supabase.from('weth_price').select('price_usd').eq('id', 'latest').single()
          const wethUsd = (wethData as any)?.price_usd ?? 2000
          const amtEth = Number(s.amount_in) / 1e18
          const usd = s.is_buy ? amtEth * wethUsd : amtEth * (s.price_usd || 0)
          if (usd < MIN_USD) return

          const { data: tok } = await supabase
            .from('tokens')
            .select('symbol, token_metadata(logo_url)')
            .eq('id', s.token_id)
            .single()

          const newEv: Event = {
            id: s.id,
            type: s.is_buy ? 'buy' : 'sell',
            symbol: (tok as any)?.symbol || '???',
            logo_url: (tok as any)?.token_metadata?.logo_url,
            wallet: s.sender || '0x????',
            usd,
            time: s.timestamp || Math.floor(Date.now() / 1000),
            isNew: true,
          }
          setEvents(prev => [newEv, ...prev].slice(0, 20))
          setTimeout(() => {
            setEvents(prev => prev.map(e => e.id === newEv.id ? { ...e, isNew: false } : e))
          }, 600)
        })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tokens' },
        payload => {
          const t = payload.new as any
          const newEv: Event = {
            id: 'launch-' + t.id,
            type: 'launch',
            symbol: t.symbol || '???',
            wallet: t.creator || '0x????',
            usd: 0,
            time: t.launch_time || Math.floor(Date.now() / 1000),
            isNew: true,
          }
          setEvents(prev => [newEv, ...prev].slice(0, 20))
          setTimeout(() => {
            setEvents(prev => prev.map(e => e.id === newEv.id ? { ...e, isNew: false } : e))
          }, 600)
        })
      .subscribe()

    return () => { supabase.removeChannel(sub) }
  }, [])

  async function loadEvents() {
    setLoading(true)
    try {
      const { data: wethData } = await supabase.from('weth_price').select('price_usd').eq('id', 'latest').single()
      const wethUsd = (wethData as any)?.price_usd ?? 2000

      const { data: swaps } = await supabase
        .from('swaps')
        .select('id, token_id, is_buy, sender, amount_in, price_usd, timestamp, tokens(symbol, token_metadata(logo_url))')
        .order('timestamp', { ascending: false })
        .limit(100)

      const { data: newTokens } = await supabase
        .from('tokens')
        .select('id, symbol, creator, launch_time, token_metadata(logo_url)')
        .order('launch_time', { ascending: false })
        .limit(10)

      const evts: Event[] = []

      for (const s of (swaps || [])) {
        const amtEth = Number(s.amount_in) / 1e18
        const usd = s.is_buy ? amtEth * wethUsd : amtEth * ((s.price_usd as number) || 0)
        if (usd < MIN_USD) continue
        evts.push({
          id: s.id,
          type: s.is_buy ? 'buy' : 'sell',
          symbol: (s.tokens as any)?.symbol || '???',
          logo_url: (s.tokens as any)?.token_metadata?.logo_url,
          wallet: (s.sender as string) || '0x????',
          usd,
          time: (s.timestamp as number) || 0,
        })
      }

      for (const t of (newTokens || [])) {
        evts.push({
          id: 'launch-' + t.id,
          type: 'launch',
          symbol: t.symbol || '???',
          logo_url: (t.token_metadata as any)?.logo_url,
          wallet: t.creator || '0x????',
          usd: 0,
          time: t.launch_time || 0,
        })
      }

      evts.sort((a, b) => b.time - a.time)
      setEvents(evts.slice(0, 20))
    } catch (e) { console.warn('loadEvents failed:', e) }
    finally { setLoading(false) }
  }

  if (loading && events.length === 0) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px 0', gap: 8, fontSize: 13, color: '#555' }}>
      <div style={{ width: 14, height: 14, border: '2px solid #1aff6e', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      Loading activity...
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  if (events.length === 0) return null

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="live-dot" style={{ width: 6, height: 6 }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'JetBrains Mono, monospace' }}>
            Live Activity
          </span>
        </div>
        <span style={{ fontSize: 11, color: '#333', fontFamily: 'JetBrains Mono, monospace' }}>min $10</span>
      </div>

      <div className="glass" style={{
        overflow: 'hidden',
        background: 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)',
      }}>
        {events.map((ev, i) => {
          const cfg = TYPE_CONFIG[ev.type]
          const wallet = ev.wallet.length >= 10
            ? ev.wallet.slice(0, 6) + '...' + ev.wallet.slice(-4)
            : ev.wallet
          return (
            <div key={ev.id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 14px',
              borderBottom: i < events.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
              background: ev.isNew ? 'rgba(26,255,110,0.04)' : 'transparent',
              transition: 'background 0.4s',
              animation: ev.isNew ? 'slideInRow 0.35s cubic-bezier(.16,1,.3,1)' : 'none',
            }}>
              {/* Type badge */}
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                background: cfg.bg, border: `1px solid ${cfg.border}`,
                borderRadius: 6, padding: '2px 7px', flexShrink: 0,
              }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: cfg.dot, boxShadow: `0 0 4px ${cfg.dot}`, flexShrink: 0 }} />
                <span style={{ fontSize: 10, fontWeight: 700, color: cfg.color, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.06em' }}>
                  {cfg.label}
                </span>
              </div>

              {/* Token avatar */}
              {ev.logo_url
                ? <img src={ev.logo_url} alt={ev.symbol} style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '1px solid rgba(255,255,255,0.1)' }} />
                : <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(26,255,110,0.1)', border: '1px solid rgba(26,255,110,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#1aff6e', flexShrink: 0 }}>
                    {ev.symbol[0]}
                  </div>
              }

              {/* Symbol */}
              <span style={{ fontSize: 13, fontWeight: 700, color: '#e8e8e8', fontFamily: 'JetBrains Mono, monospace', minWidth: 60 }}>
                ${ev.symbol}
              </span>

              {/* Wallet */}
              <span style={{ fontSize: 12, color: '#444', fontFamily: 'JetBrains Mono, monospace', flex: 1 }}>
                by {wallet}
              </span>

              {/* Amount */}
              {ev.usd >= MIN_USD && (
                <span style={{ fontSize: 13, fontWeight: 700, color: cfg.color, fontFamily: 'JetBrains Mono, monospace', flexShrink: 0 }}>
                  {fmtUsdShort(ev.usd)}
                </span>
              )}

              {/* Time */}
              <span style={{ fontSize: 11, color: '#333', fontFamily: 'JetBrains Mono, monospace', flexShrink: 0, marginLeft: 4 }}>
                {fmtAge(ev.time)}
              </span>
            </div>
          )
        })}
      </div>

      <style>{`
        @keyframes slideInRow {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
