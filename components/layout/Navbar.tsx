'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import { useWallet, fmtAddr } from '@/hooks/useWallet'
import { searchTokens, type Token } from '@/lib/supabase'
import { fmtUsd } from '@/hooks/useWallet'
import LaunchModal from './LaunchModal'

export default function Navbar() {
  const pathname = usePathname()
  const { account, wallets, connectWith, disconnect, connecting } = useWallet()
  const [query, setQuery]           = useState('')
  const [results, setResults]       = useState<Token[]>([])
  const [showSearch, setShowSearch] = useState(false)
  const [showLaunch, setShowLaunch] = useState(false)
  const [showWalletMenu, setShowWalletMenu] = useState(false)
  const [showWalletModal, setShowWalletModal] = useState(false)
  const [scrolled, setScrolled]     = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!query.trim()) { setResults([]); return }
    const t = setTimeout(async () => {
      const r = await searchTokens(query)
      setResults(r)
    }, 300)
    return () => clearTimeout(t)
  }, [query])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearch(false); setQuery(''); setResults([])
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const navLinks = [
    { href: '/',          label: 'Feed' },
    { href: '/my-tokens', label: 'My Tokens' },
    { href: '/portfolio', label: 'Portfolio' },
    { href: '/docs',      label: 'Docs' },
  ]

  return (
    <>
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-[#050a0e]/90 backdrop-blur-xl border-b border-[rgba(0,255,135,0.08)]' : 'bg-transparent'
      }`}>
        <div className="max-w-[1400px] mx-auto px-4 h-16 flex items-center gap-4">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#00ff87] to-[#00d4ff] flex items-center justify-center shadow-[0_0_20px_rgba(0,255,135,0.4)]">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 2L13 5v6L8 14 3 11V5L8 2z" stroke="#050a0e" strokeWidth="1.5" strokeLinejoin="round"/>
                <path d="M8 6v4M6 8h4" stroke="#050a0e" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            <span className="font-display font-800 text-[15px] text-white tracking-tight">gitlawnch</span>
          </Link>

          {/* Nav */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map(l => (
              <Link key={l.href} href={l.href}
                className={`px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all ${
                  pathname === l.href ? 'text-[#00ff87] bg-[rgba(0,255,135,0.08)]' : 'text-[#6b8fa3] hover:text-white'
                }`}>
                {l.label}
              </Link>
            ))}
          </div>

          {/* Search */}
          <div className="flex-1 max-w-md mx-auto" ref={searchRef}>
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[#3a5568]" width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35" strokeLinecap="round"/>
              </svg>
              <input value={query}
                onChange={e => { setQuery(e.target.value); setShowSearch(true) }}
                onFocus={() => setShowSearch(true)}
                onKeyDown={e => {
                  if (e.key === "Enter" && /^0x[a-fA-F0-9]{40}$/.test(query)) {
                    window.location.href = `/profile/${query}`
                  }
                }}
                placeholder="Search token, symbol, address, or creator..."
                className="input-dark w-full pl-9 pr-4 py-2 text-[13px]" />
              {showSearch && (query || results.length > 0) && (
                <div className="absolute top-full mt-2 left-0 right-0 glass rounded-xl overflow-hidden shadow-2xl z-50">
                  {results.length === 0 && query && (
                    /^0x[a-fA-F0-9]{40}$/.test(query)
                      ? <a href={`/profile/${query}`} className="flex items-center gap-3 px-4 py-3 hover:bg-[rgba(0,255,135,0.04)] transition-colors">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#00ff87] to-[#00d4ff] flex items-center justify-center text-[#050a0e] font-bold text-sm shrink-0">
                            {query.slice(2,4).toUpperCase()}
                          </div>
                          <div>
                            <div className="text-[13px] font-medium text-white">{query.slice(0,6)}...{query.slice(-4)}</div>
                            <div className="text-[11px] text-second">View creator profile</div>
                          </div>
                        </a>
                      : <div className="p-4 text-center text-[13px] text-second">No tokens found</div>
                  )}
                  {results.map(t => (
                    <Link key={t.id} href={`/token/${t.id}`}
                      onClick={() => { setShowSearch(false); setQuery('') }}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-[rgba(0,255,135,0.04)] transition-colors">
                      <div className="token-avatar text-sm">{t.symbol[0]}</div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-medium text-white">{t.name}</div>
                        <div className="text-[11px] text-second font-mono">${t.symbol}</div>
                      </div>
                      <div className="text-[12px] text-second font-mono">{fmtUsd(t.market_cap_usd)}</div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right */}
          <div className="flex items-center gap-2 shrink-0">
            <a href="https://x.com/Gitlawnch" target="_blank" rel="noopener noreferrer"
              className="w-9 h-9 rounded-lg flex items-center justify-center text-[#6b8fa3] hover:text-white hover:bg-white/5 transition-all">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.258 5.63zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
            </a>

            <button onClick={() => setShowLaunch(true)} className="btn-green px-4 py-2 text-[13px] flex items-center gap-1.5">
              <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                <path d="M12 5v14M5 12h14" strokeLinecap="round"/>
              </svg>
              Launch Token
            </button>

            {account ? (
              <div className="relative">
                <button onClick={() => setShowWalletMenu(!showWalletMenu)} className="btn-wallet px-3 py-2 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#00ff87]" />
                  {fmtAddr(account)}
                  <svg width="10" height="10" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"/>
                  </svg>
                </button>
                {showWalletMenu && (
                  <div className="absolute right-0 top-full mt-2 w-48 glass rounded-xl overflow-hidden shadow-2xl z-50">
                    <button onClick={() => { navigator.clipboard.writeText(account); setShowWalletMenu(false) }}
                      className="w-full text-left px-4 py-3 text-[13px] text-second hover:text-white hover:bg-white/5 transition-colors">
                      Copy Address
                    </button>
                    <a href={`https://basescan.org/address/${account}`} target="_blank" rel="noopener noreferrer"
                      className="block px-4 py-3 text-[13px] text-second hover:text-white hover:bg-white/5 transition-colors">
                      View on Basescan
                    </a>
                    <button onClick={() => { setShowWalletMenu(false); setShowWalletModal(true) }}
                      className="w-full text-left px-4 py-3 text-[13px] text-second hover:text-white hover:bg-white/5 transition-colors">
                      Switch Wallet
                    </button>
                    <div className="divider" />
                    <button onClick={() => { disconnect(); setShowWalletMenu(false) }}
                      className="w-full text-left px-4 py-3 text-[13px] text-[#ff4466] hover:bg-[rgba(255,68,102,0.06)] transition-colors">
                      Disconnect
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button onClick={() => setShowWalletModal(true)} className="btn-wallet px-3 py-2 text-[13px]">
                Connect Wallet
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Wallet Modal */}
      {showWalletModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 modal-backdrop"
          onClick={e => e.target === e.currentTarget && setShowWalletModal(false)}>
          <div className="glass w-full max-w-sm rounded-2xl p-6 shadow-2xl fade-up">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="font-display text-lg font-700 text-white">Connect Wallet</h2>
                <p className="text-[12px] text-second mt-0.5">Choose a wallet to connect</p>
              </div>
              <button onClick={() => setShowWalletModal(false)} className="text-second hover:text-white">
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round"/>
                </svg>
              </button>
            </div>

            <div className="space-y-2">
              {wallets.length === 0 ? (
                <div className="text-center py-6 text-[13px] text-second">
                  No wallet detected.<br/>
                  <a href="https://metamask.io" target="_blank" rel="noopener noreferrer" className="text-green hover:underline">Install MetaMask</a>
                  {' or '}
                  <a href="https://www.coinbase.com/wallet" target="_blank" rel="noopener noreferrer" className="text-green hover:underline">Coinbase Wallet</a>
                </div>
              ) : wallets.map(w => (
                <button key={w.info.rdns} onClick={async () => {
                  await connectWith(w)
                  setShowWalletModal(false)
                }}
                  disabled={connecting}
                  className="w-full flex items-center gap-3 p-4 rounded-xl border border-[rgba(255,255,255,0.08)] hover:border-[rgba(0,255,135,0.3)] hover:bg-[rgba(0,255,135,0.04)] transition-all disabled:opacity-50">
                  {w.info.icon
                    ? <img src={w.info.icon} alt="" className="w-8 h-8 rounded-lg shrink-0" />
                    : <div className="w-8 h-8 rounded-lg bg-[rgba(0,255,135,0.1)] flex items-center justify-center text-green font-bold shrink-0">{w.info.name[0]}</div>
                  }
                  <div className="flex-1 text-left">
                    <div className="text-[14px] font-medium text-white">{w.info.name}</div>
                    <div className="text-[11px] text-second">Connect to Base Mainnet</div>
                  </div>
                  {connecting
                    ? <div className="w-4 h-4 border-2 border-[#00ff87] border-t-transparent rounded-full animate-spin" />
                    : <svg width="14" height="14" fill="none" stroke="#6b8fa3" viewBox="0 0 24 24" strokeWidth="2"><path d="m9 18 6-6-6-6" strokeLinecap="round"/></svg>
                  }
                </button>
              ))}
            </div>

            <p className="text-[11px] text-muted text-center mt-4">
              By connecting you agree to our{' '}
              <Link href="/docs" className="text-second hover:text-white transition-colors">Terms</Link>
            </p>
          </div>
        </div>
      )}

      {showLaunch && (
        <LaunchModal
          onClose={() => setShowLaunch(false)}
          account={account}
          onConnect={() => { setShowLaunch(false); setShowWalletModal(true) }}
        />
      )}
    </>
  )
}

