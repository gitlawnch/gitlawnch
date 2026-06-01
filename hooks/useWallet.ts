'use client'
import { useState, useEffect, useCallback, useRef } from 'react'

// â”€â”€ Config â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const CFG = {
  chainId:     8453,
  chainHex:    '0x2105',
  factory:     '0x18c3B29A5a67139e947aB9f92B9cF6a99Be8421E',
  router:      '0x2bc04eCB0675BB4eC2D046fD0e17e8ae2dAf42aC',
  locker:      '0x99C4b4aa07B38FE1b30425585CAFF26f08595CbC',
  hook:        '0x8dEFd6dA5b578F50B22a358c4D859D5B538E9088',
  weth:        '0x4200000000000000000000000000000000000006',
  ZERO:        '0x0000000000000000000000000000000000000000',
  stateView:   '0xA3c0c9b65baD0b08107Aa264b0f3dB444b867A71',
  quoter:      '0x0d5e0F971ED27FBfF6c2837bf31316121532048D',
  multicall3:  '0xcA11bde05977b3631167028862bE2a173976CA11',
  rpc:         'https://mainnet.base.org',
  deployBlock: 46677352,
}

export const ABI = {
  factory: [
    'function findSalt(string name,string symbol,address creator,uint256 start,uint256 maxTries) view returns (bool found,bytes32 salt,address predicted)',
    'function launch((string name,string symbol,address creator,bytes32 salt) p) returns (address token)',
    'event TokenLaunched(address indexed token,address indexed creator,address pool,string name,string symbol)',
  ],
  router: [
    'function swap(address tokenIn,address hookIn,address tokenOut,address hookOut,uint128 amountIn,uint128 minOut) payable',
  ],
  locker: [
    'function claimFees(address token)',
    'function claimable(address token,address currency) view returns (uint256)',
  ],
  token: [
    'function name() view returns (string)',
    'function symbol() view returns (string)',
    'function balanceOf(address) view returns (uint256)',
    'function allowance(address,address) view returns (uint256)',
    'function approve(address,uint256) returns (bool)',
    'function creator() view returns (address)',
  ],
  quoter: [
    'function quoteExactInputSingle((( address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) poolKey, bool zeroForOne, uint128 exactAmount, bytes hookData) params) returns (uint256 amountOut, uint256 gasEstimate)',
  ],
  stateView: [
    'function getSlot0(bytes32 poolId) view returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee)',
  ],
}

const LAST_WALLET_KEY = 'gl_last_wallet_rdns'
const discoveredWallets = new Map<string, { info: any; provider: any }>()

// â”€â”€ Read-only provider (no wallet needed) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
let _readProvider: any = null
export async function getReadProvider() {
  if (_readProvider) return _readProvider
  const { JsonRpcProvider } = await import('ethers')
  _readProvider = new JsonRpcProvider(CFG.rpc)
  return _readProvider
}

export async function getContract(address: string, abi: string[], signerOrProvider?: any) {
  const { Contract } = await import('ethers')
  const p = signerOrProvider || await getReadProvider()
  return new Contract(address, abi, p)
}

// â”€â”€ Wallet hook â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export function useWallet() {
  const [account, setAccount]   = useState<string | null>(null)
  const [signer,  setSigner]    = useState<any>(null)
  const [connecting, setConnecting] = useState(false)
  const [wallets, setWallets]   = useState<{ info: any; provider: any }[]>([])

  // Discover EIP-6963 wallets
  useEffect(() => {
    if (typeof window === 'undefined') return

    const handler = (e: any) => {
      const { info, provider } = e.detail
      if (info?.rdns) {
        discoveredWallets.set(info.rdns, { info, provider })
        setWallets([...discoveredWallets.values()])
      }
    }
    window.addEventListener('eip6963:announceProvider', handler)
    window.dispatchEvent(new Event('eip6963:requestProvider'))
    setTimeout(() => window.dispatchEvent(new Event('eip6963:requestProvider')), 300)

    // Fallback injected wallets
    setTimeout(() => {
      if (discoveredWallets.size === 0 && (window as any).ethereum) {
        const eths = (window as any).ethereum.providers || [(window as any).ethereum]
        eths.forEach((p: any, i: number) => {
          let name = 'Injected Wallet'
          if (p.isMetaMask) name = 'MetaMask'
          else if (p.isOkxWallet || p.isOKExWallet) name = 'OKX Wallet'
          else if (p.isRabby) name = 'Rabby'
          else if (p.isCoinbaseWallet) name = 'Coinbase Wallet'
          const rdns = 'injected-' + i
          if (!discoveredWallets.has(rdns)) {
            discoveredWallets.set(rdns, { info: { rdns, name, icon: '' }, provider: p })
          }
        })
        setWallets([...discoveredWallets.values()])
      }
    }, 500)

    return () => window.removeEventListener('eip6963:announceProvider', handler)
  }, [])

  // Auto-reconnect
  useEffect(() => {
    const rdns = localStorage.getItem(LAST_WALLET_KEY)
    if (!rdns) return
    setTimeout(async () => {
      let w = discoveredWallets.get(rdns)
      if (!w) {
        const list = [...discoveredWallets.values()]
        w = list[0]
      }
      if (w) await connectWith(w, true)
    }, 600)
  }, [])

  const connectWith = useCallback(async (w: { info: any; provider: any }, silent = false) => {
    setConnecting(true)
    try {
      const { BrowserProvider } = await import('ethers')
      const prov = new BrowserProvider(w.provider)
      if (silent) {
        const accs = await w.provider.request({ method: 'eth_accounts' })
        if (!accs?.length) return false
      } else {
        await prov.send('eth_requestAccounts', [])
      }
      // Switch to Base
      const net = await prov.getNetwork()
      if (Number(net.chainId) !== CFG.chainId) {
        try {
          await w.provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: CFG.chainHex }] })
        } catch (e: any) {
          if (e.code === 4902) {
            await w.provider.request({
              method: 'wallet_addEthereumChain',
              params: [{ chainId: CFG.chainHex, chainName: 'Base', nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: ['https://mainnet.base.org'], blockExplorerUrls: ['https://basescan.org'] }],
            })
          }
        }
      }
      const prov2 = new BrowserProvider(w.provider)
      const s = await prov2.getSigner()
      const addr = await s.getAddress()
      setSigner(s)
      setAccount(addr)
      localStorage.setItem(LAST_WALLET_KEY, w.info.rdns)
      // bind events
      w.provider.on?.('accountsChanged', (accs: string[]) => {
        if (!accs?.length) disconnect()
        else window.location.reload()
      })
      w.provider.on?.('chainChanged', () => window.location.reload())
      return true
    } catch (e: any) {
      if (!silent) console.error('connect failed', e)
      return false
    } finally {
      setConnecting(false)
    }
  }, [])

  const disconnect = useCallback(() => {
    setAccount(null)
    setSigner(null)
    localStorage.removeItem(LAST_WALLET_KEY)
  }, [])

  return { account, signer, connecting, wallets, connectWith, disconnect }
}

// â”€â”€ Formatting helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export function fmtAge(ts: number | null | undefined): string {
  if (!ts) return '--'
  const now  = Math.floor(Date.now() / 1000)
  const diff = now - ts
  if (diff < 0)        return 'just now'
  if (diff < 60)       return 'a second ago'
  if (diff < 120)      return 'a minute ago'
  if (diff < 3600)     return `${Math.floor(diff / 60)}m`
  if (diff < 7200)     return 'an hour ago'
  if (diff < 86400)    return `${Math.floor(diff / 3600)}h`
  if (diff < 172800)   return 'a day ago'
  if (diff < 2592000)  return `${Math.floor(diff / 86400)}d`
  if (diff < 5184000)  return 'a month ago'
  if (diff < 31536000) return `${Math.floor(diff / 2592000)}mo`
  if (diff < 63072000) return 'a year ago'
  return `${Math.floor(diff / 31536000)}y`
}

export function fmtUsd(n: number | null | undefined): string {
  if (!n || n <= 0) return '--'
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`
  if (n >= 1)   return `$${n.toFixed(2)}`
  return `$${n.toFixed(4)}`
}

export function fmtNum(n: number | string | null | undefined): string {
  const v = Number(n)
  if (!v || v <= 0) return '--'
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`
  return v.toFixed(0)
}

export function fmtAddr(addr: string): string {
  if (!addr || addr.length < 10) return addr
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

export function fmtEth(wei: string | bigint | number): string {
  try {
    const n = Number(BigInt(String(wei))) / 1e18
    if (n === 0) return '0'
    // Strip trailing zeros, show clean number
    if (n >= 1)      return parseFloat(n.toFixed(4)).toString()
    if (n >= 0.0001) return parseFloat(n.toFixed(6)).toString()
    if (n >= 0.00001) return parseFloat(n.toFixed(7)).toString()
    return parseFloat(n.toFixed(8)).toString()
  } catch { return '0' }
}
