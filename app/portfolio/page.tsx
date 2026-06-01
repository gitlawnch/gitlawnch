'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useWallet, CFG, ABI, getContract, fmtNum, fmtUsd } from '@/hooks/useWallet'
import { getNewTokens, type Token } from '@/lib/supabase'

interface HeldToken { token: Token; balance: bigint; valueUsd: number }

const MULTICALL3 = '0xcA11bde05977b3631167028862bE2a173976CA11'
const ERC20_BALANCE_ABI = ['function balanceOf(address account) view returns (uint256)']

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

      // Use Multicall3 to batch all balanceOf calls in 1 request
      const mc = await getContract(
        MULTICALL3,
        ['function aggregate3((address target,bool allowFailure,bytes callData)[] calls) view returns ((bool success,bytes returnData)[] returnData)']
      )
      const iface = new ethers.Interface(ERC20_BALANCE_ABI)

      const calls = tokens.map(t => ({
        target:       t.id,
        allowFailure: true,
        callData:     iface.encodeFunctionData('balanceOf', [addr]),
      }))

      const results = await mc.aggregate3.staticCall(calls)

      const held: HeldToken[] = []
      results.forEach((r: any, i: number) => {
        if (!r.success || !r.returnData || r.returnData === '0x') return
        try {
          const [bal] = iface.decodeFunctionResult('balanceOf', r.returnData)
          const balance = BigInt(bal.toString())
          if (balance === 0n) return
          const t = tokens[i]
          const balFloat = Number(balance) / 1e18
          const valueUsd = balFloat * (t.price_usd || 0)
          held.push({ token: t, balance, valueUsd })
        } catch {}
      })

      held.sort((a, b) => b.valueUsd - a.valueUsd)
      setHeld(held)
      setTotalValue(held.reduce((s, r) => s + r.valueUsd, 0))
    } catch (e) { console.error('portfolio failed:', e) }
    finally { setLoading(false) }
  }

  const WalletModal = () => (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 modal-backdrop"
      onClick={e => e.target === e.currentTarget && setShowModal(false)}>
      <div className="glass w-full max-w-sm rounded-2xl p-6 shadow-2xl fade-up">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-lg font-700 text-white">Connect Wallet</h2>
          <button onClick={() => setShowModal(false)} className="text-second hover:text-white">
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
        <div className="space-y-2">
          {wallets.length === 0
            ? <div className="text-center py-4 text-[13px] text-second">No wallet detected</div>
            : wallets.map(w => (
              <button key={w.info.rdns} onClick={async () => { await connectWith(w); setShowModal(false) }}
                disabled={connecting}
                className="w-full flex items-center gap-3 p-4 rounded-xl border border-[rgba(255,255,255,0.08)] hover:border-[rgba(0,255,135,0.3)] hover:bg-[rgba(0,255,135,0.04)] transition-all disabled:opacity-50">
                {w.info.icon
                  ? <img src={w.info.icon} alt="" className="w-8 h-8 rounded-lg" />
                  : <div className="w-8 h-8 rounded-lg bg-[rgba(0,255,135,0.1)] flex items-center justify-center text-green font-bold">{w.info.name[0]}</div>
                }
                <div className="flex-1 text-left">
                  <div className="text-[14px] font-medium text-white">{w.info.name}</div>
                  <div className="text-[11px] text-second">Base Mainnet</div>
                </div>
                {connecting && <div className="w-4 h-4 border-2 border-[#00ff87] border-t-transparent rounded-full animate-spin" />}
              </button>
            ))
          }
        </div>
      </div>
    </div>
  )

  if (!account) return (
    <div className="min-h-screen pt-24 flex items-center justify-center">
      <div className="text-center fade-up">
        <div className="text-5xl mb-4">💼</div>
        <h2 className="font-display text-xl font-700 text-white mb-2">Connect your wallet</h2>
        <p className="text-[13px] text-second mb-6">View tokens you hold from gitlawnch</p>
        <button onClick={() => setShowModal(true)} className="btn-green px-6 py-3 text-[14px]">Connect Wallet</button>
      </div>
      {showModal && <WalletModal />}
    </div>
  )

  return (
    <div className="min-h-screen pt-20">
      <div className="max-w-[1400px] mx-auto px-4 py-8">

        <div className="mb-6 fade-up">
          <h1 className="font-display text-2xl font-700 text-white">Portfolio</h1>
          <p className="text-[13px] text-second mt-1">Tokens you hold from gitlawnch</p>
        </div>

        {/* Summary card */}
        <div className="glass p-6 mb-6 fade-up-1">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[11px] text-muted font-mono uppercase tracking-wider mb-1">Total Tokens Held</div>
              <div className="font-display text-3xl font-700 text-white">
                {held.length} <span className="text-[18px] text-second">tokens</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[11px] text-muted font-mono uppercase tracking-wider mb-1">Portfolio Value</div>
              <div className="font-display text-3xl font-700 text-green">{fmtUsd(totalValue)}</div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="py-20 text-center">
            <div className="inline-flex items-center gap-2 text-second text-[13px]">
              <div className="w-4 h-4 border-2 border-[#00ff87] border-t-transparent rounded-full animate-spin" />
              Checking on-chain balances...
            </div>
          </div>
        ) : held.length === 0 ? (
          <div className="py-20 text-center fade-up">
            <div className="text-5xl mb-4">🌊</div>
            <h2 className="font-display text-lg font-600 text-white mb-2">No tokens held</h2>
            <p className="text-[13px] text-second mb-6">Browse the feed and buy your first token</p>
            <Link href="/" className="btn-green px-6 py-3 text-[13px] inline-block">Browse Feed</Link>
          </div>
        ) : (
          <div className="glass overflow-hidden fade-up-2">
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
                    <td className="px-5 py-4">
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
                    <td className="px-5 py-4 text-[13px] font-mono text-white">{fmtNum(Number(balance) / 1e18)}</td>
                    <td className={`px-5 py-4 text-[13px] font-mono ${valueUsd > 0 ? 'text-green' : 'text-second'}`}>{fmtUsd(valueUsd)}</td>
                    <td className="px-5 py-4">
                      <Link href={`/token/${t.id}`} className="text-[12px] text-green hover:text-white transition-colors font-medium">Trade →</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
