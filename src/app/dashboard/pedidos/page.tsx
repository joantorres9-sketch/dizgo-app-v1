'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const T = {
  bg:'#0D1E35', card:'#081426', card2:'#0A1628',
  accent:'#F58720', blue:'#3D8EF0', green:'#2DD4A0',
  red:'#F05C5C', yellow:'#F5A623', purple:'#9B6BFF',
  text:'#E8EDF5', muted:'#5A7A9A', border:'#152238'
}

function getPais() {
  if (typeof window === 'undefined') return 'COL'
  return localStorage.getItem('dizgo_pais') || 'COL'
}

function fmt(v: number) {
  const cfgs: Record<string,{locale:string;currency:string;dec:number}> = {
    COL:{locale:'es-CO',currency:'COP',dec:0},ECU:{locale:'en-US',currency:'USD',dec:2},
    MEX:{locale:'es-MX',currency:'MXN',dec:2},PER:{locale:'es-PE',currency:'PEN',dec:2},
    CHL:{locale:'es-CL',currency:'CLP',dec:0},ARG:{locale:'es-AR',currency:'ARS',dec:2},
  }
  const c = cfgs[getPais()] || cfgs.COL
  return new Intl.NumberFormat(c.locale,{style:'currency',currency:c.currency,minimumFractionDigits:c.dec,maximumFractionDigits:c.dec}).format(v)
}

function timeAgo(date: string) {
  const diff = (Date.now() - new Date(date).getTime()) / 1000 / 60
  if (diff < 60) return `${Math.floor(diff)}m`
  if (diff < 1440) return `${Math.floor(diff/60)}h`
  return `${Math.floor(diff/1440)}d`
}

// ── HORAS LABORALES SIN GESTIÓN (SLA real) ────────────────────
// Cuenta horas desde fecha_pedido, asumiendo jornada 8am-8pm
function horasLaboralesSinGestion(fechaPedido: string): number {
  const inicio = new Date(fechaPedido)
  const ahora = new Date()
  let horas = 0
  const cursor = new Date(inicio)
  while (cursor < ahora) {
    const h = cursor.getHours()
    if (h >= 8 && h < 20) horas += 1
    cursor.setHours(cursor.getHours() + 1)
  }
  return Math.round(horas)
}
function calcularSlaNivel(horas: number): string {
  if (horas <= 2) return 'verde'
  if (horas <= 4) return 'amarillo'
  return 'rojo'
}

// ── SCORE DE RIESGO (heurística sobre datos propios) ──────────
// No usa big data externo — calcula con historial propio del tenant
function calcularRiesgo(opts: {
  esZonaRoja: boolean; tasaDevZona: number; horaCreacion: number
  pedidosPrevios: number; devolucionesPrevias: number
}): string {
  let puntos = 0
  if (opts.esZonaRoja) puntos += 3
  if (opts.tasaDevZona > 25) puntos += 2
  else if (opts.tasaDevZona > 15) puntos += 1
  if (opts.horaCreacion >= 22 || opts.horaCreacion < 6) puntos += 1
  if (opts.pedidosPrevios > 0) {
    const tasaDevCliente = opts.devolucionesPrevias / opts.pedidosPrevios
    if (tasaDevCliente >= 0.5) puntos += 4
    else if (tasaDevCliente >= 0.25) puntos += 2
  }
  if (puntos >= 5) return 'critical'
  if (puntos >= 3) return 'high'
  if (puntos >= 1) return 'medium'
  return 'low'
}

// ── CLASIFICACIÓN DE CLIENTE (agrupando pedidos por teléfono) ──
function clasificarCliente(totalPedidos: number): string {
  if (totalPedidos >= 7) return 'vip'
  if (totalPedidos >= 4) return 'frecuente'
  if (totalPedidos >= 2) return 'recurrente'
  return 'nuevo'
}
const CLIENTE_TIPO_INFO: Record<string,{l:string;c:string;icon:string}> = {
  nuevo:      { l:'Nuevo',      c:'#3D8EF0', icon:'🆕' },
  recurrente: { l:'Recurrente', c:'#9B6BFF', icon:'🔁' },
  frecuente:  { l:'Frecuente',  c:'#F5A623', icon:'⭐' },
  vip:        { l:'VIP',        c:'#2DD4A0', icon:'👑' },
}

type Pedido = {
  id: string; tenant_id: string; numero_pedido: string; cliente_nombre: string
  cliente_telefono: string; cliente_ciudad: string; cliente_departamento: string
  producto_nombre: string; producto_id?: string; pvp: number; estado: string
  origen: string; riesgo: string; cliente_tipo: string
  sla_nivel: string; horas_sin_gest: number; ia_modo: boolean; requiere_anticipo: boolean
  anticipo_estado: string; anticipo_valor: number
  dias_transito: number; zona_roja: boolean
  upsell_valor: number; descuento_pct: number; descuento_aprobado: boolean
  novedad_tipo: string; fecha_pedido: string; created_at: string
  agente_nombre?: string
}

type Zona = {
  id: string; ciudad: string; departamento: string
  dias_transito_min: number; dias_transito_max: number
  tasa_entrega: number; tasa_devolucion: number
  zona_roja: boolean; motivo_zona_roja: string
  costo_flete_referencia: number
}

type Timeline = {
  id: string; action_type: string; description: string
  trigger_by: string; created_at: string
}

const ESTADOS = [
  {v:'ingresado',    l:'Ingresado',   c:T.blue,    icon:'🛍️'},
  {v:'en_gestion',  l:'En gestión',  c:T.purple,  icon:'📞'},
  {v:'confirmado',  l:'Confirmado',  c:T.green,   icon:'✅'},
  {v:'cancelado',   l:'Cancelado',   c:T.red,     icon:'❌'},
  {v:'en_bodega',   l:'En bodega',   c:T.yellow,  icon:'📦'},
  {v:'despachado',  l:'Despachado',  c:T.accent,  icon:'🚚'},
  {v:'en_transito', l:'En tránsito', c:'#60A5FA', icon:'📍'},
  {v:'novedad',     l:'Novedad',     c:T.yellow,  icon:'⚠️'},
  {v:'entregado',   l:'Entregado',   c:T.green,   icon:'💰'},
  {v:'devolucion',  l:'Devolución',  c:T.red,     icon:'🔄'},
]

const ORIGENES = ['Shopify','WooCommerce','Funnel','Manual','Recompra_Directa','Referido','Redes']
const RIESGOS = [{v:'low',l:'Bajo',c:T.green},{v:'medium',l:'Medio',c:T.yellow},{v:'high',l:'Alto',c:T.accent},{v:'critical',l:'Crítico',c:T.red}]

const inp: React.CSSProperties = {width:'100%',background:'#0A1628',border:`1.5px solid ${T.border}`,borderRadius:'7px',padding:'7px 10px',fontSize:'12px',color:T.text,outline:'none',boxSizing:'border-box'}
const lbl: React.CSSProperties = {fontSize:'11px',color:T.muted,marginBottom:'3px',display:'block'}

// ── MODAL NUEVO PEDIDO ────────────────────────────────────
function ModalNuevoPedido({tenantId,onClose,onSave}:{tenantId:string;onClose:()=>void;onSave:()=>void}) {
  const supabase = createClient()
  const [form, setForm] = useState({
    numero_pedido:'', cliente_nombre:'', cliente_telefono:'', cliente_ciudad:'',
    cliente_departamento:'', cliente_direccion:'', producto_nombre:'', pvp:0,
    origen:'Manual', notas:''
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (k:string) => (e:React.ChangeEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>) =>
    setForm(f=>({...f,[k]:e.target.type==='number'?parseFloat(e.target.value)||0:e.target.value}))

  async function handleSave() {
    if (!form.cliente_nombre||!form.producto_nombre) { setError('Nombre del cliente y producto son obligatorios'); return }
    setSaving(true)
    try {
      // ── Cliente: historial real por teléfono ──────────────
      const { data: historialCliente } = await supabase.from('pedidos')
        .select('estado').eq('tenant_id', tenantId).eq('cliente_tel', form.cliente_telefono)
      const previos = historialCliente || []
      const totalPedidosCliente = previos.length
      const devolucionesCliente = previos.filter((p:{estado:string}) => p.estado === 'DEVOLUCION' || p.estado === 'devolucion').length
      const tipoCliente = clasificarCliente(totalPedidosCliente)

      // ── Zona: buscar si existe, si no, queda neutral ──────
      const { data: zonaData } = await supabase.from('zonas_logisticas')
        .select('*').eq('tenant_id', tenantId).eq('ciudad', form.cliente_ciudad).single()
      const zona = zonaData as Zona | null
      const esZonaRoja = zona?.zona_roja || false
      const tasaDevZona = zona?.tasa_devolucion || 0
      const diasTransito = zona ? Math.round((zona.dias_transito_min + zona.dias_transito_max)/2) : 0

      // ── Score de riesgo real ───────────────────────────────
      const riesgoCalculado = calcularRiesgo({
        esZonaRoja, tasaDevZona, horaCreacion: new Date().getHours(),
        pedidosPrevios: totalPedidosCliente, devolucionesPrevias: devolucionesCliente,
      })
      const requiereAnticipo = ['high','critical'].includes(riesgoCalculado)

      const esRecompra = form.origen === 'Recompra_Directa'

      const {error:err} = await supabase.from('pedidos').insert({
        ...form, tenant_id:tenantId, estado:'ingresado',
        sla_nivel:'verde', horas_sin_gest:0, ia_modo:true,
        riesgo: riesgoCalculado, cliente_tipo: tipoCliente,
        zona_roja: esZonaRoja, dias_transito: diasTransito,
        requiere_anticipo: requiereAnticipo,
        anticipo_estado: requiereAnticipo ? 'pendiente' : 'no_requerido',
        anticipo_valor: requiereAnticipo ? (zona?.costo_flete_referencia || 0) : 0,
        // Recompra directa: CPA=$0, no requiere pauta
        ...(esRecompra ? { notas: `${form.notas} [Recompra directa — CPA $0]`.trim() } : {}),
        fecha_pedido:new Date().toISOString()
      })
      if (err) throw err

      // Si quedó en riesgo alto, generar alerta real
      if (['high','critical'].includes(riesgoCalculado)) {
        await supabase.from('alertas').insert({
          tenant_id: tenantId, tipo: riesgoCalculado==='critical' ? 'critico' : 'atencion',
          titulo: `Pedido de alto riesgo: ${form.cliente_nombre}`,
          mensaje: `Pedido en ${form.cliente_ciudad} con riesgo ${riesgoCalculado}. ${requiereAnticipo ? 'Se recomienda solicitar anticipo de flete.' : ''}`,
          modulo: 'Pedidos', icono: riesgoCalculado==='critical'?'🔴':'🟡',
        })
      }

      onSave()
    } catch(e) { setError(e instanceof Error ? e.message : 'Error al crear pedido') }
    finally { setSaving(false) }
  }

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:'20px',backdropFilter:'blur(4px)'}}>
      <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:'14px',width:'580px',maxHeight:'88vh',overflow:'hidden',display:'flex',flexDirection:'column'}}>
        <div style={{padding:'16px 20px',borderBottom:`1px solid ${T.border}`,display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
          <div style={{fontSize:'14px',fontWeight:'700',color:T.text}}>📦 Nuevo Pedido Manual</div>
          <button onClick={onClose} style={{background:'none',border:'none',color:T.muted,cursor:'pointer',fontSize:'18px'}}>✕</button>
        </div>
        <div style={{overflowY:'auto',flex:1,padding:'18px 20px'}}>
          <div style={{fontSize:'11px',fontWeight:'700',color:T.accent,marginBottom:'8px'}}>📋 DATOS DEL CLIENTE</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px',marginBottom:'10px'}}>
            <div><label style={lbl}>Nombre completo *</label><input style={inp} value={form.cliente_nombre} onChange={set('cliente_nombre')} placeholder="Juan Pérez" /></div>
            <div><label style={lbl}>Teléfono *</label><input style={inp} value={form.cliente_telefono} onChange={set('cliente_telefono')} placeholder="3001234567" /></div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px',marginBottom:'10px'}}>
            <div><label style={lbl}>Departamento</label><input style={inp} value={form.cliente_departamento} onChange={set('cliente_departamento')} placeholder="Antioquia" /></div>
            <div><label style={lbl}>Ciudad</label><input style={inp} value={form.cliente_ciudad} onChange={set('cliente_ciudad')} placeholder="Medellín" /></div>
          </div>
          <div style={{marginBottom:'10px'}}><label style={lbl}>Dirección de entrega</label><input style={inp} value={form.cliente_direccion} onChange={set('cliente_direccion')} placeholder="Cra 70 #45-30 Apto 101" /></div>

          <div style={{fontSize:'11px',fontWeight:'700',color:T.blue,marginBottom:'8px',marginTop:'14px'}}>🛍️ DATOS DEL PEDIDO</div>
          <div style={{marginBottom:'10px'}}><label style={lbl}>Producto *</label><input style={inp} value={form.producto_nombre} onChange={set('producto_nombre')} placeholder="RELOJ LED MODA" /></div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px',marginBottom:'10px'}}>
            <div><label style={lbl}>Valor del pedido</label><input style={inp} type="number" value={form.pvp||''} onChange={set('pvp')} placeholder="0" /></div>
            <div><label style={lbl}>Origen</label>
              <select style={{...inp,appearance:'none' as any}} value={form.origen} onChange={set('origen')}>
                {ORIGENES.map(o=><option key={o}>{o}</option>)}
              </select>
            </div>
          </div>
          <div style={{marginBottom:'10px'}}><label style={lbl}>Número de pedido (Shopify/Woo)</label><input style={inp} value={form.numero_pedido} onChange={set('numero_pedido')} placeholder="#1234" /></div>
          <div><label style={lbl}>Notas internas</label><textarea style={{...inp,height:'60px',resize:'none'}} value={form.notas} onChange={set('notas')} placeholder="Observaciones del pedido..." /></div>

          {error && <div style={{background:`${T.red}15`,border:`1px solid ${T.red}30`,borderRadius:'8px',padding:'8px',fontSize:'12px',color:T.red,marginTop:'10px'}}>{error}</div>}
        </div>
        <div style={{padding:'14px 20px',borderTop:`1px solid ${T.border}`,display:'flex',gap:'8px',flexShrink:0}}>
          <button onClick={onClose} style={{flex:1,padding:'10px',background:T.card2,border:`1px solid ${T.border}`,borderRadius:'8px',color:T.muted,cursor:'pointer',fontSize:'13px'}}>Cancelar</button>
          <button onClick={handleSave} disabled={saving} style={{flex:2,padding:'10px',background:T.accent,border:'none',borderRadius:'8px',color:T.card,fontWeight:'700',cursor:saving?'wait':'pointer',fontSize:'13px',opacity:saving?0.7:1}}>
            {saving?'Creando...':'✅ Crear Pedido'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── PANEL LATERAL — HISTORIA CLÍNICA ─────────────────────
function PanelPedido({pedido,onClose,onUpdate}:{pedido:Pedido;onClose:()=>void;onUpdate:()=>void}) {
  const supabase = createClient()
  const [timeline, setTimeline] = useState<Timeline[]>([])
  const [nuevoEstado, setNuevoEstado] = useState(pedido.estado)
  const [nota, setNota] = useState('')
  const [iaActivo, setIaActivo] = useState(pedido.ia_modo)
  const [saving, setSaving] = useState(false)

  useEffect(()=>{
    supabase.from('order_timeline_logs').select('*').eq('pedido_id',pedido.id)
      .order('created_at',{ascending:false}).then(({data})=>setTimeline((data||[]) as Timeline[]))
  },[pedido.id])

  async function cambiarEstado() {
    setSaving(true)
    const horasGestion = horasLaboralesSinGestion(pedido.fecha_pedido)
    await supabase.from('pedidos').update({
      estado:nuevoEstado, horas_sin_gest:horasGestion, sla_nivel:calcularSlaNivel(horasGestion),
    }).eq('id',pedido.id)
    await supabase.from('order_timeline_logs').insert({
      pedido_id:pedido.id, tenant_id:pedido.tenant_id,
      action_type:'status_change', trigger_by:'human_user',
      description:`Estado cambiado a: ${nuevoEstado}${nota?' — '+nota:''}`,
    })

    // FIX — Conexión real a Wallet cuando el pedido se marca como entregado
    if (nuevoEstado === 'entregado' && pedido.estado !== 'entregado') {
      await supabase.from('wallet_transacciones').insert({
        tenant_id: pedido.tenant_id, fecha: new Date().toISOString(),
        tipo: 'ENTRADA', monto: pedido.pvp || 0,
        descripcion: `Entrega ${pedido.numero_pedido || pedido.id.slice(0,8)} — ${pedido.cliente_nombre}`,
        categoria: 'ganancia_dropshipper', fuente: 'dizgo_pedidos',
      })
      // Espejo en libro_caja para el módulo financiero PYG-02
      await supabase.from('libro_caja').insert({
        tenant_id: pedido.tenant_id, fecha: new Date().toISOString().slice(0,10),
        concepto: `Venta entregada — ${pedido.cliente_nombre}`,
        tipo: 'entrada', valor: pedido.pvp || 0,
        origen: 'venta', referencia_tabla: 'pedidos', referencia_id: pedido.id,
        categoria_flujo: 'operativo',
      })
    }

    setSaving(false); onUpdate()
    setTimeline(t=>[{id:'new',action_type:'status_change',description:`Estado: ${nuevoEstado}`,trigger_by:'human',created_at:new Date().toISOString()},...t])
  }

  async function toggleIA() {
    const nuevo = !iaActivo
    setIaActivo(nuevo)
    await supabase.from('pedidos').update({ia_modo:nuevo}).eq('id',pedido.id)
    await supabase.from('order_timeline_logs').insert({
      pedido_id:pedido.id, tenant_id:pedido.id,
      action_type:'mode_change', trigger_by:'human_user',
      description:`Modo cambiado a: ${nuevo?'IA':'Humano'}`,
    })
  }

  const estadoInfo = ESTADOS.find(e=>e.v===pedido.estado)
  const riesgoInfo = RIESGOS.find(r=>r.v===pedido.riesgo)
  const slaColorLocal = (n:string) => n==='verde'?T.green:n==='amarillo'?T.yellow:T.red

  const actionIcons: Record<string,string> = {
    status_change:'🔄', whatsapp_sent:'💬', whatsapp_received:'💬',
    call_log:'📞', mode_change:'🤖', api_import:'🛍️', upsell_added:'➕', default:'📋'
  }

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',zIndex:200,display:'flex',justifyContent:'flex-end',backdropFilter:'blur(2px)'}}>
      <div style={{width:'460px',background:T.card,borderLeft:`1px solid ${T.border}`,height:'100vh',display:'flex',flexDirection:'column',overflowY:'auto'}}>

        {/* Header */}
        <div style={{padding:'16px 20px',borderBottom:`1px solid ${T.border}`,flexShrink:0}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'8px'}}>
            <div style={{fontSize:'14px',fontWeight:'700',color:T.text}}>{pedido.cliente_nombre}</div>
            <button onClick={onClose} style={{background:'none',border:'none',color:T.muted,cursor:'pointer',fontSize:'18px'}}>✕</button>
          </div>
          <div style={{display:'flex',gap:'6px',flexWrap:'wrap'}}>
            <span style={{fontSize:'10px',padding:'2px 8px',borderRadius:'4px',background:`${estadoInfo?.c||T.muted}20`,color:estadoInfo?.c||T.muted,fontWeight:'600'}}>
              {estadoInfo?.icon} {estadoInfo?.l||pedido.estado}
            </span>
            <span style={{fontSize:'10px',padding:'2px 8px',borderRadius:'4px',background:`${riesgoInfo?.c||T.muted}20`,color:riesgoInfo?.c||T.muted}}>
              Riesgo: {riesgoInfo?.l||'—'}
            </span>
            <span style={{fontSize:'10px',padding:'2px 8px',borderRadius:'4px',background:`${CLIENTE_TIPO_INFO[pedido.cliente_tipo]?.c||T.purple}20`,color:CLIENTE_TIPO_INFO[pedido.cliente_tipo]?.c||T.purple,fontWeight:'600'}}>
              {CLIENTE_TIPO_INFO[pedido.cliente_tipo]?.icon||'👤'} {CLIENTE_TIPO_INFO[pedido.cliente_tipo]?.l||pedido.cliente_tipo}
            </span>
            <span style={{fontSize:'10px',padding:'2px 8px',borderRadius:'4px',background:`${slaColorLocal(pedido.sla_nivel)}20`,color:slaColorLocal(pedido.sla_nivel),fontWeight:'600'}}>
              ⏱ {pedido.horas_sin_gest||0}h sin gestión
            </span>
            {pedido.zona_roja && (
              <span style={{fontSize:'10px',padding:'2px 8px',borderRadius:'4px',background:`${T.red}20`,color:T.red,fontWeight:'600'}}>
                🚩 Zona roja
              </span>
            )}
            {pedido.requiere_anticipo && (
              <span style={{fontSize:'10px',padding:'2px 8px',borderRadius:'4px',background:`${T.accent}20`,color:T.accent,fontWeight:'600'}}>
                💰 Requiere anticipo
              </span>
            )}
          </div>
        </div>

        {/* Datos del pedido */}
        <div style={{padding:'14px 20px',borderBottom:`1px solid ${T.border}`}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px',fontSize:'12px'}}>
            {[
              ['Producto',pedido.producto_nombre],
              ['Valor',fmt(pedido.pvp||0)],
              ['Ciudad',pedido.cliente_ciudad],
              ['Teléfono',pedido.cliente_telefono],
              ['Origen',pedido.origen],
              ['Hace',timeAgo(pedido.created_at)],
            ].map(([k,v])=>(
              <div key={k as string}>
                <div style={{fontSize:'10px',color:T.muted}}>{k}</div>
                <div style={{color:T.text,fontWeight:'500'}}>{v}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Switch IA / Humano */}
        <div style={{padding:'12px 20px',borderBottom:`1px solid ${T.border}`,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div>
            <div style={{fontSize:'12px',fontWeight:'600',color:iaActivo?T.purple:T.accent}}>
              {iaActivo?'🤖 MODO IA':'👤 MODO HUMANO'}
            </div>
            <div style={{fontSize:'10px',color:T.muted}}>{iaActivo?'IA gestiona automáticamente':'Tú tienes el control'}</div>
          </div>
          <button onClick={toggleIA}
            style={{padding:'6px 14px',background:iaActivo?`${T.purple}20`:`${T.accent}20`,border:`1px solid ${iaActivo?T.purple:T.accent}`,borderRadius:'20px',color:iaActivo?T.purple:T.accent,cursor:'pointer',fontSize:'12px',fontWeight:'600'}}>
            {iaActivo?'Tomar control':'Activar IA'}
          </button>
        </div>

        {/* Cambiar estado */}
        <div style={{padding:'14px 20px',borderBottom:`1px solid ${T.border}`}}>
          <div style={{fontSize:'11px',fontWeight:'700',color:T.muted,marginBottom:'8px'}}>CAMBIAR ESTADO</div>
          <div style={{display:'flex',gap:'6px',marginBottom:'8px'}}>
            <select style={{...inp,flex:1,appearance:'none' as any}} value={nuevoEstado} onChange={e=>setNuevoEstado(e.target.value)}>
              {ESTADOS.map(e=><option key={e.v} value={e.v}>{e.icon} {e.l}</option>)}
            </select>
            <button onClick={cambiarEstado} disabled={saving}
              style={{padding:'7px 14px',background:T.accent,border:'none',borderRadius:'7px',color:T.card,fontWeight:'700',cursor:'pointer',fontSize:'12px',whiteSpace:'nowrap'}}>
              {saving?'...':'Actualizar'}
            </button>
          </div>
          <input style={inp} placeholder="Nota del cambio (opcional)" value={nota} onChange={e=>setNota(e.target.value)} />
        </div>

        {/* Acciones rápidas */}
        <div style={{padding:'12px 20px',borderBottom:`1px solid ${T.border}`}}>
          <div style={{fontSize:'11px',fontWeight:'700',color:T.muted,marginBottom:'8px'}}>ACCIONES RÁPIDAS</div>
          <div style={{display:'flex',gap:'6px',flexWrap:'wrap'}}>
            <a href={`https://wa.me/${pedido.cliente_telefono}?text=Hola%20${encodeURIComponent(pedido.cliente_nombre)},%20te%20contactamos%20sobre%20tu%20pedido%20de%20${encodeURIComponent(pedido.producto_nombre)}`}
              target="_blank" rel="noopener noreferrer"
              style={{padding:'6px 12px',background:`${T.green}15`,border:`1px solid ${T.green}30`,borderRadius:'6px',color:T.green,fontSize:'11px',fontWeight:'600',textDecoration:'none'}}>
              💬 WhatsApp
            </a>
            <a href={`tel:${pedido.cliente_telefono}`}
              style={{padding:'6px 12px',background:`${T.blue}15`,border:`1px solid ${T.blue}30`,borderRadius:'6px',color:T.blue,fontSize:'11px',fontWeight:'600',textDecoration:'none'}}>
              📞 Llamar
            </a>
            <a href="/dashboard/pqrsf"
              style={{padding:'6px 12px',background:`${T.purple}15`,border:`1px solid ${T.purple}30`,borderRadius:'6px',color:T.purple,fontSize:'11px',fontWeight:'600',textDecoration:'none'}}>
              📬 PQRSF
            </a>
          </div>
        </div>

        {/* Anticipo de flete (si el riesgo lo requiere) */}
        {pedido.requiere_anticipo && (
          <div style={{padding:'12px 20px',borderBottom:`1px solid ${T.border}`,background:`${T.accent}06`}}>
            <div style={{fontSize:'11px',fontWeight:'700',color:T.accent,marginBottom:'8px'}}>💰 ANTICIPO DE FLETE</div>
            <div style={{fontSize:'12px',color:T.text,marginBottom:'6px'}}>
              Estado: <strong>{pedido.anticipo_estado}</strong> · Valor: <strong>{fmt(pedido.anticipo_valor||0)}</strong>
            </div>
            <div style={{fontSize:'11px',color:T.muted,marginBottom:'8px',lineHeight:1.5}}>
              Mensaje sugerido: &quot;Hola {pedido.cliente_nombre}, tu pedido está listo. Para asegurar la entrega en {pedido.cliente_ciudad}, solicitamos un anticipo del flete de {fmt(pedido.anticipo_valor||0)}. ¿Deseas continuar?&quot;
            </div>
            {pedido.anticipo_estado === 'pendiente' && (
              <button onClick={async()=>{
                await supabase.from('pedidos').update({anticipo_estado:'solicitado'}).eq('id',pedido.id)
                onUpdate()
              }} style={{padding:'6px 12px',background:`${T.accent}20`,border:`1px solid ${T.accent}40`,borderRadius:'6px',color:T.accent,cursor:'pointer',fontSize:'11px',fontWeight:'600'}}>
                Marcar como solicitado
              </button>
            )}
            {pedido.anticipo_estado === 'solicitado' && (
              <button onClick={async()=>{
                await supabase.from('pedidos').update({anticipo_estado:'verificado'}).eq('id',pedido.id)
                onUpdate()
              }} style={{padding:'6px 12px',background:`${T.green}20`,border:`1px solid ${T.green}40`,borderRadius:'6px',color:T.green,cursor:'pointer',fontSize:'11px',fontWeight:'600'}}>
                ✅ Verificar pago recibido
              </button>
            )}
          </div>
        )}

        {/* Descuento / Upsell — requiere aprobación del dueño */}
        <div style={{padding:'12px 20px',borderBottom:`1px solid ${T.border}`}}>
          <div style={{fontSize:'11px',fontWeight:'700',color:T.muted,marginBottom:'8px'}}>💵 MESA DE CONTROL — DESCUENTO/UPSELL</div>
          {pedido.descuento_pct > 0 && !pedido.descuento_aprobado && (
            <div style={{background:`${T.yellow}10`,border:`1px solid ${T.yellow}30`,borderRadius:'7px',padding:'8px 10px',marginBottom:'8px'}}>
              <div style={{fontSize:'12px',color:T.text}}>Descuento solicitado: <strong style={{color:T.yellow}}>{pedido.descuento_pct}%</strong></div>
              <div style={{fontSize:'10px',color:T.muted,marginBottom:'6px'}}>Pendiente de autorización del dueño</div>
              <button onClick={async()=>{
                await supabase.from('pedidos').update({descuento_aprobado:true}).eq('id',pedido.id)
                onUpdate()
              }} style={{padding:'5px 10px',background:`${T.green}20`,border:`1px solid ${T.green}40`,borderRadius:'6px',color:T.green,cursor:'pointer',fontSize:'10px',fontWeight:'600',marginRight:'6px'}}>
                ✅ Autorizar
              </button>
              <button onClick={async()=>{
                await supabase.from('pedidos').update({descuento_pct:0}).eq('id',pedido.id)
                onUpdate()
              }} style={{padding:'5px 10px',background:`${T.red}20`,border:`1px solid ${T.red}40`,borderRadius:'6px',color:T.red,cursor:'pointer',fontSize:'10px',fontWeight:'600'}}>
                ✕ Rechazar
              </button>
            </div>
          )}
          {pedido.upsell_valor > 0 && (
            <div style={{fontSize:'12px',color:T.green}}>+ Upsell agregado: {fmt(pedido.upsell_valor)}</div>
          )}
          {pedido.descuento_pct === 0 && pedido.upsell_valor === 0 && (
            <div style={{fontSize:'11px',color:T.muted}}>Sin modificaciones en este pedido</div>
          )}
        </div>

        {/* Historia clínica */}
        <div style={{padding:'14px 20px',flex:1}}>
          <div style={{fontSize:'11px',fontWeight:'700',color:T.muted,marginBottom:'10px'}}>🏥 HISTORIA CLÍNICA</div>
          {timeline.length===0 ? (
            <div style={{fontSize:'12px',color:T.muted,textAlign:'center',padding:'20px'}}>Sin registros aún</div>
          ) : timeline.map((t,i)=>(
            <div key={t.id||i} style={{display:'flex',gap:'10px',marginBottom:'10px'}}>
              <div style={{width:'28px',height:'28px',borderRadius:'50%',background:`${T.blue}20`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'13px',flexShrink:0}}>
                {actionIcons[t.action_type]||actionIcons.default}
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:'12px',color:T.text,lineHeight:1.4}}>{t.description}</div>
                <div style={{fontSize:'10px',color:T.muted,marginTop:'2px'}}>
                  {t.trigger_by==='ia_bot'?'🤖 IA':'👤 Humano'} · {timeAgo(t.created_at)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── PÁGINA PRINCIPAL ──────────────────────────────────────
export default function PedidosPage() {
  const supabase = createClient()
  const [tenantId, setTenantId] = useState('')
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [buscar, setBuscar] = useState('')
  const [pedidoActivo, setPedidoActivo] = useState<Pedido|null>(null)
  const [showNuevo, setShowNuevo] = useState(false)

  async function loadData() {
    setLoading(true)
    const {data:{user}} = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const {data:profile} = await supabase.from('profiles').select('tenant_id').eq('id',user.id).single()
    if (!profile?.tenant_id) { setLoading(false); return }
    setTenantId(profile.tenant_id)
    const {data} = await supabase.from('pedidos').select('*')
      .eq('tenant_id',profile.tenant_id)
      .order('created_at',{ascending:false})
      .limit(200)
    const lista = (data||[]) as Pedido[]

    // Recalcular SLA real para pedidos abiertos (no entregados/cancelados/devueltos)
    const abiertos = lista.filter(p => !['entregado','cancelado','devolucion'].includes(p.estado))
    const actualizaciones: { id:string; horas:number; nivel:string }[] = []
    abiertos.forEach(p => {
      const horas = horasLaboralesSinGestion(p.fecha_pedido || p.created_at)
      const nivel = calcularSlaNivel(horas)
      if (nivel !== p.sla_nivel || Math.abs(horas - (p.horas_sin_gest||0)) >= 1) {
        p.horas_sin_gest = horas
        p.sla_nivel = nivel
        actualizaciones.push({ id:p.id, horas, nivel })
      }
    })
    // Persistir en background, sin bloquear la UI
    if (actualizaciones.length > 0) {
      Promise.all(actualizaciones.map(a =>
        supabase.from('pedidos').update({ horas_sin_gest:a.horas, sla_nivel:a.nivel }).eq('id', a.id)
      ))
    }

    setPedidos(lista)
    setLoading(false)
  }

  useEffect(()=>{ loadData() },[])

  const filtrados = pedidos.filter(p=>{
    const me = filtroEstado==='todos'||p.estado===filtroEstado
    const mb = !buscar || p.cliente_nombre?.toLowerCase().includes(buscar.toLowerCase()) ||
      p.producto_nombre?.toLowerCase().includes(buscar.toLowerCase()) ||
      p.cliente_telefono?.includes(buscar) || p.numero_pedido?.includes(buscar)
    return me&&mb
  })

  // KPIs conectados al embudo
  const kpis = {
    total:      pedidos.length,
    ingresados: pedidos.filter(p=>p.estado==='ingresado').length,
    confirmados:pedidos.filter(p=>p.estado==='confirmado').length,
    despachados:pedidos.filter(p=>p.estado==='despachado').length,
    entregados: pedidos.filter(p=>p.estado==='entregado').length,
    novedades:  pedidos.filter(p=>p.estado==='novedad').length,
    devoluciones:pedidos.filter(p=>p.estado==='devolucion').length,
    sla_vencido:pedidos.filter(p=>p.sla_nivel==='rojo').length,
    alto_riesgo:pedidos.filter(p=>['high','critical'].includes(p.riesgo||'')).length,
  }
  const tc = kpis.total>0?Math.round(kpis.confirmados/kpis.total*100):0
  const te = kpis.despachados>0?Math.round(kpis.entregados/kpis.despachados*100):0

  const slaColor = (n:string) => n==='verde'?T.green:n==='amarillo'?T.yellow:T.red
  const estadoColor = (e:string) => ESTADOS.find(x=>x.v===e)?.c||T.muted
  const riesgoColor = (r:string) => RIESGOS.find(x=>x.v===r)?.c||T.muted

  return (
    <div style={{color:T.text,fontFamily:'"DM Sans", system-ui, sans-serif'}}>
      {showNuevo && <ModalNuevoPedido tenantId={tenantId} onClose={()=>setShowNuevo(false)} onSave={()=>{setShowNuevo(false);loadData()}} />}
      {pedidoActivo && <PanelPedido pedido={pedidoActivo} onClose={()=>setPedidoActivo(null)} onUpdate={loadData} />}

      {/* Header */}
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:'20px'}}>
        <div>
          <h1 style={{fontSize:'22px',fontWeight:'700',color:T.text,marginBottom:'4px'}}>📦 Gestión de Pedidos</h1>
          <p style={{fontSize:'12px',color:T.muted}}>Los pedidos son la mina de oro — cuídalos</p>
        </div>
        <div style={{display:'flex',gap:'8px'}}>
          <button onClick={loadData} style={{padding:'8px 14px',background:T.card,border:`1px solid ${T.border}`,borderRadius:'8px',color:T.muted,cursor:'pointer',fontSize:'12px'}}>🔄 Actualizar</button>
          <button onClick={()=>setShowNuevo(true)} style={{padding:'8px 18px',background:T.accent,border:'none',borderRadius:'8px',color:T.card,fontWeight:'700',cursor:'pointer',fontSize:'13px'}}>+ Nuevo pedido</button>
        </div>
      </div>

      {/* KPIs — Embudo de etapas */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:'8px',marginBottom:'14px'}}>
        {[
          {l:'Shopify/Woo',n:kpis.total,      c:T.blue,  icon:'🛍️', sub:'Total generados'},
          {l:'Confirmados', n:kpis.confirmados,c:T.green, icon:'✅', sub:`TC: ${tc}%`},
          {l:'Despachados', n:kpis.despachados,c:T.accent,icon:'🚚', sub:'Con guía'},
          {l:'Entregados',  n:kpis.entregados, c:T.green, icon:'💰', sub:`TE: ${te}%`},
          {l:'Devoluciones',n:kpis.devoluciones,c:T.red,  icon:'🔄', sub:`${kpis.total>0?Math.round(kpis.devoluciones/kpis.total*100):0}%`},
        ].map(k=>(
          <div key={k.l} onClick={()=>setFiltroEstado(k.l==='Shopify/Woo'?'todos':k.l==='Confirmados'?'confirmado':k.l==='Despachados'?'despachado':k.l==='Entregados'?'entregado':'devolucion')}
            style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:'10px',padding:'10px 12px',cursor:'pointer',borderTop:`3px solid ${k.c}`,textAlign:'center'}}>
            <div style={{fontSize:'18px',marginBottom:'2px'}}>{k.icon}</div>
            <div style={{fontSize:'20px',fontWeight:'700',color:k.c}}>{k.n}</div>
            <div style={{fontSize:'11px',color:T.text,fontWeight:'600'}}>{k.l}</div>
            <div style={{fontSize:'10px',color:T.muted}}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Alertas rápidas */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'8px',marginBottom:'16px'}}>
        {[
          {n:kpis.novedades,    l:'Con novedad',     c:T.yellow, icon:'⚠️', f:'novedad'},
          {n:kpis.sla_vencido,  l:'SLA vencido >4h', c:T.red,    icon:'🔴', f:'sla_rojo'},
          {n:kpis.alto_riesgo,  l:'Alto riesgo dev', c:T.accent, icon:'🛡️', f:'alto_riesgo'},
        ].map(k=>(
          <div key={k.l} onClick={()=>setFiltroEstado(k.f)}
            style={{background:`${k.c}12`,border:`1px solid ${k.c}30`,borderRadius:'9px',padding:'10px 14px',cursor:'pointer',display:'flex',alignItems:'center',gap:'10px'}}>
            <span style={{fontSize:'18px'}}>{k.icon}</span>
            <div>
              <div style={{fontSize:'16px',fontWeight:'700',color:k.c}}>{k.n}</div>
              <div style={{fontSize:'11px',color:T.muted}}>{k.l}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div style={{display:'flex',gap:'6px',marginBottom:'14px',flexWrap:'wrap',alignItems:'center'}}>
        <button onClick={()=>setFiltroEstado('todos')}
          style={{padding:'5px 12px',borderRadius:'16px',cursor:'pointer',fontSize:'11px',border:`1px solid ${filtroEstado==='todos'?T.accent:T.border}`,background:filtroEstado==='todos'?`${T.accent}15`:'transparent',color:filtroEstado==='todos'?T.accent:T.muted}}>
          Todos ({pedidos.length})
        </button>
        {ESTADOS.map(e=>{
          const cnt = pedidos.filter(p=>p.estado===e.v).length
          return (
            <button key={e.v} onClick={()=>setFiltroEstado(e.v)}
              style={{padding:'5px 12px',borderRadius:'16px',cursor:'pointer',fontSize:'11px',border:`1px solid ${filtroEstado===e.v?e.c:T.border}`,background:filtroEstado===e.v?`${e.c}15`:'transparent',color:filtroEstado===e.v?e.c:T.muted}}>
              {e.icon} {e.l} {cnt>0?`(${cnt})`:''}
            </button>
          )
        })}
        <input style={{...inp,width:'200px',marginLeft:'auto'}} placeholder="🔍 Buscar cliente, producto, tel..." value={buscar} onChange={e=>setBuscar(e.target.value)} />
      </div>

      {/* Tabla de pedidos */}
      <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:'12px',overflow:'hidden'}}>
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead>
              <tr style={{background:'#060E1C'}}>
                {['#','Cliente','Ciudad','Producto','Valor','Estado','Origen','Riesgo','SLA','Modo','Acciones'].map(h=>(
                  <th key={h} style={{padding:'10px 12px',textAlign:'left',fontSize:'11px',color:T.muted,fontWeight:'600',whiteSpace:'nowrap',borderBottom:`1px solid ${T.border}`}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading?(
                <tr><td colSpan={11} style={{textAlign:'center',padding:'40px',color:T.muted,fontSize:'13px'}}>Cargando pedidos...</td></tr>
              ):filtrados.length===0?(
                <tr>
                  <td colSpan={11} style={{textAlign:'center',padding:'48px'}}>
                    <div style={{fontSize:'36px',marginBottom:'12px'}}>📦</div>
                    <div style={{fontSize:'14px',fontWeight:'600',color:T.text,marginBottom:'6px'}}>No hay pedidos</div>
                    <div style={{fontSize:'12px',color:T.muted,marginBottom:'16px'}}>Crea un pedido manual o conecta Shopify/Dropi</div>
                    <button onClick={()=>setShowNuevo(true)} style={{padding:'9px 20px',background:T.accent,border:'none',borderRadius:'8px',color:T.card,fontWeight:'700',cursor:'pointer',fontSize:'13px'}}>+ Crear primer pedido</button>
                  </td>
                </tr>
              ):filtrados.map((p,idx)=>(
                <tr key={p.id} style={{borderBottom:`1px solid ${T.border}`,background:idx%2===0?'transparent':'#080F1C',cursor:'pointer'}}
                  onMouseEnter={e=>(e.currentTarget.style.background='#0F1E32')}
                  onMouseLeave={e=>(e.currentTarget.style.background=idx%2===0?'transparent':'#080F1C')}>
                  <td style={{padding:'8px 12px',fontSize:'11px',color:T.muted,fontWeight:'600'}}>#{String(idx+1).padStart(4,'0')}</td>
                  <td style={{padding:'8px 12px'}}>
                    <div style={{fontSize:'12px',fontWeight:'600',color:T.text}}>{p.cliente_nombre}</div>
                    <div style={{fontSize:'10px',color:T.muted}}>{p.cliente_telefono}</div>
                  </td>
                  <td style={{padding:'8px 12px',fontSize:'11px',color:T.muted}}>{p.cliente_ciudad||'—'}</td>
                  <td style={{padding:'8px 12px',fontSize:'12px',color:T.text,maxWidth:'160px'}}>
                    <div style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.producto_nombre}</div>
                  </td>
                  <td style={{padding:'8px 12px',fontSize:'12px',fontWeight:'600',color:T.green}}>{fmt(p.pvp||0)}</td>
                  <td style={{padding:'8px 12px'}}>
                    <span style={{fontSize:'10px',fontWeight:'600',padding:'2px 8px',borderRadius:'4px',background:`${estadoColor(p.estado)}20`,color:estadoColor(p.estado)}}>
                      {ESTADOS.find(e=>e.v===p.estado)?.icon} {ESTADOS.find(e=>e.v===p.estado)?.l||p.estado}
                    </span>
                  </td>
                  <td style={{padding:'8px 12px',fontSize:'11px',color:T.muted}}>{p.origen||'—'}</td>
                  <td style={{padding:'8px 12px'}}>
                    <span style={{fontSize:'10px',fontWeight:'600',padding:'2px 6px',borderRadius:'4px',background:`${riesgoColor(p.riesgo)}20`,color:riesgoColor(p.riesgo)}}>
                      {RIESGOS.find(r=>r.v===p.riesgo)?.l||'—'}
                    </span>
                  </td>
                  <td style={{padding:'8px 12px'}}>
                    <div style={{width:'8px',height:'8px',borderRadius:'50%',background:slaColor(p.sla_nivel||'verde')}} title={`SLA: ${p.sla_nivel}`} />
                  </td>
                  <td style={{padding:'8px 12px'}}>
                    <span style={{fontSize:'10px',padding:'2px 6px',borderRadius:'4px',background:p.ia_modo?`${T.purple}20`:`${T.accent}20`,color:p.ia_modo?T.purple:T.accent}}>
                      {p.ia_modo?'🤖 IA':'👤 H'}
                    </span>
                  </td>
                  <td style={{padding:'8px 12px'}}>
                    <button onClick={()=>setPedidoActivo(p)}
                      style={{padding:'4px 10px',background:`${T.blue}15`,border:`1px solid ${T.blue}30`,borderRadius:'6px',color:T.blue,cursor:'pointer',fontSize:'11px',fontWeight:'600'}}>
                      Ver
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {filtrados.length>0 && (
        <div style={{textAlign:'center',marginTop:'10px',fontSize:'12px',color:T.muted}}>
          Mostrando {filtrados.length} de {pedidos.length} pedidos · TC: {tc}% · TE: {te}%
        </div>
      )}
    </div>
  )
}
