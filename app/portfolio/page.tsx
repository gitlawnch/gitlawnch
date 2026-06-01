'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useWallet, CFG, ABI, getContract, fmtNum, fmtUsd } from '@/hooks/useWallet'
import { getNewTokens, type Token } from '@/lib/supabase'

interface HeldToken { token: Token; balance: bigint; valueUsd: number; pct: number }

const MULTICALL3 = '0xcA11bde05977b3631167028862bE2a173976CA11'
const ERC20_ABI  = ['function balanceOf(address account) view returns (uint256)']

export default function PortfolioPage() {
  const { account, wallets, connectWith, connecting } = useWallet()
  const [held,       setHeld]       = useState<HeldToken[]>([])
  const [loading,    setLoading]    = useState(false)
  const [totalValue, setTotalValue] = useState(0)
  const [showModal,  setShowModal]  = useState(false)

  useEffect(() => {
    if (account) loadPortfolio(account)
  }, [account])

  async function loadPortfolio(addr: string) {
    setLoading(true)
    try {
      const { ethers } = await import('ethers')
      const tokens = await getNewTokens(100)
      if (tokens.length === 0) { setLoading(false); return }

      const mc    = await getContract(MULTICALL3, ['function aggregate3((address target,bool allowFailure,bytes callData)[] calls) view returns ((bool success,bytes returnData)[] returnData)'])
      const iface = new ethers.Interface(ERC20_ABI)
      const calls = tokens.map(t => ({ target: t.id, allowFailure: true, callData: iface.encodeFunctionData('balanceOf', [addr]) }))
      const results = await mc.aggregate3.staticCall(calls)

      const positions: HeldToken[] = []
      results.forEach((r: any, i: number) => {
        if (!r.success || !r.returnData || r.returnData === '0x') return
        try {
          const [bal]    = iface.decodeFunctionResult('balanceOf', r.returnData)
          const balance  = BigInt(bal.toString())
          if (balance === 0n) return
          const t        = tokens[i]
          const valueUsd = (Number(balance) / 1e18) * (t.price_usd || 0)
          positions.push({ token: t, balance, valueUsd, pct: 0 })
        } catch {}
      })

      // Sort by value descending
      positions.sort((a, b) => b.valueUsd - a.valueUsd)

      // Calculate allocation %
      const total = positions.reduce((s, p) => s + p.valueUsd, 0)
      positions.forEach(p => { p.pct = total > 0 ? (p.valueUsd / total) * 100 : 0 })

      setHeld(positions)
      setTotalValue(total)
    } catch (e) { console.error('portfolio failed:', e) }
    finally { setLoading(false) }
  }

  if (!account) return (
    <div className="min-h-screen pt-20 flex items-center justify-center">
      <div className="text-center fade-up">
        <div style={{ fontSize: 48, marginBottom: 16 }}>💼</div>
        <h2 className="font-display text-xl font-700 text-white mb-2">Connect your wallet</h2>
        <p className="text-[13px] text-second mb-6">View your gitlawnch token positions</p>
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
                  className="w-full flex items-center gap-3 p-4 rounded-xl border border-[rgba(255,255,255,0.08)] hover:border-[rgba(26,255,110,0.3)] hover:bg-[rgba(26,255,110,0.04)] transition-all disabled:opacity-50">
                  {w.info.icon ? <img src={w.info.icon} alt="" className="w-8 h-8 rounded-lg" /> : <div className="w-8 h-8 rounded-lg bg-[rgba(26,255,110,0.1)] flex items-center justify-center text-green font-bold">{w.info.name[0]}</div>}
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
      <div className="max-w-[1000px] mx-auto px-4 py-6">

        {/* Page title */}
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#fff', marginBottom: 4 }}>Portfolio</h1>
          <p style={{ fontSize: 13, color: '#555' }}>Your gitlawnch token positions</p>
        </div>

        {/* Portfolio value — PRIMARY METRIC */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(26,255,110,0.07), rgba(26,255,110,0.02))',
          border: '1px solid rgba(26,255,110,0.2)',
          borderRadius: 16, padding: '24px 28px',
          backdropFilter: 'blur(12px)',
          boxShadow: '0 0 32px rgba(26,255,110,0.06)',
          marginBottom: 16,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: 11, color: '#555', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 600, marginBottom: 8, fontFamily: 'JetBrains Mono, monospace' }}>
              Portfolio Value
            </div>
            <div style={{ fontSize: 42, fontWeight: 800, color: '#1aff6e', letterSpacing: '-1px', textShadow: '0 0 30px rgba(26,255,110,0.3)', lineHeight: 1 }}>
              {fmtUsd(totalValue)}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: '#555', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 600, marginBottom: 8, fontFamily: 'JetBrains Mono, monospace' }}>
              Positions
            </div>
            <div style={{ fontSize: 32, fontWeight: 700, color: '#e8e8e8' }}>{held.length}</div>
          </div>
        </div>

        {/* Positions table */}
        {loading ? (
          <div style={{ padding: '60px 0', textAlign: 'center' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#555' }}>
              <div style={{ width: 16, height: 16, border: '2px solid #1aff6e', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              Checking on-chain balances...
            </div>
          </div>
        ) : held.length === 0 ? (
          <div style={{ padding: '60px 0', textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🌊</div>
            <div style={{ fontSize: 15, color: '#555', marginBottom: 8 }}>No positions found</div>
            <div style={{ fontSize: 13, color: '#333', marginBottom: 20 }}>Buy tokens from the feed to see them here</div>
            <Link href="/" className="btn-green px-5 py-2.5 text-[13px] inline-block" style={{ textDecoration: 'none' }}>Browse Feed</Link>
          </div>
        ) : (
          <div className="glass" style={{ overflow: 'hidden', border: '1px solid rgba(26,255,110,0.12)' }}>
            {/* Header */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 140px 130px 100px 90px',
              padding: '10px 16px', borderBottom: '1px solid rgba(26,255,110,0.08)',
              background: 'rgba(255,255,255,0.02)',
            }}>
              {['Token', 'Value', 'Balance', 'Alloc %', 'Trade'].map((h, i) => (
                <div key={h} style={{
                  fontSize: 11, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase',
                  letterSpacing: '0.1em', fontWeight: 600, fontFamily: 'JetBrains Mono, monospace',
                  textAlign: i === 0 ? 'left' : 'right',
                }}>
                  {h}
                </div>
              ))}
            </div>

            {/* Rows */}
            {held.map(({ token: t, balance, valueUsd, pct }) => {
              const isDust = valueUsd < 0.01
              return (
                <div key={t.id} style={{
                  display: 'grid', gridTemplateColumns: '1fr 140px 130px 100px 90px',
                  padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)',
                  alignItems: 'center', opacity: isDust ? 0.45 : 1,
                  transition: 'background 0.15s, opacity 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(26,255,110,0.03)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>

                  {/* Token */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <div className="token-avatar" style={{ width: 32, height: 32, fontSize: 12, flexShrink: 0 }}>
                      {t.logo_url ? <img src={t.logo_url} alt={t.symbol} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /> : t.symbol[0]}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{t.name}</div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'JetBrains Mono, monospace' }}>${t.symbol}</div>
                    </div>
                  </div>

                  {/* Value — PRIMARY */}
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: valueUsd > 0 ? '#1aff6e' : '#333', textShadow: valueUsd > 0 ? '0 0 8px rgba(26,255,110,0.2)' : 'none', fontFamily: 'JetBrains Mono, monospace' }}>
                      {fmtUsd(valueUsd)}
                    </div>
                  </div>

                  {/* Balance */}
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', fontFamily: 'JetBrains Mono, monospace' }}>
                      {fmtNum(Number(balance) / 1e18)}
                    </div>
                  </div>

                  {/* Allocation % */}
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: pct > 50 ? '#ffc832' : 'rgba(255,255,255,0.5)', fontWeight: pct > 50 ? 600 : 400 }}>
                      {pct > 0 ? pct.toFixed(1) + '%' : '--'}
                    </div>
                  </div>

                  {/* Trade */}
                  <div style={{ textAlign: 'right' }}>
                    <Link href={`/token/${t.id}`} style={{ fontSize: 12, fontWeight: 600, color: '#1aff6e', textDecoration: 'none', transition: 'all 0.15s' }}
                      onMouseEnter={e => { e.currentTarget.style.color = '#4dff99'; e.currentTarget.style.textShadow = '0 0 8px rgba(26,255,110,0.4)' }}
                      onMouseLeave={e => { e.currentTarget.style.color = '#1aff6e'; e.currentTarget.style.textShadow = 'none' }}>
                      Trade →
                    </Link>
                  </div>
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
