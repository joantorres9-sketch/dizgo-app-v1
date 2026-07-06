'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const T = { bg:'#0D1E35',card:'#081426',accent:'#F58720',blue:'#3D8EF0',green:'#2DD4A0',red:'#F05C5C',yellow:'#F5A623',purple:'#9B6BFF',text:'#E8EDF5',muted:'#5A7A9A',border:'#152238' }

const PAISES = [
  { code:'COL', nombre:'Colombia',  moneda:'COP', doc:'RUT',        flag:'https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.2.3/flags/4x3/co.svg', tel:'+57' },
  { code:'ECU', nombre:'Ecuador',   moneda:'USD', doc:'RUC',        flag:'https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.2.3/flags/4x3/ec.svg', tel:'+593' },
  { code:'MEX', nombre:'México',    moneda:'MXN', doc:'RFC',        flag:'https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.2.3/flags/4x3/mx.svg', tel:'+52' },
  { code:'PER', nombre:'Perú',      moneda:'PEN', doc:'RUC',        flag:'https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.2.3/flags/4x3/pe.svg', tel:'+51' },
  { code:'CHL', nombre:'Chile',     moneda:'CLP', doc:'RUT',        flag:'https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.2.3/flags/4x3/cl.svg', tel:'+56' },
  { code:'ARG', nombre:'Argentina', moneda:'ARS', doc:'CUIT',       flag:'https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.2.3/flags/4x3/ar.svg', tel:'+54' },
  { code:'CRI', nombre:'Costa Rica',moneda:'CRC', doc:'Reg.Merc.',  flag:'https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.2.3/flags/4x3/cr.svg', tel:'+506' },
  { code:'PRY', nombre:'Paraguay',  moneda:'PYG', doc:'RUC',        flag:'https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.2.3/flags/4x3/py.svg', tel:'+595' },
  { code:'VEN', nombre:'Venezuela', moneda:'VES', doc:'RIF',        flag:'https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.2.3/flags/4x3/ve.svg', tel:'+58' },
  { code:'ESP', nombre:'España',    moneda:'EUR', doc:'NIF/CIF',    flag:'https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.2.3/flags/4x3/es.svg', tel:'+34' },
  { code:'GTM', nombre:'Guatemala', moneda:'GTQ', doc:'Pat.Comerc.',flag:'https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.2.3/flags/4x3/gt.svg', tel:'+502' },
  { code:'PAN', nombre:'Panamá',    moneda:'USD', doc:'Av.Operación',flag:'https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.2.3/flags/4x3/pa.svg', tel:'+507' },
]

const inp: React.CSSProperties = { width:'100%', background:'#0A1628', border:`1.5px solid #1E3050`, borderRadius:'8px', padding:'8px 10px', fontSize:'12px', color:'#E8EDF5', outline:'none', boxSizing:'border-box' }
const sel: React.CSSProperties = { ...inp, appearance:'none' as any }
const lbl: React.CSSProperties = { fontSize:'11px', color:'#5A7A9A', marginBottom:'4px', display:'block' }
const fld: React.CSSProperties = { marginBottom:'10px' }
const row2: React.CSSProperties = { display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))', gap:'8px', marginBottom:'10px' }
const row3: React.CSSProperties = { display:'grid', gridTemplateColumns:'90px 1fr', gap:'8px', marginBottom:'10px' }
const stepH: React.CSSProperties = { display:'flex', alignItems:'center', gap:'10px', margin:'18px 0 12px' }
const stepN = (color: string): React.CSSProperties => ({ width:'26px', height:'26px', borderRadius:'50%', background: color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'12px', fontWeight:'700', color: T.card, flexShrink:0 })
const upfile: React.CSSProperties = { width:'100%', background:'#0A1628', border:`1.5px dashed #1E3050`, borderRadius:'8px', padding:'12px 10px', fontSize:'11px', color:'#5A7A9A', textAlign:'center', cursor:'pointer', boxSizing:'border-box' }

export default function RegistroPage() {
  const router = useRouter()
  const supabase = createClient()

  const [form, setForm] = useState({
    nombres:'', apellidos:'', tipo_doc:'CC', numero_doc:'',
    codigo_tel:'+57', celular:'', email_personal:'',
    nombre_tienda:'', sitio_web:'', email_tienda:'',
    pass:'', pass2:''
  })
  const [paisMatriz, setPaisMatriz] = useState<string|null>(null)
  const [paisesOper, setPaisesOper] = useState<Set<string>>(new Set())
  const [uploading, setUploading] = useState<Record<string,boolean>>({})
  const [docUrls, setDocUrls] = useState<Record<string,string>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement|HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const toggleOper = (code: string) => {
    setPaisesOper(prev => {
      const n = new Set(prev)
      n.has(code) ? n.delete(code) : n.add(code)
      return n
    })
  }

  const handleFile = async (id: string, file: File | null) => {
    if (!file) return
    setUploading(u => ({ ...u, [id]:true }))
    try {
      const path = `registro/${Date.now()}_${id}_${file.name}`
      const { data, error: err } = await supabase.storage
        .from('documentos-registro')
        .upload(path, file, { contentType:'application/pdf' })
      if (err) throw err
      const { data: { publicUrl } } = supabase.storage.from('documentos-registro').getPublicUrl(path)
      setDocUrls(d => ({ ...d, [id]: publicUrl }))
    } catch (e) { alert('Error al subir archivo') }
    finally { setUploading(u => ({ ...u, [id]:false })) }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!paisMatriz) { setError('Selecciona el país principal (casa matriz)'); return }
    if (form.pass !== form.pass2) { setError('Las contraseñas no coinciden'); return }
    if (!docUrls['id_a'] || !docUrls['id_b']) { setError('Adjunta el documento de identidad (Lado A y B)'); return }
    if (!docUrls['doc_legal']) { setError(`Adjunta el ${PAISES.find(p=>p.code===paisMatriz)?.doc} de tu tienda`); return }
    setLoading(true); setError('')
    try {
      // 1. Crear usuario en Supabase Auth
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email: form.email_personal,
        password: form.pass,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` }
      })
      if (authErr) throw authErr

      // 2. Guardar solicitud de registro
      const { error: regErr } = await supabase.from('solicitudes_registro').insert({
        nombres:         form.nombres,
        apellidos:       form.apellidos,
        tipo_doc:        form.tipo_doc,
        numero_doc:      form.numero_doc,
        codigo_pais_tel: form.codigo_tel,
        celular:         form.celular,
        email_personal:  form.email_personal,
        nombre_tienda:   form.nombre_tienda,
        sitio_web:       form.sitio_web,
        email_tienda:    form.email_tienda,
        pais_matriz:     paisMatriz,
        paises_operacion: Array.from(paisesOper),
        estado:          'pendiente',
        docs_urls:       docUrls,
      })
      if (regErr) throw regErr

      router.push('/auth/pendiente')
    } catch (err: any) {
      setError(err.message || 'Error al registrar')
    } finally { setLoading(false) }
  }

  const docMatriz = PAISES.find(p=>p.code===paisMatriz)?.doc || 'Documento legal'

  return (
    <div style={{ minHeight:'100vh', background: T.bg, display:'flex', justifyContent:'center', padding:'20px', fontFamily:'"DM Sans", system-ui, sans-serif' }}>
      <div className="dz-registro-flex" style={{ display:'flex', gap:'16px', alignItems:'flex-start', maxWidth:'820px', width:'100%' }}>

        {/* Columna izquierda: aviso previo */}
        <div className="dz-registro-side" style={{ width:'240px', flexShrink:0, position:'sticky', top:'20px' }}>
          <div style={{ textAlign:'center', marginBottom:'20px' }}>
            <div style={{ width:'44px', height:'44px', background: T.accent, borderRadius:'12px', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:'800', fontSize:'16px', color: T.card, margin:'0 auto 10px' }}>DZ</div>
            <div style={{ fontWeight:'800', fontSize:'18px', color: T.text }}>DI<span style={{ color: T.accent }}>Z</span>GO</div>
            <div style={{ fontSize:'11px', color: T.muted }}>Registro de nueva tienda</div>
          </div>
          <div style={{ background:`${T.blue}10`, border:`1px solid ${T.blue}30`, borderRadius:'10px', padding:'14px', fontSize:'12px', color:`${T.blue}`, lineHeight:1.7 }}>
            <div style={{ fontWeight:'600', marginBottom:'8px', color: T.blue }}>Ten a la mano:</div>
            <div>· Documento identidad (PDF ambos lados)</div>
            <div>· {paisMatriz ? docMatriz : 'Doc. legal tienda (RUT/RUC/RFC..)'}</div>
            <div>· Correo personal y de la tienda</div>
            <div>· Sitio web de tu tienda</div>
          </div>
          <div style={{ marginTop:'14px', background:`${T.yellow}10`, border:`1px solid ${T.yellow}30`, borderRadius:'10px', padding:'12px', fontSize:'11px', color: T.yellow, lineHeight:1.6 }}>
            <div style={{ fontWeight:'600', marginBottom:'6px' }}>¿Qué pasa después?</div>
            <div style={{ display:'flex', gap:'6px', marginBottom:'4px' }}><span style={{ fontWeight:'700' }}>1.</span> Solicitud en Pendiente</div>
            <div style={{ display:'flex', gap:'6px', marginBottom:'4px' }}><span style={{ fontWeight:'700' }}>2.</span> DIZGO revisa en 1-2 días</div>
            <div style={{ display:'flex', gap:'6px' }}><span style={{ fontWeight:'700' }}>3.</span> Recibes email de activación</div>
          </div>
          <div style={{ marginTop:'12px', textAlign:'center' }}>
            <Link href="/auth/login" style={{ fontSize:'11px', color: T.muted, textDecoration:'underline' }}>Ya tengo cuenta — Iniciar sesión</Link>
          </div>
        </div>

        {/* Columna derecha: formulario */}
        <div style={{ flex:1, background: T.card, border:`1px solid ${T.border}`, borderRadius:'14px', overflow:'hidden' }}>
          <div style={{ padding:'18px 22px 14px', borderBottom:`1px solid ${T.border}` }}>
            <div style={{ fontSize:'14px', fontWeight:'700', color: T.text }}>Formulario de registro completo</div>
            <div style={{ fontSize:'11px', color: T.muted, marginTop:'2px' }}>Completa los 3 pasos — todo en una sola pantalla, sin sorpresas</div>
          </div>

          <form onSubmit={handleSubmit} style={{ padding:'18px 22px' }}>

            {/* PASO 1 */}
            <div style={stepH}>
              <div style={stepN(T.accent)}>1</div>
              <div>
                <div style={{ fontSize:'13px', fontWeight:'600', color: T.text }}>Datos del propietario y tienda</div>
                <div style={{ fontSize:'11px', color: T.muted }}>Información de contacto y acceso</div>
              </div>
            </div>

            <div style={row2}>
              <div><label style={lbl}>Nombres *</label><input style={inp} value={form.nombres} onChange={set('nombres')} placeholder="Joan Alexander" required /></div>
              <div><label style={lbl}>Apellidos *</label><input style={inp} value={form.apellidos} onChange={set('apellidos')} placeholder="Torres Marín" required /></div>
            </div>
            <div style={row2}>
              <div>
                <label style={lbl}>Tipo documento *</label>
                <select style={sel} value={form.tipo_doc} onChange={set('tipo_doc')}>
                  <option>CC</option><option>CE</option><option>Pasaporte</option>
                  <option>CI</option><option>DNI</option><option>CURP</option>
                  <option>NIF</option><option>DPI</option><option>RUC</option>
                </select>
              </div>
              <div><label style={lbl}>Número documento *</label><input style={inp} value={form.numero_doc} onChange={set('numero_doc')} placeholder="1234567890" required /></div>
            </div>
            <div style={row3}>
              <div>
                <label style={lbl}>Código país</label>
                <select style={sel} value={form.codigo_tel} onChange={set('codigo_tel')}>
                  {PAISES.map(p => <option key={p.code} value={p.tel}>{p.tel}</option>)}
                </select>
              </div>
              <div><label style={lbl}>Celular *</label><input style={inp} value={form.celular} onChange={set('celular')} placeholder="320 634 8574" required /></div>
            </div>
            <div style={fld}><label style={lbl}>Email personal *</label><input style={inp} type="email" value={form.email_personal} onChange={set('email_personal')} placeholder="joantorres9@gmail.com" required /></div>

            <div style={{ height:'1px', background: T.border, margin:'14px 0 10px' }} />
            <div style={{ fontSize:'11px', fontWeight:'600', color: T.accent, marginBottom:'10px' }}>Datos de la tienda</div>

            <div style={fld}><label style={lbl}>Nombre de la tienda *</label><input style={inp} value={form.nombre_tienda} onChange={set('nombre_tienda')} placeholder="Mi Tienda Store" required /></div>
            <div style={row2}>
              <div><label style={lbl}>Sitio web</label><input style={inp} value={form.sitio_web} onChange={set('sitio_web')} placeholder="www.mitienda.com" /></div>
              <div><label style={lbl}>Email tienda *</label><input style={inp} type="email" value={form.email_tienda} onChange={set('email_tienda')} placeholder="hola@tienda.com" required /></div>
            </div>
            <div style={row2}>
              <div><label style={lbl}>Contraseña *</label><input style={inp} type="password" value={form.pass} onChange={set('pass')} placeholder="••••••••" required minLength={8} /></div>
              <div><label style={lbl}>Confirmar contraseña *</label><input style={inp} type="password" value={form.pass2} onChange={set('pass2')} placeholder="••••••••" required /></div>
            </div>

            {/* PASO 2 */}
            <div style={stepH}>
              <div style={stepN(T.green)}>2</div>
              <div>
                <div style={{ fontSize:'13px', fontWeight:'600', color: T.text }}>Países de operación</div>
                <div style={{ fontSize:'11px', color: T.muted }}>Casa matriz obligatoria · otros países opcionales</div>
              </div>
            </div>

            <div style={{ ...lbl, marginBottom:'8px', display:'flex', alignItems:'center', gap:'8px' }}>
              País principal — Casa matriz
              <span style={{ fontSize:'10px', fontWeight:'600', padding:'1px 7px', borderRadius:'4px', background:`${T.red}18`, color: T.red }}>Obligatorio</span>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))', gap:'6px', marginBottom:'12px' }}>
              {PAISES.map(p => (
                <button type="button" key={p.code} onClick={() => { setPaisMatriz(p.code); setForm(f=>({...f,codigo_tel:p.tel})) }}
                  style={{ background: paisMatriz===p.code ? `${T.accent}15` : '#0A1628', border:`1.5px solid ${paisMatriz===p.code ? T.accent : '#1E3050'}`, borderRadius:'8px', padding:'7px 5px', cursor:'pointer', display:'flex', alignItems:'center', gap:'5px' }}>
                  <img src={p.flag} alt={p.nombre} style={{ width:'20px', height:'14px', borderRadius:'2px', objectFit:'cover', flexShrink:0 }} />
                  <div style={{ textAlign:'left', minWidth:0 }}>
                    <div style={{ fontSize:'10px', color: T.text, fontWeight:'500', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{p.nombre}</div>
                    <div style={{ fontSize:'9px', color: T.muted }}>{p.moneda}</div>
                  </div>
                </button>
              ))}
            </div>

            <div style={{ ...lbl, marginBottom:'8px', display:'flex', alignItems:'center', gap:'8px' }}>
              Otros países de operación
              <span style={{ fontSize:'10px', fontWeight:'600', padding:'1px 7px', borderRadius:'4px', background:`${T.blue}18`, color: T.blue }}>Opcional</span>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))', gap:'6px', marginBottom:'12px' }}>
              {PAISES.filter(p=>p.code!==paisMatriz).map(p => (
                <button type="button" key={p.code} onClick={() => toggleOper(p.code)}
                  style={{ background: paisesOper.has(p.code) ? `${T.green}12` : '#0A1628', border:`1.5px solid ${paisesOper.has(p.code) ? T.green : '#1E3050'}`, borderRadius:'8px', padding:'7px 5px', cursor:'pointer', display:'flex', alignItems:'center', gap:'5px' }}>
                  <img src={p.flag} alt={p.nombre} style={{ width:'20px', height:'14px', borderRadius:'2px', objectFit:'cover', flexShrink:0 }} />
                  <div style={{ textAlign:'left', minWidth:0, flex:1 }}>
                    <div style={{ fontSize:'10px', color: T.text, fontWeight:'500', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{p.nombre}</div>
                    <div style={{ fontSize:'9px', color: T.muted }}>{p.moneda}</div>
                  </div>
                  {paisesOper.has(p.code) && <div style={{ width:'12px', height:'12px', borderRadius:'3px', background: T.green, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}><span style={{ fontSize:'8px', color: T.card }}>✓</span></div>}
                </button>
              ))}
            </div>

            {paisesOper.size > 0 && (
              <div style={{ background:`${T.blue}10`, border:`1px solid ${T.blue}30`, borderRadius:'8px', padding:'9px 12px', fontSize:'11px', color: T.blue, marginBottom:'12px', lineHeight:1.6 }}>
                Con {paisesOper.size + 1} países activos tendrás <strong>Dashboard Consolidado</strong> con conversión TRM en tiempo real.
              </div>
            )}

            {/* PASO 3 */}
            <div style={stepH}>
              <div style={stepN(T.purple)}>3</div>
              <div>
                <div style={{ fontSize:'13px', fontWeight:'600', color: T.text }}>Documentos de verificación</div>
                <div style={{ fontSize:'11px', color: T.muted }}>Formato PDF · máx. 5 MB por archivo</div>
              </div>
            </div>

            <div style={{ background:`${T.yellow}10`, border:`1px solid ${T.yellow}30`, borderRadius:'8px', padding:'9px 12px', fontSize:'11px', color: T.yellow, marginBottom:'14px', lineHeight:1.6 }}>
              Todos los documentos en <strong>PDF</strong>. El equipo DIZGO los verificará en 1–2 días hábiles.
            </div>

            {/* Identidad */}
            <div style={{ background:'#0A1828', border:`1px solid ${T.border}`, borderRadius:'9px', padding:'12px 14px', marginBottom:'10px' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'10px' }}>
                <div style={{ fontSize:'12px', color: T.accent, fontWeight:'600' }}>Documento de identidad</div>
                <span style={{ fontSize:'10px', fontWeight:'600', padding:'1px 7px', borderRadius:'4px', background:`${T.red}18`, color: T.red }}>Obligatorio</span>
              </div>
              <div style={fld}>
                <label style={lbl}>Lado A — Frontal</label>
                <label style={{ ...upfile, display:'block', ...(docUrls['id_a'] ? { borderColor: T.green, borderStyle:'solid', color: T.green } : {}) }}>
                  {uploading['id_a'] ? 'Subiendo...' : docUrls['id_a'] ? '✓ Archivo cargado' : '+ Subir PDF · máx. 5 MB'}
                  <input type="file" accept="application/pdf" style={{ display:'none' }} onChange={e=>handleFile('id_a', e.target.files?.[0]||null)} />
                </label>
              </div>
              <div>
                <label style={lbl}>Lado B — Posterior</label>
                <label style={{ ...upfile, display:'block', ...(docUrls['id_b'] ? { borderColor: T.green, borderStyle:'solid', color: T.green } : {}) }}>
                  {uploading['id_b'] ? 'Subiendo...' : docUrls['id_b'] ? '✓ Archivo cargado' : '+ Subir PDF · máx. 5 MB'}
                  <input type="file" accept="application/pdf" style={{ display:'none' }} onChange={e=>handleFile('id_b', e.target.files?.[0]||null)} />
                </label>
              </div>
            </div>

            {/* Documento legal tienda */}
            {paisMatriz && (
              <div style={{ background:'#0A1828', border:`1px solid ${T.border}`, borderRadius:'9px', padding:'12px 14px', marginBottom:'10px' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'10px' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                    <img src={PAISES.find(p=>p.code===paisMatriz)?.flag} alt="" style={{ width:'20px', height:'14px', borderRadius:'2px', objectFit:'cover' }} />
                    <div style={{ fontSize:'12px', color: T.text, fontWeight:'600' }}>{PAISES.find(p=>p.code===paisMatriz)?.nombre} — {docMatriz}</div>
                  </div>
                  <span style={{ fontSize:'10px', fontWeight:'600', padding:'1px 7px', borderRadius:'4px', background:`${T.red}18`, color: T.red }}>Obligatorio</span>
                </div>
                <label style={{ ...upfile, display:'block', ...(docUrls['doc_legal'] ? { borderColor: T.green, borderStyle:'solid', color: T.green } : {}) }}>
                  {uploading['doc_legal'] ? 'Subiendo...' : docUrls['doc_legal'] ? '✓ Archivo cargado' : `+ Subir ${docMatriz} en PDF · máx. 5 MB`}
                  <input type="file" accept="application/pdf" style={{ display:'none' }} onChange={e=>handleFile('doc_legal', e.target.files?.[0]||null)} />
                </label>
              </div>
            )}

            {/* Documentos países operación */}
            {Array.from(paisesOper).map(code => {
              const p = PAISES.find(x=>x.code===code)!
              const uid = `doc_${code}`
              return (
                <div key={code} style={{ background:'#0A1828', border:`1px solid ${T.border}`, borderRadius:'9px', padding:'12px 14px', marginBottom:'10px' }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'8px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                      <img src={p.flag} alt={p.nombre} style={{ width:'20px', height:'14px', borderRadius:'2px', objectFit:'cover' }} />
                      <div style={{ fontSize:'12px', color: T.text, fontWeight:'600' }}>{p.nombre} — {p.doc}</div>
                    </div>
                    <span style={{ fontSize:'10px', fontWeight:'600', padding:'1px 7px', borderRadius:'4px', background:`${T.blue}18`, color: T.blue }}>Opcional</span>
                  </div>
                  <div style={{ fontSize:'11px', color: T.muted, marginBottom:'8px', lineHeight:1.5 }}>
                    Puedes adjuntar el {p.doc} ahora o después desde tu perfil. Sin él no podrás operar en {p.nombre}.
                  </div>
                  <label style={{ ...upfile, display:'block', ...(docUrls[uid] ? { borderColor: T.green, borderStyle:'solid', color: T.green } : {}) }}>
                    {uploading[uid] ? 'Subiendo...' : docUrls[uid] ? '✓ Archivo cargado' : `+ Subir ${p.doc} en PDF · máx. 5 MB`}
                    <input type="file" accept="application/pdf" style={{ display:'none' }} onChange={e=>handleFile(uid, e.target.files?.[0]||null)} />
                  </label>
                </div>
              )
            })}

            <div style={{ height:'1px', background: T.border, margin:'14px 0' }} />

            {error && (
              <div style={{ background:`${T.red}15`, border:`1px solid ${T.red}30`, borderRadius:'8px', padding:'9px 12px', fontSize:'12px', color: T.red, marginBottom:'12px' }}>
                {error}
              </div>
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
              {loading ? 'Enviando solicitud...' : '✉ Enviar solicitud de registro'}
            </button>

            <div style={{ textAlign:'center', marginTop:'10px' }}>
              <Link href="/auth/login" style={{ fontSize:'11px', color: T.muted, textDecoration:'underline' }}>
                Ya tengo cuenta — Ir al login
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
