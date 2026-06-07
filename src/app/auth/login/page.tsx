'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const T = {
  bg:'#0D1E35', card:'#081426', accent:'#F58720',
  blue:'#3D8EF0', green:'#2DD4A0', red:'#F05C5C',
  text:'#E8EDF5', muted:'#5A7A9A', border:'#152238'
}

const PAISES = [
  { code:'COL', nombre:'Colombia',    moneda:'COP', flag:'https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.2.3/flags/4x3/co.svg' },
  { code:'ECU', nombre:'Ecuador',     moneda:'USD', flag:'https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.2.3/flags/4x3/ec.svg' },
  { code:'MEX', nombre:'México',      moneda:'MXN', flag:'https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.2.3/flags/4x3/mx.svg' },
  { code:'PER', nombre:'Perú',        moneda:'PEN', flag:'https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.2.3/flags/4x3/pe.svg' },
  { code:'CHL', nombre:'Chile',       moneda:'CLP', flag:'https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.2.3/flags/4x3/cl.svg' },
  { code:'ARG', nombre:'Argentina',   moneda:'ARS', flag:'https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.2.3/flags/4x3/ar.svg' },
  { code:'CRI', nombre:'Costa Rica',  moneda:'CRC', flag:'https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.2.3/flags/4x3/cr.svg' },
  { code:'PRY', nombre:'Paraguay',    moneda:'PYG', flag:'https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.2.3/flags/4x3/py.svg' },
  { code:'VEN', nombre:'Venezuela',   moneda:'VES', flag:'https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.2.3/flags/4x3/ve.svg' },
  { code:'ESP', nombre:'España',      moneda:'EUR', flag:'https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.2.3/flags/4x3/es.svg' },
  { code:'GTM', nombre:'Guatemala',   moneda:'GTQ', flag:'https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.2.3/flags/4x3/gt.svg' },
  { code:'PAN', nombre:'Panamá',      moneda:'USD', flag:'https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.2.3/flags/4x3/pa.svg' },
]

const inp: React.CSSProperties = {
  width:'100%', background:'#0D1E35', border:`1.5px solid #1E3050`,
  borderRadius:'8px', padding:'9px 12px', fontSize:'13px', color:'#E8EDF5',
  outline:'none', boxSizing:'border-box'
}
const lbl: React.CSSProperties = { fontSize:'11px', color:'#5A7A9A', marginBottom:'4px', display:'block' }
const field: React.CSSProperties = { marginBottom:'12px' }

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()

  const [paisSel, setPaisSel] = useState<string|null>(null)
  const [email, setEmail]     = useState('')
  const [pass, setPass]       = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!paisSel) { setError('Selecciona tu país de operación'); return }
    setLoading(true); setError('')
    try {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password: pass })
      if (err) { setError(err.message); return }
      localStorage.setItem('dizgo_pais', paisSel)
      router.push('/dashboard')
    } catch { setError('Error de conexión') }
    finally { setLoading(false) }
  }

  return (
    <div style={{
      minHeight:'100vh', background: T.bg,
      display:'flex', alignItems:'center', justifyContent:'center',
      padding:'20px', fontFamily:'"DM Sans", system-ui, sans-serif'
    }}>
      <div style={{ width:'360px' }}>

        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom:'24px' }}>
          <div style={{
            width:'52px', height:'52px', background: T.accent, borderRadius:'14px',
            display:'flex', alignItems:'center', justifyContent:'center',
            fontWeight:'800', fontSize:'18px', color: T.card, margin:'0 auto 12px'
          }}>DZ</div>
          <div style={{ fontWeight:'800', fontSize:'22px', color: T.text }}>
            DI<span style={{ color: T.accent }}>Z</span>GO
          </div>
          <div style={{ fontSize:'12px', color: T.muted, marginTop:'4px' }}>
            Hallazgo de dinero · Plataforma e-commerce LATAM
          </div>
        </div>

        {/* Card */}
        <div style={{
          background: T.card, border:`1px solid ${T.border}`,
          borderRadius:'14px', overflow:'hidden'
        }}>
          <div style={{ padding:'20px 22px 16px', borderBottom:`1px solid ${T.border}` }}>
            <div style={{ fontSize:'13px', fontWeight:'600', color: T.text }}>Iniciar sesión</div>
          </div>
          <div style={{ padding:'20px 22px' }}>

            {/* Selección de país */}
            <div style={{ marginBottom:'16px' }}>
              <div style={{ ...lbl }}>Selecciona tu país de operación *</div>
              <div style={{
                display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'6px'
              }}>
                {PAISES.map(p => (
                  <button
                    key={p.code}
                    onClick={() => setPaisSel(p.code)}
                    style={{
                      background: paisSel===p.code ? `${T.accent}15` : '#0D1E35',
                      border: `1.5px solid ${paisSel===p.code ? T.accent : '#1E3050'}`,
                      borderRadius:'8px', padding:'7px 5px', cursor:'pointer',
                      display:'flex', alignItems:'center', gap:'5px'
                    }}
                  >
                    <img src={p.flag} alt={p.nombre} style={{ width:'20px', height:'14px', borderRadius:'2px', objectFit:'cover', flexShrink:0 }} />
                    <div style={{ textAlign:'left', minWidth:0 }}>
                      <div style={{ fontSize:'10px', color: T.text, fontWeight:'500', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{p.nombre}</div>
                      <div style={{ fontSize:'9px', color: T.muted }}>{p.moneda}</div>
                    </div>
                  </button>
                ))}
              </div>
              {paisSel && (
                <div style={{
                  marginTop:'8px', background:`${T.accent}10`, border:`1px solid ${T.accent}30`,
                  borderRadius:'7px', padding:'7px 10px', fontSize:'11px', color: T.accent,
                  display:'flex', alignItems:'center', gap:'6px'
                }}>
                  <img src={PAISES.find(p=>p.code===paisSel)?.flag} alt="" style={{ width:'18px', height:'12px', borderRadius:'2px', objectFit:'cover' }} />
                  <span>{PAISES.find(p=>p.code===paisSel)?.nombre} · {PAISES.find(p=>p.code===paisSel)?.moneda}</span>
                </div>
              )}
            </div>

            <div style={{ height:'1px', background: T.border, margin:'14px 0' }} />

            {/* Formulario */}
            <form onSubmit={handleLogin}>
              <div style={field}>
                <label style={lbl}>Correo electrónico</label>
                <input style={inp} type="email" placeholder="tu@correo.com" value={email} onChange={e=>setEmail(e.target.value)} required />
              </div>
              <div style={field}>
                <label style={lbl}>Contraseña</label>
                <div style={{ position:'relative' }}>
                  <input
                    style={{ ...inp, paddingRight:'36px' }}
                    type={showPass ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={pass}
                    onChange={e=>setPass(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={()=>setShowPass(!showPass)}
                    style={{
                      position:'absolute', right:'10px', top:'50%', transform:'translateY(-50%)',
                      background:'none', border:'none', color: T.muted, cursor:'pointer', fontSize:'14px'
                    }}
                  >{showPass ? '🙈' : '👁'}</button>
                </div>
              </div>

              {/* reCAPTCHA placeholder */}
              <div style={{
                display:'flex', alignItems:'center', gap:'8px', background:'#0D1E35',
                border:`1.5px solid ${T.border}`, borderRadius:'7px', padding:'8px 10px', marginBottom:'14px'
              }}>
                <div style={{
                  width:'18px', height:'18px', background:`${T.green}18`,
                  border:`1.5px solid ${T.green}`, borderRadius:'4px',
                  display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0
                }}>
                  <span style={{ fontSize:'11px', color: T.green }}>✓</span>
                </div>
                <span style={{ fontSize:'11px', color:'#8BA4C0', flex:1 }}>No soy un robot</span>
                <span style={{ fontSize:'9px', color: T.muted, textAlign:'right', lineHeight:1.3 }}>reCAPTCHA<br/>v3</span>
              </div>

              {error && (
                <div style={{
                  background:`${T.red}15`, border:`1px solid ${T.red}30`,
                  borderRadius:'7px', padding:'8px 10px', fontSize:'12px',
                  color: T.red, marginBottom:'12px'
                }}>{error}</div>
              )}

              <button
                type="submit"
                disabled={loading}
                style={{
                  width:'100%', background: T.accent, border:'none', borderRadius:'9px',
                  padding:'12px', fontSize:'14px', fontWeight:'700', color: T.card,
                  cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.7 : 1
                }}
              >
                {loading ? 'Ingresando...' : 'Ingresar a DIZGO'}
              </button>
            </form>

            <div style={{ display:'flex', justifyContent:'space-between', marginTop:'12px' }}>
              <Link href="/auth/recuperar" style={{ fontSize:'11px', color: T.muted, textDecoration:'underline' }}>
                Olvidé mi contraseña
              </Link>
              <Link href="/auth/registro" style={{ fontSize:'11px', color: T.accent, fontWeight:'600', textDecoration:'none' }}>
                Registrar mi tienda →
              </Link>
            </div>
          </div>
        </div>

        <div style={{ textAlign:'center', marginTop:'16px', fontSize:'10px', color: T.muted }}>
          DIZGO.APP · Finanzas en el Dropshipping · Joan Torres
        </div>
      </div>
    </div>
  )
}
