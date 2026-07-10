'use client'
import { useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PAISES } from '@/lib/paises'

const T = { bg:'#0D1E35', card:'#081426', accent:'#F58720', blue:'#3D8EF0', green:'#2DD4A0', red:'#F05C5C', text:'#E8EDF5', muted:'#5A7A9A', border:'#152238' }
const inp: React.CSSProperties = { width:'100%', background:'#0A1628', border:`1.5px solid ${T.border}`, borderRadius:'8px', padding:'10px 12px', fontSize:'13px', color:T.text, outline:'none', boxSizing:'border-box' }
const lbl: React.CSSProperties = { fontSize:'11px', color:T.muted, marginBottom:'4px', display:'block' }
const row2: React.CSSProperties = { display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:'10px', marginBottom:'12px' }

export default function RegistroColaboradorPage() {
  const params = useParams()
  const tenantId = String(params.tenantId || '')
  const supabase = createClient()
  const [enviado, setEnviado] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [f, setF] = useState({
    nombres:'', apellidos:'', tipo_doc:'CC', numero_doc:'', celular:'', email:'',
    pais_code:'COL', ciudad:'', nivel_formacion:'', estado_civil:'Soltero',
  })

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF(prev => ({ ...prev, [k]: e.target.value }))

  async function enviar() {
    if (!f.nombres || !f.apellidos || !f.numero_doc || !f.celular || !f.email) {
      setError('Completa nombres, apellidos, documento, celular y correo'); return
    }
    setEnviando(true); setError('')
    const { error: err } = await supabase.from('nomina_solicitudes').insert({
      tenant_id: tenantId, tipo: 'colaborador', estado: 'pendiente', ...f,
    })
    setEnviando(false)
    if (err) { setError(`No se pudo enviar tu registro: ${err.message}`); return }
    setEnviado(true)
  }

  if (enviado) {
    return (
      <div style={{ minHeight:'100vh', background:T.bg, display:'flex', alignItems:'center', justifyContent:'center', padding:'20px', fontFamily:'"DM Sans", system-ui, sans-serif' }}>
        <div style={{ width:'min(420px,100%)', textAlign:'center', background:T.card, border:`1px solid ${T.border}`, borderRadius:'14px', padding:'32px 24px' }}>
          <div style={{ fontSize:'40px', marginBottom:'12px' }}>✅</div>
          <div style={{ fontSize:'16px', fontWeight:'700', color:T.text, marginBottom:'8px' }}>¡Registro enviado!</div>
          <div style={{ fontSize:'13px', color:T.muted, lineHeight:1.6 }}>
            Un asesor de la empresa revisará tu información y se pondrá en contacto contigo para completar tu vinculación
            (documentos, contrato y datos laborales).
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight:'100vh', background:T.bg, display:'flex', alignItems:'center', justifyContent:'center', padding:'20px', fontFamily:'"DM Sans", system-ui, sans-serif' }}>
      <div style={{ width:'min(560px,100%)', background:T.card, border:`1px solid ${T.border}`, borderRadius:'14px', padding:'28px 24px' }}>
        <div style={{ fontSize:'18px', fontWeight:'800', color:T.text, marginBottom:'2px' }}>👋 Registro de nuevo colaborador</div>
        <div style={{ fontSize:'12px', color:T.muted, marginBottom:'20px' }}>Completa tus datos básicos — luego un asesor te contactará para el resto del proceso.</div>

        <div style={row2}>
          <div><label style={lbl}>Nombres *</label><input style={inp} value={f.nombres} onChange={set('nombres')} /></div>
          <div><label style={lbl}>Apellidos *</label><input style={inp} value={f.apellidos} onChange={set('apellidos')} /></div>
        </div>
        <div style={row2}>
          <div>
            <label style={lbl}>Tipo documento</label>
            <select style={{ ...inp, appearance:'none' as React.CSSProperties['appearance'] }} value={f.tipo_doc} onChange={set('tipo_doc')}>
              {['CC','CE','Pasaporte','CI','DNI','CURP','NIF','DPI','TI','RUC'].map(v => <option key={v}>{v}</option>)}
            </select>
          </div>
          <div><label style={lbl}>Número documento *</label><input style={inp} value={f.numero_doc} onChange={set('numero_doc')} /></div>
        </div>
        <div style={row2}>
          <div>
            <label style={lbl}>País de residencia</label>
            <select style={{ ...inp, appearance:'none' as React.CSSProperties['appearance'] }} value={f.pais_code} onChange={set('pais_code')}>
              {PAISES.map(p => <option key={p.code} value={p.code}>{p.nombre}</option>)}
            </select>
          </div>
          <div><label style={lbl}>Ciudad</label><input style={inp} value={f.ciudad} onChange={set('ciudad')} /></div>
        </div>
        <div style={row2}>
          <div><label style={lbl}>Celular *</label><input style={inp} value={f.celular} onChange={set('celular')} placeholder="3001234567" /></div>
          <div><label style={lbl}>Correo *</label><input style={inp} type="email" value={f.email} onChange={set('email')} /></div>
        </div>
        <div style={row2}>
          <div>
            <label style={lbl}>Nivel de formación</label>
            <input style={inp} value={f.nivel_formacion} onChange={set('nivel_formacion')} placeholder="Bachiller, Técnico, Profesional..." />
          </div>
          <div>
            <label style={lbl}>Estado civil</label>
            <select style={{ ...inp, appearance:'none' as React.CSSProperties['appearance'] }} value={f.estado_civil} onChange={set('estado_civil')}>
              {['Soltero','Casado','Unión libre','Divorciado','Viudo','Otro'].map(v => <option key={v}>{v}</option>)}
            </select>
          </div>
        </div>

        {error && <div style={{ background:`${T.red}15`, border:`1px solid ${T.red}30`, borderRadius:'8px', padding:'9px', fontSize:'12px', color:T.red, marginBottom:'12px' }}>{error}</div>}

        <button onClick={enviar} disabled={enviando}
          style={{ width:'100%', padding:'11px', background:T.accent, border:'none', borderRadius:'9px', color:T.card, fontWeight:'700', cursor:enviando?'wait':'pointer', fontSize:'13px', opacity:enviando?0.7:1 }}>
          {enviando ? 'Enviando...' : '✅ Enviar registro'}
        </button>
      </div>
    </div>
  )
}
