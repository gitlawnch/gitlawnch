'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useWallet, CFG, getContract, fmtNum } from '@/hooks/useWallet'
import { getCreatorTokens, type Token } from '@/lib/supabase'
import { fmtUsd } from '@/hooks/useWallet'

// Correct ABI for Locker contract
const LOCKER_ABI = [
  'function claimFees(address token) external',
  'function claimable(address token, address currency) view returns (uint256)',
]

export default function MyTokensPage() {
  const { account, signer, wallets, connectWith, connecting } = useWallet()
  const [tokens,    setTokens]    = useState<Token[]>([])
  const [claimable, setClaimable] = useState<Record<string, { eth: bigint; tok: bigint }>>({})
  const [loading,   setLoading]   = useState(false)
  const [claiming,  setClaiming]  = useState<string | null>(null)
  const [claimMsg,  setClaimMsg]  = useState<Record<string, string>>({})
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    if (account) loadTokens(account)
  }, [account])

  async function loadTokens(addr: string) {
    setLoading(true)
    const data = await getCreatorTokens(addr)
    setTokens(data)

    // Load on-chain claimable via Multicall3 - 1 request for all tokens
    const claims: Record<string, { eth: bigint; tok: bigint }> = {}

    try {
      const { ethers } = await import('ethers')
      const mc = await getContract(
        '0xcA11bde05977b3631167028862bE2a173976CA11',
        ['function aggregate3((address target,bool allowFailure,bytes callData)[] calls) view returns ((bool success,bytes returnData)[] returnData)']
      )
      const iface = new ethers.Interface(LOCKER_ABI)

      // Build calls: 2 per token (weth side + token side)
      const calls = data.flatMap(t => [
        { target: CFG.locker, allowFailure: true, callData: iface.encodeFunctionData('claimable', [t.id, CFG.weth]) },
        { target: CFG.locker, allowFailure: true, callData: iface.encodeFunctionData('claimable', [t.id, t.id]) },
      ])

      const results = await mc.aggregate3.staticCall(calls)

      data.forEach((t, i) => {
        const ethRes = results[i * 2]
        const tokRes = results[i * 2 + 1]
        const eth = ethRes.success && ethRes.returnData !== '0x'
          ? BigInt(iface.decodeFunctionResult('claimable', ethRes.returnData)[0].toString())
          : 0n
        const tok = tokRes.success && tokRes.returnData !== '0x'
          ? BigInt(iface.decodeFunctionResult('claimable', tokRes.returnData)[0].toString())
          : 0n
        claims[t.id] = { eth, tok }
      })
    } catch (e: any) {
      console.warn('multicall claimable failed, fallback to zero:', e?.message)
      data.forEach(t => { claims[t.id] = { eth: 0n, tok: 0n } })
    }
    setClaimable(claims)
    setLoading(false)
  }

  async function claimFees(tokenId: string, symbol: string) {
    if (!signer) return
    setClaiming(tokenId)
    setClaimMsg(prev => ({ ...prev, [tokenId]: 'Confirm in walletâ€¦' }))
    try {
      const locker = await getContract(CFG.locker, LOCKER_ABI, signer)
      const tx = await locker.claimFees(tokenId)
      setClaimMsg(prev => ({ ...prev, [tokenId]: 'Waiting for confirmationâ€¦' }))
      await tx.wait()
      setClaimMsg(prev => ({ ...prev, [tokenId]: 'âœ… Fees claimed!' }))
      if (account) setTimeout(() => loadTokens(account), 2000)
    } catch (e: any) {
      const msg = e.code === 4001 || e.code === 'ACTION_REJECTED'
        ? 'Rejected'
        : (e.shortMessage || e.message?.slice(0, 50) || 'Failed')
      setClaimMsg(prev => ({ ...prev, [tokenId]: 'âŒ ' + msg }))
    } finally { setClaiming(null) }
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
              <button key={w.info.rdns}
                onClick={async () => { await connectWith(w); setShowModal(false) }}
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
        <div className="text-5xl mb-4">ðŸ”</div>
        <h2 className="font-display text-xl font-700 text-white mb-2">Connect your wallet</h2>
        <p className="text-[13px] text-second mb-6">See tokens you've deployed on gitlawnch</p>
        <button onClick={() => setShowModal(true)} className="btn-green px-6 py-3 text-[14px]">Connect Wallet</button>
      </div>
      {showModal && <WalletModal />}
    </div>
  )

  return (
    <div className="min-h-screen pt-20">
      <div className="max-w-[1400px] mx-auto px-4 py-8">

        <div className="mb-8 fade-up">
          <h1 className="font-display text-2xl font-700 text-white">My Tokens</h1>
          <p className="text-[13px] text-second mt-1">Tokens you've deployed Â· Claim your trading fees</p>
        </div>

        {loading ? (
          <div className="py-20 text-center">
            <div className="inline-flex items-center gap-2 text-second text-[13px]">
              <div className="w-4 h-4 border-2 border-[#00ff87] border-t-transparent rounded-full animate-spin" />
              Loading your tokensâ€¦
            </div>
          </div>
        ) : tokens.length === 0 ? (
          <div className="py-20 text-center fade-up">
            <div className="text-5xl mb-4">ðŸŒ±</div>
            <h2 className="font-display text-lg font-600 text-white mb-2">No tokens yet</h2>
            <p className="text-[13px] text-second mb-6">Launch your first token on Base</p>
            <Link href="/" className="btn-green px-6 py-3 text-[13px] inline-block">Launch Token</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tokens.map((t, i) => {
              const claim    = claimable[t.id]
              const ethAmt   = claim ? Number(claim.eth)   / 1e18 : 0
              const tokenAmt = claim ? Number(claim.tok) / 1e18 : 0
              const hasFees = ethAmt > 0 || tokenAmt > 0
              const msg      = claimMsg[t.id]

              return (
                <div key={t.id} className={`glass p-5 fade-up-${Math.min(i + 1, 5)}`}>
                  {/* Header */}
                  <div className="flex items-start gap-3 mb-4">
                    <div className="token-avatar !w-11 !h-11 !text-base shrink-0">
                      {t.logo_url
                        ? <img src={t.logo_url} alt={t.symbol} className="w-full h-full rounded-full object-cover" />
                        : t.symbol[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] font-600 text-white font-display truncate">{t.name}</div>
                      <div className="text-[11px] text-second font-mono">${t.symbol}</div>
                    </div>
                    <Link href={`/token/${t.id}`} className="text-[11px] text-green hover:text-white transition-colors shrink-0">
                      View â†’
                    </Link>
                  </div>

                  {/* Fee amounts */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-[rgba(0,255,135,0.04)] rounded-xl p-3 border border-[rgba(0,255,135,0.08)]">
                      <div className="text-[10px] text-muted font-mono mb-0.5">FEE Â· WETH</div>
                      <div className={`text-[14px] font-mono font-600 ${ethAmt > 0 ? 'text-green' : 'text-muted'}`}>
                        {ethAmt.toFixed(5)}
                      </div>
                      <div className="text-[10px] text-second font-mono">WETH</div>
                    </div>
                    <div className="bg-[rgba(0,212,255,0.04)] rounded-xl p-3 border border-[rgba(0,212,255,0.08)]">
                      <div className="text-[10px] text-muted font-mono mb-0.5">FEE Â· TOKEN</div>
                      <div className={`text-[13px] font-mono font-600 ${tokenAmt > 0 ? 'text-cyan' : 'text-muted'}`}>
                        {fmtNum(tokenAmt)}
                      </div>
                      <div className="text-[10px] text-second font-mono">{t.symbol}</div>
                    </div>
                  </div>

                  {/* Status message */}
                  {msg && (
                    <div className={`text-[11px] mb-3 p-2 rounded-lg ${
                      msg.startsWith('âœ…') ? 'bg-[rgba(0,255,135,0.08)] text-green'
                      : msg.startsWith('âŒ') ? 'bg-[rgba(255,68,102,0.08)] text-[#ff4466]'
                      : 'bg-[rgba(0,212,255,0.08)] text-cyan'
                    }`}>{msg}</div>
                  )}

                  {/* Claim button */}
                  {hasFees ? (
                    <button onClick={() => claimFees(t.id, t.symbol)}
                      disabled={claiming === t.id}
                      className="btn-green w-full py-2.5 text-[13px] disabled:opacity-50">
                      {claiming === t.id ? 'Claimingâ€¦' : 'Claim Fees'}
                    </button>
                  ) : (
                    <div className="py-2 text-center text-[12px] text-muted">No fees yet</div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

