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
  const [showSocials, setShowSocials] = useState(false)
  const [logoFile,    setLogoFile]    = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [loading,     setLoading]     = useState(false)
  const [step,        setStep]        = useState('')
  const [done,        setDone]        = useState(false)
  const [error,       setError]       = useState('')
  const [copied,      setCopied]      = useState<'ca'|'tx'|null>(null)
  const [launchResult, setLaunchResult] = useState<{
    txHash: string; tokenAddr: string; tokenName: string; tokenSymbol: string
  } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function handleLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 1_048_576) { setError('Image must be under 1MB'); return }
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
        .from('token-logos').upload(path, logoFile, { upsert: true, contentType: logoFile.type })
      if (uploadErr) { console.error('logo upload error:', uploadErr); return null }
      const { data } = supabase.storage.from('token-logos').getPublicUrl(path)
      return data.publicUrl
    } catch (e) { console.error('logo upload exception:', e); return null }
  }

  async function saveMetadata(tokenAddr: string, logoUrl: string | null) {
    const payload = {
      token_id: tokenAddr, logo_url: logoUrl || null,
      description: bio || null, website: website || null,
      twitter: twitter || null, telegram: telegram || null,
      discord: discord || null, updated_at: new Date().toISOString(),
    }
    const { error: insertErr } = await supabase.from('token_metadata').insert(payload)
    if (insertErr) {
      await supabase.from('token_metadata').update(payload).eq('token_id', tokenAddr)
    }
  }

  async function launch() {
    if (!account) { onConnect(); return }
    if (!signer)  { onConnect(); return }
    if (!name.trim() || !symbol.trim()) { setError('Token name and symbol are required'); return }
    if (symbol.length > 10) { setError('Symbol must be 10 characters or less'); return }

    setLoading(true); setError(''); setStep(''); setDone(false)
    try {
      const factory = await getContract(CFG.factory, ABI.factory, signer)
      setStep('Finding vanity address (a19)... ~10–30s')
      let found = false, salt = '', predicted = ''
      let start = 0n
      for (let attempt = 0; attempt < 10 && !found; attempt++) {
        try {
          const res = await factory.findSalt(name, symbol, account, start, 200000n)
          found = res[0]; salt = res[1]; predicted = res[2]
          if (!found) start += 200000n
        } catch { start += 200000n }
      }
      if (!found) { setError('Could not find vanity address. Try a different name or symbol.'); setLoading(false); return }

      const tokenAddr = predicted.toLowerCase()
      setStep(`Address found: ${tokenAddr.slice(0,8)}...${tokenAddr.slice(-4)} — Confirm in wallet`)

      const tx = await factory.launch({ name, symbol: symbol.toUpperCase(), creator: account, salt })
      setStep('Waiting for on-chain confirmation...')
      const receipt = await tx.wait()

      setStep('Saving token data...')
      await supabase.from('tokens').upsert({
        id: tokenAddr, name, symbol: symbol.toUpperCase(),
        creator: account.toLowerCase(), launch_tx: tx.hash,
        launch_block: receipt?.blockNumber || 0,
        launch_time: Math.floor(Date.now() / 1000),
        price_weth: 0, price_usd: 0, market_cap_usd: 0,
      }, { onConflict: 'id' })

      setStep('Uploading logo...')
      const logoUrl = await uploadLogo(tokenAddr)
      setStep('Saving metadata...')
      await saveMetadata(tokenAddr, logoUrl)

      setDone(true)
      setLaunchResult({ txHash: tx.hash, tokenAddr, tokenName: name, tokenSymbol: symbol.toUpperCase() })

    } catch (e: any) {
      if (e.code === 4001 || e.code === 'ACTION_REJECTED') setError('Transaction rejected')
      else setError(e.shortMessage || e.message?.slice(0, 120) || 'Launch failed')
    } finally { setLoading(false) }
  }

  function copyText(text: string, type: 'ca'|'tx') {
    navigator.clipboard.writeText(text)
    setCopied(type)
    setTimeout(() => setCopied(null), 2000)
  }

  const inputStyle = {
    background: 'rgba(255,255,255,0.07)',
    border: '1px solid rgba(255,255,255,0.14)',
    color: '#e8e8e8',
    borderRadius: 10,
    padding: '10px 12px',
    fontSize: 13,
    width: '100%',
    outline: 'none',
    fontFamily: 'Inter, sans-serif',
    transition: 'border-color 0.2s',
  }

  // ── Success Modal ────────────────────────────────────────────────────────────
  if (launchResult) {
    const shareText = `🚀 Just launched $${launchResult.tokenSymbol} on @gitlawnch!\n\nCA: ${launchResult.tokenAddr}\n\nTrade now 👇\nhttps://gitlawnch.xyz/token/${launchResult.tokenAddr}`
    const shareUrl  = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`

    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 modal-backdrop">
        <div className="glass w-full max-w-md rounded-2xl shadow-2xl fade-up overflow-hidden">

          {/* Success header */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(26,255,110,0.12), rgba(26,255,110,0.04))',
            borderBottom: '1px solid rgba(26,255,110,0.15)',
            padding: '28px 24px 24px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 44, marginBottom: 10 }}>🚀</div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#fff', marginBottom: 4 }}>
              {launchResult.tokenName} is live!
            </h2>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(26,255,110,0.1)', border: '1px solid rgba(26,255,110,0.2)', borderRadius: 20, padding: '4px 12px' }}>
              <div className="live-dot" style={{ width: 6, height: 6 }} />
              <span style={{ fontSize: 12, color: '#1aff6e', fontWeight: 600, fontFamily: 'JetBrains Mono, monospace' }}>${launchResult.tokenSymbol}</span>
            </div>
          </div>

          <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>

            {/* Contract Address */}
            <div style={{ background: 'rgba(0,212,255,0.05)', border: '1px solid rgba(0,212,255,0.15)', borderRadius: 12, padding: '12px 14px' }}>
              <div style={{ fontSize: 10, color: '#00d4ff', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 600, fontFamily: 'JetBrains Mono, monospace', marginBottom: 6 }}>
                Contract Address (CA)
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: '#e8e8e8', flex: 1, wordBreak: 'break-all' }}>
                  {launchResult.tokenAddr}
                </span>
                <button onClick={() => copyText(launchResult.tokenAddr, 'ca')}
                  style={{ flexShrink: 0, padding: '5px 10px', borderRadius: 7, background: copied === 'ca' ? 'rgba(26,255,110,0.2)' : 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: copied === 'ca' ? '#1aff6e' : '#aaa', fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', fontFamily: 'Inter, sans-serif' }}>
                  {copied === 'ca' ? '✓ Copied' : 'Copy'}
                </button>
              </div>
            </div>

            {/* TX Hash */}
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '12px 14px' }}>
              <div style={{ fontSize: 10, color: '#666', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 600, fontFamily: 'JetBrains Mono, monospace', marginBottom: 6 }}>
                Transaction Hash
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: '#888', flex: 1 }}>
                  {launchResult.txHash.slice(0,20)}...{launchResult.txHash.slice(-8)}
                </span>
                <button onClick={() => copyText(launchResult.txHash, 'tx')}
                  style={{ flexShrink: 0, padding: '5px 10px', borderRadius: 7, background: copied === 'tx' ? 'rgba(26,255,110,0.2)' : 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: copied === 'tx' ? '#1aff6e' : '#aaa', fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', fontFamily: 'Inter, sans-serif' }}>
                  {copied === 'tx' ? '✓ Copied' : 'Copy'}
                </button>
              </div>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 4 }}>
              <a href={`https://basescan.org/tx/${launchResult.txHash}`}
                target="_blank" rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '11px', borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#aaa', fontSize: 13, fontWeight: 500, textDecoration: 'none', transition: 'all 0.2s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.2)'; (e.currentTarget as HTMLElement).style.color = '#fff' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.1)'; (e.currentTarget as HTMLElement).style.color = '#aaa' }}>
                <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                Basescan
              </a>
              <a href={shareUrl} target="_blank" rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '11px', borderRadius: 10, background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', fontSize: 13, fontWeight: 600, textDecoration: 'none', transition: 'all 0.2s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.25)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.12)' }}>
                <svg width="13" height="13" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.258 5.63zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                Share on X
              </a>
            </div>

            {/* Trade Now — primary CTA */}
            <button onClick={() => { onClose(); window.location.href = `/token/${launchResult.tokenAddr}` }}
              className="btn-green w-full"
              style={{ padding: '13px', fontSize: 15, fontWeight: 700 }}>
              Trade Now →
            </button>

            <button onClick={onClose}
              style={{ background: 'none', border: 'none', color: '#444', fontSize: 12, cursor: 'pointer', fontFamily: 'Inter, sans-serif', padding: '4px 0' }}>
              Close
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Launch Form ──────────────────────────────────────────────────────────────
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

        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#fff', marginBottom: 4 }}>Launch a Token</h2>
          <p style={{ fontSize: 12, color: '#666' }}>Deploy on Base · 100B fixed supply · instant Uniswap V4 pool</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* Logo + name/symbol row */}
          <div style={{ display: 'flex', gap: 12 }}>
            {/* Upload area */}
            <div onClick={() => !loading && fileRef.current?.click()}
              style={{
                width: 110, height: 110, borderRadius: 12, flexShrink: 0,
                border: '2px dashed rgba(26,255,110,0.25)', cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 4, overflow: 'hidden', background: 'rgba(26,255,110,0.03)',
                transition: 'border-color 0.2s',
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(26,255,110,0.45)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(26,255,110,0.25)')}>
              {logoPreview
                ? <img src={logoPreview} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <>
                    <svg width="22" height="22" fill="none" stroke="rgba(26,255,110,0.5)" viewBox="0 0 24 24" strokeWidth="1.5">
                      <path d="M12 16V8m0 0-3 3m3-3 3 3" strokeLinecap="round" strokeLinejoin="round"/>
                      <rect x="3" y="3" width="18" height="18" rx="4"/>
                    </svg>
                    <span style={{ fontSize: 11, color: '#1aff6e', fontWeight: 600, opacity: 0.7 }}>Upload Logo</span>
                    <span style={{ fontSize: 9, color: '#444', textAlign: 'center', lineHeight: 1.4 }}>JPG/PNG/WEBP<br/>Max 1MB</span>
                  </>
              }
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={handleLogo} />
            </div>

            {/* Name + symbol */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input value={name} onChange={e => setName(e.target.value)} disabled={loading}
                placeholder="Token name (e.g. Pepe Coin)"
                style={inputStyle}
                onFocus={e => (e.currentTarget.style.borderColor = 'rgba(26,255,110,0.45)')}
                onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.14)')} />
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#666', fontSize: 13, fontFamily: 'JetBrains Mono, monospace' }}>$</span>
                <input value={symbol}
                  onChange={e => setSymbol(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                  disabled={loading} placeholder="SYMBOL" maxLength={10}
                  style={{ ...inputStyle, paddingLeft: 24, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.05em' }}
                  onFocus={e => (e.currentTarget.style.borderColor = 'rgba(26,255,110,0.45)')}
                  onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.14)')} />
              </div>
            </div>
          </div>

          {/* Bio */}
          <textarea value={bio} onChange={e => setBio(e.target.value)} disabled={loading}
            placeholder="Describe your token — what problem does it solve, what's the vibe? (optional)"
            rows={2}
            style={{ ...inputStyle, resize: 'none', lineHeight: 1.5 }}
            onFocus={e => (e.currentTarget.style.borderColor = 'rgba(26,255,110,0.45)')}
            onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.14)')} />

          {/* Socials toggle */}
          <button onClick={() => setShowSocials(!showSocials)} type="button"
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#888', fontSize: 13, cursor: 'pointer', transition: 'all 0.2s', fontFamily: 'Inter, sans-serif', width: '100%' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.2)'; (e.currentTarget as HTMLElement).style.color = '#ccc' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.1)'; (e.currentTarget as HTMLElement).style.color = '#888' }}>
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
            <span>Add socials</span>
            <span style={{ fontSize: 10, color: '#555', marginLeft: 2 }}>optional</span>
            <svg style={{ marginLeft: 'auto', transition: 'transform 0.2s', transform: showSocials ? 'rotate(180deg)' : 'rotate(0deg)' }}
              width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path d="m6 9 6 6 6-6" strokeLinecap="round"/>
            </svg>
          </button>

          {showSocials && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              <input value={website} onChange={e => setWebsite(e.target.value)} disabled={loading}
                placeholder="Website URL — https://yourtoken.com"
                style={inputStyle}
                onFocus={e => (e.currentTarget.style.borderColor = 'rgba(26,255,110,0.45)')}
                onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.14)')} />
              <div style={{ display: 'flex', alignItems: 'center', ...inputStyle, padding: 0, overflow: 'hidden' }}>
                <span style={{ padding: '10px 10px 10px 12px', fontSize: 12, color: '#666', fontFamily: 'JetBrains Mono, monospace', whiteSpace: 'nowrap', borderRight: '1px solid rgba(255,255,255,0.08)' }}>t.me/</span>
                <input value={telegram} onChange={e => setTelegram(e.target.value.replace(/^@/, '').replace(/\s/g, ''))} disabled={loading}
                  placeholder="your_group" style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', padding: '10px 12px', fontSize: 13, color: '#e8e8e8', fontFamily: 'Inter, sans-serif' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', ...inputStyle, padding: 0, overflow: 'hidden' }}>
                <span style={{ padding: '10px 10px 10px 12px', fontSize: 12, color: '#666', fontFamily: 'JetBrains Mono, monospace', whiteSpace: 'nowrap', borderRight: '1px solid rgba(255,255,255,0.08)' }}>x.com/</span>
                <input value={twitter} onChange={e => setTwitter(e.target.value.replace(/^@/, '').replace(/\s/g, ''))} disabled={loading}
                  placeholder="yourhandle" style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', padding: '10px 12px', fontSize: 13, color: '#e8e8e8', fontFamily: 'Inter, sans-serif' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', ...inputStyle, padding: 0, overflow: 'hidden' }}>
                <span style={{ padding: '10px 10px 10px 12px', fontSize: 12, color: '#666', fontFamily: 'JetBrains Mono, monospace', whiteSpace: 'nowrap', borderRight: '1px solid rgba(255,255,255,0.08)' }}>discord.gg/</span>
                <input value={discord} onChange={e => setDiscord(e.target.value.replace(/\s/g, ''))} disabled={loading}
                  placeholder="invite-code" style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', padding: '10px 12px', fontSize: 13, color: '#e8e8e8', fontFamily: 'Inter, sans-serif' }} />
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{ fontSize: 12, padding: '10px 12px', borderRadius: 8, background: 'rgba(255,68,102,0.08)', color: '#ff4466', border: '1px solid rgba(255,68,102,0.2)' }}>
              {error}
            </div>
          )}

          {/* Loading step */}
          {loading && step && (
            <div style={{ fontSize: 12, padding: '10px 12px', borderRadius: 8, background: 'rgba(0,212,255,0.07)', color: '#00d4ff', border: '1px solid rgba(0,212,255,0.2)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 12, height: 12, border: '2px solid #00d4ff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
              {step}
            </div>
          )}

          {/* Launch button */}
          <button onClick={launch} disabled={loading}
            className="btn-green w-full"
            style={{ padding: '13px', fontSize: 15, fontWeight: 700, opacity: loading ? 0.6 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}>
            {loading ? 'Launching...' : account ? '🚀 Launch on Base' : 'Connect Wallet to Launch'}
          </button>

          <p style={{ fontSize: 10, color: '#333', textAlign: 'center', fontFamily: 'JetBrains Mono, monospace' }}>
            Gas fees apply · 100B fixed supply · Uniswap V4 pool created instantly
          </p>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
