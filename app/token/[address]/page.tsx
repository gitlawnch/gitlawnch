'use client'
import { use, useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useWallet, CFG, ABI, getContract, getReadProvider, fmtAge, fmtUsd, fmtAddr, fmtNum, fmtEth } from '@/hooks/useWallet'
import { getToken, getTokenSwaps, getNewTokens, supabase, type Token, type Swap } from '@/lib/supabase'

const SLIPPAGE_KEY = 'gl_slippage_v1'
const QUOTER_ABI = [
  'function quoteExactInputSingle(((address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks) poolKey,bool zeroForOne,uint128 exactAmount,bytes hookData) params) returns (uint256 amountOut,uint256 gasEstimate)',
]

function poolKeyFor(token: string) {
  return { currency0: token, currency1: CFG.weth, fee: 0, tickSpacing: 200, hooks: CFG.hook }
}

export default function TokenPage({ params }: { params: Promise<{ address: string }> }) {
  const { address } = use(params)
  const { account, signer } = useWallet()

  const [token, setToken]   = useState<Token | null>(null)
  const [swaps, setSwaps]   = useState<Swap[]>([])
  const [loading, setLoading] = useState(true)
  const [isBuy, setIsBuy]   = useState(true)
  const [amount, setAmount] = useState('')
  const [slippage, setSlippage] = useState(() => {
    if (typeof window === 'undefined') return 3
    return parseFloat(localStorage.getItem(SLIPPAGE_KEY) || '3') || 3
  })
  const [swapStatus, setSwapStatus] = useState('')
  const [swapBusy, setSwapBusy]     = useState(false)
  const [copied, setCopied] = useState(false)
  const [ethBal, setEthBal] = useState('0')
  const [tokenBal, setTokenBal] = useState('0')
  const [quoteOut, setQuoteOut] = useState<bigint | null>(null)
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [claiming, setClaiming]   = useState(false)
  const [claimableEth, setClaimableEth] = useState<bigint>(0n)
  const [mcapUsd,      setMcapUsd]      = useState<number>(0)
  const [livePrice,    setLivePrice]     = useState<number>(0)
  const [claimableTok, setClaimableTok] = useState<bigint>(0n)
  const [claimStatus, setClaimStatus] = useState('')
  const [allTokens, setAllTokens]     = useState<Token[]>([])
  const [payWith, setPayWith]         = useState<string>('ETH')
  const [showPayPicker, setShowPayPicker] = useState(false)
  const quoteTimer = useRef<any>(null)

  useEffect(() => {
    loadData()
    loadAllTokens()

    const sub = supabase
      .channel(`token-${address}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'swaps', filter: `token_id=eq.${address.toLowerCase()}` },
        payload => setSwaps(prev => [payload.new as Swap, ...prev].slice(0, 50)))
      .subscribe()
    return () => { supabase.removeChannel(sub) }
  }, [address])

  useEffect(() => {
    if (!account) return
    refreshBalances()
  }, [account, address, isBuy, payWith])

  async function loadData() {
    const [t, s] = await Promise.all([getToken(address), getTokenSwaps(address)])
    setToken(t); setSwaps(s); setLoading(false)
    if (t) { loadClaimable(t.id); loadMcap(t.id) }
  }

  async function loadClaimable(tokenId: string) {
    try {
      const locker = await getContract(CFG.locker, [
        'function claimable(address token, address currency) view returns (uint256)',
      ])
      const [eth, tok] = await Promise.all([
        locker.claimable(tokenId, CFG.weth),
        locker.claimable(tokenId, tokenId),
      ])
      setClaimableEth(BigInt(eth.toString()))
      setClaimableTok(BigInt(tok.toString()))
    } catch (e) { console.warn('claimable failed:', e) }
  }

  async function loadMcap(tokenId: string) {
    try {
      const { ethers } = await import('ethers')
      const p = await getReadProvider()

      // Get WETH price from Supabase
      const { data: wethData } = await supabase.from('weth_price').select('price_usd').eq('id', 'latest').single()
      const wethUsd = (wethData as any)?.price_usd ?? 0
      if (!wethUsd) return

      // Compute poolId: keccak256(abi.encode(token, weth, 0, 200, hook))
      // gitlawnch tokens always have address < WETH (a19 suffix < 0x4200...)
      // so token = currency0, WETH = currency1
      const abiCoder = ethers.AbiCoder.defaultAbiCoder()
      const hook = ethers.getAddress(CFG.hook)
      const poolId = ethers.keccak256(
        abiCoder.encode(
          ['address','address','uint24','int24','address'],
          [ethers.getAddress(tokenId), ethers.getAddress(CFG.weth), 0, 200, hook]
        )
      )

      // Call StateView.getSlot0
      const sv = await getContract(
        '0xA3c0c9b65baD0b08107Aa264b0f3dB444b867A71',
        ['function getSlot0(bytes32 poolId) view returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee)']
      )
      const [sqrtPriceX96] = await sv.getSlot0(poolId)
      if (!sqrtPriceX96 || sqrtPriceX96 === 0n) return

      // price = (sqrtPriceX96 / 2^96)^2 = WETH per token
      const Q96 = 2 ** 96
      const sqrtNum = Number(sqrtPriceX96)
      const priceWeth = (sqrtNum / Q96) ** 2
      const priceUsd  = priceWeth * wethUsd
      const mcap      = priceUsd * 100_000_000_000 // 100B supply

      setLivePrice(priceUsd)
      setMcapUsd(mcap)
    } catch (e) {
      console.warn('loadMcap failed:', e)
    }
  }

  async function loadAllTokens() {
    const tokens = await getNewTokens(50)
    setAllTokens(tokens.filter(t => t.id !== address.toLowerCase()))
  }

  async function refreshBalances() {
    try {
      const { ethers } = await import('ethers')
      const p = await (await import('@/hooks/useWallet')).getReadProvider()
      if (isBuy) {
        if (payWith === 'ETH') {
          const b = await p.getBalance(account!)
          setEthBal(ethers.formatEther(b))
        } else if (payWith === 'WETH') {
          const c = await getContract(CFG.weth, ABI.token)
          const b = await c.balanceOf(account!)
          setEthBal(ethers.formatEther(b))
        } else {
          const c = await getContract(payWith, ABI.token)
          const b = await c.balanceOf(account!)
          setEthBal(ethers.formatEther(b))
        }
      } else {
        const c = await getContract(address, ABI.token)
        const b = await c.balanceOf(account!)
        setTokenBal(ethers.formatEther(b))
      }
    } catch {}
  }

  function saveSlippage(v: number) {
    setSlippage(v)
    localStorage.setItem(SLIPPAGE_KEY, String(v))
  }

  function setPercent(pct: number) {
    const bal = isBuy ? parseFloat(ethBal) : parseFloat(tokenBal)
    if (!bal) return
    let amt = bal * (pct / 100)
    if (isBuy && payWith === 'ETH' && pct === 100) amt = Math.max(0, bal - 0.0005)
    setAmount(amt.toFixed(6))
    triggerQuote(String(amt.toFixed(6)))
  }

  function triggerQuote(val: string) {
    clearTimeout(quoteTimer.current)
    quoteTimer.current = setTimeout(() => runQuote(val), 350)
  }

  async function runQuote(val: string) {
    if (!val || parseFloat(val) <= 0 || !token) { setQuoteOut(null); return }
    setQuoteLoading(true)
    try {
      const { ethers } = await import('ethers')
      const p = await (await import('@/hooks/useWallet')).getReadProvider()
      const quoter = new ethers.Contract(CFG.quoter, QUOTER_ABI, p)
      const amtIn = ethers.parseUnits(val, 18)
      const key = poolKeyFor(token.id)
      let out: bigint

      if (isBuy) {
        if (payWith === 'ETH' || payWith === 'WETH') {
          // WETH → token: zeroForOne = false (weth=currency1 → token=currency0)
          const res = await quoter.quoteExactInputSingle.staticCall({
            poolKey: key, zeroForOne: false, exactAmount: amtIn, hookData: '0x'
          })
          out = res[0]
        } else {
          // token A → WETH → token B (two hops)
          const keyA = poolKeyFor(payWith)
          const res1 = await quoter.quoteExactInputSingle.staticCall({
            poolKey: keyA, zeroForOne: true, exactAmount: amtIn, hookData: '0x'
          })
          const wethOut = res1[0]
          const res2 = await quoter.quoteExactInputSingle.staticCall({
            poolKey: key, zeroForOne: false, exactAmount: wethOut, hookData: '0x'
          })
          out = res2[0]
        }
      } else {
        // sell token → WETH: zeroForOne = true (token=currency0 → weth=currency1)
        const res = await quoter.quoteExactInputSingle.staticCall({
          poolKey: key, zeroForOne: true, exactAmount: amtIn, hookData: '0x'
        })
        out = res[0]
      }
      setQuoteOut(out)
    } catch (e) {
      console.warn('quote failed', e)
      setQuoteOut(null)
    } finally {
      setQuoteLoading(false)
    }
  }

  function applySlippage(out: bigint): bigint {
    const bps = BigInt(Math.round((100 - slippage) * 100))
    return (out * bps) / 10000n
  }

  async function doSwap() {
    if (!account || !signer || !token || !amount) return
    if (!quoteOut || quoteOut === 0n) { setSwapStatus('❌ Get a quote first'); return }

    const minOut = applySlippage(quoteOut)
    setSwapBusy(true); setSwapStatus('')

    try {
      const { ethers } = await import('ethers')
      const amtIn = ethers.parseUnits(amount, 18)
      const router = await getContract(CFG.router, ABI.router, signer)

      if (isBuy) {
        if (payWith === 'ETH') {
          setSwapStatus('Confirm in wallet…')
          const tx = await router.swap(CFG.ZERO, CFG.ZERO, token.id, CFG.hook, amtIn, minOut, { value: amtIn })
          setSwapStatus('Waiting for confirmation…')
          await tx.wait()
        } else {
          const tokenInAddr = payWith === 'WETH' ? CFG.weth : payWith
          const hookIn      = payWith === 'WETH' ? CFG.ZERO : CFG.hook
          // approve router
          const tk = await getContract(tokenInAddr, ABI.token, signer)
          const allowance = await tk.allowance(account, CFG.router)
          if (allowance < amtIn) {
            setSwapStatus('Approving…')
            const atx = await tk.approve(CFG.router, ethers.MaxUint256)
            await atx.wait()
          }
          setSwapStatus('Confirm swap in wallet…')
          const tx = await router.swap(tokenInAddr, hookIn, token.id, CFG.hook, amtIn, minOut)
          setSwapStatus('Waiting…')
          await tx.wait()
        }
      } else {
        // sell token → ETH
        const tk = await getContract(token.id, ABI.token, signer)
        const allowance = await tk.allowance(account, CFG.router)
        if (allowance < amtIn) {
          setSwapStatus('Approving…')
          const atx = await tk.approve(CFG.router, ethers.MaxUint256)
          await atx.wait()
        }
        setSwapStatus('Confirm sell in wallet…')
        const tx = await router.swap(token.id, CFG.hook, CFG.ZERO, CFG.ZERO, amtIn, minOut)
        setSwapStatus('Waiting…')
        await tx.wait()
      }

      setSwapStatus(`✅ ${isBuy ? 'Buy' : 'Sell'} successful!`)
      setAmount(''); setQuoteOut(null)
      refreshBalances()
    } catch (e: any) {
      if (e.code === 4001 || e.code === 'ACTION_REJECTED') setSwapStatus('❌ Rejected')
      else setSwapStatus('❌ ' + (e.shortMessage || e.message?.slice(0, 80) || 'Failed'))
    } finally {
      setSwapBusy(false)
    }
  }

  async function claimFees() {
    if (!account || !signer || !token) return
    setClaiming(true); setClaimStatus('Confirm in wallet…')
    try {
      const locker = await getContract(CFG.locker, ABI.locker, signer)
      const tx = await locker.claimFees(token.id)
      await tx.wait()
      setClaimStatus('✅ Fees claimed!')
      loadData()
      loadClaimable(token.id)
    } catch (e: any) {
      setClaimStatus('❌ ' + (e.shortMessage || e.message?.slice(0, 60) || 'Failed'))
    } finally { setClaiming(false) }
  }

  function copyCA() {
    navigator.clipboard.writeText(address)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Format quote output
  function quoteDisplay(): string {
    if (quoteLoading) return 'Calculating…'
    if (!quoteOut || quoteOut === 0n) return '?'
    const { ethers } = require('ethers')
    const n = parseFloat(ethers.formatEther(quoteOut))
    if (isBuy) return fmtNum(n) || n.toFixed(0)
    return n.toFixed(6)
  }

  function payLabel(): string {
    if (payWith === 'ETH')  return 'ETH'
    if (payWith === 'WETH') return 'WETH'
    const t = allTokens.find(t => t.id === payWith)
    return t ? `$${t.symbol}` : 'TOKEN'
  }

  function currentBalance(): string {
    return isBuy ? parseFloat(ethBal).toFixed(4) : parseFloat(tokenBal).toFixed(4)
  }

  const geckoUrl = token
    ? `https://www.geckoterminal.com/base/pools/${token.id}?embed=1&info=0&swaps=0&grayscale=0&light_chart=0`
    : ''

  const isCreator = account?.toLowerCase() === token?.creator?.toLowerCase()

  if (loading) return (
    <div className="min-h-screen pt-24 flex items-center justify-center">
      <div className="flex items-center gap-2 text-second text-[13px]">
        <div className="w-4 h-4 border-2 border-[#00ff87] border-t-transparent rounded-full animate-spin" />
        Loading…
      </div>
    </div>
  )

  if (!token) return (
    <div className="min-h-screen pt-24 flex items-center justify-center">
      <div className="text-center">
        <div className="text-4xl mb-3">🔍</div>
        <div className="text-[14px] text-second">Token not found</div>
        <Link href="/" className="mt-4 inline-block text-[13px] text-green hover:underline">← Back to feed</Link>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen pt-20">
      <div className="max-w-[1400px] mx-auto px-4 py-6">

        <Link href="/" className="inline-flex items-center gap-1.5 text-[13px] text-second hover:text-white transition-colors mb-5">
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
            <path d="m15 18-6-6 6-6" strokeLinecap="round"/>
          </svg>
          Back to feed
        </Link>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 20 }}>
          {/* Logo */}
          <div className="token-avatar"
            style={{ width: 52, height: 52, fontSize: 20, flexShrink: 0, cursor: token.logo_url ? 'pointer' : 'default' }}
            onClick={() => token.logo_url && window.open(token.logo_url, '_blank')}>
            {token.logo_url
              ? <img src={token.logo_url} alt={token.symbol} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
              : token.symbol[0]}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Row 1: name + symbol + badges */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff', letterSpacing: '-0.3px', margin: 0 }}>{token.name}</h1>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', fontFamily: 'JetBrains Mono, monospace', fontWeight: 500 }}>${token.symbol}</span>

              {/* Age badge */}
              <span style={{ fontSize: 11, fontWeight: 600, color: '#aaa', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: '2px 8px', fontFamily: 'JetBrains Mono, monospace' }}>
                {fmtAge(token.launch_time)}
              </span>

              {/* Base badge */}
              <span style={{ fontSize: 11, fontWeight: 600, color: '#4d9fff', background: 'rgba(77,159,255,0.08)', border: '1px solid rgba(77,159,255,0.2)', borderRadius: 20, padding: '2px 8px' }}>
                Base
              </span>

              {/* Live badge */}
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: '#1aff6e', background: 'rgba(26,255,110,0.08)', border: '1px solid rgba(26,255,110,0.2)', borderRadius: 20, padding: '2px 8px' }}>
                <div className="live-dot" style={{ width: 5, height: 5 }} />
                Live
              </span>
            </div>

            {/* Row 2: CA + copy + basescan */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 5 }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontFamily: 'JetBrains Mono, monospace' }}>CA</span>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', fontFamily: 'JetBrains Mono, monospace' }}>
                {token.id.slice(0,8)}...{token.id.slice(-6)}
              </span>
              <button onClick={copyCA} style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 6,
                background: copied ? 'rgba(26,255,110,0.12)' : 'rgba(255,255,255,0.06)',
                border: copied ? '1px solid rgba(26,255,110,0.25)' : '1px solid rgba(255,255,255,0.1)',
                color: copied ? '#1aff6e' : '#888', cursor: 'pointer', transition: 'all 0.2s',
                fontFamily: 'Inter, sans-serif',
              }}>
                {copied
                  ? <><svg width="9" height="9" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="M20 6 9 17l-5-5" strokeLinecap="round"/></svg>Copied</>
                  : <><svg width="9" height="9" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>Copy CA</>
                }
              </button>
              <a href={`https://basescan.org/address/${token.id}`} target="_blank" rel="noopener noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#888', textDecoration: 'none', transition: 'all 0.2s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#fff'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.2)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#888'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)' }}>
                <svg width="9" height="9" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                BaseScan
              </a>
            </div>

            {/* Row 3: creator */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>Created by</span>
              <a href={`/profile/${token.creator}`} style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontFamily: 'JetBrains Mono, monospace', textDecoration: 'none', transition: 'color 0.2s' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#1aff6e')}
                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.45)')}>
                {fmtAddr(token.creator)}
              </a>
            </div>
          </div>
        </div>

        {/* Stats pills */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-5">
          {/* Market Cap — primary */}
          <div style={{ background: 'linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: '12px 14px', backdropFilter: 'blur(12px)' }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, fontFamily: 'JetBrains Mono, monospace', marginBottom: 6 }}>Market Cap</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '-0.3px' }}>
              {mcapUsd > 0 ? fmtUsd(mcapUsd) : fmtUsd(token.market_cap_usd)}
            </div>
          </div>

          {/* Volume 24h — green */}
          <div style={{ background: 'linear-gradient(135deg,rgba(26,255,110,0.07),rgba(26,255,110,0.02))', border: '1px solid rgba(26,255,110,0.2)', borderRadius: 12, padding: '12px 14px', backdropFilter: 'blur(12px)' }}>
            <div style={{ fontSize: 10, color: 'rgba(26,255,110,0.7)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, fontFamily: 'JetBrains Mono, monospace', marginBottom: 6 }}>Volume 24h</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: (token.volume_24h_usd||0) > 0 ? '#1aff6e' : '#333', fontFamily: 'JetBrains Mono, monospace', textShadow: (token.volume_24h_usd||0) > 0 ? '0 0 12px rgba(26,255,110,0.25)' : 'none' }}>
              {(token.volume_24h_usd||0) > 0 ? fmtUsd(token.volume_24h_usd) : '--'}
            </div>
          </div>

          {/* Fees Earned — gold */}
          <div style={{ background: 'linear-gradient(135deg,rgba(255,200,50,0.06),rgba(255,200,50,0.02))', border: '1px solid rgba(255,200,50,0.15)', borderRadius: 12, padding: '12px 14px', backdropFilter: 'blur(12px)' }}>
            <div style={{ fontSize: 10, color: 'rgba(255,200,50,0.7)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, fontFamily: 'JetBrains Mono, monospace', marginBottom: 6 }}>Fees Earned</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: (token.creator_fees_earned||0) >= 1 ? '#ffc832' : '#333', fontFamily: 'JetBrains Mono, monospace' }}>
              {(token.creator_fees_earned||0) >= 1 ? fmtUsd(token.creator_fees_earned) : '--'}
            </div>
          </div>

          {/* Txns */}
          <div style={{ background: 'linear-gradient(135deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '12px 14px', backdropFilter: 'blur(12px)' }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, fontFamily: 'JetBrains Mono, monospace', marginBottom: 6 }}>Txns</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: (token.total_txns||0) > 0 ? '#e8e8e8' : '#333', fontFamily: 'JetBrains Mono, monospace' }}>
              {(token.total_txns||0) > 0 ? <>{token.total_txns} <span style={{fontSize:11,color:'rgba(255,255,255,0.3)',fontWeight:400}}>tx</span></> : '--'}
            </div>
          </div>

          {/* Supply */}
          <div style={{ background: 'linear-gradient(135deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '12px 14px', backdropFilter: 'blur(12px)' }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, fontFamily: 'JetBrains Mono, monospace', marginBottom: 6 }}>Supply</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#e8e8e8', fontFamily: 'JetBrains Mono, monospace' }}>100B</div>
          </div>

          {/* Network */}
          <div style={{ background: 'linear-gradient(135deg,rgba(77,159,255,0.06),rgba(77,159,255,0.02))', border: '1px solid rgba(77,159,255,0.15)', borderRadius: 12, padding: '12px 14px', backdropFilter: 'blur(12px)' }}>
            <div style={{ fontSize: 10, color: 'rgba(77,159,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, fontFamily: 'JetBrains Mono, monospace', marginBottom: 6 }}>Network</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#4d9fff', fontFamily: 'JetBrains Mono, monospace' }}>Base</div>
          </div>
        </div>

        {/* Layout */}
        <div className="flex gap-4 flex-col lg:flex-row">

          {/* Left */}
          <div className="flex-1 min-w-0 space-y-4">
            <div style={{
              background: 'linear-gradient(135deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))',
              border: '1px solid rgba(26,255,110,0.12)',
              borderRadius: 14, overflow: 'hidden',
              backdropFilter: 'blur(14px)',
              boxShadow: '0 0 24px rgba(26,255,110,0.04)',
            }}>
              {/* Chart header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                {/* Price info */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, fontFamily: 'JetBrains Mono, monospace', marginBottom: 2 }}>Price</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', fontFamily: 'JetBrains Mono, monospace' }}>
                      {livePrice > 0 ? `$${livePrice.toFixed(8)}` : token.price_usd > 0 ? `$${token.price_usd.toFixed(8)}` : '--'}
                    </div>
                  </div>
                  <div style={{ width: 1, height: 28, background: 'rgba(255,255,255,0.06)' }} />
                  <div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, fontFamily: 'JetBrains Mono, monospace', marginBottom: 2 }}>MCap</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#e8e8e8', fontFamily: 'JetBrains Mono, monospace' }}>
                      {mcapUsd > 0 ? fmtUsd(mcapUsd) : '--'}
                    </div>
                  </div>
                  <div style={{ width: 1, height: 28, background: 'rgba(255,255,255,0.06)' }} />
                  <div>
                    <div style={{ fontSize: 10, color: 'rgba(26,255,110,0.6)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, fontFamily: 'JetBrains Mono, monospace', marginBottom: 2 }}>Vol 24h</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: (token.volume_24h_usd||0) > 0 ? '#1aff6e' : '#333', fontFamily: 'JetBrains Mono, monospace' }}>
                      {(token.volume_24h_usd||0) > 0 ? fmtUsd(token.volume_24h_usd) : '--'}
                    </div>
                  </div>
                </div>

                {/* Status badges */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 600, color: '#1aff6e', background: 'rgba(26,255,110,0.08)', border: '1px solid rgba(26,255,110,0.2)', borderRadius: 20, padding: '3px 8px' }}>
                    <div className="live-dot" style={{ width: 5, height: 5 }} />
                    Live Trading
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 600, color: '#a064ff', background: 'rgba(160,100,255,0.07)', border: '1px solid rgba(160,100,255,0.18)', borderRadius: 20, padding: '3px 8px' }}>
                    Uniswap V4
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 600, color: '#4d9fff', background: 'rgba(77,159,255,0.07)', border: '1px solid rgba(77,159,255,0.18)', borderRadius: 20, padding: '3px 8px' }}>
                    Base
                  </span>
                </div>
              </div>

              {/* Chart iframe */}
              <iframe src={geckoUrl} className="w-full h-[400px]" frameBorder="0" allow="clipboard-write" title="chart" />
            </div>

            {/* Trades */}
            <div style={{ background: 'linear-gradient(135deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, overflow: 'hidden', backdropFilter: 'blur(12px)' }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#e8e8e8' }}>Recent Trades</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#1aff6e', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>
                  <div className="live-dot" style={{ width: 5, height: 5 }} /> Live
                </div>
              </div>
              {/* Table header */}
              <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 100px 120px 80px', padding: '8px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)', background: 'rgba(255,255,255,0.02)' }}>
                {['Side', 'Amount', 'Value', 'Wallet', 'Time'].map(h => (
                  <div key={h} style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, fontFamily: 'JetBrains Mono, monospace' }}>{h}</div>
                ))}
              </div>
              {/* Rows */}
              {swaps.length === 0 ? (
                <div style={{ padding: '40px 16px', textAlign: 'center' }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>📊</div>
                  <div style={{ fontSize: 13, color: '#555' }}>No trades yet</div>
                  <div style={{ fontSize: 11, color: '#333', marginTop: 4 }}>Be the first to trade {token.symbol}</div>
                </div>
              ) : swaps.map(s => (
                <div key={s.id} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 100px 120px 80px', padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.03)', alignItems: 'center', transition: 'background 0.15s', cursor: 'pointer', background: 'transparent' }}
                  onMouseEnter={e => (e.currentTarget.style.background = s.is_buy ? 'rgba(26,255,110,0.03)' : 'rgba(255,70,70,0.03)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  {/* Side badge */}
                  <div>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      fontSize: 11, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace',
                      padding: '3px 8px', borderRadius: 6,
                      background: s.is_buy ? 'rgba(26,255,110,0.1)' : 'rgba(255,70,70,0.1)',
                      border: `1px solid ${s.is_buy ? 'rgba(26,255,110,0.25)' : 'rgba(255,70,70,0.25)'}`,
                      color: s.is_buy ? '#1aff6e' : '#ff4646',
                    }}>
                      {s.is_buy ? '▲' : '▼'} {s.is_buy ? 'BUY' : 'SELL'}
                    </span>
                  </div>
                  {/* Amount */}
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#e8e8e8', fontFamily: 'JetBrains Mono, monospace' }}>
                    {s.is_buy ? fmtEth(s.amount_in) + ' ETH' : fmtNum(Number(BigInt(s.amount_in)) / 1e18) + ' ' + token.symbol}
                  </div>
                  {/* Value */}
                  <div style={{ fontSize: 12, color: s.is_buy ? 'rgba(26,255,110,0.8)' : 'rgba(255,70,70,0.8)', fontFamily: 'JetBrains Mono, monospace', fontWeight: 500 }}>
                    {s.price_usd ? fmtUsd(s.price_usd * Number(BigInt(s.amount_in)) / 1e18) : '--'}
                  </div>
                  {/* Wallet — clickable */}
                  <div>
                    <a href={`/profile/${s.sender}`}
                      style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'JetBrains Mono, monospace', textDecoration: 'none', transition: 'color 0.15s' }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#1aff6e')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.4)')}>
                      {fmtAddr(s.sender)}
                    </a>
                  </div>
                  {/* Time */}
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontFamily: 'JetBrains Mono, monospace' }}>
                    {fmtAge(s.timestamp)}
                  </div>
                </div>
                      ))
                    }
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right */}
          <div className="w-full lg:w-[320px] shrink-0 space-y-4">

            {/* Swap */}
            <div className="glass p-4">
              {/* Buy/Sell tabs */}
              <div className="flex rounded-xl overflow-hidden border border-[rgba(255,255,255,0.06)] mb-4">
                {(['buy', 'sell'] as const).map(side => (
                  <button key={side} onClick={() => { setIsBuy(side === 'buy'); setAmount(''); setQuoteOut(null); setPayWith('ETH') }}
                    className={`flex-1 py-2.5 text-[13px] font-600 font-display transition-all ${
                      (isBuy && side === 'buy') ? 'bg-gradient-to-r from-[#00ff87] to-[#00c96b] text-[#050a0e]'
                      : (!isBuy && side === 'sell') ? 'bg-[rgba(255,68,102,0.15)] text-[#ff4466]'
                      : 'text-second hover:text-white'
                    }`}>
                    {side.charAt(0).toUpperCase() + side.slice(1)}
                  </button>
                ))}
              </div>

              {/* Balance */}
              {account && (
                <div className="flex justify-between text-[11px] text-muted font-mono mb-2">
                  <span>Balance</span>
                  <button className="text-second hover:text-green transition-colors" onClick={() => setPercent(100)}>
                    {currentBalance()} {isBuy ? payLabel() : token.symbol}
                  </button>
                </div>
              )}

              {/* Pay with selector (buy mode) */}
              {isBuy && (
                <div className="mb-2 relative">
                  <div className="text-[11px] text-muted mb-1.5 font-mono">PAY WITH</div>
                  <button onClick={() => setShowPayPicker(!showPayPicker)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl border border-[rgba(255,255,255,0.08)] hover:border-[rgba(0,255,135,0.2)] transition-all">
                    <span className="text-[13px] font-mono text-white">{payLabel()}</span>
                    <svg width="12" height="12" fill="none" stroke="#6b8fa3" viewBox="0 0 24 24" strokeWidth="2">
                      <path d="m6 9 6 6 6-6" strokeLinecap="round"/>
                    </svg>
                  </button>
                  {showPayPicker && (
                    <div className="absolute top-full mt-1 left-0 right-0 glass rounded-xl overflow-hidden shadow-2xl z-10 max-h-48 overflow-y-auto">
                      {[
                        { id: 'ETH',  label: 'ETH',  sub: 'Native Ether' },
                        { id: 'WETH', label: 'WETH', sub: 'Wrapped Ether' },
                        ...allTokens.slice(0, 8).map(t => ({ id: t.id, label: `$${t.symbol}`, sub: t.name })),
                      ].map(opt => (
                        <button key={opt.id}
                          onClick={() => { setPayWith(opt.id); setShowPayPicker(false); setAmount(''); setQuoteOut(null) }}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 hover:bg-[rgba(0,255,135,0.04)] transition-colors text-left ${payWith === opt.id ? 'bg-[rgba(0,255,135,0.06)]' : ''}`}>
                          <div className="token-avatar !w-7 !h-7 !text-xs shrink-0">{opt.label[0]}</div>
                          <div>
                            <div className="text-[12px] text-white font-mono">{opt.label}</div>
                            <div className="text-[10px] text-muted">{opt.sub}</div>
                          </div>
                          {payWith === opt.id && <div className="ml-auto w-2 h-2 rounded-full bg-green" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Amount */}
              <div className="mb-3">
                <div className="text-[11px] text-muted mb-1.5 font-mono">AMOUNT</div>
                <div className="input-dark flex items-center px-3 py-2.5 gap-2">
                  <input value={amount}
                    onChange={e => { setAmount(e.target.value); triggerQuote(e.target.value) }}
                    placeholder="0.0"
                    className="flex-1 bg-transparent outline-none text-[16px] font-mono text-white placeholder:text-muted" />
                  <span className="text-[13px] text-second font-mono shrink-0">{isBuy ? payLabel() : token.symbol}</span>
                </div>
              </div>

              {/* Percent */}
              <div className="grid grid-cols-4 gap-1.5 mb-3">
                {[10, 25, 50, 100].map(p => (
                  <button key={p} onClick={() => setPercent(p)}
                    className="py-1.5 rounded-lg text-[11px] text-second border border-[rgba(255,255,255,0.06)] hover:border-[rgba(0,255,135,0.3)] hover:text-green transition-all font-mono">
                    {p}%
                  </button>
                ))}
              </div>

              {/* Quote estimate */}
              {(amount && parseFloat(amount) > 0) && (
                <div className="mb-3 px-3 py-2.5 rounded-xl bg-[rgba(0,255,135,0.04)] border border-[rgba(0,255,135,0.1)]">
                  <div className="text-[10px] text-muted font-mono mb-0.5">YOU RECEIVE (EST.)</div>
                  <div className={`text-[15px] font-mono font-600 ${quoteLoading ? 'text-second' : quoteOut && quoteOut > 0n ? 'text-green' : 'text-muted'}`}>
                    {quoteDisplay()} {isBuy ? token.symbol : 'ETH'}
                  </div>
                  <div className="text-[10px] text-muted font-mono mt-0.5">After 1% fee · {slippage}% slippage</div>
                </div>
              )}

              {/* Slippage */}
              <div className="mb-3">
                <div className="text-[11px] text-muted mb-1.5 font-mono">SLIPPAGE</div>
                <div className="flex gap-1.5">
                  {[1, 3, 5, 15].map(s => (
                    <button key={s} onClick={() => saveSlippage(s)}
                      className={`flex-1 py-1.5 rounded-lg text-[11px] font-mono transition-all ${
                        slippage === s ? 'bg-[rgba(0,255,135,0.15)] text-green border border-[rgba(0,255,135,0.3)]'
                        : 'border border-[rgba(255,255,255,0.06)] text-second hover:text-white'
                      }`}>{s}%</button>
                  ))}
                </div>
              </div>

              {/* Status */}
              {swapStatus && (
                <div className={`text-[11px] mb-3 p-2.5 rounded-lg leading-relaxed ${
                  swapStatus.startsWith('✅') ? 'bg-[rgba(0,255,135,0.08)] text-green border border-[rgba(0,255,135,0.2)]'
                  : swapStatus.startsWith('❌') ? 'bg-[rgba(255,68,102,0.08)] text-[#ff4466] border border-[rgba(255,68,102,0.2)]'
                  : 'bg-[rgba(0,212,255,0.08)] text-cyan border border-[rgba(0,212,255,0.2)]'
                }`}>{swapStatus}</div>
              )}

              <button onClick={account ? doSwap : undefined} disabled={swapBusy}
                className={`w-full py-3.5 rounded-xl text-[14px] font-display font-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                  !account ? 'btn-green'
                  : isBuy ? 'bg-gradient-to-r from-[#00ff87] to-[#00c96b] text-[#050a0e] shadow-[0_0_20px_rgba(0,255,135,0.25)] hover:shadow-[0_0_35px_rgba(0,255,135,0.4)]'
                  : 'bg-[rgba(255,68,102,0.15)] text-[#ff4466] border border-[rgba(255,68,102,0.3)] hover:bg-[rgba(255,68,102,0.25)]'
                }`}>
                {swapBusy ? 'Processing…'
                  : !account ? 'Connect Wallet'
                  : isBuy ? `Buy ${token.symbol}`
                  : `Sell ${token.symbol}`}
              </button>

              <div className="flex justify-between mt-2 text-[11px] text-muted font-mono">
                <span>1% trading fee</span>
                <span>Slippage {slippage}%</span>
              </div>
            </div>

            {/* Claim fees */}
            {isCreator && (
              <div className="glass p-4">
                <div className="flex items-center gap-2 mb-4">
                  <span>🏆</span>
                  <span className="text-[13px] font-medium text-white">Accrued Fees</span>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-[rgba(0,255,135,0.04)] rounded-xl p-3 border border-[rgba(0,255,135,0.1)]">
                    <div className="text-[10px] text-muted font-mono mb-1">WETH SIDE</div>
                    <div className={`text-[16px] font-mono font-600 ${claimableEth > 0n ? 'text-green' : 'text-muted'}`}>
                      {(Number(claimableEth) / 1e18).toFixed(5)}
                    </div>
                    <div className="text-[10px] text-second font-mono">WETH</div>
                  </div>
                  <div className="bg-[rgba(0,212,255,0.04)] rounded-xl p-3 border border-[rgba(0,212,255,0.1)]">
                    <div className="text-[10px] text-muted font-mono mb-1">TOKEN SIDE</div>
                    <div className={`text-[14px] font-mono font-600 ${claimableTok > 0n ? 'text-cyan' : 'text-muted'}`}>
                      {fmtNum(Number(claimableTok) / 1e18)}
                    </div>
                    <div className="text-[10px] text-second font-mono">{token.symbol}</div>
                  </div>
                </div>
                {claimStatus && (
                  <div className={`text-[11px] mb-3 p-2.5 rounded-lg ${
                    claimStatus.startsWith('✅') ? 'bg-[rgba(0,255,135,0.08)] text-green' : 'bg-[rgba(255,68,102,0.08)] text-[#ff4466]'
                  }`}>{claimStatus}</div>
                )}
                {(claimableEth > 0n || claimableTok > 0n) ? (
                  <button onClick={claimFees} disabled={claiming}
                    className="btn-green w-full py-3 text-[13px] disabled:opacity-50">
                    {claiming ? 'Claiming...' : 'Claim Fees'}
                  </button>
                ) : (
                  <div className="w-full py-3 text-center text-[13px] text-muted border border-[rgba(255,255,255,0.06)] rounded-xl">
                    No fees to claim
                  </div>
                )}
                <p className="text-[10px] text-muted text-center mt-2">80% creator · 20% platform</p>
              </div>
            )}

            {/* About */}
            <div className="glass p-4">
              <div className="text-[13px] font-medium text-white mb-3">About</div>
              {!token.description && (
                <div className="text-center py-4"><div className="text-2xl mb-2">🌱</div><div className="text-[12px] text-muted">No info added yet</div></div>
              )}
              {token.description && (
                <p className="text-[12px] text-second leading-relaxed break-words overflow-hidden">{token.description}</p>
              )}
              {((token as any).website || (token as any).twitter || (token as any).telegram || (token as any).discord) && (
                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  {(token as any).website  && <a href={(token as any).website}  target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] text-[12px] text-second hover:text-green hover:border-[rgba(0,255,135,0.25)] transition-all">🌐 Website</a>}
                  {(token as any).twitter  && <a href={(token as any).twitter}  target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] text-[12px] text-second hover:text-green hover:border-[rgba(0,255,135,0.25)] transition-all">X Twitter</a>}
                  {(token as any).telegram && <a href={(token as any).telegram} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] text-[12px] text-second hover:text-green hover:border-[rgba(0,255,135,0.25)] transition-all">Telegram</a>}
                  {(token as any).discord  && <a href={(token as any).discord}  target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] text-[12px] text-second hover:text-green hover:border-[rgba(0,255,135,0.25)] transition-all">Discord</a>}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
