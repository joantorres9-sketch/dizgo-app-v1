'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useTema } from '@/lib/tema'

const inp: React.CSSProperties = { width:'100%', background:'#0D1E35', border:`1.5px solid #1E3050`, borderRadius:'8px', padding:'9px 12px', fontSize:'13px', color:'#E8EDF5', outline:'none', boxSizing:'border-box' }
const lbl: React.CSSProperties = { fontSize:'11px', color:'#5A7A9A', marginBottom:'4px', display:'block' }
const field: React.CSSProperties = { marginBottom:'12px' }

export default function ResetPage() {
  const { T } = useTema()
  const router = useRouter()
  const supabase = createClient()

  // El enlace del correo trae ?code=... (flujo PKCE) -- Supabase ya validó el token y emitió
  // este código de un solo uso; hay que canjearlo por una sesión real antes de poder cambiar la
  // contraseña. Se hace acá (no en un route handler /auth/callback) porque esta es la única
  // pantalla que necesita ese canje -- el resto del flujo de auth no lo usa.
  //
  // OJO: NO se valida con getSession() como respaldo -- si el navegador ya tenía una sesión
  // activa (usuario logueado en el dashboard), getSession() la devuelve igual aunque el enlace
  // de recuperación esté vencido/inválido, y el formulario se muestra por error (bug real
  // encontrado en producción: un enlace ya expirado por Supabase, con
  // error_code=otp_expired en la URL, dejaba pasar igual porque había sesión previa). La única
  // prueba válida de que el enlace es correcto es un exchangeCodeForSession exitoso.
  const [verificando, setVerificando] = useState(true)
  const [enlaceValido, setEnlaceValido] = useState(false)
  const [motivoInvalido, setMotivoInvalido] = useState('')

  const [pass, setPass] = useState('')
  const [pass2, setPass2] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [listo, setListo] = useState(false)

  useEffect(() => {
    (async () => {
      const query = new URLSearchParams(window.location.search)
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
      const errorDesc = query.get('error_description') || hash.get('error_description')
      if (errorDesc) {
        setMotivoInvalido(decodeURIComponent(errorDesc.replace(/\+/g, ' ')))
        setEnlaceValido(false)
        setVerificando(false)
        return
      }
      const code = query.get('code')
      if (!code) {
        setEnlaceValido(false)
        setVerificando(false)
        return
      }
      const { error: err } = await supabase.auth.exchangeCodeForSession(code)
      setEnlaceValido(!err)
      setVerificando(false)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (pass.length < 6) { setError('La contraseña debe tener al menos 6 caracteres'); return }
    if (pass !== pass2) { setError('Las contraseñas no coinciden'); return }
    setGuardando(true)
    const { error: err } = await supabase.auth.updateUser({ password: pass })
    if (err) { setError(err.message); setGuardando(false); return }
    setListo(true)
    setTimeout(() => router.push('/dashboard'), 1800)
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
          {verificando ? (
            <div style={{ textAlign:'center', padding:'20px 0', color: T.muted, fontSize:'13px' }}>Verificando enlace...</div>
          ) : listo ? (
            <div style={{ textAlign:'center', padding:'10px 0' }}>
              <div style={{ width:'52px', height:'52px', background:`${T.green}18`, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 12px' }}>
                <span style={{ fontSize:'24px' }}>✅</span>
              </div>
              <div style={{ fontSize:'14px', fontWeight:'600', color: T.green, marginBottom:'8px' }}>Contraseña actualizada</div>
              <div style={{ fontSize:'12px', color: T.muted, lineHeight:1.6 }}>Entrando a tu cuenta...</div>
            </div>
          ) : !enlaceValido ? (
            <div style={{ textAlign:'center', padding:'10px 0' }}>
              <div style={{ width:'52px', height:'52px', background:`${T.red}18`, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 12px' }}>
                <span style={{ fontSize:'24px' }}>⚠️</span>
              </div>
              <div style={{ fontSize:'14px', fontWeight:'600', color: T.red, marginBottom:'8px' }}>Enlace inválido o vencido</div>
              <div style={{ fontSize:'12px', color: T.muted, lineHeight:1.6, marginBottom:'16px' }}>
                Los enlaces de recuperación vencen en 1 hora y solo se pueden usar una vez. Pide uno nuevo.
                {motivoInvalido && <><br /><span style={{ fontSize:'11px', opacity:0.7 }}>({motivoInvalido})</span></>}
              </div>
              <Link href="/auth/recuperar" style={{ display:'block', width:'100%', boxSizing:'border-box', background: T.accent, border:'none', borderRadius:'9px', padding:'11px', fontSize:'13px', fontWeight:'700', color: T.card, textDecoration:'none' }}>
                Pedir enlace nuevo
              </Link>
            </div>
          ) : (
            <>
              <div style={{ textAlign:'center', marginBottom:'20px' }}>
                <div style={{ fontSize:'14px', fontWeight:'600', color: T.text, marginBottom:'6px' }}>Nueva contraseña</div>
                <div style={{ fontSize:'12px', color: T.muted, lineHeight:1.6 }}>Elige la nueva contraseña para tu cuenta DIZGO.</div>
              </div>
              <form onSubmit={handleSubmit}>
                <div style={field}>
                  <label style={lbl}>Nueva contraseña</label>
                  <div style={{ position:'relative' }}>
                    <input style={{ ...inp, paddingRight:'36px' }} type={showPass ? 'text' : 'password'} placeholder="••••••••" value={pass} onChange={e=>setPass(e.target.value)} required />
                    <button type="button" onClick={()=>setShowPass(!showPass)} style={{ position:'absolute', right:'10px', top:'50%', transform:'translateY(-50%)', background:'none', border:'none', color: T.muted, cursor:'pointer', fontSize:'14px' }}>{showPass ? '🙈' : '👁'}</button>
                  </div>
                </div>
                <div style={field}>
                  <label style={lbl}>Confirmar contraseña</label>
                  <input style={inp} type={showPass ? 'text' : 'password'} placeholder="••••••••" value={pass2} onChange={e=>setPass2(e.target.value)} required />
                </div>
                {error && <div style={{ background:`${T.red}15`, border:`1px solid ${T.red}30`, borderRadius:'7px', padding:'8px', fontSize:'12px', color: T.red, marginBottom:'12px' }}>{error}</div>}
                <button type="submit" disabled={guardando} style={{ width:'100%', background: T.accent, border:'none', borderRadius:'9px', padding:'11px', fontSize:'13px', fontWeight:'700', color: T.card, cursor: guardando ? 'wait' : 'pointer', opacity: guardando ? 0.7 : 1 }}>
                  {guardando ? 'Guardando...' : 'Guardar y entrar'}
                </button>
              </form>
            </>
          )}
          <div style={{ textAlign:'center', marginTop:'14px' }}>
            <Link href="/auth/login" style={{ fontSize:'11px', color: T.muted, textDecoration:'underline' }}>Volver al login</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
