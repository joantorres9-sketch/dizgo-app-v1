'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatMoneda } from '@/lib/paises'
import { useTasasCambio, copAUsdConTasas } from '@/lib/tasas'
import { useTema, PALETA_OSCURA } from '@/lib/tema'

const WA = '#25D366' // verde de marca de WhatsApp -- fijo, no depende del tema

const ETAPAS: { v: string; l: string; c: string }[] = [
  { v:'nuevo',       l:'Nuevo',        c:PALETA_OSCURA.blue },
  { v:'conversando', l:'Conversando',  c:PALETA_OSCURA.purple },
  { v:'calificado',  l:'Calificado',   c:PALETA_OSCURA.accent },
  { v:'propuesta',   l:'Propuesta',    c:PALETA_OSCURA.yellow },
  { v:'negociacion', l:'Negociación',  c:PALETA_OSCURA.yellow },
  { v:'ganado',      l:'Ganado',       c:PALETA_OSCURA.green },
  { v:'perdido',     l:'Perdido',      c:PALETA_OSCURA.red },
]
const INTERES_LABEL: Record<string, string> = { app:'📱 App', mentoria:'🎓 Mentoría', consultoria:'💼 Consultoría', otro:'❓ Otro' }
const PRECIOS_PLAN: Record<string, number> = { emprendedor: 89000, empresarial: 249000 }
const TABS: { v: string; l: string }[] = [
  { v:'kanban', l:'📈 Kanban' },
  { v:'catalogo', l:'💰 Catálogo & Agente' },
  { v:'finanzas', l:'🏦 Finanzas' },
  { v:'publicaciones', l:'📝 Publicaciones' },
  { v:'campanas', l:'📣 Campañas' },
  { v:'enlaces', l:'🔗 Enlaces' },
  { v:'integraciones', l:'🔌 Integraciones' },
]
const OBJETIVOS_CAMPANA = ['OUTCOME_TRAFFIC', 'OUTCOME_ENGAGEMENT', 'OUTCOME_LEADS', 'OUTCOME_SALES', 'OUTCOME_AWARENESS']

const ENLACES = [
  { label:'Meta Business Manager (Dizgo.co)', url:'https://business.facebook.com/latest/home?business_id=1672084047562878', emoji:'📘' },
  { label:'Administrador de WhatsApp', url:'https://business.facebook.com/latest/whatsapp_manager/phone_numbers/?business_id=1672084047562878', emoji:'💬' },
  { label:'Administrador de Anuncios (Meta Ads)', url:'https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=2093741134685570', emoji:'📣' },
  { label:'Vercel — app.dizgo.app', url:'https://vercel.com/joantorres9-sketchs-projects/dizgo-app', emoji:'▲' },
  { label:'Vercel — www.dizgo.app', url:'https://vercel.com/joantorres9-sketchs-projects/dizgo-home', emoji:'▲' },
  { label:'Supabase', url:'https://supabase.com/dashboard/project/pplwwvfopzfkdkkxyswq', emoji:'🗄️' },
  { label:'GitHub — dizgo-app-v1', url:'https://github.com/joantorres9-sketch/dizgo-app-v1', emoji:'💻' },
  { label:'GitHub — dizgo-home', url:'https://github.com/joantorres9-sketch/dizgo-home', emoji:'💻' },
  { label:'Stripe Dashboard', url:'https://dashboard.stripe.com/', emoji:'💳' },
  { label:'Wompi Dashboard', url:'https://comercios.wompi.co/', emoji:'💳' },
]

type Lead = {
  id: string; nombre: string | null; whatsapp: string; email: string | null; pais: string | null
  interes: string; etapa: string; ia_modo_activo: boolean
  origen_meta: Record<string, unknown> | null; notas: string | null
  created_at: string; ultimo_mensaje_at: string | null
}
type Mensaje = { id: string; direccion: string; texto: string; generado_por: string; created_at: string }
type CatalogoItem = { nombre: string; precio: string; detalle: string }
type ConfigAgente = { prompt_sistema: string; catalogo: { planes_app: CatalogoItem[]; servicios_consultoria: CatalogoItem[] } }
type TenantPago = { id: string; nombre: string; plan: string; licencia: string; licencia_vence: string | null }
type PagoLog = { id: string; tenant_id: string | null; proveedor: string; evento: string; created_at: string }
type Publicacion = { id: string; texto: string; imagen_url: string | null; fb_post_id: string | null; estado: string; created_at: string }
type Campana = {
  id: string; nombre: string; objetivo: string; presupuesto_diario_cop: number; estado: string
  meta_campaign_id: string | null; creado_at: string
  rendimiento: { spend: string; impressions: string; clicks: string } | null
}

function tiempoDesde(iso: string | null): string {
  if (!iso) return 'sin actividad'
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (min < 60) return `hace ${min}m`
  if (min < 1440) return `hace ${Math.round(min/60)}h`
  return `hace ${Math.round(min/1440)}d`
}

export default function CentroDizgoPage() {
  const { T } = useTema()
  const inp: React.CSSProperties = { width:'100%', background:T.card2, border:`1.5px solid ${T.border}`, borderRadius:'8px', padding:'8px 10px', fontSize:'12px', color:T.text, outline:'none', boxSizing:'border-box' }
  const lbl: React.CSSProperties = { fontSize:'11px', color:T.muted, marginBottom:'4px', display:'block' }
  const router = useRouter()
  const supabase = createClient()
  const { tasas } = useTasasCambio()
  const [autorizado, setAutorizado] = useState<boolean | null>(null)
  const [tab, setTab] = useState('kanban')

  // ── Kanban ──
  const [leads, setLeads] = useState<Lead[]>([])
  const [dragId, setDragId] = useState<string | null>(null)
  const [leadActivo, setLeadActivo] = useState<Lead | null>(null)
  const [mensajes, setMensajes] = useState<Mensaje[]>([])
  const [textoManual, setTextoManual] = useState('')
  const [enviando, setEnviando] = useState(false)

  // ── Catálogo & Agente ──
  const [config, setConfig] = useState<ConfigAgente | null>(null)
  const [guardandoConfig, setGuardandoConfig] = useState(false)
  const [configGuardado, setConfigGuardado] = useState(false)

  // ── Finanzas ──
  const [tenantsPago, setTenantsPago] = useState<TenantPago[]>([])
  const [pagos, setPagos] = useState<PagoLog[]>([])
  const [nombresTenant, setNombresTenant] = useState<Record<string,string>>({})

  // ── Publicaciones ──
  const [publicaciones, setPublicaciones] = useState<Publicacion[]>([])
  const [textoPost, setTextoPost] = useState('')
  const [imagenPost, setImagenPost] = useState('')
  const [publicando, setPublicando] = useState(false)
  const [publicado, setPublicado] = useState(false)

  // ── Campañas ──
  const [campanas, setCampanas] = useState<Campana[]>([])
  const [formCampana, setFormCampana] = useState({ nombre:'', objetivo: OBJETIVOS_CAMPANA[0], presupuesto:'' })
  const [creandoCampana, setCreandoCampana] = useState(false)
  const [campanaCreada, setCampanaCreada] = useState(false)
  const [activandoId, setActivandoId] = useState<string | null>(null)

  // ── Integraciones ──
  const [estadoIntegraciones, setEstadoIntegraciones] = useState<Record<string, boolean> | null>(null)
  const [ultimoMensajeWa, setUltimoMensajeWa] = useState<string | null>(null)

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
      if (profile?.rol !== 'superadmin') { setAutorizado(false); return }
      setAutorizado(true)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const cargarLeads = useCallback(async () => {
    const { data } = await supabase.from('crm_leads').select('*').order('ultimo_mensaje_at', { ascending: false, nullsFirst: false })
    setLeads((data as Lead[]) || [])
  }, [supabase])

  const cargarConfig = useCallback(async () => {
    const { data } = await supabase.from('crm_config_agente').select('prompt_sistema, catalogo').eq('id', 1).single()
    if (data) setConfig(data as ConfigAgente)
  }, [supabase])

  const cargarFinanzas = useCallback(async () => {
    const [{ data: tp }, { data: pg }, { data: todos }] = await Promise.all([
      supabase.from('tenants').select('id,nombre,plan,licencia,licencia_vence').neq('plan', 'explorador').order('created_at', { ascending: false }),
      supabase.from('pagos_log').select('*').order('created_at', { ascending: false }).limit(20),
      supabase.from('tenants').select('id,nombre'),
    ])
    setTenantsPago((tp as TenantPago[]) || [])
    setPagos((pg as PagoLog[]) || [])
    const mapa: Record<string,string> = {}
    ;(todos || []).forEach((t: { id:string; nombre:string }) => { mapa[t.id] = t.nombre })
    setNombresTenant(mapa)
  }, [supabase])

  const cargarPublicaciones = useCallback(async () => {
    const { data } = await supabase.from('crm_publicaciones').select('*').order('created_at', { ascending: false })
    setPublicaciones((data as Publicacion[]) || [])
  }, [supabase])

  const cargarCampanas = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/crm/facebook/campanas', { headers: { Authorization: `Bearer ${session?.access_token}` } })
    if (res.ok) { const d = await res.json(); setCampanas(d.campanas || []) }
  }, [supabase])

  const cargarIntegraciones = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/crm/estado-integraciones', { headers: { Authorization: `Bearer ${session?.access_token}` } })
    if (res.ok) setEstadoIntegraciones(await res.json())
    const { data: ultimoMsg } = await supabase.from('crm_mensajes').select('created_at').eq('direccion', 'entrante').order('created_at', { ascending: false }).limit(1).maybeSingle()
    setUltimoMensajeWa(ultimoMsg?.created_at || null)
  }, [supabase])

  useEffect(() => {
    if (!autorizado) return
    if (tab === 'kanban') cargarLeads()
    if (tab === 'catalogo' && !config) cargarConfig()
    if (tab === 'finanzas') cargarFinanzas()
    if (tab === 'publicaciones') cargarPublicaciones()
    if (tab === 'campanas') cargarCampanas()
    if (tab === 'integraciones') cargarIntegraciones()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autorizado, tab])

  // ── Acciones Kanban ──
  async function onDrop(etapa: string) {
    if (!dragId) return
    await supabase.from('crm_leads').update({ etapa }).eq('id', dragId)
    setDragId(null)
    cargarLeads()
  }
  async function toggleIA(lead: Lead) {
    await supabase.from('crm_leads').update({ ia_modo_activo: !lead.ia_modo_activo }).eq('id', lead.id)
    cargarLeads()
    if (leadActivo?.id === lead.id) setLeadActivo({ ...lead, ia_modo_activo: !lead.ia_modo_activo })
  }
  async function abrirLead(lead: Lead) {
    setLeadActivo(lead)
    const { data } = await supabase.from('crm_mensajes').select('*').eq('lead_id', lead.id).order('created_at', { ascending: true })
    setMensajes((data as Mensaje[]) || [])
  }
  async function enviarManual() {
    if (!leadActivo || !textoManual.trim()) return
    setEnviando(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/crm/enviar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ leadId: leadActivo.id, texto: textoManual }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error enviando mensaje')
      setTextoManual('')
      await abrirLead(leadActivo)
      cargarLeads()
    } catch (e: any) {
      alert(e.message || 'Error enviando mensaje')
    } finally { setEnviando(false) }
  }

  // ── Acciones Catálogo ──
  function actualizarItem(lista: 'planes_app'|'servicios_consultoria', idx: number, campo: keyof CatalogoItem, valor: string) {
    if (!config) return
    const items = [...config.catalogo[lista]]
    items[idx] = { ...items[idx], [campo]: valor }
    setConfig({ ...config, catalogo: { ...config.catalogo, [lista]: items } })
  }
  function agregarItem(lista: 'planes_app'|'servicios_consultoria') {
    if (!config) return
    setConfig({ ...config, catalogo: { ...config.catalogo, [lista]: [...config.catalogo[lista], { nombre:'', precio:'', detalle:'' }] } })
  }
  function quitarItem(lista: 'planes_app'|'servicios_consultoria', idx: number) {
    if (!config) return
    setConfig({ ...config, catalogo: { ...config.catalogo, [lista]: config.catalogo[lista].filter((_, i) => i !== idx) } })
  }
  async function guardarConfig() {
    if (!config) return
    setGuardandoConfig(true)
    await supabase.from('crm_config_agente').update({ prompt_sistema: config.prompt_sistema, catalogo: config.catalogo, updated_at: new Date().toISOString() }).eq('id', 1)
    setGuardandoConfig(false)
    setConfigGuardado(true)
    setTimeout(() => setConfigGuardado(false), 2000)
  }

  // ── Acciones Publicaciones ──
  async function publicar() {
    if (!textoPost.trim()) return
    setPublicando(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/crm/facebook/publicar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ texto: textoPost, imagenUrl: imagenPost || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error publicando')
      setTextoPost(''); setImagenPost('')
      cargarPublicaciones()
      setPublicado(true)
      setTimeout(() => setPublicado(false), 3000)
    } catch (e: any) {
      alert(e.message || 'Error publicando')
    } finally { setPublicando(false) }
  }

  // ── Acciones Campañas ──
  async function crearCampana() {
    const presupuesto = Number(formCampana.presupuesto)
    if (!formCampana.nombre.trim() || !presupuesto) { alert('Completa nombre y presupuesto diario'); return }
    setCreandoCampana(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/crm/facebook/campana/crear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ nombre: formCampana.nombre, objetivo: formCampana.objetivo, presupuestoDiarioCop: presupuesto }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error creando la campaña')
      setFormCampana({ nombre:'', objetivo: OBJETIVOS_CAMPANA[0], presupuesto:'' })
      cargarCampanas()
      setCampanaCreada(true)
      setTimeout(() => setCampanaCreada(false), 3000)
    } catch (e: any) {
      alert(e.message || 'Error creando la campaña')
    } finally { setCreandoCampana(false) }
  }

  async function activarCampanaAccion(c: Campana) {
    const monto = formatMoneda(c.presupuesto_diario_cop, 'COL')
    if (!confirm(`Vas a activar "${c.nombre}" con presupuesto diario de ${monto}. Esto empieza a gastar de la tarjeta registrada en la cuenta publicitaria. ¿Confirmas?`)) return
    setActivandoId(c.id)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/crm/facebook/campana/activar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ id: c.id, presupuestoConfirmado: c.presupuesto_diario_cop }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error activando la campaña')
      cargarCampanas()
    } catch (e: any) {
      alert(e.message || 'Error activando la campaña')
    } finally { setActivandoId(null) }
  }

  if (autorizado === null) return <div style={{ padding:'40px', color:T.muted, fontSize:'13px' }}>Verificando acceso…</div>
  if (autorizado === false) return <div style={{ padding:'40px', color:T.red, fontSize:'13px' }}>No autorizado — esta sección es solo para superadmin.</div>

  const mrrCop = tenantsPago.filter(t => t.licencia === 'activa').reduce((s, t) => s + (PRECIOS_PLAN[t.plan] || 0), 0)
  const mrrUsd = Math.round(copAUsdConTasas(mrrCop, tasas))
  const porPlan = tenantsPago.reduce((acc: Record<string, number>, t) => { acc[t.plan] = (acc[t.plan] || 0) + 1; return acc }, {})

  return (
    <div style={{ padding:'20px', fontFamily:'"DM Sans", system-ui, sans-serif' }}>
      <div style={{ marginBottom:'14px' }}>
        <div style={{ fontSize:'18px', fontWeight:800, color:T.text }}>🏢 Centro DIZGO</div>
        <div style={{ fontSize:'12px', color:T.muted, marginTop:'4px' }}>
          Todo lo del negocio DIZGO en un solo lugar — ventas, catálogo, finanzas reales, enlaces e integraciones. No es el módulo de tus tenants.
        </div>
      </div>

      <div style={{ display:'flex', gap:'6px', marginBottom:'18px', borderBottom:`1px solid ${T.border}`, flexWrap:'wrap' }}>
        {TABS.map(t => (
          <button key={t.v} onClick={() => setTab(t.v)}
            style={{ padding:'9px 14px', background:'none', border:'none', borderBottom: tab === t.v ? `2px solid ${T.accent}` : '2px solid transparent', color: tab === t.v ? T.accent : T.muted, fontWeight: tab === t.v ? 700 : 500, fontSize:'12.5px', cursor:'pointer' }}>
            {t.l}
          </button>
        ))}
      </div>

      {tab === 'kanban' && (
        <>
          <div style={{ background:`${T.blue}10`, border:`1px solid ${T.blue}20`, borderRadius:'8px', padding:'10px 14px', marginBottom:'16px', fontSize:'11px', color:T.muted }}>
            Arrastra una tarjeta entre columnas para mover la etapa. Clic en una tarjeta para ver la conversación completa.
          </div>
          <div style={{ display:'flex', gap:'14px', overflowX:'auto', paddingBottom:'10px' }}>
            {ETAPAS.map(({ v: etapa, l: label, c: color }) => {
              const items = leads.filter(x => x.etapa === etapa)
              return (
                <div key={etapa}
                  onDragOver={e => e.preventDefault()}
                  onDrop={() => onDrop(etapa)}
                  style={{ background:T.card2, border:`1px solid ${T.border}`, borderTop:`3px solid ${color}`, borderRadius:'10px', padding:'12px', minWidth:'240px', width:'240px', flexShrink:0, minHeight:'200px' }}
                >
                  <div style={{ fontSize:'12px', fontWeight:700, color, marginBottom:'10px' }}>
                    {label.toUpperCase()} <span style={{ color:T.muted, fontWeight:400 }}>({items.length})</span>
                  </div>
                  {items.map(lead => (
                    <div key={lead.id}
                      draggable
                      onDragStart={() => setDragId(lead.id)}
                      onClick={() => abrirLead(lead)}
                      style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:'8px', padding:'10px 12px', marginBottom:'8px', cursor:'grab' }}
                    >
                      <div style={{ fontSize:'12px', fontWeight:600, color:T.text, marginBottom:'3px' }}>{lead.nombre || lead.whatsapp}</div>
                      <div style={{ fontSize:'10px', color:T.muted, marginBottom:'4px' }}>{lead.whatsapp}</div>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                        <span style={{ fontSize:'10px', color:T.blue }}>{INTERES_LABEL[lead.interes] || lead.interes}</span>
                        {lead.origen_meta && <span title="Vino de un anuncio de Meta" style={{ fontSize:'10px' }}>📢</span>}
                      </div>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:'6px' }}>
                        <span style={{ fontSize:'9px', padding:'2px 6px', borderRadius:'4px', background: lead.ia_modo_activo ? `${T.purple}20` : `${T.accent}20`, color: lead.ia_modo_activo ? T.purple : T.accent }}>
                          {lead.ia_modo_activo ? '🤖 IA' : '👤 Humano'}
                        </span>
                        <span style={{ fontSize:'9px', color:T.muted }}>{tiempoDesde(lead.ultimo_mensaje_at)}</span>
                      </div>
                    </div>
                  ))}
                  {items.length === 0 && <div style={{ fontSize:'11px', color:T.muted, textAlign:'center', padding:'10px 0' }}>Vacío</div>}
                </div>
              )
            })}
          </div>

          {leadActivo && (
            <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:'20px', backdropFilter:'blur(4px)' }} onClick={() => setLeadActivo(null)}>
              <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:'14px', width:'min(480px,100%)', maxHeight:'85vh', display:'flex', flexDirection:'column' }} onClick={e => e.stopPropagation()}>
                <div style={{ padding:'16px 20px', borderBottom:`1px solid ${T.border}`, display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                  <div>
                    <div style={{ fontSize:'14px', fontWeight:700, color:T.text }}>{leadActivo.nombre || leadActivo.whatsapp}</div>
                    <div style={{ fontSize:'11px', color:T.muted }}>{leadActivo.whatsapp} · {INTERES_LABEL[leadActivo.interes] || leadActivo.interes}</div>
                  </div>
                  <button onClick={() => toggleIA(leadActivo)}
                    style={{ fontSize:'10px', fontWeight:700, padding:'5px 10px', borderRadius:'20px', cursor:'pointer', border:'none', background: leadActivo.ia_modo_activo ? `${T.purple}20` : `${T.accent}20`, color: leadActivo.ia_modo_activo ? T.purple : T.accent }}>
                    {leadActivo.ia_modo_activo ? '🤖 Modo IA — clic para pausar' : '👤 Modo Humano — clic para reactivar IA'}
                  </button>
                </div>
                <div style={{ flex:1, overflowY:'auto', padding:'16px 20px', display:'flex', flexDirection:'column', gap:'8px' }}>
                  {mensajes.length === 0 && <div style={{ fontSize:'12px', color:T.muted, textAlign:'center' }}>Sin mensajes todavía</div>}
                  {mensajes.map(m => (
                    <div key={m.id} style={{ alignSelf: m.direccion === 'saliente' ? 'flex-end' : 'flex-start', maxWidth:'80%' }}>
                      <div style={{
                        background: m.direccion === 'saliente' ? (m.generado_por === 'ia' ? `${T.purple}20` : `${WA}20`) : T.card2,
                        border:`1px solid ${T.border}`, borderRadius:'10px', padding:'8px 12px', fontSize:'12px', color:T.text,
                      }}>{m.texto}</div>
                      <div style={{ fontSize:'9px', color:T.muted, marginTop:'2px', textAlign: m.direccion === 'saliente' ? 'right' : 'left' }}>
                        {m.direccion === 'saliente' ? (m.generado_por === 'ia' ? '🤖 IA' : '👤 Joan') : 'Cliente'} · {new Date(m.created_at).toLocaleString('es-CO')}
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ padding:'14px 20px', borderTop:`1px solid ${T.border}`, display:'flex', gap:'8px' }}>
                  <input style={inp} placeholder="Escribe un mensaje…" value={textoManual}
                    onChange={e => setTextoManual(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !enviando) enviarManual() }} />
                  <button onClick={enviarManual} disabled={enviando || !textoManual.trim()}
                    style={{ padding:'0 16px', background:WA, border:'none', borderRadius:'8px', color:'#04140A', fontWeight:700, cursor: enviando ? 'wait' : 'pointer', fontSize:'12px', opacity: enviando ? 0.7 : 1 }}>
                    {enviando ? '…' : 'Enviar'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'catalogo' && (
        !config ? <div style={{ color:T.muted, fontSize:'12px' }}>Cargando…</div> : (
          <div style={{ maxWidth:'760px' }}>
            <div style={{ marginBottom:'16px' }}>
              <label style={lbl}>Prompt del agente de ventas (personalidad, tono, reglas)</label>
              <textarea style={{ ...inp, minHeight:'120px', resize:'vertical' }} value={config.prompt_sistema}
                onChange={e => setConfig({ ...config, prompt_sistema: e.target.value })} />
            </div>

            {(['planes_app', 'servicios_consultoria'] as const).map(lista => (
              <div key={lista} style={{ marginBottom:'20px' }}>
                <div style={{ fontSize:'12px', fontWeight:700, color:T.accent, textTransform:'uppercase', letterSpacing:'.4px', marginBottom:'10px' }}>
                  {lista === 'planes_app' ? 'Planes de la app' : 'Servicios de consultoría'}
                </div>
                {config.catalogo[lista].map((item, idx) => (
                  <div key={idx} style={{ display:'grid', gridTemplateColumns:'1fr 1fr 2fr auto', gap:'8px', marginBottom:'8px', alignItems:'end' }}>
                    <div><label style={lbl}>Nombre</label><input style={inp} value={item.nombre} onChange={e => actualizarItem(lista, idx, 'nombre', e.target.value)} /></div>
                    <div><label style={lbl}>Precio</label><input style={inp} value={item.precio} onChange={e => actualizarItem(lista, idx, 'precio', e.target.value)} /></div>
                    <div><label style={lbl}>Detalle</label><input style={inp} value={item.detalle} onChange={e => actualizarItem(lista, idx, 'detalle', e.target.value)} /></div>
                    <button onClick={() => quitarItem(lista, idx)} style={{ background:T.card2, border:`1.5px solid ${T.red}40`, borderRadius:'8px', color:T.red, width:'34px', height:'34px', cursor:'pointer' }}>✕</button>
                  </div>
                ))}
                <button onClick={() => agregarItem(lista)} style={{ width:'100%', background:'transparent', border:`1.5px dashed ${T.border}`, borderRadius:'8px', padding:'8px', fontSize:'11px', color:T.blue, cursor:'pointer' }}>+ Agregar</button>
              </div>
            ))}

            <button onClick={guardarConfig} disabled={guardandoConfig}
              style={{ padding:'11px 20px', background: configGuardado ? T.green : T.accent, border:'none', borderRadius:'9px', color:T.card, fontWeight:700, fontSize:'13px', cursor: guardandoConfig ? 'wait' : 'pointer' }}>
              {configGuardado ? '✓ Guardado' : guardandoConfig ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        )
      )}

      {tab === 'finanzas' && (
        <div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:'12px', marginBottom:'20px' }}>
            <div style={{ background:`${T.accent}12`, border:`1px solid ${T.accent}40`, borderRadius:'10px', padding:'14px' }}>
              <div style={{ fontSize:'10px', color:T.accent, marginBottom:'4px' }}>MRR (ingreso mensual recurrente)</div>
              <div style={{ fontSize:'19px', fontWeight:800, color:T.accent }}>{formatMoneda(mrrCop, 'COL')}</div>
              <div style={{ fontSize:'11px', color:T.muted, marginTop:'2px' }}>~${mrrUsd} USD</div>
            </div>
            <div style={{ background:T.card2, border:`1px solid ${T.border}`, borderRadius:'10px', padding:'14px' }}>
              <div style={{ fontSize:'10px', color:T.muted, marginBottom:'4px' }}>Tenants de pago</div>
              <div style={{ fontSize:'19px', fontWeight:800, color:T.text }}>{tenantsPago.length}</div>
              <div style={{ fontSize:'11px', color:T.muted, marginTop:'2px' }}>
                {Object.entries(porPlan).map(([p,n]) => `${n} ${p}`).join(' · ') || 'ninguno todavía'}
              </div>
            </div>
          </div>

          <div style={{ fontSize:'12px', fontWeight:700, color:T.text, marginBottom:'8px' }}>Tenants de pago</div>
          <div style={{ background:T.card2, border:`1px solid ${T.border}`, borderRadius:'10px', overflow:'hidden', marginBottom:'20px' }}>
            {tenantsPago.length === 0 && <div style={{ padding:'16px', fontSize:'12px', color:T.muted, textAlign:'center' }}>Sin tenants de pago todavía</div>}
            {tenantsPago.map(t => (
              <div key={t.id} style={{ display:'flex', justifyContent:'space-between', padding:'10px 14px', borderBottom:`1px solid ${T.border}`, fontSize:'12px' }}>
                <span style={{ color:T.text, fontWeight:600 }}>{t.nombre}</span>
                <span style={{ color:T.muted }}>{t.plan} · {t.licencia} · vence {t.licencia_vence || '—'}</span>
              </div>
            ))}
          </div>

          <div style={{ fontSize:'12px', fontWeight:700, color:T.text, marginBottom:'8px' }}>Últimos eventos de pago</div>
          <div style={{ background:T.card2, border:`1px solid ${T.border}`, borderRadius:'10px', overflow:'hidden' }}>
            {pagos.length === 0 && <div style={{ padding:'16px', fontSize:'12px', color:T.muted, textAlign:'center' }}>Sin eventos todavía</div>}
            {pagos.map(p => (
              <div key={p.id} style={{ display:'flex', justifyContent:'space-between', padding:'10px 14px', borderBottom:`1px solid ${T.border}`, fontSize:'12px' }}>
                <span style={{ color:T.text }}>{p.proveedor} · {p.evento}</span>
                <span style={{ color:T.muted }}>{p.tenant_id ? (nombresTenant[p.tenant_id] || p.tenant_id) : '—'} · {new Date(p.created_at).toLocaleString('es-CO')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'publicaciones' && (
        <div style={{ maxWidth:'640px' }}>
          <div style={{ marginBottom:'20px' }}>
            <label style={lbl}>Texto de la publicación</label>
            <textarea style={{ ...inp, minHeight:'90px', resize:'vertical' }} value={textoPost} onChange={e => setTextoPost(e.target.value)} placeholder="¿Qué quieres contarle a tu audiencia?" />
            <div style={{ marginTop:'8px' }}>
              <label style={lbl}>URL de imagen (opcional)</label>
              <input style={inp} value={imagenPost} onChange={e => setImagenPost(e.target.value)} placeholder="https://..." />
            </div>
            <button onClick={publicar} disabled={publicando || !textoPost.trim()}
              style={{ marginTop:'10px', padding:'10px 18px', background: publicado ? T.green : T.accent, border:'none', borderRadius:'9px', color:T.card, fontWeight:700, fontSize:'13px', cursor: publicando ? 'wait' : 'pointer', opacity: publicando ? 0.7 : 1 }}>
              {publicado ? '✓ Publicado en la Página' : publicando ? 'Publicando…' : '📤 Publicar en la Página'}
            </button>
          </div>

          <div style={{ fontSize:'12px', fontWeight:700, color:T.text, marginBottom:'8px' }}>Publicaciones</div>
          <div style={{ background:T.card2, border:`1px solid ${T.border}`, borderRadius:'10px', overflow:'hidden' }}>
            {publicaciones.length === 0 && <div style={{ padding:'16px', fontSize:'12px', color:T.muted, textAlign:'center' }}>Sin publicaciones todavía</div>}
            {publicaciones.map(p => (
              <div key={p.id} style={{ padding:'10px 14px', borderBottom:`1px solid ${T.border}`, fontSize:'12px' }}>
                <div style={{ color:T.text, marginBottom:'3px' }}>{p.texto}</div>
                <div style={{ display:'flex', justifyContent:'space-between', color:T.muted, fontSize:'10.5px' }}>
                  <span>{p.estado === 'publicado' ? '🟢 Publicado' : '🔴 Falló'} · {new Date(p.created_at).toLocaleString('es-CO')}</span>
                  {p.fb_post_id && <a href={`https://facebook.com/${p.fb_post_id}`} target="_blank" rel="noopener noreferrer" style={{ color:T.blue }}>Ver post →</a>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'campanas' && (
        <div>
          <div style={{ background:`${T.red}10`, border:`1px solid ${T.red}30`, borderRadius:'8px', padding:'10px 14px', marginBottom:'16px', fontSize:'11px', color:T.red }}>
            Crear una campaña aquí SIEMPRE queda en pausa — no gasta nada. Solo el botón "Activar" en una campaña ya creada empieza a gastar de la tarjeta real.
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'2fr 1.2fr 1fr auto', gap:'8px', marginBottom:'20px', alignItems:'end', maxWidth:'760px' }}>
            <div><label style={lbl}>Nombre de la campaña</label><input style={inp} value={formCampana.nombre} onChange={e => setFormCampana(f => ({ ...f, nombre: e.target.value }))} placeholder="Ej: DIZGO - Lanzamiento App" /></div>
            <div>
              <label style={lbl}>Objetivo</label>
              <select style={{ ...inp, appearance:'none' as React.CSSProperties['appearance'] }} value={formCampana.objetivo} onChange={e => setFormCampana(f => ({ ...f, objetivo: e.target.value }))}>
                {OBJETIVOS_CAMPANA.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div><label style={lbl}>Presupuesto diario (COP)</label><input style={inp} inputMode="numeric" value={formCampana.presupuesto} onChange={e => setFormCampana(f => ({ ...f, presupuesto: e.target.value.replace(/\D/g,'') }))} placeholder="50000" /></div>
            <button onClick={crearCampana} disabled={creandoCampana}
              style={{ padding:'9px 16px', background: campanaCreada ? T.green : T.blue, border:'none', borderRadius:'8px', color:'#fff', fontWeight:700, fontSize:'12px', cursor: creandoCampana ? 'wait' : 'pointer', height:'34px' }}>
              {campanaCreada ? '✓ Creada' : creandoCampana ? '…' : 'Crear (pausada)'}
            </button>
          </div>
          {campanaCreada && <div style={{ fontSize:'12px', color:T.green, marginTop:'-14px', marginBottom:'14px' }}>Campaña creada y guardada en pausa — revisa la lista abajo.</div>}

          <div style={{ fontSize:'12px', fontWeight:700, color:T.text, marginBottom:'8px' }}>Campañas</div>
          <div style={{ background:T.card2, border:`1px solid ${T.border}`, borderRadius:'10px', overflow:'hidden' }}>
            {campanas.length === 0 && <div style={{ padding:'16px', fontSize:'12px', color:T.muted, textAlign:'center' }}>Sin campañas todavía</div>}
            {campanas.map(c => (
              <div key={c.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 14px', borderBottom:`1px solid ${T.border}`, fontSize:'12px' }}>
                <div>
                  <div style={{ color:T.text, fontWeight:600 }}>{c.nombre}</div>
                  <div style={{ color:T.muted, fontSize:'10.5px' }}>
                    {c.objetivo} · {formatMoneda(c.presupuesto_diario_cop, 'COL')}/día
                    {c.rendimiento && ` · gasto: ${c.rendimiento.spend} · ${c.rendimiento.impressions} impr. · ${c.rendimiento.clicks} clics`}
                  </div>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                  <span style={{ fontSize:'9px', padding:'2px 8px', borderRadius:'4px', fontWeight:700, background: c.estado === 'activa' ? `${T.green}20` : `${T.muted}20`, color: c.estado === 'activa' ? T.green : T.muted }}>
                    {c.estado === 'activa' ? '🟢 ACTIVA' : c.estado === 'pausada' ? '⏸ PAUSADA' : '📝 BORRADOR'}
                  </span>
                  {c.estado === 'pausada' && (
                    <button onClick={() => activarCampanaAccion(c)} disabled={activandoId === c.id}
                      style={{ padding:'5px 12px', background:T.red, border:'none', borderRadius:'6px', color:'#fff', fontWeight:700, fontSize:'10.5px', cursor: activandoId === c.id ? 'wait' : 'pointer' }}>
                      {activandoId === c.id ? '…' : '▶ Activar (gasta real)'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'enlaces' && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:'12px' }}>
          {ENLACES.map(e => (
            <a key={e.url} href={e.url} target="_blank" rel="noopener noreferrer"
              style={{ background:T.card2, border:`1px solid ${T.border}`, borderRadius:'10px', padding:'14px', display:'flex', alignItems:'center', gap:'10px', textDecoration:'none' }}>
              <span style={{ fontSize:'20px' }}>{e.emoji}</span>
              <span style={{ fontSize:'12.5px', fontWeight:600, color:T.text }}>{e.label}</span>
            </a>
          ))}
        </div>
      )}

      {tab === 'integraciones' && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:'12px' }}>
          {!estadoIntegraciones ? <div style={{ color:T.muted, fontSize:'12px' }}>Cargando…</div> : (
            <>
              <div style={{ background:T.card2, border:`1px solid ${T.border}`, borderRadius:'10px', padding:'14px' }}>
                <div style={{ fontSize:'12px', fontWeight:700, color:T.text, marginBottom:'6px' }}>💬 WhatsApp / Meta</div>
                <div style={{ fontSize:'11px', color: estadoIntegraciones.whatsapp ? T.green : T.red, fontWeight:700 }}>
                  {estadoIntegraciones.whatsapp ? '🟢 Conectado' : '🔴 No configurado'}
                </div>
                <div style={{ fontSize:'10.5px', color:T.muted, marginTop:'4px' }}>Último mensaje recibido: {tiempoDesde(ultimoMensajeWa)}</div>
              </div>
              <div style={{ background:T.card2, border:`1px solid ${T.border}`, borderRadius:'10px', padding:'14px' }}>
                <div style={{ fontSize:'12px', fontWeight:700, color:T.text, marginBottom:'6px' }}>💳 Stripe</div>
                <div style={{ fontSize:'11px', color: estadoIntegraciones.stripe ? T.green : T.red, fontWeight:700 }}>
                  {estadoIntegraciones.stripe ? '🟢 Conectado' : '🔴 No configurado'}
                </div>
              </div>
              <div style={{ background:T.card2, border:`1px solid ${T.border}`, borderRadius:'10px', padding:'14px' }}>
                <div style={{ fontSize:'12px', fontWeight:700, color:T.text, marginBottom:'6px' }}>💳 Wompi</div>
                <div style={{ fontSize:'11px', color: estadoIntegraciones.wompi ? T.green : T.red, fontWeight:700 }}>
                  {estadoIntegraciones.wompi ? '🟢 Conectado' : '🔴 No configurado'}
                </div>
              </div>
              <div style={{ background:T.card2, border:`1px solid ${T.border}`, borderRadius:'10px', padding:'14px' }}>
                <div style={{ fontSize:'12px', fontWeight:700, color:T.text, marginBottom:'6px' }}>🤖 Claude (agente IA)</div>
                <div style={{ fontSize:'11px', color: estadoIntegraciones.claude ? T.green : T.red, fontWeight:700 }}>
                  {estadoIntegraciones.claude ? '🟢 Conectado' : '🔴 No configurado'}
                </div>
              </div>
              <div style={{ background:T.card2, border:`1px solid ${T.border}`, borderRadius:'10px', padding:'14px' }}>
                <div style={{ fontSize:'12px', fontWeight:700, color:T.text, marginBottom:'6px' }}>✉️ Resend (correos)</div>
                <div style={{ fontSize:'11px', color: estadoIntegraciones.resend ? T.green : T.red, fontWeight:700 }}>
                  {estadoIntegraciones.resend ? '🟢 Conectado' : '🔴 No configurado'}
                </div>
              </div>
              <div style={{ background:T.card2, border:`1px solid ${T.border}`, borderRadius:'10px', padding:'14px' }}>
                <div style={{ fontSize:'12px', fontWeight:700, color:T.text, marginBottom:'6px' }}>📘 Página de Facebook</div>
                <div style={{ fontSize:'11px', color: estadoIntegraciones.facebookPagina ? T.green : T.red, fontWeight:700 }}>
                  {estadoIntegraciones.facebookPagina ? '🟢 Conectado' : '🔴 No configurado'}
                </div>
              </div>
              <div style={{ background:T.card2, border:`1px solid ${T.border}`, borderRadius:'10px', padding:'14px' }}>
                <div style={{ fontSize:'12px', fontWeight:700, color:T.text, marginBottom:'6px' }}>📣 Meta Ads</div>
                <div style={{ fontSize:'11px', color: estadoIntegraciones.metaAds ? T.green : T.red, fontWeight:700 }}>
                  {estadoIntegraciones.metaAds ? '🟢 Conectado' : '🔴 No configurado'}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
