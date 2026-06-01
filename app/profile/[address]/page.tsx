'use client'
import { use, useState, useEffect } from 'react'
import Link from 'next/link'
import { useWallet, CFG, ABI, getContract, fmtAge, fmtUsd, fmtNum, fmtAddr } from '@/hooks/useWallet'
import { getCreatorTokens, getNewTokens, supabase, type Token, type Swap } from '@/lib/supabase'

interface HeldToken { token: Token; balance: bigint; valueUsd: number }
interface Activity {
  id: string
  type: 'swap' | 'claim'
  token_id: string
  token_name?: string
  token_symbol?: string
  is_buy?: boolean
  amount_in?: string
  price_usd?: number
  timestamp: number
  tx_hash: string
}

type Tab = 'holdings' | 'launched' | 'activity'

export default function ProfilePage({ params }: { params: Promise<{ address: string }> }) {
  const { address } = use(params)
  const { account } = useWallet()

  const [tab,         setTab]         = useState<Tab>('holdings')
  const [held,        setHeld]        = useState<HeldToken[]>([])
  const [launched,    setLaunched]    = useState<Token[]>([])
  const [activity,    setActivity]    = useState<Activity[]>([])
  const [totalValue,  setTotalValue]  = useState(0)
  const [totalFees,   setTotalFees]   = useState(0)
  const [loadingHeld, setLoadingHeld] = useState(true)
  const [loadingLaunch, setLoadingLaunch] = useState(true)
  const [loadingActivity, setLoadingActivity] = useState(true)
  const [copied, setCopied] = useState(false)

  const isOwnProfile = account?.toLowerCase() === address?.toLowerCase()

  useEffect(() => {
    if (!address) return
    loadHoldings()
    loadLaunched()
    loadActivity()
  }, [address])

  async function loadHoldings() {
    setLoadingHeld(true)
    try {
      const { ethers } = await import('ethers')
      const allTokens = await getNewTokens(100)
      if (allTokens.length === 0) { setLoadingHeld(false); return }

      // Multicall3 - batch all balanceOf in 1 request
      const mc = await getContract(
        '0xcA11bde05977b3631167028862bE2a173976CA11',
        ['function aggregate3((address target,bool allowFailure,bytes callData)[] calls) view returns ((bool success,bytes returnData)[] returnData)']
      )
      const iface = new ethers.Interface(['function balanceOf(address account) view returns (uint256)'])

      const calls = allTokens.map(t => ({
        target:       t.id,
        allowFailure: true,
        callData:     iface.encodeFunctionData('balanceOf', [address]),
      }))

      const results = await mc.aggregate3.staticCall(calls)
      const held: HeldToken[] = []

      results.forEach((r: any, i: number) => {
        if (!r.success || !r.returnData || r.returnData === '0x') return
        try {
          const [bal] = iface.decodeFunctionResult('balanceOf', r.returnData)
          const balance = BigInt(bal.toString())
          if (balance === 0n) return
          const t = allTokens[i]
          const balFloat = Number(balance) / 1e18
          const valueUsd = balFloat * (t.price_usd || 0)
          held.push({ token: t, balance, valueUsd })
        } catch {}
      })

      held.sort((a, b) => b.valueUsd - a.valueUsd)
      setHeld(held)
      setTotalValue(held.reduce((s, r) => s + r.valueUsd, 0))
    } catch (e) { console.error('loadHoldings failed:', e) }
    finally { setLoadingHeld(false) }
  }

  async function loadLaunched() {
    setLoadingLaunch(true)
    try {
      const data = await getCreatorTokens(address)
      setLaunched(data)
      setTotalFees(data.reduce((s, t) => s + (t.creator_fees_earned || 0), 0))
    } catch (e) { console.error(e) }
    finally { setLoadingLaunch(false) }
  }

  async function loadActivity() {
    setLoadingActivity(true)
    try {
      // Get swaps by this wallet
      const { data: swaps } = await supabase
        .from('swaps')
        .select('*, tokens(name, symbol)')
        .eq('sender', address.toLowerCase())
        .order('timestamp', { ascending: false })
        .limit(50)

      const acts: Activity[] = (swaps || []).map((s: any) => ({
        id:           s.id,
        type:         'swap' as const,
        token_id:     s.token_id,
        token_name:   s.tokens?.name   || s.token_id?.slice(0, 8) + '...',
        token_symbol: s.tokens?.symbol || '???',
        is_buy:       s.is_buy,
        amount_in:    s.amount_in,
        price_usd:    s.price_usd,
        timestamp:    s.timestamp,
        tx_hash:      s.tx_hash,
      }))

      setActivity(acts)
    } catch (e) { console.error(e) }
    finally { setLoadingActivity(false) }
  }

  function copyAddress() {
    navigator.clipboard.writeText(address)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'holdings', label: 'Holdings' },
    { id: 'launched', label: 'Launched' },
    { id: 'activity', label: 'Activity' },
  ]

  return (
    <div className="min-h-screen pt-20">
      <div className="max-w-[1000px] mx-auto px-4 py-8">

        {/* Back */}
        <Link href="/" className="inline-flex items-center gap-1.5 text-[13px] text-second hover:text-white transition-colors mb-6">
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
            <path d="m15 18-6-6 6-6" strokeLinecap="round"/>
          </svg>
          Back to feed
        </Link>

        {/* Profile header */}
        <div className="glass p-6 mb-6 fade-up">
          <div className="flex items-center gap-4 flex-wrap">
            {/* Avatar */}
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#00ff87] to-[#00d4ff] flex items-center justify-center shrink-0 shadow-[0_0_24px_rgba(0,255,135,0.25)]">
              <span className="font-display font-700 text-[#050a0e] text-xl">
                {address.slice(2, 4).toUpperCase()}
              </span>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-display text-xl font-700 text-white font-mono">
                  {address.slice(0, 6)}…{address.slice(-4)}
                </h1>
                {isOwnProfile && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-[rgba(0,255,135,0.1)] text-green border border-[rgba(0,255,135,0.2)]">
                    You
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                <button onClick={copyAddress}
                  className="flex items-center gap-1.5 text-[12px] font-mono text-second hover:text-green transition-colors">
                  {address}
                  {copied
                    ? <svg width="12" height="12" fill="none" stroke="#00ff87" viewBox="0 0 24 24" strokeWidth="2.5"><path d="M20 6 9 17l-5-5" strokeLinecap="round"/></svg>
                    : <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                  }
                </button>
                <a href={`https://basescan.org/address/${address}`} target="_blank" rel="noopener noreferrer"
                  className="text-[12px] text-second hover:text-green transition-colors">
                  BaseScan ↗
                </a>
              </div>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-4 flex-wrap">
              <div className="text-center">
                <div className="text-[11px] text-muted font-mono uppercase tracking-wider mb-0.5">Tokens</div>
                <div className="font-display text-xl font-700 text-white">{held.length}</div>
              </div>
              <div className="w-px h-8 bg-[rgba(255,255,255,0.06)]" />
              <div className="text-center">
                <div className="text-[11px] text-muted font-mono uppercase tracking-wider mb-0.5">Portfolio</div>
                <div className="font-display text-xl font-700 text-green">{fmtUsd(totalValue)}</div>
              </div>
              <div className="w-px h-8 bg-[rgba(255,255,255,0.06)]" />
              <div className="text-center">
                <div className="text-[11px] text-muted font-mono uppercase tracking-wider mb-0.5">Launched</div>
                <div className="font-display text-xl font-700 text-white">{launched.length}</div>
              </div>
              <div className="w-px h-8 bg-[rgba(255,255,255,0.06)]" />
              <div className="text-center">
                <div className="text-[11px] text-muted font-mono uppercase tracking-wider mb-0.5">Fees Earned</div>
                <div className="font-display text-xl font-700 text-cyan">{fmtUsd(totalFees)}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 mb-5 fade-up-1">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-4 py-2 rounded-xl text-[13px] font-medium transition-all ${
                tab === t.id ? 'tab-active' : 'tab-inactive'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Holdings tab */}
        {tab === 'holdings' && (
          <div className="glass overflow-hidden fade-up-2">
            {loadingHeld ? (
              <div className="py-16 text-center">
                <div className="inline-flex items-center gap-2 text-second text-[13px]">
                  <div className="w-4 h-4 border-2 border-[#00ff87] border-t-transparent rounded-full animate-spin" />
                  Checking on-chain balances…
                </div>
              </div>
            ) : held.length === 0 ? (
              <div className="py-16 text-center">
                <div className="text-3xl mb-3">🌊</div>
                <div className="text-[13px] text-second">No gitlawnch tokens held</div>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[rgba(255,255,255,0.04)]">
                    {['Token', 'Balance', 'Value', 'Trade'].map(h => (
                      <th key={h} className="px-5 py-3 text-left text-[10px] text-muted uppercase tracking-wider font-mono">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {held.map(({ token: t, balance, valueUsd }) => (
                    <tr key={t.id} className="border-b border-[rgba(255,255,255,0.03)] hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="token-avatar !w-8 !h-8 !text-xs shrink-0">
                            {t.logo_url ? <img src={t.logo_url} alt={t.symbol} className="w-full h-full rounded-full object-cover" /> : t.symbol[0]}
                          </div>
                          <div>
                            <div className="text-[13px] font-medium text-white">{t.name}</div>
                            <div className="text-[11px] text-second font-mono">${t.symbol}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-[13px] font-mono text-white">{fmtNum(Number(balance) / 1e18)}</td>
                      <td className={`px-5 py-3.5 text-[13px] font-mono ${valueUsd > 0 ? 'text-green' : 'text-second'}`}>{fmtUsd(valueUsd)}</td>
                      <td className="px-5 py-3.5">
                        <Link href={`/token/${t.id}`} className="text-[12px] text-green hover:text-white transition-colors font-medium">Trade →</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Launched tab */}
        {tab === 'launched' && (
          <div className="glass overflow-hidden fade-up-2">
            {loadingLaunch ? (
              <div className="py-16 text-center">
                <div className="inline-flex items-center gap-2 text-second text-[13px]">
                  <div className="w-4 h-4 border-2 border-[#00ff87] border-t-transparent rounded-full animate-spin" />
                  Loading launched tokens…
                </div>
              </div>
            ) : launched.length === 0 ? (
              <div className="py-16 text-center">
                <div className="text-3xl mb-3">🌱</div>
                <div className="text-[13px] text-second">No tokens launched yet</div>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[rgba(255,255,255,0.04)]">
                    {['Token', 'MCap', 'Volume', 'Fees Earned', 'Launched', ''].map(h => (
                      <th key={h} className="px-5 py-3 text-left text-[10px] text-muted uppercase tracking-wider font-mono">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {launched.map(t => (
                    <tr key={t.id} className="border-b border-[rgba(255,255,255,0.03)] hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="token-avatar !w-8 !h-8 !text-xs shrink-0">
                            {t.logo_url ? <img src={t.logo_url} alt={t.symbol} className="w-full h-full rounded-full object-cover" /> : t.symbol[0]}
                          </div>
                          <div>
                            <div className="text-[13px] font-medium text-white">{t.name}</div>
                            <div className="text-[11px] text-second font-mono">${t.symbol}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-[13px] font-mono text-white">{fmtUsd(t.market_cap_usd)}</td>
                      <td className={`px-5 py-3.5 text-[13px] font-mono ${t.total_volume_usd > 0 ? 'text-green' : 'text-muted'}`}>{fmtUsd(t.total_volume_usd)}</td>
                      <td className="px-5 py-3.5 text-[13px] font-mono text-cyan">{fmtUsd(t.creator_fees_earned)}</td>
                      <td className="px-5 py-3.5 text-[12px] text-second font-mono">{fmtAge(t.launch_time)}</td>
                      <td className="px-5 py-3.5">
                        <Link href={`/token/${t.id}`} className="text-[12px] text-green hover:text-white transition-colors font-medium">View →</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Activity tab */}
        {tab === 'activity' && (
          <div className="glass overflow-hidden fade-up-2">
            {loadingActivity ? (
              <div className="py-16 text-center">
                <div className="inline-flex items-center gap-2 text-second text-[13px]">
                  <div className="w-4 h-4 border-2 border-[#00ff87] border-t-transparent rounded-full animate-spin" />
                  Loading activity…
                </div>
              </div>
            ) : activity.length === 0 ? (
              <div className="py-16 text-center">
                <div className="text-3xl mb-3">📭</div>
                <div className="text-[13px] text-second">No activity yet</div>
                <div className="text-[11px] text-muted mt-1">Swaps will appear here once the indexer catches up</div>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[rgba(255,255,255,0.04)]">
                    {['Type', 'Token', 'Amount', 'Value', 'Time', 'Tx'].map(h => (
                      <th key={h} className="px-5 py-3 text-left text-[10px] text-muted uppercase tracking-wider font-mono">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {activity.map(a => (
                    <tr key={a.id} className="border-b border-[rgba(255,255,255,0.03)] hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-3.5">
                        <span className={`text-[12px] font-mono font-600 ${
                          a.type === 'claim' ? 'text-cyan'
                          : a.is_buy ? 'text-green' : 'text-[#ff4466]'
                        }`}>
                          {a.type === 'claim' ? 'CLAIM' : a.is_buy ? 'BUY' : 'SELL'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <Link href={`/token/${a.token_id}`} className="text-[13px] text-white hover:text-green transition-colors font-medium">
                          {a.token_name}
                          <span className="text-[11px] text-second font-mono ml-1">${a.token_symbol}</span>
                        </Link>
                      </td>
                      <td className="px-5 py-3.5 text-[12px] font-mono text-white">
                        {a.amount_in ? `${(Number(BigInt(a.amount_in)) / 1e18).toExponential(2)} ${a.is_buy ? 'ETH' : a.token_symbol}` : '--'}
                      </td>
                      <td className="px-5 py-3.5 text-[12px] font-mono text-second">
                        {a.price_usd && a.amount_in ? fmtUsd(a.price_usd * Number(BigInt(a.amount_in)) / 1e18) : '--'}
                      </td>
                      <td className="px-5 py-3.5 text-[12px] font-mono text-muted">{fmtAge(a.timestamp)}</td>
                      <td className="px-5 py-3.5">
                        <a href={`https://basescan.org/tx/${a.tx_hash}`} target="_blank" rel="noopener noreferrer"
                          className="text-[11px] text-second hover:text-green transition-colors font-mono">
                          {a.tx_hash.slice(0, 8)}… ↗
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
