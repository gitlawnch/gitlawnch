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
  icons: {
    icon: 'https://nwkrwvxdttsosikoweop.supabase.co/storage/v1/object/public/token-logos/ChatGPT%20Image%201%20Jun%202026,%2016.50.34.png',
    shortcut: 'https://nwkrwvxdttsosikoweop.supabase.co/storage/v1/object/public/token-logos/ChatGPT%20Image%201%20Jun%202026,%2016.50.34.png',
    apple: 'https://nwkrwvxdttsosikoweop.supabase.co/storage/v1/object/public/token-logos/ChatGPT%20Image%201%20Jun%202026,%2016.50.34.png',
  },
  openGraph: {
    title:       'gitlawnch - Token Launchpad on Base',
    description: 'Launch your token on Base with instant Uniswap V4 liquidity.',
    url:         'https://gitlawnch.xyz',
    images: [{ url: 'https://nwkrwvxdttsosikoweop.supabase.co/storage/v1/object/public/token-logos/ChatGPT%20Image%201%20Jun%202026,%2016.50.34.png', width: 1200, height: 630 }],
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
          <div style={{ height: 10, background: 'rgba(6,6,6,0.95)' }} />
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
