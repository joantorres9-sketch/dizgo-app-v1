'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

const T = { bg:'#0D1E35', card:'#081426', accent:'#F58720', blue:'#3D8EF0', green:'#2DD4A0', red:'#F05C5C', text:'#E8EDF5', muted:'#5A7A9A', border:'#152238', yellow:'#F5A623' }
const inp: React.CSSProperties = { width:'100%', background:'#0A1628', border:`1.5px solid ${T.border}`, borderRadius:'8px', padding:'10px 12px', fontSize:'13px', color:T.text, outline:'none', boxSizing:'border-box' }
const lbl: React.CSSProperties = { fontSize:'11px', color:T.muted, marginBottom:'4px', display:'block' }
const row2: React.CSSProperties = { display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:'10px', marginBottom:'12px' }

const TIPOS = [
  { v:'P', l:'📋 Petición', desc:'Solicita información o un trámite.' },
  { v:'Q', l:'😤 Queja', desc:'Manifiesta tu inconformidad con el servicio.' },
  { v:'R', l:'❗ Reclamo', desc:'Reporta un problema con tu pedido.' },
  { v:'S', l:'💡 Sugerencia', desc:'Comparte una idea para mejorar.' },
  { v:'F', l:'⭐ Felicitación', desc:'Cuéntanos qué te gustó.' },
]

export default function PqrsfPublicoPage() {
  const params = useParams()
  const slug = String(params.slug || '')
  const [cargando, setCargando] = useState(true)
  const [tienda, setTienda] = useState<{ nombre: string } | null>(null)
  const [notFound, setNotFound] = useState(false)

  const [tipo, setTipo] = useState('')
  const [nombreCliente, setNombreCliente] = useState('')
  const [emailCliente, setEmailCliente] = useState('')
  const [telefono, setTelefono] = useState('')
  const [ordenId, setOrdenId] = useState('')
  const [asunto, setAsunto] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [radicado, setRadicado] = useState('')

  useEffect(() => {
    if (!slug) return
    fetch(`/api/pqrsf/tenant-publico/${slug}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => setTienda(data))
      .catch(() => setNotFound(true))
      .finally(() => setCargando(false))
  }, [slug])

  async function enviar() {
    if (!tipo || !nombreCliente || !asunto || !descripcion) { setError('Completa tipo, nombre, asunto y descripción'); return }
    setEnviando(true); setError('')
    const res = await fetch('/api/pqrsf/crear', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, tipo, nombre_cliente: nombreCliente, email_cliente: emailCliente, telefono, orden_id: ordenId, asunto, descripcion }),
    })
    setEnviando(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error || 'No se pudo enviar tu caso')
      return
    }
    const data = await res.json()
    setRadicado(data.numero_radicado || '')
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
          <div style={{ fontSize:'12px', color:T.muted, marginTop:'8px' }}>Verifica el link con la tienda.</div>
        </div>
      </div>
    )
  }

  if (radicado) {
    return (
      <div style={{ minHeight:'100vh', background:T.bg, display:'flex', alignItems:'center', justifyContent:'center', padding:'20px', fontFamily:'"DM Sans", system-ui, sans-serif' }}>
        <div style={{ width:'min(420px,100%)', textAlign:'center', background:T.card, border:`1px solid ${T.border}`, borderRadius:'14px', padding:'32px 24px' }}>
          <div style={{ fontSize:'40px', marginBottom:'12px' }}>✅</div>
          <div style={{ fontSize:'16px', fontWeight:'700', color:T.text, marginBottom:'8px' }}>¡Caso radicado!</div>
          <div style={{ fontSize:'12px', color:T.muted, lineHeight:1.6, marginBottom:'12px' }}>
            {tienda?.nombre} recibió tu caso y te responderá dentro del plazo legal. Guarda tu número de radicado.
          </div>
          <div style={{ background:'#0A1628', border:`1px solid ${T.border}`, borderRadius:'8px', padding:'10px', fontSize:'14px', fontWeight:'700', color:T.accent, fontFamily:'monospace' }}>
            {radicado}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight:'100vh', background:T.bg, display:'flex', alignItems:'center', justifyContent:'center', padding:'20px', fontFamily:'"DM Sans", system-ui, sans-serif' }}>
      <div style={{ width:'min(560px,100%)', background:T.card, border:`1px solid ${T.border}`, borderRadius:'14px', padding:'28px 24px' }}>
        <div style={{ fontSize:'18px', fontWeight:'800', color:T.text, marginBottom:'2px' }}>
          📬 PQRSF — {tienda?.nombre}
        </div>
        <div style={{ fontSize:'12px', color:T.muted, marginBottom:'20px' }}>Peticiones, quejas, reclamos, sugerencias y felicitaciones.</div>

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
            <div style={row2}>
              <div><label style={lbl}>Tu nombre *</label><input style={inp} value={nombreCliente} onChange={e => setNombreCliente(e.target.value)} /></div>
              <div><label style={lbl}>Número de pedido (si aplica)</label><input style={inp} value={ordenId} onChange={e => setOrdenId(e.target.value)} /></div>
            </div>
            <div style={row2}>
              <div><label style={lbl}>Correo</label><input style={inp} type="email" value={emailCliente} onChange={e => setEmailCliente(e.target.value)} /></div>
              <div><label style={lbl}>Celular</label><input style={inp} value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="3001234567" /></div>
            </div>
            <div style={{ marginBottom:'12px' }}>
              <label style={lbl}>Asunto *</label>
              <input style={inp} value={asunto} onChange={e => setAsunto(e.target.value)} placeholder="Ej: Producto llegó dañado" />
            </div>
            <div style={{ marginBottom:'16px' }}>
              <label style={lbl}>Cuéntanos qué pasó *</label>
              <textarea style={{ ...inp, minHeight:'90px', resize:'vertical' }} value={descripcion} onChange={e => setDescripcion(e.target.value)} />
            </div>

            {error && <div style={{ background:`${T.red}15`, border:`1px solid ${T.red}30`, borderRadius:'8px', padding:'9px', fontSize:'12px', color:T.red, marginBottom:'12px' }}>{error}</div>}

            <button onClick={enviar} disabled={enviando}
              style={{ width:'100%', padding:'11px', background:T.accent, border:'none', borderRadius:'9px', color:T.card, fontWeight:'700', cursor:enviando?'wait':'pointer', fontSize:'13px', opacity:enviando?0.7:1 }}>
              {enviando ? 'Enviando...' : '✅ Radicar caso'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
