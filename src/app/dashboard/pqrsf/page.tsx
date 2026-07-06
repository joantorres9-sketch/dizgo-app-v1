'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

type PQRSF = {
  id: string; numero_radicado: string; tipo: 'P'|'Q'|'R'|'S'|'F'
  nombre_cliente: string; email_cliente: string; telefono: string
  orden_id: string; asunto: string; descripcion: string
  estado: 'RECIBIDO'|'EN_GESTION'|'RESPONDIDO'|'CERRADO'
  respuesta: string; respondido_por: string | null
  created_at: string; fecha_respuesta: string | null; fecha_limite: string
}

const TIPO_INFO: Record<string, { label:string; color:string; emoji:string; dias:number }> = {
  P: { label:'Petición', color:'#3D8EF0', emoji:'📋', dias:15 },
  Q: { label:'Queja', color:'#F5A623', emoji:'😤', dias:10 },
  R: { label:'Reclamo', color:'#F05C5C', emoji:'❗', dias:10 },
  S: { label:'Sugerencia', color:'#2DD4A0', emoji:'💡', dias:15 },
  F: { label:'Felicitación', color:'#F5A623', emoji:'⭐', dias:15 },
}
const ESTADO_INFO: Record<string, { color:string; bg:string }> = {
  RECIBIDO: { color:'#3D8EF0', bg:'rgba(61,142,240,0.1)' },
  EN_GESTION: { color:'#F5A623', bg:'rgba(245,166,35,0.1)' },
  RESPONDIDO: { color:'#9B6BFF', bg:'rgba(155,107,255,0.1)' },
  CERRADO: { color:'#2DD4A0', bg:'rgba(45,212,160,0.1)' },
}

function diasRestantes(fechaLimite: string): number {
  const limite = new Date(fechaLimite)
  const hoy = new Date()
  return Math.ceil((limite.getTime() - hoy.getTime()) / (1000*60*60*24))
}
function fmtFecha(f: string | null): string {
  if (!f) return '—'
  return new Date(f).toLocaleDateString('es-CO', { day:'2-digit', month:'2-digit', year:'numeric' })
}

const s = { background:'#111520', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'12px' }
const inp = { background:'#0A0D14', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'7px', color:'#E8EDF5', padding:'7px 10px', fontSize:'13px', outline:'none', width:'100%', boxSizing:'border-box' as const }

export default function PQRSFPage() {
  const supabase = createClient()
  const [tenantId, setTenantId] = useState('')
  const [tenantSlug, setTenantSlug] = useState('')
  const [loading, setLoading] = useState(true)
  const [pqrsf, setPqrsf] = useState<PQRSF[]>([])
  const [seleccionada, setSeleccionada] = useState<PQRSF | null>(null)
  const [tab, setTab] = useState<'lista'|'nueva'|'stats'>('lista')
  const [filtroEstado, setFiltroEstado] = useState('TODOS')
  const [filtroTipo, setFiltroTipo] = useState('TODOS')
  const [respuesta, setRespuesta] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [copiado, setCopiado] = useState(false)
  const [nuevaPQRSF, setNuevaPQRSF] = useState({
    tipo:'R', nombre_cliente:'', email_cliente:'', telefono:'',
    orden_id:'', asunto:'', descripcion:''
  })

  const loadData = useCallback(async () => {
    setLoading(true)
    const { data:{ user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single()
    if (!profile?.tenant_id) { setLoading(false); return }
    const tid = profile.tenant_id
    setTenantId(tid)

    const [{ data: pqrsfData }, { data: tenantData }] = await Promise.all([
      supabase.from('pqrsf').select('*').eq('tenant_id', tid).order('created_at', { ascending:false }),
      supabase.from('tenants').select('slug').eq('id', tid).single(),
    ])
    setPqrsf((pqrsfData||[]) as PQRSF[])
    setTenantSlug((tenantData as { slug?:string }|null)?.slug || '')
    setLoading(false)
  }, [supabase])

  useEffect(() => { loadData() }, [loadData])

  const filtradas = pqrsf.filter(p => {
    if (filtroEstado !== 'TODOS' && p.estado !== filtroEstado) return false
    if (filtroTipo !== 'TODOS' && p.tipo !== filtroTipo) return false
    return true
  })

  const stats = {
    total: pqrsf.length,
    recibidas: pqrsf.filter(p=>p.estado==='RECIBIDO').length,
    en_gestion: pqrsf.filter(p=>p.estado==='EN_GESTION').length,
    respondidas: pqrsf.filter(p=>p.estado==='RESPONDIDO').length,
    cerradas: pqrsf.filter(p=>p.estado==='CERRADO').length,
    vencidas: pqrsf.filter(p => diasRestantes(p.fecha_limite) < 0 && p.estado !== 'CERRADO').length,
  }

  // ── Generar alertas reales por PQRSF vencidas (no solo en pantalla) ──
  useEffect(() => {
    if (!tenantId || pqrsf.length === 0) return
    const vencidasSinAlerta = pqrsf.filter(p => diasRestantes(p.fecha_limite) < 0 && p.estado !== 'CERRADO')
    if (vencidasSinAlerta.length === 0) return
    ;(async () => {
      const hoy = new Date().toDateString()
      const { data: alertasHoy } = await supabase.from('alertas').select('titulo').eq('tenant_id', tenantId)
        .gte('created_at', new Date().toISOString().slice(0,10))
      const titulosHoy = (alertasHoy||[]).map((a:{titulo:string}) => a.titulo)
      const titulo = `${vencidasSinAlerta.length} PQRSF vencidas sin responder`
      if (titulosHoy.includes(titulo)) return
      await supabase.from('alertas').insert({
        tenant_id: tenantId, tipo:'critico', categoria:'operativa', titulo,
        mensaje: `Tienes ${vencidasSinAlerta.length} solicitud(es) PQRSF que superaron el plazo legal de respuesta (Ley 1480). Riesgo de sanción ante la SIC.`,
        accion: 'Responde estas solicitudes hoy mismo desde el módulo PQRSF',
        modulo:'PQRSF', valor:`${vencidasSinAlerta.length} vencidas`, icono:'🔴',
      })
    })()
  }, [tenantId, pqrsf, supabase])

  async function responder() {
    if (!seleccionada || !respuesta) return
    setGuardando(true)
    const { data:{ user } } = await supabase.auth.getUser()
    const ahora = new Date().toISOString()
    await supabase.from('pqrsf').update({
      estado:'RESPONDIDO', respuesta, respondido_por: user?.id || null, fecha_respuesta: ahora,
    }).eq('id', seleccionada.id)
    setPqrsf(prev => prev.map(p => p.id === seleccionada.id
      ? { ...p, estado:'RESPONDIDO', respuesta, fecha_respuesta: ahora } : p))
    setSeleccionada(prev => prev ? { ...prev, estado:'RESPONDIDO', respuesta, fecha_respuesta: ahora } : null)
    setRespuesta('')
    setGuardando(false)
  }

  async function cerrar(id: string) {
    await supabase.from('pqrsf').update({ estado:'CERRADO' }).eq('id', id)
    setPqrsf(prev => prev.map(p => p.id === id ? { ...p, estado:'CERRADO' } : p))
    setSeleccionada(prev => prev?.id === id ? { ...prev, estado:'CERRADO' } : prev)
  }

  async function crearNueva() {
    if (!nuevaPQRSF.nombre_cliente || !nuevaPQRSF.asunto || !nuevaPQRSF.descripcion || !tenantId) return
    setGuardando(true)
    const now = new Date()
    const dias = TIPO_INFO[nuevaPQRSF.tipo]?.dias || 15
    const limite = new Date(now.getTime() + dias * 24*60*60*1000)
    const radicado = `DZ-${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}-${String(Date.now()).slice(-5)}`

    const { data, error } = await supabase.from('pqrsf').insert({
      tenant_id: tenantId, numero_radicado: radicado, tipo: nuevaPQRSF.tipo,
      nombre_cliente: nuevaPQRSF.nombre_cliente, email_cliente: nuevaPQRSF.email_cliente,
      telefono: nuevaPQRSF.telefono, orden_id: nuevaPQRSF.orden_id,
      asunto: nuevaPQRSF.asunto, descripcion: nuevaPQRSF.descripcion,
      estado:'RECIBIDO', fecha_limite: limite.toISOString(),
    }).select().single()

    if (!error && data) {
      setPqrsf(prev => [data as PQRSF, ...prev])
      // PQRSF de tipo Reclamo/Queja con prioridad alta → alerta inmediata
      if (['R','Q'].includes(nuevaPQRSF.tipo)) {
        await supabase.from('alertas').insert({
          tenant_id: tenantId, tipo:'atencion', categoria:'operativa',
          titulo: `Nueva PQRSF: ${nuevaPQRSF.asunto}`,
          mensaje: `${nuevaPQRSF.nombre_cliente} radicó un(a) ${TIPO_INFO[nuevaPQRSF.tipo].label.toLowerCase()}. Tienes ${dias} días hábiles para responder.`,
          accion: 'Revisar y responder desde el módulo PQRSF',
          modulo:'PQRSF', valor: radicado, icono:'🟡',
        })
      }
      setNuevaPQRSF({ tipo:'R', nombre_cliente:'', email_cliente:'', telefono:'', orden_id:'', asunto:'', descripcion:'' })
      setTab('lista')
    }
    setGuardando(false)
  }

  const linkPublico = tenantSlug ? `https://dizgo.app/pqrsf/${tenantSlug}` : ''

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'300px', color:'#8B96A8', fontSize:'14px' }}>
      Cargando PQRSF...
    </div>
  )

  return (
    <div style={{ color:'#E8EDF5', fontFamily:'system-ui,sans-serif' }}>

      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'20px', flexWrap:'wrap', gap:'10px' }}>
        <div>
          <h1 style={{ fontSize:'22px', fontWeight:'700', marginBottom:'4px' }}>📬 PQRSF</h1>
          <p style={{ fontSize:'13px', color:'#8B96A8' }}>
            Peticiones · Quejas · Reclamos · Sugerencias · Felicitaciones · HACER
          </p>
        </div>
        <div style={{ display:'flex', gap:'8px' }}>
          {linkPublico && (
            <button onClick={() => { navigator.clipboard?.writeText(linkPublico); setCopiado(true); setTimeout(()=>setCopiado(false),2000) }}
              style={{ padding:'9px 16px', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'10px', color:'#8B96A8', fontSize:'13px', fontWeight:'600', cursor:'pointer' }}>
              {copiado ? '✅ Copiado' : '🔗 Copiar link público'}
            </button>
          )}
          <button onClick={() => setTab('nueva')}
            style={{ padding:'9px 18px', background:'#F5A623', color:'#0A0D14', border:'none', borderRadius:'10px', fontWeight:'700', fontSize:'13px', cursor:'pointer' }}>
            + Nueva PQRSF
          </button>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:'8px', marginBottom:'16px' }}>
        {[
          { label:'Total', value:stats.total, color:'#E8EDF5', icon:'📬' },
          { label:'Recibidas', value:stats.recibidas, color:'#3D8EF0', icon:'📥' },
          { label:'En gestión', value:stats.en_gestion, color:'#F5A623', icon:'⏳' },
          { label:'Respondidas', value:stats.respondidas, color:'#9B6BFF', icon:'✉️' },
          { label:'Cerradas', value:stats.cerradas, color:'#2DD4A0', icon:'✅' },
          { label:'Vencidas', value:stats.vencidas, color: stats.vencidas > 0 ? '#F05C5C' : '#2DD4A0', icon:'🚨' },
        ].map((k,i) => (
          <div key={i} style={{ ...s, padding:'12px', borderTop:`2px solid ${k.color}` }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'6px' }}>
              <span style={{ fontSize:'10px', color:'#8B96A8' }}>{k.label}</span><span>{k.icon}</span>
            </div>
            <div style={{ fontSize:'22px', fontWeight:'800', color:k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'flex', gap:'6px', marginBottom:'16px', flexWrap:'wrap' }}>
        {[
          { key:'lista', label:'📋 Lista' },
          { key:'nueva', label:'✏️ Nueva PQRSF' },
          { key:'stats', label:'📊 Estadísticas' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as typeof tab)}
            style={{ padding:'8px 16px', borderRadius:'9px', border:'none', cursor:'pointer', fontSize:'13px', fontWeight:'600',
              background: tab === t.key ? '#F5A623' : 'rgba(255,255,255,0.05)', color: tab === t.key ? '#0A0D14' : '#8B96A8' }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'lista' && (
        <div style={{ display:'grid', gridTemplateColumns: seleccionada ? '1fr 400px' : '1fr', gap:'16px' }}>
          <div>
            <div style={{ display:'flex', gap:'6px', marginBottom:'12px', flexWrap:'wrap' }}>
              {['TODOS','RECIBIDO','EN_GESTION','RESPONDIDO','CERRADO'].map(f => (
                <button key={f} onClick={() => setFiltroEstado(f)}
                  style={{ padding:'5px 12px', borderRadius:'7px', border:'none', cursor:'pointer', fontSize:'11px', fontWeight:'600',
                    background: filtroEstado === f ? '#F5A623' : 'rgba(255,255,255,0.05)', color: filtroEstado === f ? '#0A0D14' : '#8B96A8' }}>
                  {f.replace('_',' ')}
                </button>
              ))}
              <div style={{ width:'1px', background:'rgba(255,255,255,0.08)', margin:'0 4px' }} />
              {['TODOS','P','Q','R','S','F'].map(t => (
                <button key={t} onClick={() => setFiltroTipo(t)}
                  style={{ padding:'5px 10px', borderRadius:'7px', cursor:'pointer', fontSize:'11px', fontWeight:'600',
                    background: filtroTipo === t ? (t === 'TODOS' ? '#F5A623' : `${TIPO_INFO[t]?.color || '#F5A623'}22`) : 'rgba(255,255,255,0.05)',
                    color: filtroTipo === t ? (t === 'TODOS' ? '#0A0D14' : TIPO_INFO[t]?.color || '#F5A623') : '#8B96A8',
                    border: filtroTipo === t && t !== 'TODOS' ? `1px solid ${TIPO_INFO[t]?.color}44` : '1px solid transparent' }}>
                  {t === 'TODOS' ? 'Todos' : `${TIPO_INFO[t]?.emoji} ${t}`}
                </button>
              ))}
            </div>

            <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
              {filtradas.map(p => {
                const tipo = TIPO_INFO[p.tipo]
                const estado = ESTADO_INFO[p.estado]
                const dias = diasRestantes(p.fecha_limite)
                const activa = seleccionada?.id === p.id
                return (
                  <div key={p.id} onClick={() => setSeleccionada(activa ? null : p)}
                    style={{ ...s, padding:'14px 16px', cursor:'pointer', transition:'all .12s',
                      border:`1px solid ${activa ? tipo.color + '44' : 'rgba(255,255,255,0.07)'}`,
                      background: activa ? tipo.color + '06' : '#111520' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                      <div style={{ width:'36px', height:'36px', borderRadius:'10px', background:`${tipo.color}15`,
                        display:'flex', alignItems:'center', justifyContent:'center', fontSize:'18px', flexShrink:0 }}>
                        {tipo.emoji}
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'3px', flexWrap:'wrap' }}>
                          <span style={{ fontSize:'13px', fontWeight:'700' }}>{p.nombre_cliente}</span>
                          <span style={{ fontSize:'10px', padding:'1px 7px', borderRadius:'5px', fontWeight:'700', background:`${tipo.color}15`, color:tipo.color }}>{tipo.label}</span>
                          <span style={{ fontSize:'10px', padding:'1px 7px', borderRadius:'5px', fontWeight:'700', background:estado.bg, color:estado.color }}>{p.estado.replace('_',' ')}</span>
                          {['R','Q'].includes(p.tipo) && (
                            <span style={{ fontSize:'9px', padding:'1px 6px', borderRadius:'4px', background:'rgba(240,92,92,0.12)', color:'#F05C5C', fontWeight:'700' }}>ALTA PRIORIDAD</span>
                          )}
                        </div>
                        <div style={{ fontSize:'12px', color:'#E8EDF5', marginBottom:'2px' }}>{p.asunto}</div>
                        <div style={{ fontSize:'11px', color:'#5A6478' }}>
                          {p.numero_radicado} · {fmtFecha(p.created_at)}{p.orden_id && ` · Orden #${p.orden_id}`}
                        </div>
                      </div>
                      <div style={{ textAlign:'right', flexShrink:0 }}>
                        <div style={{ fontSize:'11px', fontWeight:'700', color: dias < 0 ? '#F05C5C' : dias <= 3 ? '#F5A623' : '#5A6478' }}>
                          {dias < 0 ? `Vencida (${Math.abs(dias)}d)` : dias === 0 ? '¡Vence hoy!' : `${dias}d restantes`}
                        </div>
                        <div style={{ fontSize:'10px', color:'#5A6478', marginTop:'2px' }}>Límite: {fmtFecha(p.fecha_limite)}</div>
                      </div>
                    </div>
                  </div>
                )
              })}
              {filtradas.length === 0 && (
                <div style={{ ...s, padding:'32px', textAlign:'center', color:'#5A6478', fontSize:'13px' }}>Sin PQRSF con los filtros seleccionados</div>
              )}
            </div>
          </div>

          {seleccionada && (
            <div style={{ ...s, padding:'20px', position:'sticky', top:'20px', maxHeight:'80vh', overflowY:'auto' }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'16px' }}>
                <div>
                  <div style={{ fontSize:'11px', color:'#5A6478', marginBottom:'4px' }}>RADICADO</div>
                  <div style={{ fontSize:'14px', fontWeight:'800', color: TIPO_INFO[seleccionada.tipo].color }}>
                    {TIPO_INFO[seleccionada.tipo].emoji} {seleccionada.numero_radicado}
                  </div>
                </div>
                <button onClick={() => setSeleccionada(null)} style={{ background:'none', border:'none', color:'#8B96A8', cursor:'pointer', fontSize:'20px' }}>×</button>
              </div>

              <div style={{ background:'rgba(255,255,255,0.02)', borderRadius:'10px', padding:'12px 14px', marginBottom:'12px' }}>
                <div style={{ fontSize:'11px', color:'#5A6478', fontWeight:'700', marginBottom:'8px' }}>CLIENTE</div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))', gap:'8px', fontSize:'12px' }}>
                  {[
                    { l:'Nombre', v:seleccionada.nombre_cliente },
                    { l:'Teléfono', v:seleccionada.telefono || 'N/A' },
                    { l:'Email', v:seleccionada.email_cliente || 'N/A' },
                    { l:'Orden', v:seleccionada.orden_id || 'N/A' },
                  ].map((f,i) => (
                    <div key={i}>
                      <div style={{ color:'#5A6478', fontSize:'10px' }}>{f.l}</div>
                      <div style={{ color:'#E8EDF5', fontWeight:'600' }}>{f.v}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom:'12px' }}>
                <div style={{ fontSize:'13px', fontWeight:'700', marginBottom:'6px' }}>{seleccionada.asunto}</div>
                <div style={{ fontSize:'12px', color:'#8B96A8', lineHeight:'1.6', background:'rgba(255,255,255,0.02)', padding:'10px 12px', borderRadius:'8px' }}>{seleccionada.descripcion}</div>
              </div>

              {seleccionada.respuesta && (
                <div style={{ marginBottom:'12px', padding:'12px', background:'rgba(45,212,160,0.06)', borderRadius:'10px', border:'1px solid rgba(45,212,160,0.15)' }}>
                  <div style={{ fontSize:'11px', color:'#2DD4A0', fontWeight:'700', marginBottom:'6px' }}>✅ RESPUESTA ENVIADA — {fmtFecha(seleccionada.fecha_respuesta)}</div>
                  <div style={{ fontSize:'12px', color:'#8B96A8', lineHeight:'1.6' }}>{seleccionada.respuesta}</div>
                </div>
              )}

              {seleccionada.estado !== 'CERRADO' && (
                <div>
                  <div style={{ fontSize:'11px', color:'#5A6478', fontWeight:'700', marginBottom:'6px' }}>
                    {seleccionada.respuesta ? 'ACTUALIZAR RESPUESTA' : 'RESPONDER'}
                  </div>
                  <textarea value={respuesta} onChange={e => setRespuesta(e.target.value)}
                    placeholder="Escribe tu respuesta al cliente..." rows={4}
                    style={{ ...inp, resize:'vertical', marginBottom:'8px' }} />
                  <div style={{ display:'flex', gap:'8px' }}>
                    <button onClick={responder} disabled={!respuesta || guardando}
                      style={{ flex:1, padding:'9px', background: respuesta ? '#F5A623' : 'rgba(255,255,255,0.05)',
                        border:'none', borderRadius:'8px', color: respuesta ? '#0A0D14' : '#5A6478',
                        cursor: respuesta ? 'pointer' : 'not-allowed', fontSize:'13px', fontWeight:'700' }}>
                      {guardando ? 'Enviando...' : '✉️ Enviar respuesta'}
                    </button>
                    {seleccionada.estado === 'RESPONDIDO' && (
                      <button onClick={() => cerrar(seleccionada.id)}
                        style={{ padding:'9px 14px', background:'rgba(45,212,160,0.1)', border:'none', borderRadius:'8px', color:'#2DD4A0', cursor:'pointer', fontSize:'13px', fontWeight:'700' }}>
                        ✅ Cerrar
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div style={{ marginTop:'12px', padding:'10px 12px', borderRadius:'8px', display:'flex', justifyContent:'space-between',
                background: diasRestantes(seleccionada.fecha_limite) < 0 ? 'rgba(240,92,92,0.06)' : diasRestantes(seleccionada.fecha_limite) <= 3 ? 'rgba(245,166,35,0.06)' : 'rgba(255,255,255,0.02)',
                border: `1px solid ${diasRestantes(seleccionada.fecha_limite) < 0 ? 'rgba(240,92,92,0.2)' : 'rgba(255,255,255,0.06)'}` }}>
                <span style={{ fontSize:'11px', color:'#5A6478' }}>Fecha límite respuesta</span>
                <span style={{ fontSize:'12px', fontWeight:'700', color: diasRestantes(seleccionada.fecha_limite) < 0 ? '#F05C5C' : diasRestantes(seleccionada.fecha_limite) <= 3 ? '#F5A623' : '#2DD4A0' }}>
                  {fmtFecha(seleccionada.fecha_limite)} ({diasRestantes(seleccionada.fecha_limite)}d)
                </span>
              </div>

              <div style={{ marginTop:'10px', padding:'10px 12px', borderRadius:'8px', background:'rgba(61,142,240,0.05)', border:'1px solid rgba(61,142,240,0.15)', fontSize:'11px', color:'#5A6478', lineHeight:'1.5' }}>
                ⚖️ Según Ley 1480 (Estatuto del Consumidor), tienes hasta {TIPO_INFO[seleccionada.tipo]?.dias} días hábiles para responder esta {TIPO_INFO[seleccionada.tipo]?.label.toLowerCase()}.
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'nueva' && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))', gap:'16px' }}>
          <div style={{ ...s, padding:'20px' }}>
            <div style={{ fontSize:'12px', fontWeight:'700', color:'#F5A623', marginBottom:'16px' }}>✏️ REGISTRAR NUEVA PQRSF</div>
            <div style={{ marginBottom:'14px' }}>
              <label style={{ display:'block', fontSize:'11px', color:'#5A6478', marginBottom:'8px' }}>Tipo de solicitud</label>
              <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
                {Object.entries(TIPO_INFO).map(([key, info]) => (
                  <button key={key} onClick={() => setNuevaPQRSF(p => ({...p, tipo:key}))}
                    style={{ padding:'7px 14px', borderRadius:'8px', border:`1px solid ${nuevaPQRSF.tipo === key ? info.color : 'rgba(255,255,255,0.08)'}`,
                      background: nuevaPQRSF.tipo === key ? `${info.color}15` : 'transparent',
                      color: nuevaPQRSF.tipo === key ? info.color : '#8B96A8', cursor:'pointer', fontSize:'12px', fontWeight:'600' }}>
                    {info.emoji} {info.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))', gap:'10px', marginBottom:'10px' }}>
              <div style={{ gridColumn:'1/-1' }}>
                <label style={{ display:'block', fontSize:'11px', color:'#5A6478', marginBottom:'4px' }}>Nombre del cliente</label>
                <input value={nuevaPQRSF.nombre_cliente} placeholder="Ej: María García"
                  onChange={e => setNuevaPQRSF(p => ({...p, nombre_cliente:e.target.value}))} style={inp} />
              </div>
              <div>
                <label style={{ display:'block', fontSize:'11px', color:'#5A6478', marginBottom:'4px' }}>Email</label>
                <input value={nuevaPQRSF.email_cliente} placeholder="cliente@email.com"
                  onChange={e => setNuevaPQRSF(p => ({...p, email_cliente:e.target.value}))} style={inp} />
              </div>
              <div>
                <label style={{ display:'block', fontSize:'11px', color:'#5A6478', marginBottom:'4px' }}>Teléfono</label>
                <input value={nuevaPQRSF.telefono} placeholder="3001234567"
                  onChange={e => setNuevaPQRSF(p => ({...p, telefono:e.target.value}))} style={inp} />
              </div>
              <div>
                <label style={{ display:'block', fontSize:'11px', color:'#5A6478', marginBottom:'4px' }}>Número de orden (opcional)</label>
                <input value={nuevaPQRSF.orden_id} placeholder="9012345"
                  onChange={e => setNuevaPQRSF(p => ({...p, orden_id:e.target.value}))} style={inp} />
              </div>
            </div>

            <div style={{ marginBottom:'10px' }}>
              <label style={{ display:'block', fontSize:'11px', color:'#5A6478', marginBottom:'4px' }}>Asunto</label>
              <input value={nuevaPQRSF.asunto} placeholder="Resumen breve de la solicitud"
                onChange={e => setNuevaPQRSF(p => ({...p, asunto:e.target.value}))} style={inp} />
            </div>

            <div style={{ marginBottom:'14px' }}>
              <label style={{ display:'block', fontSize:'11px', color:'#5A6478', marginBottom:'4px' }}>Descripción detallada</label>
              <textarea value={nuevaPQRSF.descripcion} placeholder="Describe en detalle la solicitud del cliente..."
                rows={4} onChange={e => setNuevaPQRSF(p => ({...p, descripcion:e.target.value}))} style={{ ...inp, resize:'vertical' }} />
            </div>

            <button onClick={crearNueva} disabled={!nuevaPQRSF.nombre_cliente || !nuevaPQRSF.asunto || !nuevaPQRSF.descripcion || guardando}
              style={{ width:'100%', padding:'11px', background:'#F5A623', border:'none', borderRadius:'10px',
                color:'#0A0D14', cursor:'pointer', fontWeight:'700', fontSize:'13px',
                opacity: !nuevaPQRSF.nombre_cliente || !nuevaPQRSF.asunto ? 0.5 : 1 }}>
              {guardando ? 'Radicando...' : '📬 Radicar PQRSF'}
            </button>
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
            <div style={{ ...s, padding:'18px' }}>
              <div style={{ fontSize:'12px', fontWeight:'700', color:'#3D8EF0', marginBottom:'12px' }}>⚖️ TIEMPOS LEGALES — LEY 1480</div>
              {Object.entries(TIPO_INFO).map(([key, info]) => (
                <div key={key} style={{ display:'flex', justifyContent:'space-between', padding:'8px 10px', borderRadius:'8px', marginBottom:'5px', background:`${info.color}06` }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                    <span style={{ fontSize:'16px' }}>{info.emoji}</span><span style={{ fontSize:'12px', color:'#8B96A8' }}>{info.label}</span>
                  </div>
                  <span style={{ fontSize:'12px', fontWeight:'700', color:info.color }}>{info.dias} días hábiles</span>
                </div>
              ))}
              <div style={{ marginTop:'10px', padding:'10px 12px', background:'rgba(61,142,240,0.05)', borderRadius:'8px', fontSize:'11px', color:'#8B96A8', lineHeight:'1.6' }}>
                El incumplimiento de estos plazos puede generar sanciones ante la Superintendencia de Industria y Comercio (SIC).
              </div>
            </div>

            <div style={{ ...s, padding:'18px' }}>
              <div style={{ fontSize:'12px', fontWeight:'700', color:'#2DD4A0', marginBottom:'12px' }}>🔗 FORMULARIO PÚBLICO DE TU TIENDA</div>
              <div style={{ fontSize:'12px', color:'#8B96A8', marginBottom:'12px', lineHeight:'1.6' }}>
                Comparte este link con tus clientes para que radiquen sus solicitudes directamente sin revelar la identidad de tu tienda.
              </div>
              {linkPublico ? (
                <>
                  <div style={{ padding:'10px 12px', background:'rgba(255,255,255,0.03)', borderRadius:'8px', fontFamily:'monospace', fontSize:'12px', color:'#2DD4A0', marginBottom:'10px', wordBreak:'break-all' }}>
                    {linkPublico}
                  </div>
                  <div style={{ display:'flex', gap:'8px' }}>
                    <button onClick={() => { navigator.clipboard?.writeText(linkPublico); setCopiado(true); setTimeout(()=>setCopiado(false),2000) }}
                      style={{ flex:1, padding:'8px', background:'rgba(45,212,160,0.1)', border:'none', borderRadius:'7px', color:'#2DD4A0', cursor:'pointer', fontSize:'12px', fontWeight:'600' }}>
                      {copiado ? '✅ Copiado' : '📋 Copiar link'}
                    </button>
                    <button onClick={() => {
                      const msg = encodeURIComponent(`Hola, si tienes alguna solicitud, queja o reclamo sobre tu pedido, puedes radicarlo aquí: ${linkPublico}`)
                      window.open(`https://wa.me/?text=${msg}`, '_blank')
                    }}
                      style={{ flex:1, padding:'8px', background:'rgba(37,211,102,0.1)', border:'none', borderRadius:'7px', color:'#25D366', cursor:'pointer', fontSize:'12px', fontWeight:'600' }}>
                      💬 Compartir WA
                    </button>
                  </div>
                </>
              ) : (
                <div style={{ fontSize:'12px', color:'#5A6478', textAlign:'center', padding:'10px' }}>Configura el slug de tu tienda para generar el link público</div>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === 'stats' && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))', gap:'16px' }}>
          <div style={{ ...s, padding:'20px' }}>
            <div style={{ fontSize:'12px', fontWeight:'700', color:'#F5A623', marginBottom:'14px' }}>📊 POR TIPO DE SOLICITUD</div>
            {Object.entries(TIPO_INFO).map(([key, info]) => {
              const count = pqrsf.filter(p => p.tipo === key).length
              const pct = pqrsf.length > 0 ? Math.round(count/pqrsf.length*100) : 0
              return (
                <div key={key} style={{ marginBottom:'12px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'4px' }}>
                    <span style={{ fontSize:'12px', color:'#8B96A8' }}>{info.emoji} {info.label}</span>
                    <span style={{ fontSize:'13px', fontWeight:'700', color:info.color }}>{count} ({pct}%)</span>
                  </div>
                  <div style={{ height:'8px', background:'rgba(255,255,255,0.05)', borderRadius:'4px' }}>
                    <div style={{ height:'8px', width:`${pct}%`, background:info.color, borderRadius:'4px' }} />
                  </div>
                </div>
              )
            })}
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
            <div style={{ ...s, padding:'18px' }}>
              <div style={{ fontSize:'12px', fontWeight:'700', color:'#3D8EF0', marginBottom:'12px' }}>⏱️ TIEMPOS DE RESPUESTA</div>
              {[
                { label:'Respondidas a tiempo', value:pqrsf.filter(p=>p.estado==='RESPONDIDO'||p.estado==='CERRADO').length, color:'#2DD4A0', icon:'✅' },
                { label:'En gestión (a tiempo)', value:pqrsf.filter(p=>p.estado==='EN_GESTION' && diasRestantes(p.fecha_limite)>=0).length, color:'#F5A623', icon:'⏳' },
                { label:'Vencidas sin responder', value:pqrsf.filter(p=>p.estado!=='CERRADO'&&diasRestantes(p.fecha_limite)<0).length, color:'#F05C5C', icon:'🚨' },
              ].map((k, i) => (
                <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 12px', borderRadius:'8px', marginBottom:'6px', background:`${k.color}08` }}>
                  <span style={{ fontSize:'12px', color:'#8B96A8', display:'flex', gap:'6px', alignItems:'center' }}><span>{k.icon}</span>{k.label}</span>
                  <span style={{ fontSize:'16px', fontWeight:'800', color:k.color }}>{k.value}</span>
                </div>
              ))}
            </div>

            <div style={{ ...s, padding:'18px' }}>
              <div style={{ fontSize:'12px', fontWeight:'700', color:'#9B6BFF', marginBottom:'12px' }}>💡 RECOMENDACIONES</div>
              {[
                stats.en_gestion > 0 && { color:'#F5A623', texto:`${stats.en_gestion} solicitudes en gestión — responder antes del vencimiento` },
                stats.vencidas > 0 && { color:'#F05C5C', texto:`${stats.vencidas} solicitudes vencidas — riesgo legal ante la SIC (ya se generó alerta)` },
                { color:'#3D8EF0', texto:'Comparte el link público con cada cliente en el mensaje de confirmación' },
                { color:'#2DD4A0', texto:'Responder en menos de 24h genera mayor confianza y reduce reclamos formales' },
              ].filter(Boolean).map((a, i) => a && (
                <div key={i} style={{ display:'flex', gap:'8px', padding:'8px 10px', borderRadius:'7px', marginBottom:'5px', background:`${a.color}08`, borderLeft:`3px solid ${a.color}` }}>
                  <span style={{ fontSize:'12px', color:'#8B96A8' }}>{a.texto}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
