'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const T = { bg:'#0D1E35', card:'#081426', card2:'#0A1628', accent:'#F58720', blue:'#3D8EF0', green:'#2DD4A0', red:'#F05C5C', yellow:'#F5A623', purple:'#9B6BFF', text:'#E8EDF5', muted:'#5A7A9A', border:'#152238', wa:'#25D366' }

const ETAPAS: { v: string; l: string; c: string }[] = [
  { v:'nuevo',       l:'Nuevo',        c:T.blue },
  { v:'conversando', l:'Conversando',  c:T.purple },
  { v:'calificado',  l:'Calificado',   c:T.accent },
  { v:'propuesta',   l:'Propuesta',    c:T.yellow },
  { v:'negociacion', l:'Negociación',  c:T.yellow },
  { v:'ganado',      l:'Ganado',       c:T.green },
  { v:'perdido',     l:'Perdido',      c:T.red },
]

const INTERES_LABEL: Record<string, string> = { app:'📱 App', mentoria:'🎓 Mentoría', consultoria:'💼 Consultoría', otro:'❓ Otro' }

type Lead = {
  id: string; nombre: string | null; whatsapp: string; email: string | null; pais: string | null
  interes: string; etapa: string; ia_modo_activo: boolean
  origen_meta: Record<string, unknown> | null; notas: string | null
  created_at: string; ultimo_mensaje_at: string | null
}
type Mensaje = { id: string; direccion: string; texto: string; generado_por: string; created_at: string }

const inp: React.CSSProperties = { width:'100%', background:T.card2, border:`1.5px solid ${T.border}`, borderRadius:'8px', padding:'8px 10px', fontSize:'12px', color:T.text, outline:'none', boxSizing:'border-box' }

function tiempoDesde(iso: string | null): string {
  if (!iso) return 'sin mensajes'
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (min < 60) return `hace ${min}m`
  if (min < 1440) return `hace ${Math.round(min/60)}h`
  return `hace ${Math.round(min/1440)}d`
}

export default function CrmVentasPage() {
  const router = useRouter()
  const supabase = createClient()
  const [autorizado, setAutorizado] = useState<boolean | null>(null)
  const [leads, setLeads] = useState<Lead[]>([])
  const [dragId, setDragId] = useState<string | null>(null)
  const [leadActivo, setLeadActivo] = useState<Lead | null>(null)
  const [mensajes, setMensajes] = useState<Mensaje[]>([])
  const [textoManual, setTextoManual] = useState('')
  const [enviando, setEnviando] = useState(false)

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

  useEffect(() => { if (autorizado) cargarLeads() }, [autorizado, cargarLeads])

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

  if (autorizado === null) return <div style={{ padding:'40px', color:T.muted, fontSize:'13px' }}>Verificando acceso…</div>
  if (autorizado === false) return <div style={{ padding:'40px', color:T.red, fontSize:'13px' }}>No autorizado — esta sección es solo para superadmin.</div>

  return (
    <div style={{ padding:'20px', fontFamily:'"DM Sans", system-ui, sans-serif' }}>
      <div style={{ marginBottom:'18px' }}>
        <div style={{ fontSize:'18px', fontWeight:800, color:T.text }}>📈 CRM Ventas DIZGO</div>
        <div style={{ fontSize:'12px', color:T.muted, marginTop:'4px' }}>
          Leads de WhatsApp interesados en la app, mentorías o consultoría — no es el módulo de tus tenants, esto es el embudo de ventas propio de DIZGO.
        </div>
      </div>

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
                    background: m.direccion === 'saliente' ? (m.generado_por === 'ia' ? `${T.purple}20` : `${T.wa}20`) : T.card2,
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
                style={{ padding:'0 16px', background:T.wa, border:'none', borderRadius:'8px', color:'#04140A', fontWeight:700, cursor: enviando ? 'wait' : 'pointer', fontSize:'12px', opacity: enviando ? 0.7 : 1 }}>
                {enviando ? '…' : 'Enviar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
