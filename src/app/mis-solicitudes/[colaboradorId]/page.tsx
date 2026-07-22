'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

const T = { bg:'#0D1E35', card:'#081426', accent:'#F58720', blue:'#3D8EF0', green:'#2DD4A0', red:'#F05C5C', text:'#E8EDF5', muted:'#5A7A9A', border:'#152238', yellow:'#F5A623' }
const inp: React.CSSProperties = { width:'100%', background:'#0A1628', border:`1.5px solid ${T.border}`, borderRadius:'8px', padding:'10px 12px', fontSize:'13px', color:T.text, outline:'none', boxSizing:'border-box' }
const lbl: React.CSSProperties = { fontSize:'11px', color:T.muted, marginBottom:'4px', display:'block' }
const row2: React.CSSProperties = { display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:'10px', marginBottom:'12px' }

const TIPOS = [
  { v:'vacaciones', l:'🏖️ Vacaciones', desc:'Solicita tus días de descanso remunerado.' },
  { v:'incapacidad', l:'🏥 Incapacidad', desc:'Reporta una incapacidad médica — adjunta el soporte del médico/EPS.' },
  { v:'auxilio', l:'💳 Auxilio', desc:'Solicita un auxilio de alimentación, rodamiento, estudio u otro.' },
]

export default function MisSolicitudesPage() {
  const params = useParams()
  const colaboradorId = String(params.colaboradorId || '')
  const [cargando, setCargando] = useState(true)
  const [colaborador, setColaborador] = useState<{ nombres: string; apellidos: string } | null>(null)
  const [notFound, setNotFound] = useState(false)

  const [tipo, setTipo] = useState('')
  const [fechaInicio, setFechaInicio] = useState('')
  const [fechaFin, setFechaFin] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [subtipoAuxilio, setSubtipoAuxilio] = useState('Alimentación')
  const [archivo, setArchivo] = useState<File | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!colaboradorId) return
    fetch(`/api/nomina/colaborador-publico/${colaboradorId}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => setColaborador(data))
      .catch(() => setNotFound(true))
      .finally(() => setCargando(false))
  }, [colaboradorId])

  async function enviar() {
    if (!tipo) { setError('Selecciona el tipo de solicitud'); return }
    if (tipo === 'incapacidad' && !archivo) { setError('Adjunta el soporte médico para reportar una incapacidad'); return }
    if ((tipo === 'vacaciones' || tipo === 'incapacidad') && (!fechaInicio || !fechaFin)) {
      setError('Indica la fecha de inicio y fin'); return
    }
    setEnviando(true); setError('')

    const form = new FormData()
    form.append('colaboradorId', colaboradorId)
    form.append('tipo', tipo)
    form.append('fecha_inicio', fechaInicio)
    form.append('fecha_fin', fechaFin)
    form.append('campos', JSON.stringify({ descripcion, subtipo: tipo === 'auxilio' ? subtipoAuxilio : undefined }))
    if (archivo) form.append('soporte', archivo)

    const res = await fetch('/api/nomina/solicitud-novedad', { method: 'POST', body: form })
    setEnviando(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error || 'No se pudo enviar la solicitud')
      return
    }
    setEnviado(true)
  }

  if (cargando) {
    return <div style={{ minHeight:'100vh', background:T.bg, display:'flex', alignItems:'center', justifyContent:'center', color:T.muted, fontFamily:'"DM Sans", system-ui, sans-serif' }}>Cargando...</div>
  }

  if (notFound) {
    return (
      <div style={{ minHeight:'100vh', background:T.bg, display:'flex', alignItems:'center', justifyContent:'center', padding:'20px', fontFamily:'"DM Sans", system-ui, sans-serif' }}>
        <div style={{ width:'min(420px,100%)', textAlign:'center', background:T.card, border:`1px solid ${T.border}`, borderRadius:'14px', padding:'32px 24px' }}>
          <div style={{ fontSize:'40px', marginBottom:'12px' }}>⚠️</div>
          <div style={{ fontSize:'15px', fontWeight:'700', color:T.text }}>Link no válido</div>
          <div style={{ fontSize:'12px', color:T.muted, marginTop:'8px' }}>Verifica el link con tu empresa.</div>
        </div>
      </div>
    )
  }

  if (enviado) {
    return (
      <div style={{ minHeight:'100vh', background:T.bg, display:'flex', alignItems:'center', justifyContent:'center', padding:'20px', fontFamily:'"DM Sans", system-ui, sans-serif' }}>
        <div style={{ width:'min(420px,100%)', textAlign:'center', background:T.card, border:`1px solid ${T.border}`, borderRadius:'14px', padding:'32px 24px' }}>
          <div style={{ fontSize:'40px', marginBottom:'12px' }}>✅</div>
          <div style={{ fontSize:'16px', fontWeight:'700', color:T.text, marginBottom:'8px' }}>¡Solicitud enviada!</div>
          <div style={{ fontSize:'13px', color:T.muted, lineHeight:1.6 }}>
            Recursos Humanos revisará tu solicitud y te notificará la decisión.
          </div>
          <button onClick={() => { setEnviado(false); setTipo(''); setFechaInicio(''); setFechaFin(''); setDescripcion(''); setArchivo(null) }}
            style={{ marginTop:'18px', padding:'9px 18px', background:'none', border:`1px solid ${T.border}`, borderRadius:'8px', color:T.muted, cursor:'pointer', fontSize:'12px' }}>
            Enviar otra solicitud
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight:'100vh', background:T.bg, display:'flex', alignItems:'center', justifyContent:'center', padding:'20px', fontFamily:'"DM Sans", system-ui, sans-serif' }}>
      <div style={{ width:'min(560px,100%)', background:T.card, border:`1px solid ${T.border}`, borderRadius:'14px', padding:'28px 24px' }}>
        <div style={{ fontSize:'18px', fontWeight:'800', color:T.text, marginBottom:'2px' }}>
          👋 Hola{colaborador ? `, ${colaborador.nombres}` : ''}
        </div>
        <div style={{ fontSize:'12px', color:T.muted, marginBottom:'20px' }}>Elige qué quieres solicitar a Recursos Humanos.</div>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:'8px', marginBottom:'16px' }}>
          {TIPOS.map(t => (
            <button key={t.v} onClick={() => setTipo(t.v)}
              style={{
                padding:'12px 10px', borderRadius:'10px', cursor:'pointer', textAlign:'left',
                background: tipo === t.v ? `${T.accent}20` : '#0A1628',
                border: `1.5px solid ${tipo === t.v ? T.accent : T.border}`,
              }}>
              <div style={{ fontSize:'13px', fontWeight:'700', color:T.text }}>{t.l}</div>
              <div style={{ fontSize:'10.5px', color:T.muted, marginTop:'4px', lineHeight:1.4 }}>{t.desc}</div>
            </button>
          ))}
        </div>

        {tipo && (
          <>
            {(tipo === 'vacaciones' || tipo === 'incapacidad') && (
              <div style={row2}>
                <div><label style={lbl}>Fecha inicio *</label><input type="date" style={inp} value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} /></div>
                <div><label style={lbl}>Fecha fin *</label><input type="date" style={inp} value={fechaFin} onChange={e => setFechaFin(e.target.value)} /></div>
              </div>
            )}
            {tipo === 'auxilio' && (
              <div style={row2}>
                <div>
                  <label style={lbl}>Tipo de auxilio</label>
                  <select style={{ ...inp, appearance:'none' as React.CSSProperties['appearance'] }} value={subtipoAuxilio} onChange={e => setSubtipoAuxilio(e.target.value)}>
                    {['Alimentación','Rodamiento','Estudio','Otro'].map(v => <option key={v}>{v}</option>)}
                  </select>
                </div>
              </div>
            )}
            <div style={{ marginBottom:'12px' }}>
              <label style={lbl}>Descripción {tipo === 'incapacidad' ? '(diagnóstico general, opcional)' : ''}</label>
              <textarea style={{ ...inp, minHeight:'70px', resize:'vertical' }} value={descripcion} onChange={e => setDescripcion(e.target.value)} />
            </div>
            <div style={{ marginBottom:'16px' }}>
              <label style={lbl}>{tipo === 'incapacidad' ? 'Soporte médico/EPS *' : 'Adjunto (opcional)'}</label>
              <input type="file" accept=".pdf,image/*" onChange={e => setArchivo(e.target.files?.[0] || null)} style={{ fontSize:'11px', color:T.muted }} />
            </div>

            {error && <div style={{ background:`${T.red}15`, border:`1px solid ${T.red}30`, borderRadius:'8px', padding:'9px', fontSize:'12px', color:T.red, marginBottom:'12px' }}>{error}</div>}

            <button onClick={enviar} disabled={enviando}
              style={{ width:'100%', padding:'11px', background:T.accent, border:'none', borderRadius:'9px', color:T.card, fontWeight:'700', cursor:enviando?'wait':'pointer', fontSize:'13px', opacity:enviando?0.7:1 }}>
              {enviando ? 'Enviando...' : '✅ Enviar solicitud'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
