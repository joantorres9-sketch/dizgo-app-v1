'use client'
import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useTema } from '@/lib/tema'

const inp: React.CSSProperties = { width:'100%', background:'#0D1E35', border:`1.5px solid #1E3050`, borderRadius:'8px', padding:'9px 12px', fontSize:'13px', color:'#E8EDF5', outline:'none', boxSizing:'border-box' }

export default function RecuperarPage() {
  const { T } = useTema()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset`,
    })
    if (err) { setError(err.message); setLoading(false); return }
    setEnviado(true); setLoading(false)
  }

  return (
    <div style={{ minHeight:'100vh', background: T.bg, display:'flex', alignItems:'center', justifyContent:'center', padding:'20px', fontFamily:'"DM Sans", system-ui, sans-serif' }}>
      <div style={{ width:'min(360px, calc(100vw - 32px))' }}>
        <div style={{ textAlign:'center', marginBottom:'24px' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/dizgo-icon.png" alt="DIZGO" width={52} height={52} style={{ borderRadius:'14px', margin:'0 auto 12px', display:'block' }} />
          <div style={{ fontWeight:'800', fontSize:'20px', color: T.text }}>d<span style={{ color: T.accent }}>i</span>zgo</div>
        </div>
        <div style={{ background: T.card, border:`1px solid ${T.border}`, borderRadius:'14px', padding:'24px' }}>
          {!enviado ? (
            <>
              <div style={{ textAlign:'center', marginBottom:'20px' }}>
                <div style={{ width:'48px', height:'48px', background:`${T.accent}18`, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 10px' }}>
                  <span style={{ fontSize:'22px' }}>📧</span>
                </div>
                <div style={{ fontSize:'14px', fontWeight:'600', color: T.text, marginBottom:'6px' }}>Recuperar contraseña</div>
                <div style={{ fontSize:'12px', color: T.muted, lineHeight:1.6 }}>
                  Ingresa tu correo registrado y te enviaremos un enlace para restablecer tu contraseña.
                </div>
              </div>
              <form onSubmit={handleSubmit}>
                <div style={{ marginBottom:'14px' }}>
                  <label style={{ fontSize:'11px', color: T.muted, marginBottom:'4px', display:'block' }}>Correo registrado</label>
                  <input style={inp} type="email" placeholder="tu@correo.com" value={email} onChange={e=>setEmail(e.target.value)} required />
                </div>
                {error && <div style={{ background:`${T.red}15`, border:`1px solid ${T.red}30`, borderRadius:'7px', padding:'8px', fontSize:'12px', color: T.red, marginBottom:'12px' }}>{error}</div>}
                <button type="submit" disabled={loading} style={{ width:'100%', background: T.accent, border:'none', borderRadius:'9px', padding:'11px', fontSize:'13px', fontWeight:'700', color: T.card, cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.7 : 1 }}>
                  {loading ? 'Enviando...' : 'Enviar enlace de recuperación'}
                </button>
              </form>
            </>
          ) : (
            <div style={{ textAlign:'center', padding:'10px 0' }}>
              <div style={{ width:'52px', height:'52px', background:`${T.green}18`, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 12px' }}>
                <span style={{ fontSize:'24px' }}>✅</span>
              </div>
              <div style={{ fontSize:'14px', fontWeight:'600', color: T.green, marginBottom:'8px' }}>Enlace enviado</div>
              <div style={{ fontSize:'12px', color: T.muted, lineHeight:1.6 }}>
                Revisa tu bandeja de entrada en <strong style={{ color: T.text }}>{email}</strong>. El enlace vence en 1 hora.
              </div>
            </div>
          )}
          <div style={{ textAlign:'center', marginTop:'14px' }}>
            <Link href="/auth/login" style={{ fontSize:'11px', color: T.muted, textDecoration:'underline' }}>Volver al login</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
