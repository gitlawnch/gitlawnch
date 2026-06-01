'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useWallet, CFG, getContract, fmtNum, fmtUsd } from '@/hooks/useWallet'
import { getCreatorTokens, type Token } from '@/lib/supabase'

const LOCKER_ABI = [
  'function claimFees(address token) external',
  'function claimable(address token, address currency) view returns (uint256)',
]
const MULTICALL3 = '0xcA11bde05977b3631167028862bE2a173976CA11'

interface TokenWithFees extends Token {
  claimableEth: bigint
  claimableTok: bigint
  claimableUsd: number
}

export default function MyTokensPage() {
  const { account, signer, wallets, connectWith, connecting } = useWallet()
  const [tokens,   setTokens]   = useState<TokenWithFees[]>([])
  const [loading,  setLoading]  = useState(false)
  const [claiming, setClaiming] = useState<string | null>(null)
  const [claimMsg, setClaimMsg] = useState<Record<string, string>>({})
  const [showModal, setShowModal] = useState(false)
  const [wethUsd,  setWethUsd]  = useState(2000)

  useEffect(() => {
    if (account) loadTokens(account)
  }, [account])

  async function loadTokens(addr: string) {
    setLoading(true)
    try {
      const { ethers } = await import('ethers')

      // Fetch WETH price
      const { supabase } = await import('@/lib/supabase')
      const { data: wd } = await supabase.from('weth_price').select('price_usd').eq('id', 'latest').single()
      const wp = (wd as any)?.price_usd ?? 2000
      setWethUsd(wp)

      const data = await getCreatorTokens(addr)
      if (data.length === 0) { setTokens([]); setLoading(false); return }

      // Multicall3 for all claimable
      const mc = await getContract(
        MULTICALL3,
        ['function aggregate3((address target,bool allowFailure,bytes callData)[] calls) view returns ((bool success,bytes returnData)[] returnData)']
      )
      const iface = new ethers.Interface(LOCKER_ABI)
      const calls = data.flatMap(t => [
        { target: CFG.locker, allowFailure: true, callData: iface.encodeFunctionData('claimable', [t.id, CFG.weth]) },
        { target: CFG.locker, allowFailure: true, callData: iface.encodeFunctionData('claimable', [t.id, t.id]) },
      ])
      const results = await mc.aggregate3.staticCall(calls)

      const enriched: TokenWithFees[] = data.map((t, i) => {
        const ethRes = results[i * 2]
        const tokRes = results[i * 2 + 1]
        const cEth = ethRes.success && ethRes.returnData !== '0x'
          ? BigInt(iface.decodeFunctionResult('claimable', ethRes.returnData)[0].toString()) : 0n
        const cTok = tokRes.success && tokRes.returnData !== '0x'
          ? BigInt(iface.decodeFunctionResult('claimable', tokRes.returnData)[0].toString()) : 0n
        const cUsd = (Number(cEth) / 1e18) * wp
        return { ...t, claimableEth: cEth, claimableTok: cTok, claimableUsd: cUsd }
      })

      // Sort by highest claimable USD first
      enriched.sort((a, b) => b.claimableUsd - a.claimableUsd)
      setTokens(enriched)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  async function claimFees(tokenId: string) {
    if (!signer) return
    setClaiming(tokenId)
    try {
      const locker = await getContract(CFG.locker, LOCKER_ABI, signer)
      const tx = await locker.claimFees(tokenId)
      setClaimMsg(p => ({ ...p, [tokenId]: 'Confirming...' }))
      await tx.wait()
      setClaimMsg(p => ({ ...p, [tokenId]: '✅ Claimed!' }))
      if (account) setTimeout(() => loadTokens(account), 1500)
    } catch (e: any) {
      setClaimMsg(p => ({ ...p, [tokenId]: e.code === 4001 ? 'Rejected' : 'Failed' }))
    } finally { setClaiming(null) }
  }

  // Summary stats
  const totalClaimableEth = tokens.reduce((s, t) => s + Number(t.claimableEth) / 1e18, 0)
  const totalClaimableUsd = tokens.reduce((s, t) => s + t.claimableUsd, 0)
  const totalLifetimeFees = tokens.reduce((s, t) => s + (t.creator_fees_earned || 0), 0)
  const topEarnerSymbol   = tokens.length > 0 ? tokens[0].symbol : null

  function getBadge(t: TokenWithFees, i: number) {
    if (i === 0 && tokens.length > 1 && t.claimableUsd > 0) return { label: 'Top Earner', color: '#ffc832' }
    if ((t.txns_24h || 0) > 5) return { label: 'Most Active', color: '#00d4ff' }
    const age = Math.floor(Date.now() / 1000) - t.launch_time
    if (age < 3600) return { label: 'Newest', color: '#a064ff' }
    return null
  }

  if (!account) return (
    <div className="min-h-screen pt-20 flex items-center justify-center">
      <div className="text-center fade-up">
        <div style={{ fontSize: 48, marginBottom: 16 }}>💰</div>
        <h2 className="font-display text-xl font-700 text-white mb-2">Connect your wallet</h2>
        <p className="text-[13px] text-second mb-6">View your creator earnings dashboard</p>
        <button onClick={() => setShowModal(true)} className="btn-green px-6 py-3 text-[14px]">Connect Wallet</button>
      </div>
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 modal-backdrop"
          onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="glass w-full max-w-sm rounded-2xl p-6 fade-up">
            <h2 className="font-display text-lg font-700 text-white mb-4">Connect Wallet</h2>
            <div className="space-y-2">
              {wallets.map(w => (
                <button key={w.info.rdns} onClick={async () => { await connectWith(w); setShowModal(false) }}
                  disabled={connecting}
                  className="w-full flex items-center gap-3 p-4 rounded-xl border border-[rgba(255,255,255,0.08)] hover:border-[rgba(0,255,135,0.3)] hover:bg-[rgba(0,255,135,0.04)] transition-all disabled:opacity-50">
                  {w.info.icon ? <img src={w.info.icon} alt="" className="w-8 h-8 rounded-lg" /> : <div className="w-8 h-8 rounded-lg bg-[rgba(0,255,135,0.1)] flex items-center justify-center text-green font-bold">{w.info.name[0]}</div>}
                  <span className="text-[14px] font-medium text-white">{w.info.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )

  return (
    <div className="min-h-screen pt-20">
      <div className="max-w-[1200px] mx-auto px-4 py-6">

        {/* Page title */}
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#fff', marginBottom: 4 }}>My Tokens</h1>
          <p style={{ fontSize: 13, color: '#555' }}>Creator earnings dashboard</p>
        </div>

        {/* Summary cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Tokens Created', value: tokens.length.toString(), color: '#e8e8e8', sub: 'All time' },
            { label: 'Claimable Now', value: totalClaimableEth > 0 ? totalClaimableEth.toFixed(5) + ' WETH' : '--', color: '#1aff6e', sub: totalClaimableUsd > 0 ? `≈ ${fmtUsd(totalClaimableUsd)}` : 'No pending fees', glow: true },
            { label: 'Lifetime Earned', value: totalLifetimeFees > 0 && totalLifetimeFees >= 1 ? fmtUsd(totalLifetimeFees) : '--', color: '#ffc832', sub: '80% of all trading fees' },
          ].map(s => (
            <div key={s.label} style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))',
              border: `1px solid ${(s as any).glow ? 'rgba(26,255,110,0.2)' : 'rgba(255,255,255,0.08)'}`,
              borderRadius: 14, padding: '18px 20px',
              backdropFilter: 'blur(12px)',
              boxShadow: (s as any).glow ? '0 0 24px rgba(26,255,110,0.07)' : 'none',
            }}>
              <div style={{ fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 600, marginBottom: 8, fontFamily: 'JetBrains Mono, monospace' }}>{s.label}</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: s.color, letterSpacing: '-0.5px', textShadow: (s as any).glow ? '0 0 20px rgba(26,255,110,0.25)' : 'none' }}>{s.value}</div>
              <div style={{ fontSize: 11, color: '#444', marginTop: 4, fontFamily: 'JetBrains Mono, monospace' }}>{s.sub}</div>
            </div>
          ))}
        </div>

        {/* Token cards */}
        {loading ? (
          <div style={{ padding: '60px 0', textAlign: 'center' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#555' }}>
              <div style={{ width: 16, height: 16, border: '2px solid #1aff6e', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              Loading your tokens...
            </div>
          </div>
        ) : tokens.length === 0 ? (
          <div style={{ padding: '60px 0', textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🌱</div>
            <div style={{ fontSize: 15, color: '#555', marginBottom: 8 }}>No tokens launched yet</div>
            <div style={{ fontSize: 13, color: '#333' }}>Launch your first token to start earning fees</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
            {tokens.map((t, i) => {
              const hasFees = t.claimableEth > 0n || t.claimableTok > 0n
              const ethAmt  = Number(t.claimableEth) / 1e18
              const tokAmt  = Number(t.claimableTok) / 1e18
              const msg     = claimMsg[t.id]
              const badge   = getBadge(t, i)
              const isClaiming = claiming === t.id

              return (
                <div key={t.id} style={{
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))',
                  border: hasFees ? '1px solid rgba(26,255,110,0.2)' : '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 16, padding: '18px',
                  backdropFilter: 'blur(12px)',
                  boxShadow: hasFees ? '0 0 20px rgba(26,255,110,0.05)' : 'none',
                  opacity: hasFees ? 1 : 0.7,
                  transition: 'all 0.2s',
                }}>

                  {/* Card header — token info + badge */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div className="token-avatar" style={{ width: 36, height: 36, fontSize: 14, flexShrink: 0 }}>
                        {t.logo_url ? <img src={t.logo_url} alt={t.symbol} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /> : t.symbol[0]}
                      </div>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{t.name}</div>
                        <div style={{ fontSize: 11, color: '#444', fontFamily: 'JetBrains Mono, monospace' }}>${t.symbol}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {badge && (
                        <span style={{ fontSize: 10, fontWeight: 600, color: badge.color, background: `${badge.color}18`, border: `1px solid ${badge.color}35`, borderRadius: 20, padding: '2px 8px', whiteSpace: 'nowrap' }}>
                          {badge.label}
                        </span>
                      )}
                      {hasFees && (
                        <span style={{ fontSize: 10, fontWeight: 600, color: '#1aff6e', background: 'rgba(26,255,110,0.1)', border: '1px solid rgba(26,255,110,0.25)', borderRadius: 20, padding: '2px 8px' }}>
                          Active
                        </span>
                      )}
                      <Link href={`/token/${t.id}`} style={{ fontSize: 12, color: '#1aff6e', textDecoration: 'none', fontWeight: 500 }}>View →</Link>
                    </div>
                  </div>

                  {/* Claimable fees — PRIMARY */}
                  <div style={{
                    background: hasFees ? 'rgba(26,255,110,0.05)' : 'rgba(255,255,255,0.02)',
                    border: hasFees ? '1px solid rgba(26,255,110,0.12)' : '1px solid rgba(255,255,255,0.05)',
                    borderRadius: 10, padding: '12px 14px', marginBottom: 12,
                  }}>
                    <div style={{ fontSize: 10, color: '#444', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, marginBottom: 6, fontFamily: 'JetBrains Mono, monospace' }}>
                      Claimable Fees
                    </div>
                    {hasFees ? (
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                        <div>
                          <span style={{ fontSize: 22, fontWeight: 700, color: '#1aff6e', textShadow: '0 0 16px rgba(26,255,110,0.25)' }}>{ethAmt.toFixed(5)}</span>
                          <span style={{ fontSize: 12, color: '#555', marginLeft: 4, fontFamily: 'JetBrains Mono, monospace' }}>WETH</span>
                        </div>
                        {tokAmt > 0 && (
                          <div>
                            <span style={{ fontSize: 14, fontWeight: 600, color: '#00d4ff' }}>{fmtNum(tokAmt)}</span>
                            <span style={{ fontSize: 11, color: '#444', marginLeft: 4, fontFamily: 'JetBrains Mono, monospace' }}>{t.symbol}</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ fontSize: 13, color: '#333' }}>No fees generated yet</div>
                    )}
                  </div>

                  {/* Claim message */}
                  {msg && (
                    <div style={{
                      fontSize: 12, padding: '8px 12px', borderRadius: 8, marginBottom: 10,
                      background: msg.includes('✅') ? 'rgba(26,255,110,0.08)' : 'rgba(255,68,102,0.08)',
                      color: msg.includes('✅') ? '#1aff6e' : '#ff4466',
                      border: `1px solid ${msg.includes('✅') ? 'rgba(26,255,110,0.2)' : 'rgba(255,68,102,0.2)'}`,
                    }}>{msg}</div>
                  )}

                  {/* Claim button */}
                  {hasFees ? (
                    <button onClick={() => claimFees(t.id)} disabled={!!isClaiming}
                      style={{
                        width: '100%', padding: '11px', borderRadius: 10,
                        background: isClaiming ? 'rgba(26,255,110,0.15)' : '#1aff6e',
                        color: isClaiming ? '#1aff6e' : '#0d1f12',
                        border: isClaiming ? '1px solid rgba(26,255,110,0.3)' : 'none',
                        fontSize: 14, fontWeight: 700, cursor: isClaiming ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s',
                        boxShadow: isClaiming ? 'none' : '0 0 20px rgba(26,255,110,0.2)',
                        fontFamily: 'Inter, sans-serif',
                      }}>
                      {isClaiming ? 'Claiming...' : `Claim Fees`}
                    </button>
                  ) : (
                    <div style={{
                      width: '100%', padding: '11px', borderRadius: 10, textAlign: 'center',
                      border: '1px solid rgba(255,255,255,0.06)', fontSize: 13,
                      color: '#333', fontFamily: 'Inter, sans-serif',
                    }}>
                      No Fees Available
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
