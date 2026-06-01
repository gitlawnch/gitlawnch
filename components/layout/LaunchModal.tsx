'use client'
import { useState, useRef } from 'react'
import { useWallet, CFG, ABI, getContract } from '@/hooks/useWallet'
import { supabase } from '@/lib/supabase'

interface Props {
  onClose:   () => void
  account:   string | null
  onConnect: () => void
}

export default function LaunchModal({ onClose, account, onConnect }: Props) {
  const { signer } = useWallet()
  const [name,        setName]        = useState('')
  const [symbol,      setSymbol]      = useState('')
  const [bio,         setBio]         = useState('')
  const [website,     setWebsite]     = useState('')
  const [telegram,    setTelegram]    = useState('')
  const [twitter,     setTwitter]     = useState('')
  const [discord,     setDiscord]     = useState('')
  // Helpers to build full URLs
  const telegramUrl = telegram ? `https://t.me/${telegram.replace(/^@/, '').replace(/^https?:\/\/t\.me\//, '')}` : null
  const twitterUrl  = twitter  ? `https://x.com/${twitter.replace(/^@/, '').replace(/^https?:\/\/x\.com\//, '').replace(/^https?:\/\/twitter\.com\//, '')}` : null
  const discordUrl  = discord  ? `https://discord.gg/${discord.replace(/^https?:\/\/discord\.gg\//, '')}` : null
  const [showSocials, setShowSocials] = useState(false)
  const [logoFile,    setLogoFile]    = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [loading,     setLoading]     = useState(false)
  const [step,        setStep]        = useState('')
  const [done,        setDone]        = useState(false)
  const [error,       setError]       = useState('')
  const [launchResult, setLaunchResult] = useState<{ txHash: string; tokenAddr: string; tokenName: string; tokenSymbol: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function handleLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 1_048_576) { setError('Image max 1MB'); return }
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
    setError('')
  }

  async function uploadLogo(tokenAddr: string): Promise<string | null> {
    if (!logoFile) return null
    try {
      const ext  = logoFile.name.split('.').pop() || 'png'
      const path = `${tokenAddr}.${ext}`
      const { error: uploadErr } = await supabase.storage
        .from('token-logos')
        .upload(path, logoFile, { upsert: true, contentType: logoFile.type })
      if (uploadErr) { console.error('logo upload error:', uploadErr); return null }
      const { data } = supabase.storage.from('token-logos').getPublicUrl(path)
      return data.publicUrl
    } catch (e) { console.error('logo upload exception:', e); return null }
  }

  async function saveMetadata(tokenAddr: string, logoUrl: string | null) {
    const payload = {
      token_id:    tokenAddr,
      logo_url:    logoUrl  || null,
      description: bio      || null,
      website:     website  || null,
      twitter:     twitter  || null,
      telegram:    telegram || null,
      discord:     discord  || null,
      updated_at:  new Date().toISOString(),
    }
    const { error: insertErr } = await supabase.from('token_metadata').insert(payload)
    if (insertErr) {
      console.warn('insert failed, trying update:', insertErr.message)
      const { error: updateErr } = await supabase
        .from('token_metadata').update(payload).eq('token_id', tokenAddr)
      if (updateErr) console.error('update also failed:', updateErr.message)
    }
  }

  async function launch() {
    if (!account) { onConnect(); return }
    if (!signer)  { onConnect(); return }
    if (!name.trim() || !symbol.trim()) { setError('Name and symbol are required'); return }
    if (symbol.length > 10) { setError('Symbol max 10 characters'); return }

    setLoading(true); setError(''); setStep(''); setDone(false)
    try {
      const factory = await getContract(CFG.factory, ABI.factory, signer)

      // 1. Find vanity salt
      setStep('Finding vanity address (a19)... ~10-30s')
      let found = false, salt = '', predicted = ''
      let start = 0n
      for (let attempt = 0; attempt < 10 && !found; attempt++) {
        try {
          const res = await factory.findSalt(name, symbol, account, start, 200000n)
          found = res[0]; salt = res[1]; predicted = res[2]
          if (!found) start += 200000n
        } catch (e: any) { start += 200000n }
      }
      if (!found) { setError('Could not find vanity address. Try different name/symbol.'); setLoading(false); return }

      const tokenAddr = predicted.toLowerCase()
      setStep(`Found: ${tokenAddr.slice(0,8)}...${tokenAddr.slice(-4)} - Confirm in wallet...`)

      // 2. Launch on-chain
      const tx = await factory.launch({ name, symbol: symbol.toUpperCase(), creator: account, salt })
      setStep('Waiting for confirmation...')
      const receipt = await tx.wait()

      // 3. Insert token to Supabase FIRST (metadata has FK constraint)
      setStep('Saving token...')
      await supabase.from('tokens').upsert({
        id:           tokenAddr,
        name,
        symbol:       symbol.toUpperCase(),
        creator:      account.toLowerCase(),
        launch_tx:    tx.hash,
        launch_block: receipt?.blockNumber || 0,
        launch_time:  Math.floor(Date.now() / 1000),
        price_weth:   0, price_usd: 0, market_cap_usd: 0,
      }, { onConflict: 'id' })

      // 4. Upload logo
      setStep('Uploading logo...')
      const logoUrl = await uploadLogo(tokenAddr)

      // 5. Save metadata
      setStep('Saving metadata...')
      await saveMetadata(tokenAddr, logoUrl)

      // 6. Done
      setDone(true)
      setLaunchResult({ txHash: tx.hash, tokenAddr, tokenName: name, tokenSymbol: symbol.toUpperCase() })
      setStep(`${name} launched successfully!`)

    } catch (e: any) {
      if (e.code === 4001 || e.code === 'ACTION_REJECTED') setError('Transaction rejected')
      else setError(e.shortMessage || e.message?.slice(0, 120) || 'Launch failed')
    } finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 modal-backdrop"
      onClick={e => e.target === e.currentTarget && !loading && onClose()}>
      <div className="glass w-full max-w-md rounded-2xl p-6 shadow-2xl fade-up relative max-h-[90vh] overflow-y-auto">

        <button onClick={() => !loading && onClose()} disabled={loading}
          className="absolute top-4 right-4 text-second hover:text-white transition-colors">
          <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
            <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round"/>
          </svg>
        </button>

        <div className="mb-5">
          <h2 className="font-display text-xl font-700 text-white">Launch a Token</h2>
          <p className="text-[12px] text-second mt-1">Deploy on Base · 100B fixed supply · instant Uniswap V4 pool</p>
        </div>

        <div className="space-y-3">
          <div className="flex gap-3">
            <div onClick={() => !loading && fileRef.current?.click()}
              className="w-28 h-28 rounded-xl border border-dashed border-[rgba(0,255,135,0.2)] flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-[rgba(0,255,135,0.4)] transition-colors shrink-0 overflow-hidden bg-[rgba(0,255,135,0.02)]">
              {logoPreview
                ? <img src={logoPreview} alt="logo" className="w-full h-full object-cover" />
                : <>
                    <svg width="20" height="20" fill="none" stroke="#3a5568" viewBox="0 0 24 24" strokeWidth="1.5">
                      <path d="M12 16V8m0 0-3 3m3-3 3 3" strokeLinecap="round" strokeLinejoin="round"/>
                      <rect x="3" y="3" width="18" height="18" rx="4"/>
                    </svg>
                    <span className="text-[10px] text-muted text-center px-2">JPEG/PNG<br/>1MB max</span>
                  </>
              }
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleLogo} />
            </div>
            <div className="flex-1 space-y-3">
              <input value={name} onChange={e => setName(e.target.value)} disabled={loading}
                placeholder="Token name" className="input-dark w-full px-3 py-2.5 text-[13px]" />
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#3a5568] text-[13px] font-mono">$</span>
                <input value={symbol}
                  onChange={e => setSymbol(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                  disabled={loading} placeholder="SYMBOL" maxLength={10}
                  className="input-dark w-full pl-6 pr-3 py-2.5 text-[13px] font-mono" />
              </div>
            </div>
          </div>

          <textarea value={bio} onChange={e => setBio(e.target.value)} disabled={loading}
            placeholder="Bio - what's this token about? (optional)"
            rows={2} className="input-dark w-full px-3 py-2.5 text-[13px] resize-none" />

          <button onClick={() => setShowSocials(!showSocials)} type="button"
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border border-[rgba(0,255,135,0.1)] text-[13px] text-second hover:text-white hover:border-[rgba(0,255,135,0.2)] transition-all">
            <span>Socials</span>
            <span className="text-[10px] text-muted ml-1">optional</span>
            <svg className={`ml-auto w-4 h-4 transition-transform ${showSocials ? 'rotate-180' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path d="m6 9 6 6 6-6" strokeLinecap="round"/>
            </svg>
          </button>

          {showSocials && (
            <div className="space-y-2">
              {/* Website */}
              <input value={website} onChange={e => setWebsite(e.target.value)} disabled={loading}
                placeholder="Website - https://..." className="input-dark w-full px-3 py-2 text-[12px]" />

              {/* Telegram */}
              <div className="flex items-center input-dark overflow-hidden">
                <span className="pl-3 text-[12px] text-muted whitespace-nowrap">t.me/</span>
                <input value={telegram} onChange={e => setTelegram(e.target.value.replace(/^@/, '').replace(/\s/g, ''))} disabled={loading}
                  placeholder="username" className="flex-1 bg-transparent px-2 py-2 text-[12px] outline-none" />
              </div>

              {/* Twitter/X */}
              <div className="flex items-center input-dark overflow-hidden">
                <span className="pl-3 text-[12px] text-muted whitespace-nowrap">x.com/</span>
                <input value={twitter} onChange={e => setTwitter(e.target.value.replace(/^@/, '').replace(/\s/g, ''))} disabled={loading}
                  placeholder="username" className="flex-1 bg-transparent px-2 py-2 text-[12px] outline-none" />
              </div>

              {/* Discord */}
              <div className="flex items-center input-dark overflow-hidden">
                <span className="pl-3 text-[12px] text-muted whitespace-nowrap">discord.gg/</span>
                <input value={discord} onChange={e => setDiscord(e.target.value.replace(/\s/g, ''))} disabled={loading}
                  placeholder="invite" className="flex-1 bg-transparent px-2 py-2 text-[12px] outline-none" />
              </div>
            </div>
          )}

          {error && (
            <div className="text-[12px] p-3 rounded-lg bg-[rgba(255,68,102,0.08)] text-[#ff4466] border border-[rgba(255,68,102,0.2)]">
              {error}
            </div>
          )}

          {loading && step && (
            <div className="text-[12px] p-3 rounded-lg bg-[rgba(0,212,255,0.08)] text-cyan border border-[rgba(0,212,255,0.2)] flex items-center gap-2">
              <div className="w-3 h-3 border-2 border-cyan border-t-transparent rounded-full animate-spin shrink-0" />
              {step}
            </div>
          )}
          {done && (
            <div className="text-[12px] p-3 rounded-lg bg-[rgba(0,255,135,0.08)] text-green border border-[rgba(0,255,135,0.2)]">
              {step}
            </div>
          )}

          {launchResult ? (
            <div className="space-y-3">
              {/* Success header */}
              <div className="text-center py-2">
                <div className="text-3xl mb-2">🚀</div>
                <div className="text-[15px] font-medium text-white">{launchResult.tokenName} launched!</div>
                <div className="text-[12px] text-second font-mono">${launchResult.tokenSymbol}</div>
              </div>

              {/* TX Hash */}
              <div className="bg-[rgba(0,255,135,0.04)] rounded-xl p-3 border border-[rgba(0,255,135,0.1)]">
                <div className="text-[10px] text-muted font-mono mb-1 uppercase tracking-wider">Transaction</div>
                <a href={`https://basescan.org/tx/${launchResult.txHash}`} target="_blank" rel="noopener noreferrer"
                  className="text-[12px] font-mono text-green hover:text-white transition-colors break-all">
                  {launchResult.txHash.slice(0, 20)}...{launchResult.txHash.slice(-8)} ↗
                </a>
              </div>

              {/* CA */}
              <div className="bg-[rgba(0,212,255,0.04)] rounded-xl p-3 border border-[rgba(0,212,255,0.1)]">
                <div className="text-[10px] text-muted font-mono mb-1 uppercase tracking-wider">Contract Address</div>
                <div className="flex items-center gap-2">
                  <span className="text-[12px] font-mono text-cyan break-all flex-1">
                    {launchResult.tokenAddr.slice(0, 20)}...{launchResult.tokenAddr.slice(-8)}
                  </span>
                  <button onClick={() => navigator.clipboard.writeText(launchResult!.tokenAddr)}
                    className="shrink-0 text-muted hover:text-white transition-colors">
                    <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                      <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                    </svg>
                  </button>
                </div>
              </div>

              {/* Action buttons */}
              <div className="grid grid-cols-2 gap-2">
                <a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Just launched $${launchResult.tokenSymbol} on @gitlawnch! 🚀

CA: ${launchResult.tokenAddr}

https://gitlawnch.xyz/token/${launchResult.tokenAddr}`)}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 py-3 rounded-xl bg-black border border-[rgba(255,255,255,0.1)] text-[13px] text-white hover:border-[rgba(255,255,255,0.3)] transition-all font-medium">
                  <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.26 5.632 5.905-5.632zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                  </svg>
                  Share on X
                </a>
                <button onClick={() => { onClose(); window.location.href = `/token/${launchResult!.tokenAddr}` }}
                  className="btn-green py-3 text-[13px] font-medium">
                  View Token →
                </button>
              </div>
            </div>
          ) : (
            <>
              <button onClick={launch} disabled={loading}
                className="btn-green w-full py-3.5 text-[14px] disabled:opacity-60 disabled:cursor-not-allowed">
                {loading ? 'Launching...' : account ? 'Launch on Base' : 'Connect Wallet to Launch'}
              </button>
              <p className="text-[10px] text-muted text-center">
                Gas fees apply · 100B supply · Uniswap V4 pool created instantly
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
