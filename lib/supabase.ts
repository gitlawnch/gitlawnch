import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!


export const MIN_ACTIVITY_USD = 10

export const supabase = createClient(supabaseUrl, supabaseKey)

export interface Token {
  id:                   string
  name:                 string
  symbol:               string
  creator:              string
  launch_tx:            string
  launch_block:         number
  launch_time:          number
  price_weth:           number
  price_usd:            number
  market_cap_usd:       number
  volume_24h_usd:       number
  txns_24h:             number
  buy_count_24h:        number
  sell_count_24h:       number
  total_volume_usd:     number
  total_txns:           number
  holder_count:         number
  creator_fees_earned:  number
  platform_fees_earned: number
  // from token_metadata join
  logo_url?:    string | null
  description?: string | null
  website?:     string | null
  twitter?:     string | null
  telegram?:    string | null
  discord?:     string | null
}

export interface Swap {
  id:           string
  token_id:     string
  tx_hash:      string
  block_number: number
  timestamp:    number
  sender:       string
  is_buy:       boolean
  amount_in:    string
  fee_amount:   string
  fee_currency: string
  price_usd:    number
}

// Normalize token_metadata nested join into flat Token object
function normalizeToken(raw: any): Token {
  const meta = Array.isArray(raw.token_metadata)
    ? raw.token_metadata[0]
    : raw.token_metadata
  return {
    ...raw,
    logo_url:    meta?.logo_url    ?? null,
    description: meta?.description ?? null,
    website:     meta?.website     ?? null,
    twitter:     meta?.twitter     ?? null,
    telegram:    meta?.telegram    ?? null,
    discord:     meta?.discord     ?? null,
    token_metadata: undefined,
  }
}

const META_SELECT = '*, token_metadata(logo_url, description, website, twitter, telegram, discord)'

// ── Queries ───────────────────────────────────────────────────────────────────

export async function getNewTokens(limit = 30): Promise<Token[]> {
  const { data } = await supabase
    .from('tokens')
    .select(META_SELECT)
    .order('launch_time', { ascending: false })
    .limit(limit)
  return (data || []).map(normalizeToken)
}

export async function getTrendingTokens(limit = 30): Promise<Token[]> {
  const { data } = await supabase
    .from('tokens')
    .select(META_SELECT)
    .gt('total_txns', 0)
    .order('volume_24h_usd', { ascending: false })
    .limit(limit)
  return (data || []).map(normalizeToken)
}

export async function getTopVolumeTokens(limit = 30): Promise<Token[]> {
  const { data } = await supabase
    .from('tokens')
    .select(META_SELECT)
    .gt('total_volume_usd', 0)
    .order('total_volume_usd', { ascending: false })
    .limit(limit)
  return (data || []).map(normalizeToken)
}

export async function getToken(address: string): Promise<Token | null> {
  const { data } = await supabase
    .from('tokens')
    .select(META_SELECT)
    .eq('id', address.toLowerCase())
    .single()
  return data ? normalizeToken(data) : null
}

export async function getTokenSwaps(tokenId: string, limit = 50): Promise<Swap[]> {
  const { data } = await supabase
    .from('swaps')
    .select('*')
    .eq('token_id', tokenId.toLowerCase())
    .order('timestamp', { ascending: false })
    .limit(limit)
  return data || []
}

export async function searchTokens(query: string): Promise<Token[]> {
  const { data } = await supabase
    .from('tokens')
    .select(META_SELECT)
    .or(`name.ilike.%${query}%,symbol.ilike.%${query}%,id.ilike.%${query}%`)
    .limit(20)
  return (data || []).map(normalizeToken)
}

export async function getCreatorTokens(creator: string): Promise<Token[]> {
  const { data } = await supabase
    .from('tokens')
    .select(META_SELECT)
    .eq('creator', creator.toLowerCase())
    .order('launch_time', { ascending: false })
  return (data || []).map(normalizeToken)
}

export async function getStats() {
  const [
    { count: tokenCount },
    { count: swapCount  },
    { data: weth        },
    { data: lb          },
  ] = await Promise.all([
    supabase.from('tokens').select('id', { count: 'exact', head: true }),
    supabase.from('swaps').select('id',  { count: 'exact', head: true }),
    supabase.from('weth_price').select('price_usd').eq('id', 'latest').single(),
    supabase.from('last_block').select('block_number').eq('id', 'singleton').single(),
  ])
  return {
    totalTokens: tokenCount ?? 0,
    totalSwaps:  swapCount  ?? 0,
    wethPrice:   (weth as any)?.price_usd  ?? 0,
    lastBlock:   (lb   as any)?.block_number ?? 0,
  }
}
