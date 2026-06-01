import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="relative mt-24 border-t border-[rgba(0,255,135,0.08)]">
      <div className="max-w-[1400px] mx-auto px-4 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">

          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#00ff87] to-[#00d4ff] flex items-center justify-center">
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                  <path d="M8 2L13 5v6L8 14 3 11V5L8 2z" stroke="#050a0e" strokeWidth="1.5" strokeLinejoin="round"/>
                  <path d="M8 6v4M6 8h4" stroke="#050a0e" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </div>
              <span className="font-display font-700 text-white text-[14px]">gitlawnch</span>
            </div>
            <p className="text-[12px] text-second leading-relaxed">
              The fairest token launchpad on Base. 100B fixed supply, instant Uniswap V4 pool, 1% trading fee.
            </p>
            <div className="flex items-center gap-2 mt-4">
              <a href="https://x.com/Gitlawnch" target="_blank" rel="noopener noreferrer"
                className="w-8 h-8 rounded-lg border border-[rgba(255,255,255,0.08)] flex items-center justify-center text-second hover:text-white hover:border-[rgba(0,255,135,0.3)] transition-all">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.258 5.63zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </a>
            </div>
          </div>

          {/* Product */}
          <div>
            <h4 className="font-display text-[11px] uppercase tracking-widest text-[#3a5568] mb-4">Product</h4>
            <ul className="space-y-2.5">
              {[
                { href: '/',          label: 'Feed' },
                { href: '/my-tokens', label: 'My Tokens' },
                { href: '/portfolio', label: 'Portfolio' },
              ].map(l => (
                <li key={l.href}>
                  <Link href={l.href} className="text-[13px] text-second hover:text-white transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="font-display text-[11px] uppercase tracking-widest text-[#3a5568] mb-4">Resources</h4>
            <ul className="space-y-2.5">
              {[
                { href: '/docs',  label: 'Documentation' },
                { href: '/faq',   label: 'FAQ' },
                { href: '/about', label: 'About' },
              ].map(l => (
                <li key={l.href}>
                  <Link href={l.href} className="text-[13px] text-second hover:text-white transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Network */}
          <div>
            <h4 className="font-display text-[11px] uppercase tracking-widest text-[#3a5568] mb-4">Network</h4>
            <div className="flex items-center gap-2 text-[13px] text-second">
              <div className="live-dot" />
              Base Mainnet
            </div>
            <div className="mt-3 text-[12px] text-muted">Chain ID: 8453</div>
            <a href="https://basescan.org" target="_blank" rel="noopener noreferrer"
              className="mt-2 block text-[12px] text-second hover:text-[#00ff87] transition-colors">
              BaseScan ↗
            </a>
          </div>
        </div>

        <div className="divider" />
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-6">
          <p className="text-[12px] text-muted">
            © 2026 gitlawnch · Powered by Uniswap V4 on Base
          </p>
          <p className="text-[12px] text-muted text-center">
            Info is for reference only, not financial advice. DYOR.
          </p>
        </div>
      </div>
    </footer>
  )
}
