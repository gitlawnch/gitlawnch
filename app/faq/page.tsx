'use client'
import { useState } from 'react'
import Link from 'next/link'

const faqs = [
  {
    q: 'What is gitlawnch?',
    a: 'gitlawnch is a token launchpad on Base that lets anyone deploy a token with a live Uniswap V4 trading pool in under 2 minutes. No coding required.'
  },
  {
    q: 'How much does it cost to launch a token?',
    a: 'Launching is free. You only pay Base network gas fees (usually less than $0.50). There are no platform launch fees.'
  },
  {
    q: 'What is the token supply?',
    a: 'Every gitlawnch token has a fixed supply of 100,000,000,000 (100 billion). The supply is minted once at launch and can never be increased — there is no mint function.'
  },
  {
    q: 'How does the 1% trading fee work?',
    a: 'Every swap charges a 1% fee on the input amount. 80% goes to the token creator (you), and 20% goes to the gitlawnch platform. Fees accumulate in the Locker contract and can be claimed at any time.'
  },
  {
    q: 'When can I claim my creator fees?',
    a: 'You can claim your fees at any time from the "My Tokens" page or the token detail page. There is no lock-up period.'
  },
  {
    q: 'Is there a bonding curve?',
    a: 'No. gitlawnch launches directly into a Uniswap V4 pool with your full token supply as single-sided liquidity. There is no bonding curve, no presale, and no graduation mechanism.'
  },
  {
    q: 'Can I rug pull my own token?',
    a: 'No. The token creator does not have any special access to the pool liquidity. The liquidity is held by the Uniswap V4 PoolManager contract, not by the creator or gitlawnch.'
  },
  {
    q: 'What network is gitlawnch on?',
    a: 'gitlawnch runs on Base Mainnet (Chain ID: 8453). Base is an Ethereum L2 by Coinbase with very low fees (usually under $0.01 per transaction).'
  },
  {
    q: 'How do I add Base Mainnet to MetaMask?',
    a: 'Go to chainlist.org and search for "Base". Click "Add to MetaMask". Alternatively, gitlawnch will prompt you to add and switch to Base when you connect your wallet.'
  },
  {
    q: 'What is a vanity address?',
    a: 'Every gitlawnch token address ends in "a19" — this is a vanity suffix mined using CREATE2. It makes gitlawnch tokens easily identifiable on-chain.'
  },
  {
    q: 'Can I add metadata (logo, description) after launch?',
    a: 'Yes. Token metadata (logo, bio, socials) is stored off-chain in the gitlawnch database. You can update it at any time from the token detail page — no transaction required.'
  },
  {
    q: 'Is gitlawnch audited?',
    a: 'The contracts have not been formally audited. The code is open source and verifiable on BaseScan. Use gitlawnch at your own risk. Never invest more than you can afford to lose.'
  },
  {
    q: 'How is the price determined?',
    a: 'Price is determined by the Uniswap V4 AMM (x*y=k). It moves based on buys and sells. There is no oracle or artificial price floor.'
  },
  {
    q: 'Can I list my token on Gecko Terminal / DexScreener?',
    a: 'Yes. Once your token has some trading activity, it will automatically be picked up by GeckoTerminal and DexScreener since they index all Uniswap V4 pools on Base.'
  },
]

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className={`glass overflow-hidden transition-all duration-200 ${open ? 'border-[rgba(0,255,135,0.2)]' : ''}`}>
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 text-left gap-4">
        <span className={`text-[14px] font-medium transition-colors ${open ? 'text-white' : 'text-[#d0e8e0]'}`}>{q}</span>
        <svg className={`w-4 h-4 text-second shrink-0 transition-transform duration-200 ${open ? 'rotate-180 text-green' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
          <path d="m6 9 6 6 6-6" strokeLinecap="round"/>
        </svg>
      </button>
      {open && (
        <div className="px-5 pb-5 border-t border-[rgba(255,255,255,0.04)]">
          <p className="text-[13px] text-second leading-relaxed pt-4">{a}</p>
        </div>
      )}
    </div>
  )
}

export default function FAQPage() {
  return (
    <div className="min-h-screen pt-20">
      <div className="max-w-2xl mx-auto px-4 py-12">

        <div className="text-center mb-12 fade-up">
          <h1 className="font-display text-4xl font-800 gradient-text mb-3">FAQ</h1>
          <p className="text-[14px] text-second">Frequently asked questions about gitlawnch.</p>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <div key={i} className={`fade-up-${Math.min(i+1,5)}`}>
              <FAQItem q={faq.q} a={faq.a} />
            </div>
          ))}
        </div>

        <div className="text-center mt-12 fade-up">
          <p className="text-[13px] text-second mb-4">Didn't find your answer?</p>
          <div className="flex items-center justify-center gap-4">
            <Link href="/docs" className="btn-wallet px-5 py-2.5 text-[13px]">Read Docs</Link>
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
