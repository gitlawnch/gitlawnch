import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="relative mt-24 border-t border-[rgba(0,255,135,0.08)]">
      <div className="max-w-[1400px] mx-auto px-4 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">

          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2.5 mb-3">
              <div style={{ width: 32, height: 32, borderRadius: 9, overflow: 'hidden', flexShrink: 0 }}>
                <img src="https://nwkrwvxdttsosikoweop.supabase.co/storage/v1/object/public/token-logos/ChatGPT%20Image%201%20Jun%202026,%2016.50.34.png" alt="gitlawnch" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              <span className="font-display font-700 text-white text-[14px]">gitlawnch</span>
            </div>
            <p className="text-[12px] text-second leading-relaxed">
              The fairest token launchpad on Base. 100B fixed supply, instant Uniswap V4 pool, 1% trading fee — 80% to creators.
            </p>
            <div className="flex items-center gap-2 mt-4">
              {/* X / Twitter */}
              <a href="https://x.com/Gitlawnch" target="_blank" rel="noopener noreferrer"
                className="w-8 h-8 rounded-lg border border-[rgba(255,255,255,0.08)] flex items-center justify-center text-second hover:text-white hover:border-[rgba(26,255,110,0.3)] transition-all"
                title="Twitter / X">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.258 5.63zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </a>
              {/* GitHub */}
              <a href="https://github.com/gitlawnch/gitlawnch" target="_blank" rel="noopener noreferrer"
                className="w-8 h-8 rounded-lg border border-[rgba(255,255,255,0.08)] flex items-center justify-center text-second hover:text-white hover:border-[rgba(26,255,110,0.3)] transition-all"
                title="GitHub">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z"/>
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
