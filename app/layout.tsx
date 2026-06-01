import type { Metadata } from 'next'
import './globals.css'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import BackgroundCanvas from '@/components/BackgroundCanvas'
import ActivityTicker from '@/components/ActivityTicker'

export const metadata: Metadata = {
  title:       'gitlawnch - Token Launchpad on Base',
  description: 'The fairest token launchpad on Base. 100B fixed supply, instant Uniswap V4 pool, 1% trading fee split 80/20 to creator and platform.',
  metadataBase: new URL('https://gitlawnch.xyz'),
  openGraph: {
    title:       'gitlawnch - Token Launchpad on Base',
    description: 'Launch your token on Base with instant Uniswap V4 liquidity.',
    url:         'https://gitlawnch.xyz',
    siteName:    'gitlawnch',
    type:        'website',
  },
  twitter: {
    card:        'summary_large_image',
    site:        '@Gitlawnch',
    creator:     '@Gitlawnch',
    title:       'gitlawnch - Token Launchpad on Base',
    description: 'Launch your token on Base with instant Uniswap V4 liquidity.',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <BackgroundCanvas />
        <Navbar />
        <div style={{ paddingTop: 64, position: 'relative', zIndex: 1 }}>
          <ActivityTicker />
          <main>
            {children}
          </main>
          <Footer />
        </div>
      </body>
    </html>
  )
}
