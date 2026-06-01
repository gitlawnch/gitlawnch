import Link from 'next/link'

export default function DocsPage() {
  const sections = [
    {
      id: 'launch',
      title: 'Launching a Token',
      content: [
        { type: 'p', text: 'Launching a token on gitlawnch takes less than 2 minutes. Here\'s the full process:' },
        { type: 'steps', items: [
          'Connect your MetaMask wallet (Base Mainnet).',
          'Click "+ Launch Token" in the top navigation.',
          'Enter your token name and symbol (e.g. PEPE, DOGE).',
          'Optionally upload a logo, add a bio, and add social links.',
          'Click "Launch on Base" and confirm the transaction in your wallet.',
          'Your token is live instantly â€” with a Uniswap V4 pool ready to trade.',
        ]},
        { type: 'callout', text: 'Make sure you\'re on Base Mainnet (Chain ID: 8453). gitlawnch will prompt you to switch if needed.' },
      ],
    },
    {
      id: 'trading',
      title: 'Trading Tokens',
      content: [
        { type: 'p', text: 'Every gitlawnch token has its own trading page with a live chart, order book, and buy/sell widget.' },
        { type: 'steps', items: [
          'Find a token in the Feed or via search.',
          'Click on it to open the token detail page.',
          'Enter the amount of ETH you want to spend.',
          'Set your slippage tolerance (default 3%).',
          'Click "Buy" and confirm in your wallet.',
        ]},
        { type: 'p', text: 'Selling works the same way â€” switch to the "Sell" tab and enter the token amount you want to sell.' },
      ],
    },
    {
      id: 'fees',
      title: 'Fee Distribution',
      content: [
        { type: 'p', text: 'gitlawnch charges a flat 1% fee on every swap. This is the only fee â€” there are no separate LP fees.' },
        { type: 'table', rows: [
          ['Recipient',  'Share', 'Notes'],
          ['Creator',    '80%',   'Token deployer, claimable anytime'],
          ['Platform',   '20%',   'gitlawnch operations'],
        ]},
        { type: 'p', text: 'As a token creator, you can claim your accumulated fees anytime from the "My Tokens" page or the token detail page.' },
        { type: 'callout', text: 'Fees accrue in both ETH (from buys) and your token (from sells). Both sides are claimable separately.' },
      ],
    },
    {
      id: 'addresses',
      title: 'Contract Addresses',
      content: [
        { type: 'p', text: 'All gitlawnch contracts are deployed on Base Mainnet (Chain ID: 8453).' },
        { type: 'table', rows: [
          ['Contract',  'Address'],
          ['Factory',   '0x18c3B29A5a67139e947aB9f92B9cF6a99Be8421E'],
          ['Hook',      '0x8dEFd6dA5b578F50B22a358c4D859D5B538E9088'],
          ['Locker',    '0x99C4b4aa07B38FE1b30425585CAFF26f08595Cbc'],
          ['Router',    '0x2bc04eCB0675BB4eC2D046fD0e17e8ae2dAf42aC'],
        ]},
      ],
    },
    {
      id: 'security',
      title: 'Security',
      content: [
        { type: 'p', text: 'gitlawnch is built with security and fairness as core principles:' },
        { type: 'list', items: [
          'Fixed 100B supply â€” no minting function exists after deployment.',
          'Single-sided liquidity â€” no ETH is locked; you can always trade.',
          'No admin keys â€” the factory has no upgrade or pause mechanism.',
          'Open source contracts â€” verify everything on BaseScan.',
          'Fees are distributed by the Locker contract â€” not a hot wallet.',
        ]},
        { type: 'callout', text: 'gitlawnch contracts have NOT been formally audited. Use at your own risk. Never invest more than you can afford to lose.' },
      ],
    },
  ]

  return (
    <div className="min-h-screen pt-20">
      <div className="max-w-[900px] mx-auto px-4 py-12">

        {/* Header */}
        <div className="mb-12 fade-up">
          <h1 className="font-display text-4xl font-800 gradient-text mb-3">Documentation</h1>
          <p className="text-[14px] text-second">Everything you need to know about gitlawnch.</p>
        </div>

        {/* Quick nav */}
        <div className="glass p-5 mb-10 fade-up-1">
          <div className="text-[11px] text-muted font-mono uppercase tracking-wider mb-3">Quick Navigation</div>
          <div className="flex flex-wrap gap-2">
            {sections.map(s => (
              <a key={s.id} href={`#${s.id}`}
                className="px-3 py-1.5 rounded-lg text-[12px] text-second border border-[rgba(255,255,255,0.06)] hover:border-[rgba(0,255,135,0.3)] hover:text-green transition-all">
                {s.title}
              </a>
            ))}
          </div>
        </div>

        {/* Sections */}
        <div className="space-y-8">
          {sections.map((section, si) => (
            <div key={section.id} id={section.id} className={`glass p-8 fade-up-${Math.min(si+1,5)}`}>
              <h2 className="font-display text-xl font-700 text-white mb-5">{section.title}</h2>
              <div className="space-y-4">
                {section.content.map((block, bi) => {
                  if (block.type === 'p') return (
                    <p key={bi} className="text-[13px] text-second leading-relaxed">{block.text}</p>
                  )
                  if (block.type === 'callout') return (
                    <div key={bi} className="bg-[rgba(0,212,255,0.06)] border border-[rgba(0,212,255,0.15)] rounded-xl p-4 text-[12px] text-cyan leading-relaxed">
                      â„¹ï¸ {block.text}
                    </div>
                  )
                  if (block.type === 'steps') return (
                    <ol key={bi} className="space-y-2">
                      {((block as any).items as string[]).map((item, i) => (
                        <li key={i} className="flex gap-3 text-[13px] text-second">
                          <span className="font-mono text-[11px] text-green bg-[rgba(0,255,135,0.1)] rounded px-1.5 py-0.5 h-fit shrink-0">{String(i+1).padStart(2,'0')}</span>
                          {item}
                        </li>
                      ))}
                    </ol>
                  )
                  if (block.type === 'list') return (
                    <ul key={bi} className="space-y-2">
                      {((block as any).items as string[]).map((item, i) => (
                        <li key={i} className="flex gap-2 text-[13px] text-second">
                          <span className="text-green mt-1 shrink-0">â†’</span>{item}
                        </li>
                      ))}
                    </ul>
                  )
                  if (block.type === 'table') return (
                    <div key={bi} className="overflow-x-auto rounded-xl border border-[rgba(255,255,255,0.06)]">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)]">
                            {((block as any).rows as string[][])[0].map((h,i) => (
                              <th key={i} className="px-4 py-2.5 text-left text-[10px] text-muted uppercase tracking-wider font-mono">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {((block as any).rows as string[][]).slice(1).map((row, ri) => (
                            <tr key={ri} className="border-b border-[rgba(255,255,255,0.03)] last:border-0">
                              {row.map((cell, ci) => (
                                <td key={ci} className="px-4 py-2.5 text-[12px] font-mono text-second break-all">{cell}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                  return null
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer CTA */}
        <div className="text-center mt-12 fade-up">
          <p className="text-[13px] text-second mb-4">Still have questions?</p>
          <div className="flex items-center justify-center gap-4">
            <Link href="/faq" className="btn-wallet px-5 py-2.5 text-[13px]">Read FAQ</Link>
            <a href="https://x.com/Gitlawnch" target="_blank" rel="noopener noreferrer"
              className="btn-green px-5 py-2.5 text-[13px] flex items-center gap-2">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.258 5.63zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
              Ask on X
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}


