import Link from 'next/link'

export default function AboutPage() {
  return (
    <div className="min-h-screen pt-20">
      <div className="max-w-2xl mx-auto px-4 py-16">

        {/* Hero */}
        <div className="text-center mb-16 fade-up">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#00ff87] to-[#00d4ff] flex items-center justify-center mx-auto mb-6 shadow-[0_0_40px_rgba(0,255,135,0.3)]">
            <svg width="28" height="28" viewBox="0 0 16 16" fill="none">
              <path d="M8 2L13 5v6L8 14 3 11V5L8 2z" stroke="#050a0e" strokeWidth="1.5" strokeLinejoin="round"/>
              <path d="M8 6v4M6 8h4" stroke="#050a0e" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <h1 className="font-display text-4xl font-800 gradient-text mb-4">About gitlawnch</h1>
          <p className="text-[15px] text-second leading-relaxed">
            The fairest token launchpad on Base, powered by Uniswap V4.
          </p>
        </div>

        {/* Mission */}
        <div className="glass p-8 mb-6 fade-up-1">
          <h2 className="font-display text-lg font-700 text-white mb-3">Our Mission</h2>
          <p className="text-[13px] text-second leading-relaxed">
            gitlawnch was built to give everyone equal access to launch tokens on Base with zero complexity. No bonding curves, no rugs, no hidden fees — just a fair launch with instant Uniswap V4 liquidity the moment your token is deployed.
          </p>
        </div>

        {/* How it works */}
        <div className="glass p-8 mb-6 fade-up-2">
          <h2 className="font-display text-lg font-700 text-white mb-5">How It Works</h2>
          <div className="space-y-5">
            {[
              { num: '01', title: 'Deploy Your Token', desc: 'Fill in the name, symbol, and optional metadata. gitlawnch deploys an ERC-20 with a fixed 100B supply directly to Base mainnet via CREATE2.' },
              { num: '02', title: 'Instant Uniswap V4 Pool', desc: 'The factory immediately seeds a single-sided TOKEN/WETH pool on Uniswap V4 with your entire supply as liquidity.' },
              { num: '03', title: 'Trade Immediately', desc: 'Anyone can buy or sell your token the instant it launches. No waiting period, no whitelist, no presale.' },
              { num: '04', title: 'Earn Fees', desc: 'Every swap charges a 1% fee. 80% goes to you as the creator, 20% goes to the gitlawnch platform.' },
            ].map(s => (
              <div key={s.num} className="flex gap-4">
                <div className="font-mono text-[11px] text-[#00ff87] w-8 shrink-0 pt-0.5">{s.num}</div>
                <div>
                  <div className="text-[14px] font-600 text-white font-display mb-1">{s.title}</div>
                  <p className="text-[12px] text-second leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Fee structure */}
        <div className="glass p-8 mb-6 fade-up-3">
          <h2 className="font-display text-lg font-700 text-white mb-5">Fee Structure</h2>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Trading Fee',     value: '1%',   desc: 'Charged on every swap' },
              { label: 'Creator Share',   value: '80%',  desc: 'Of every trading fee', green: true },
              { label: 'Platform Share',  value: '20%',  desc: 'Keeps gitlawnch running' },
              { label: 'Launch Fee',      value: '$0',   desc: 'Free to launch', green: true },
            ].map(f => (
              <div key={f.label} className="bg-[rgba(255,255,255,0.02)] rounded-xl p-4 border border-[rgba(255,255,255,0.05)]">
                <div className="text-[10px] text-muted font-mono uppercase tracking-wider mb-1">{f.label}</div>
                <div className={`text-2xl font-display font-700 ${f.green ? 'text-green' : 'text-white'}`}>{f.value}</div>
                <div className="text-[11px] text-second mt-0.5">{f.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Tech stack */}
        <div className="glass p-8 mb-10 fade-up-4">
          <h2 className="font-display text-lg font-700 text-white mb-5">Tech Stack</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              ['Network',    'Base Mainnet (EVM L2)'],
              ['DEX',        'Uniswap V4'],
              ['Hook',       'Custom Fee Hook (1%)'],
              ['Token',      'ERC-20 + ERC20Permit'],
              ['Supply',     '100B fixed, immutable'],
              ['Indexer',    'Supabase Edge Functions'],
            ].map(([k,v]) => (
              <div key={k} className="flex items-start gap-2">
                <span className="text-[11px] text-muted font-mono w-20 shrink-0">{k}</span>
                <span className="text-[12px] text-second">{v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center fade-up-5">
          <Link href="/" className="btn-green inline-flex items-center gap-2 px-8 py-4 text-[15px]">
            <span>🚀</span> Launch Your Token
          </Link>
          <p className="text-[11px] text-muted mt-4">
            Built with ❤️ on Base ·{' '}
            <a href="https://x.com/Gitlawnch" target="_blank" rel="noopener noreferrer" className="text-second hover:text-white transition-colors">@Gitlawnch</a>
          </p>
        </div>
      </div>
    </div>
  )
}
