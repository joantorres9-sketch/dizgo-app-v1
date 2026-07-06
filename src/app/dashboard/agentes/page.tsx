'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

type PedidoPendiente = {
  id: string; numero_pedido: string; cliente_nombre: string
  cliente_telefono: string; producto_nombre: string; pvp: number
  estado: string; fecha_pedido: string; horas_espera: number
  novedad_tipo?: string
}
type CXP = { id: string; tercero: string; concepto: string; valor: number; fecha_vencimiento: string; dias_vencida: number }
type LogAgente = { id: string; agente: string; output_texto: string; estado: string; created_at: string; pedido_id?: string }

const AGENTES = [
  { key:'confirmador', label:'📞 Confirmador', color:'#3D8EF0', desc:'Genera mensajes de confirmación para pedidos nuevos sin respuesta en +2h' },
  { key:'novedades',   label:'⚠️ Novedades',   color:'#F5A623', desc:'Gestiona pedidos con novedad activa +24h sin resolverse' },
  { key:'contable',    label:'📊 Contable',    color:'#2DD4A0', desc:'Diagnóstico financiero diario: CXP vencidas, liquidez, semáforos' },
  { key:'campanas',    label:'📡 Campañas',    color:'#9B6BFF', desc:'Analiza rendimiento de pauta y sugiere optimizaciones por campaña' },
  { key:'inventario',  label:'🏭 Inventario',  color:'#F05C5C', desc:'Detecta quiebres de stock y sugiere traslados o compras urgentes' },
  { key:'logistico',   label:'🚚 Logístico',   color:'#2DD4A0', desc:'Evalúa transportadoras, zonas de riesgo y novedades por ciudad' },
]

const s: React.CSSProperties = { background:'#111520', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'12px' }
function fmt(n: number){ return `$${Math.round(n).toLocaleString('es-CO')}` }
function horasDesde(fecha: string){ return Math.round((Date.now()-new Date(fecha).getTime())/3600000) }

export default function AgentesPage() {
  const supabase = createClient()
  const [tenantId, setTenantId] = useState('')
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'confirmador'|'novedades'|'contable'|'campanas'|'inventario'|'logistico'>('confirmador')

  const [pedidosSinConfirmar, setPedidosSinConfirmar] = useState<PedidoPendiente[]>([])
  const [pedidosNovedad, setPedidosNovedad] = useState<PedidoPendiente[]>([])
  const [cxpVencidas, setCxpVencidas] = useState<CXP[]>([])
  const [saldoWallet, setSaldoWallet] = useState(0)
  const [totalCxpPendiente, setTotalCxpPendiente] = useState(0)
  const [logs, setLogs] = useState<LogAgente[]>([])

  const [corriendo, setCorriendo] = useState<string|null>(null)
  const [resultado, setResultado] = useState<{agente:string; texto:string; pedido_id?:string}|null>(null)

  // Estados Fase 2
  const [pautaRows, setPautaRows] = useState<{id:string;campana:string;plataforma:string;inversion:number;resultados:number;ctr:number;cpa:number;roas:number;fecha:string}[]>([])
  const [stockBajoItems, setStockBajoItems] = useState<{producto_id:string;bodega_id:string;cantidad_disponible:number;stock_minimo:number}[]>([])
  const [transportadorasMetrica, setTransportadorasMetrica] = useState<{transportadora:string;total:number;entregados:number;tasa:number}[]>([])

  const loadData = useCallback(async () => {
    setLoading(true)
    const { data:{ user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single()
    if (!profile?.tenant_id) { setLoading(false); return }
    const tid = profile.tenant_id
    setTenantId(tid)

    const limite2h = new Date(Date.now()-2*3600000).toISOString()
    const limite24h = new Date(Date.now()-24*3600000).toISOString()
    const hoy = new Date().toISOString().slice(0,10)

    const [
      { data: sinConf }, { data: novedad },
      { data: cxpData }, { data: walletData }, { data: logsData },
    ] = await Promise.all([
      supabase.from('pedidos').select('id,numero_pedido,cliente_nombre,cliente_telefono,producto_nombre,pvp,estado,fecha_pedido')
        .eq('tenant_id', tid).eq('estado','NUEVO').lt('fecha_pedido', limite2h).limit(20),
      supabase.from('pedidos').select('id,numero_pedido,cliente_nombre,cliente_telefono,producto_nombre,pvp,estado,fecha_pedido,novedad_tipo')
        .eq('tenant_id', tid).eq('estado','NOVEDAD').lt('fecha_pedido', limite24h).limit(20),
      supabase.from('cuentas_por_pagar').select('id,tercero,concepto,valor,fecha_vencimiento')
        .eq('tenant_id', tid).eq('estado','pendiente').lt('fecha_vencimiento', hoy).order('fecha_vencimiento'),
      supabase.from('wallet_transacciones').select('tipo,monto').eq('tenant_id', tid),
      supabase.from('agentes_ia_logs').select('*').eq('tenant_id', tid)
        .order('created_at',{ascending:false}).limit(30),
    ])

    setPedidosSinConfirmar(((sinConf||[]) as PedidoPendiente[]).map(p=>({...p,horas_espera:horasDesde(p.fecha_pedido)})))
    setPedidosNovedad(((novedad||[]) as PedidoPendiente[]).map(p=>({...p,horas_espera:horasDesde(p.fecha_pedido)})))

    const hoy2 = new Date()
    setCxpVencidas(((cxpData||[]) as CXP[]).map(c=>({
      ...c, dias_vencida: Math.floor((hoy2.getTime()-new Date(c.fecha_vencimiento).getTime())/86400000)
    })))
    setTotalCxpPendiente((cxpData||[]).reduce((a:number,c:{valor:number})=>a+Number(c.valor),0))

    const wRows = (walletData||[]) as {tipo:string;monto:number}[]
    setSaldoWallet(wRows.filter(w=>w.tipo==='ENTRADA').reduce((a,w)=>a+Number(w.monto),0)
      - wRows.filter(w=>w.tipo==='SALIDA').reduce((a,w)=>a+Number(w.monto),0))

    setLogs((logsData||[]) as LogAgente[])

    // Datos Fase 2 — Campañas, Inventario, Logístico
    const ini30 = new Date(Date.now()-30*86400000).toISOString().slice(0,10)
    const [{ data: pautaData }, { data: invBajoData }, { data: pedsLogData }] = await Promise.all([
      supabase.from('pauta').select('id,campana,plataforma,inversion,resultados,ctr,cpa,fecha').eq('tenant_id',tid).gte('fecha',ini30).order('fecha',{ascending:false}),
      supabase.from('inventario').select('producto_id,bodega_id,cantidad_disponible,stock_minimo').eq('tenant_id',tid).filter('cantidad_disponible','lte','stock_minimo'),
      supabase.from('pedidos').select('estado,transportadora').eq('tenant_id',tid).gte('fecha_pedido',ini30+'T00:00:00').not('transportadora','is','null'),
    ])

    const pRows = (pautaData||[]) as {id:string;campana:string;plataforma:string;inversion:number;resultados:number;ctr:number;cpa:number;fecha:string}[]
    setPautaRows(pRows.map(r => ({
      ...r,
      roas: r.inversion>0 && r.resultados>0 ? Math.round(r.resultados/r.inversion*100)/100 : 0
    })))

    setStockBajoItems((invBajoData||[]) as {producto_id:string;bodega_id:string;cantidad_disponible:number;stock_minimo:number}[])

    const tMap: Record<string,{total:number;entregados:number}> = {}
    ;(pedsLogData||[]).forEach((p:{estado:string;transportadora:string}) => {
      if (!p.transportadora) return
      if (!tMap[p.transportadora]) tMap[p.transportadora] = { total:0, entregados:0 }
      tMap[p.transportadora].total++
      if (['ENTREGADO','entregado'].includes(p.estado)) tMap[p.transportadora].entregados++
    })
    setTransportadorasMetrica(Object.entries(tMap).map(([t,d]) => ({
      transportadora: t, total: d.total, entregados: d.entregados,
      tasa: d.total>0 ? Math.round(d.entregados/d.total*100) : 0
    })).sort((a,b) => b.total-a.total))

    setLoading(false)
  }, [supabase])

  useEffect(() => { loadData() }, [loadData])

  // ── LLAMADA AL AGENTE ─────────────────────────────────────
  async function ejecutarAgente(agente: 'confirmador'|'novedades'|'contable', pedido?: PedidoPendiente) {
    if (!tenantId) return
    setCorriendo(agente)
    setResultado(null)
    const t0 = Date.now()

    let prompt = ''
    let inputResumen = ''

    if (agente === 'confirmador' && pedido) {
      inputResumen = `Pedido ${pedido.numero_pedido || pedido.id.slice(0,8)} | ${pedido.cliente_nombre} | ${pedido.producto_nombre} | ${fmt(pedido.pvp)} | ${pedido.horas_espera}h sin confirmar`
      prompt = `Eres el Agente Confirmador de DIZGO, plataforma de gestión para dropshipping en Colombia.

Tu misión: generar el mensaje de WhatsApp perfecto para confirmar este pedido.

DATOS DEL PEDIDO:
- Cliente: ${pedido.cliente_nombre}
- Producto: ${pedido.producto_nombre}
- Valor: ${fmt(pedido.pvp)}
- Pedido hace: ${pedido.horas_espera} horas sin confirmar
- Teléfono: ${pedido.cliente_telefono}

REGLAS:
1. Mensaje breve (máximo 4 líneas)
2. Tono amigable y profesional
3. Menciona el producto por nombre
4. Incluye el valor del pedido
5. Pide confirmación de dirección de entrega
6. No uses emojis en exceso (máximo 2)
7. Termina con el nombre de la empresa DIZGO como referencia

Genera SOLO el mensaje de WhatsApp, sin explicaciones adicionales.`
    }

    if (agente === 'novedades' && pedido) {
      const tipoNovedad = pedido.novedad_tipo || 'dirección incorrecta'
      inputResumen = `Pedido ${pedido.numero_pedido || pedido.id.slice(0,8)} | ${pedido.cliente_nombre} | Novedad: ${tipoNovedad} | ${pedido.horas_espera}h sin resolver`
      prompt = `Eres el Agente de Novedades de DIZGO, experto en resolver novedades de entrega en dropshipping colombiano.

NOVEDAD ACTIVA:
- Cliente: ${pedido.cliente_nombre}
- Producto: ${pedido.producto_nombre}
- Tipo de novedad: ${tipoNovedad}
- Tiempo sin resolver: ${pedido.horas_espera} horas
- Teléfono: ${pedido.cliente_telefono}

CONTEXTO:
Las novedades más comunes en Colombia son: dirección incorrecta, cliente no contesta, 
coordinar entrega, vecino no recibe, dirección no existe.

TAREA:
1. Genera el mensaje de WhatsApp ideal para resolver esta novedad específica
2. El mensaje debe ser urgente pero amigable
3. Incluye una solución o alternativa concreta
4. Máximo 5 líneas

Genera SOLO el mensaje de WhatsApp listo para enviar.`
    }

    if (agente === 'contable') {
      const liquidez = totalCxpPendiente > 0 ? Math.round(saldoWallet/totalCxpPendiente*100)/100 : 0
      const semLiquidez = liquidez >= 1.5 ? '🟢 Sólida' : liquidez >= 1 ? '🟡 Ajustada' : '🔴 Riesgo'
      inputResumen = `Saldo wallet: ${fmt(saldoWallet)} | CXP pendiente: ${fmt(totalCxpPendiente)} | CXP vencidas: ${cxpVencidas.length} | Liquidez: ${liquidez}`
      prompt = `Eres el Agente Contable de DIZGO, experto financiero en dropshipping latinoamericano.

SITUACIÓN FINANCIERA HOY:
- Saldo disponible (Wallet): ${fmt(saldoWallet)}
- Total cuentas por pagar pendientes: ${fmt(totalCxpPendiente)}
- Cuentas por pagar VENCIDAS: ${cxpVencidas.length} obligaciones
${cxpVencidas.slice(0,3).map(c=>`  • ${c.tercero}: ${fmt(c.valor)} (${c.dias_vencida} días vencida)`).join('\n')}
- Razón de liquidez: ${liquidez} (${semLiquidez})

REGLAS DEL ANÁLISIS:
1. Liquidez ≥ 1.5 = sólida | 1-1.5 = ajustada | < 1 = riesgo crítico
2. CXP vencidas son prioridad inmediata
3. Si el saldo no cubre las CXP vencidas, es alerta roja

TAREA:
Genera un diagnóstico financiero ejecutivo en máximo 6 líneas:
1. Semáforo general con emoji (🟢/🟡/🔴)
2. Situación de liquidez en una frase
3. Acción más urgente (si hay CXP vencidas, cuál pagar primero y por qué)
4. Recomendación del día

Sé directo, usa números reales, sin rodeos.`
    }

    try {
      const res = await fetch('/api/agentes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      })
      const data = await res.json()
      const texto = data.texto || 'Sin respuesta del agente'
      const duracion = Date.now()-t0

      // Guardar log en Supabase
      await supabase.from('agentes_ia_logs').insert({
        tenant_id: tenantId, agente, trigger_tipo: 'manual',
        input_resumen: inputResumen, output_texto: texto,
        pedido_id: pedido?.id || null,
        tokens_usados: data.tokens || 0, duracion_ms: duracion, estado: 'ok',
      })

      setResultado({ agente, texto, pedido_id: pedido?.id })
      loadData()
    } catch(err) {
      await supabase.from('agentes_ia_logs').insert({
        tenant_id: tenantId, agente, trigger_tipo: 'manual',
        input_resumen: inputResumen, output_texto: 'Error al conectar con la IA',
        estado: 'error',
      })
      setResultado({ agente, texto: '❌ Error al conectar con el agente. Verifica la configuración de la API.' })
    } finally {
      setCorriendo(null)
    }
  }

  async function ejecutarContable() { await ejecutarAgente('contable') }

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'300px', color:'#8B96A8', fontSize:'14px' }}>
      Inicializando agentes de IA...
    </div>
  )

  return (
    <div style={{ color:'#E8EDF5', fontFamily:'system-ui,sans-serif' }}>
      <div style={{ marginBottom:'20px' }}>
        <h1 style={{ fontSize:'22px', fontWeight:'700', marginBottom:'4px' }}>🤖 Agentes de IA DIZGO</h1>
        <p style={{ fontSize:'13px', color:'#8B96A8' }}>Fase 1 · Confirmador · Novedades · Contable · Powered by Claude</p>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))', gap:'8px', marginBottom:'16px' }}>
        {[
          { label:'Pedidos sin confirmar (+2h)', v:pedidosSinConfirmar.length, c: pedidosSinConfirmar.length>0?'#F05C5C':'#2DD4A0', icon:'📞' },
          { label:'Novedades sin resolver (+24h)', v:pedidosNovedad.length, c: pedidosNovedad.length>0?'#F5A623':'#2DD4A0', icon:'⚠️' },
          { label:'CXP vencidas', v:cxpVencidas.length, c: cxpVencidas.length>0?'#F05C5C':'#2DD4A0', icon:'📋' },
        ].map((k,i) => (
          <div key={i} style={{ ...s, padding:'14px', borderTop:`2px solid ${k.c}` }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'6px' }}>
              <span style={{ fontSize:'11px', color:'#8B96A8' }}>{k.label}</span><span>{k.icon}</span>
            </div>
            <div style={{ fontSize:'24px', fontWeight:'900', color:k.c }}>{k.v}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'flex', gap:'6px', marginBottom:'16px', flexWrap:'wrap' }}>
        {AGENTES.map(a => (
          <button key={a.key} onClick={()=>setTab(a.key as typeof tab)}
            style={{ padding:'8px 16px', borderRadius:'9px', border:'none', cursor:'pointer', fontSize:'13px', fontWeight:'600',
              background: tab===a.key?a.color:'rgba(255,255,255,0.05)', color: tab===a.key?'#0A0D14':'#8B96A8' }}>
            {a.label}
          </button>
        ))}
      </div>

      {/* ── TAB CONFIRMADOR ── */}
      {tab === 'confirmador' && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))', gap:'16px' }}>
          <div style={{ ...s, overflow:'hidden' }}>
            <div style={{ padding:'12px 16px', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontWeight:'700', marginBottom:'2px' }}>📞 Pedidos sin confirmar — más de 2 horas</div>
              <div style={{ fontSize:'11px', color:'#8B96A8' }}>El agente genera el mensaje WhatsApp ideal para cada caso</div>
            </div>
            {pedidosSinConfirmar.length === 0 ? (
              <div style={{ padding:'30px', textAlign:'center', color:'#5A6478', fontSize:'13px' }}>
                ✅ Sin pedidos pendientes de confirmación
              </div>
            ) : pedidosSinConfirmar.map(p => (
              <div key={p.id} style={{ padding:'12px 16px', borderBottom:'1px solid rgba(255,255,255,0.03)', display:'flex', alignItems:'center', gap:'10px' }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:'13px', fontWeight:'600' }}>{p.cliente_nombre}</div>
                  <div style={{ fontSize:'11px', color:'#8B96A8' }}>{p.producto_nombre} · {fmt(p.pvp)}</div>
                  <div style={{ fontSize:'10px', color:'#F05C5C', marginTop:'2px' }}>⏰ {p.horas_espera}h esperando</div>
                </div>
                <button onClick={() => ejecutarAgente('confirmador', p)}
                  disabled={corriendo === 'confirmador'}
                  style={{ padding:'7px 14px', background:'rgba(61,142,240,0.15)', border:'1px solid rgba(61,142,240,0.3)', borderRadius:'8px', color:'#3D8EF0', cursor: corriendo?'wait':'pointer', fontSize:'11px', fontWeight:'700', whiteSpace:'nowrap' }}>
                  {corriendo==='confirmador' ? '⏳ Generando...' : '🤖 Generar mensaje'}
                </button>
              </div>
            ))}
          </div>

          <div style={{ ...s, padding:'18px' }}>
            <div style={{ fontSize:'12px', fontWeight:'700', color:'#3D8EF0', marginBottom:'12px' }}>💬 Resultado del agente</div>
            {resultado && resultado.agente === 'confirmador' ? (
              <>
                <div style={{ background:'rgba(61,142,240,0.06)', borderRadius:'10px', padding:'14px', border:'1px solid rgba(61,142,240,0.2)', fontSize:'13px', lineHeight:'1.7', color:'#E8EDF5', marginBottom:'12px', whiteSpace:'pre-wrap' }}>
                  {resultado.texto}
                </div>
                <div style={{ display:'flex', gap:'8px' }}>
                  <button onClick={() => navigator.clipboard.writeText(resultado.texto)}
                    style={{ flex:1, padding:'8px', background:'rgba(61,142,240,0.1)', border:'none', borderRadius:'8px', color:'#3D8EF0', cursor:'pointer', fontSize:'12px', fontWeight:'600' }}>
                    📋 Copiar mensaje
                  </button>
                  <a href={`https://wa.me/?text=${encodeURIComponent(resultado.texto)}`} target="_blank" rel="noopener noreferrer"
                    style={{ flex:1, padding:'8px', background:'rgba(45,212,160,0.1)', border:'none', borderRadius:'8px', color:'#2DD4A0', cursor:'pointer', fontSize:'12px', fontWeight:'600', textAlign:'center', textDecoration:'none', display:'block' }}>
                    📱 Abrir en WhatsApp
                  </a>
                </div>
              </>
            ) : (
              <div style={{ fontSize:'12px', color:'#5A6478', padding:'20px', textAlign:'center' }}>
                Selecciona un pedido y presiona &quot;Generar mensaje&quot; para ver el resultado aquí
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB NOVEDADES ── */}
      {tab === 'novedades' && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))', gap:'16px' }}>
          <div style={{ ...s, overflow:'hidden' }}>
            <div style={{ padding:'12px 16px', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontWeight:'700', marginBottom:'2px' }}>⚠️ Novedades sin resolver — más de 24 horas</div>
              <div style={{ fontSize:'11px', color:'#8B96A8' }}>El agente genera el script específico para cada tipo de novedad</div>
            </div>
            {pedidosNovedad.length === 0 ? (
              <div style={{ padding:'30px', textAlign:'center', color:'#5A6478', fontSize:'13px' }}>
                ✅ Sin novedades pendientes
              </div>
            ) : pedidosNovedad.map(p => (
              <div key={p.id} style={{ padding:'12px 16px', borderBottom:'1px solid rgba(255,255,255,0.03)', display:'flex', alignItems:'center', gap:'10px' }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:'13px', fontWeight:'600' }}>{p.cliente_nombre}</div>
                  <div style={{ fontSize:'11px', color:'#8B96A8' }}>{p.novedad_tipo || 'Novedad general'}</div>
                  <div style={{ fontSize:'10px', color:'#F5A623', marginTop:'2px' }}>⏰ {p.horas_espera}h en novedad</div>
                </div>
                <button onClick={() => ejecutarAgente('novedades', p)}
                  disabled={corriendo === 'novedades'}
                  style={{ padding:'7px 14px', background:'rgba(245,166,35,0.15)', border:'1px solid rgba(245,166,35,0.3)', borderRadius:'8px', color:'#F5A623', cursor: corriendo?'wait':'pointer', fontSize:'11px', fontWeight:'700', whiteSpace:'nowrap' }}>
                  {corriendo==='novedades' ? '⏳ Generando...' : '🤖 Resolver novedad'}
                </button>
              </div>
            ))}
          </div>

          <div style={{ ...s, padding:'18px' }}>
            <div style={{ fontSize:'12px', fontWeight:'700', color:'#F5A623', marginBottom:'12px' }}>💬 Script del agente</div>
            {resultado && resultado.agente === 'novedades' ? (
              <>
                <div style={{ background:'rgba(245,166,35,0.06)', borderRadius:'10px', padding:'14px', border:'1px solid rgba(245,166,35,0.2)', fontSize:'13px', lineHeight:'1.7', color:'#E8EDF5', marginBottom:'12px', whiteSpace:'pre-wrap' }}>
                  {resultado.texto}
                </div>
                <div style={{ display:'flex', gap:'8px' }}>
                  <button onClick={() => navigator.clipboard.writeText(resultado.texto)}
                    style={{ flex:1, padding:'8px', background:'rgba(245,166,35,0.1)', border:'none', borderRadius:'8px', color:'#F5A623', cursor:'pointer', fontSize:'12px', fontWeight:'600' }}>
                    📋 Copiar script
                  </button>
                  <a href={`https://wa.me/?text=${encodeURIComponent(resultado.texto)}`} target="_blank" rel="noopener noreferrer"
                    style={{ flex:1, padding:'8px', background:'rgba(45,212,160,0.1)', border:'none', borderRadius:'8px', color:'#2DD4A0', cursor:'pointer', fontSize:'12px', fontWeight:'600', textAlign:'center', textDecoration:'none', display:'block' }}>
                    📱 Abrir en WhatsApp
                  </a>
                </div>
              </>
            ) : (
              <div style={{ fontSize:'12px', color:'#5A6478', padding:'20px', textAlign:'center' }}>
                Selecciona una novedad para que el agente genere el script de resolución
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB CONTABLE ── */}
      {tab === 'contable' && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))', gap:'16px' }}>
          <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
            <div style={{ ...s, padding:'18px' }}>
              <div style={{ fontSize:'12px', fontWeight:'700', color:'#2DD4A0', marginBottom:'14px' }}>📊 Contexto financiero que recibirá el agente</div>
              {[
                { label:'Saldo Wallet (caja disponible)', v:fmt(saldoWallet), c: saldoWallet>500000?'#2DD4A0':'#F5A623' },
                { label:'CXP pendientes total', v:fmt(totalCxpPendiente), c:'#F5A623' },
                { label:'CXP vencidas', v:`${cxpVencidas.length} obligaciones`, c: cxpVencidas.length>0?'#F05C5C':'#2DD4A0' },
              ].map((k,i) => (
                <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'10px 0', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                  <span style={{ fontSize:'12px', color:'#8B96A8' }}>{k.label}</span>
                  <span style={{ fontSize:'14px', fontWeight:'700', color:k.c }}>{k.v}</span>
                </div>
              ))}
              {cxpVencidas.slice(0,3).map((c,i) => (
                <div key={i} style={{ padding:'8px 10px', background:'rgba(240,92,92,0.05)', borderRadius:'8px', marginTop:'6px', display:'flex', justifyContent:'space-between' }}>
                  <span style={{ fontSize:'11px', color:'#F05C5C' }}>⏰ {c.tercero} — {c.concepto.slice(0,30)}</span>
                  <span style={{ fontSize:'11px', fontWeight:'700', color:'#F05C5C' }}>{fmt(c.valor)}</span>
                </div>
              ))}
              <button onClick={ejecutarContable} disabled={corriendo==='contable'}
                style={{ width:'100%', marginTop:'14px', padding:'11px', background: corriendo==='contable'?'rgba(45,212,160,0.1)':'#2DD4A0', border:'none', borderRadius:'9px', color:'#0A0D14', fontWeight:'700', cursor: corriendo==='contable'?'wait':'pointer', fontSize:'13px' }}>
                {corriendo==='contable' ? '⏳ Analizando situación...' : '🤖 Ejecutar diagnóstico financiero'}
              </button>
            </div>
          </div>

          <div style={{ ...s, padding:'18px' }}>
            <div style={{ fontSize:'12px', fontWeight:'700', color:'#2DD4A0', marginBottom:'12px' }}>📋 Diagnóstico del agente contable</div>
            {resultado && resultado.agente === 'contable' ? (
              <>
                <div style={{ background:'rgba(45,212,160,0.06)', borderRadius:'10px', padding:'16px', border:'1px solid rgba(45,212,160,0.2)', fontSize:'13px', lineHeight:'1.9', color:'#E8EDF5', marginBottom:'12px', whiteSpace:'pre-wrap' }}>
                  {resultado.texto}
                </div>
                <button onClick={() => navigator.clipboard.writeText(resultado.texto)}
                  style={{ width:'100%', padding:'8px', background:'rgba(45,212,160,0.1)', border:'none', borderRadius:'8px', color:'#2DD4A0', cursor:'pointer', fontSize:'12px', fontWeight:'600' }}>
                  📋 Copiar diagnóstico
                </button>
              </>
            ) : (
              <div style={{ fontSize:'12px', color:'#5A6478', padding:'20px', textAlign:'center', lineHeight:'1.7' }}>
                Presiona &quot;Ejecutar diagnóstico financiero&quot; para que el agente analice tu situación real y genere un informe ejecutivo
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB CAMPAÑAS ── */}
      {tab === 'campanas' && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))', gap:'16px' }}>
          <div style={{ ...s, overflow:'hidden' }}>
            <div style={{ padding:'12px 16px', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontWeight:'700', marginBottom:'2px' }}>📡 Campañas activas — últimos 30 días</div>
              <div style={{ fontSize:'11px', color:'#8B96A8' }}>El agente detecta campañas con ROAS bajo o CPA fuera de rango</div>
            </div>
            {pautaRows.length === 0 ? (
              <div style={{ padding:'30px', textAlign:'center', color:'#5A6478', fontSize:'13px' }}>Sin datos de pauta en los últimos 30 días</div>
            ) : pautaRows.map(p => {
              const alerta = p.roas < 1.5 || p.cpa > 22000
              return (
                <div key={p.id} style={{ padding:'12px 16px', borderBottom:'1px solid rgba(255,255,255,0.03)', display:'flex', alignItems:'center', gap:'10px', borderLeft:`3px solid ${alerta?'#F05C5C':'#2DD4A0'}` }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:'12px', fontWeight:'600' }}>{p.campana}</div>
                    <div style={{ fontSize:'10px', color:'#8B96A8' }}>{p.plataforma} · {p.fecha} · Inv: ${Math.round(p.inversion/1000)}K</div>
                    <div style={{ display:'flex', gap:'10px', marginTop:'3px' }}>
                      <span style={{ fontSize:'10px', color: p.roas>=1.5?'#2DD4A0':'#F05C5C', fontWeight:'700' }}>ROAS {p.roas}x</span>
                      <span style={{ fontSize:'10px', color: p.cpa<=22000?'#2DD4A0':'#F05C5C', fontWeight:'700' }}>CPA ${Math.round(p.cpa/1000)}K</span>
                      <span style={{ fontSize:'10px', color:'#8B96A8' }}>CTR {p.ctr}%</span>
                    </div>
                  </div>
                  <button onClick={async () => {
                    setCorriendo('campanas'); setResultado(null)
                    const prompt = `Eres el Agente de Campañas de DIZGO. Analiza esta campaña y da una recomendación concreta.\n\nCAMPAÑA: ${p.campana}\nPlataforma: ${p.plataforma}\nInversión: $${Math.round(p.inversion/1000)}K\nResultados: ${p.resultados}\nROAS: ${p.roas}x\nCPA: $${Math.round(p.cpa)}\nCTR: ${p.ctr}%\nCPA máximo del negocio: $18.000\n\nDiagnóstico en máximo 5 líneas:\n1. ¿Qué está pasando en esta campaña?\n2. ¿Cuál es la causa probable?\n3. Acción inmediata (pausar, escalar, cambiar creative, ajustar audiencia)\n4. Proyección si se aplica la acción\n\nSé directo, usa los números reales.`
                    try {
                      const res = await fetch('/api/agentes', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({prompt}) })
                      const data = await res.json()
                      setResultado({ agente:'campanas', texto:data.texto||'' })
                      if (tenantId) await supabase.from('agentes_ia_logs').insert({ tenant_id:tenantId, agente:'campanas', trigger_tipo:'manual', input_resumen:p.campana, output_texto:(data.texto||'').slice(0,500), estado:'ok' })
                    } catch { setResultado({ agente:'campanas', texto:'❌ Error al conectar' }) }
                    setCorriendo(null)
                  }} disabled={corriendo==='campanas'}
                    style={{ padding:'6px 12px', background:`rgba(155,107,255,0.15)`, border:'none', borderRadius:'7px', color:'#9B6BFF', cursor:corriendo?'wait':'pointer', fontSize:'10px', fontWeight:'700', whiteSpace:'nowrap' }}>
                    {corriendo==='campanas'?'⏳':'🤖 Analizar'}
                  </button>
                </div>
              )
            })}
          </div>
          <div style={{ ...s, padding:'18px' }}>
            <div style={{ fontSize:'12px', fontWeight:'700', color:'#9B6BFF', marginBottom:'12px' }}>💬 Diagnóstico del agente</div>
            {resultado?.agente==='campanas' ? (
              <>
                <div style={{ background:'rgba(155,107,255,0.06)', borderRadius:'10px', padding:'14px', border:'1px solid rgba(155,107,255,0.2)', fontSize:'13px', lineHeight:'1.8', color:'#E8EDF5', marginBottom:'12px', whiteSpace:'pre-wrap' }}>{resultado.texto}</div>
                <button onClick={()=>navigator.clipboard.writeText(resultado.texto)} style={{ width:'100%', padding:'8px', background:'rgba(155,107,255,0.1)', border:'none', borderRadius:'8px', color:'#9B6BFF', cursor:'pointer', fontSize:'12px', fontWeight:'600' }}>📋 Copiar</button>
              </>
            ) : <div style={{ fontSize:'12px', color:'#5A6478', padding:'20px', textAlign:'center' }}>Selecciona una campaña para analizarla</div>}
          </div>
        </div>
      )}

      {/* ── TAB INVENTARIO ── */}
      {tab === 'inventario' && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))', gap:'16px' }}>
          <div style={{ ...s, overflow:'hidden' }}>
            <div style={{ padding:'12px 16px', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontWeight:'700', marginBottom:'2px' }}>🏭 Productos con stock bajo o en quiebre</div>
              <div style={{ fontSize:'11px', color:'#8B96A8' }}>El agente sugiere traslado entre bodegas o compra urgente</div>
            </div>
            {stockBajoItems.length === 0 ? (
              <div style={{ padding:'30px', textAlign:'center', color:'#5A6478', fontSize:'13px' }}>✅ Todos los productos tienen stock suficiente</div>
            ) : stockBajoItems.map((item,i) => (
              <div key={i} style={{ padding:'12px 16px', borderBottom:'1px solid rgba(255,255,255,0.03)', display:'flex', alignItems:'center', gap:'10px', borderLeft:'3px solid #F05C5C' }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:'12px', fontWeight:'600' }}>Producto ID: {item.producto_id.slice(0,8)}...</div>
                  <div style={{ fontSize:'10px', color:'#8B96A8' }}>Disponible: {item.cantidad_disponible} u · Mínimo: {item.stock_minimo} u</div>
                </div>
                <button onClick={async () => {
                  setCorriendo('inventario'); setResultado(null)
                  const prompt = `Eres el Agente de Inventario de DIZGO. Analiza esta situación de stock y da una recomendación concreta.\n\nPRODUCTO (ID): ${item.producto_id}\nStock disponible: ${item.cantidad_disponible} unidades\nStock mínimo configurado: ${item.stock_minimo} unidades\nDéficit: ${item.stock_minimo - item.cantidad_disponible} unidades\n\nCONTEXTO DEL NEGOCIO:\n- Tasa de entrega actual: 70%\n- Ritmo de ventas: ~80-100 pedidos/mes\n\nDiagnóstico en máximo 5 líneas:\n1. Urgencia del quiebre (días restantes de stock)\n2. Impacto en ventas si no se actúa\n3. Acción inmediata: ¿traslado desde otra bodega o compra nueva?\n4. Cantidad mínima a reponer para 30 días de operación\n\nSé directo y usa los números reales.`
                  try {
                    const res = await fetch('/api/agentes', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({prompt}) })
                    const data = await res.json()
                    setResultado({ agente:'inventario', texto:data.texto||'' })
                    if (tenantId) await supabase.from('agentes_ia_logs').insert({ tenant_id:tenantId, agente:'inventario', trigger_tipo:'manual', input_resumen:`Stock bajo: ${item.cantidad_disponible}/${item.stock_minimo}`, output_texto:(data.texto||'').slice(0,500), estado:'ok' })
                  } catch { setResultado({ agente:'inventario', texto:'❌ Error al conectar' }) }
                  setCorriendo(null)
                }} disabled={corriendo==='inventario'}
                  style={{ padding:'6px 12px', background:'rgba(240,92,92,0.15)', border:'none', borderRadius:'7px', color:'#F05C5C', cursor:corriendo?'wait':'pointer', fontSize:'10px', fontWeight:'700', whiteSpace:'nowrap' }}>
                  {corriendo==='inventario'?'⏳':'🤖 Analizar'}
                </button>
              </div>
            ))}
          </div>
          <div style={{ ...s, padding:'18px' }}>
            <div style={{ fontSize:'12px', fontWeight:'700', color:'#F05C5C', marginBottom:'12px' }}>💬 Recomendación del agente</div>
            {resultado?.agente==='inventario' ? (
              <>
                <div style={{ background:'rgba(240,92,92,0.06)', borderRadius:'10px', padding:'14px', border:'1px solid rgba(240,92,92,0.2)', fontSize:'13px', lineHeight:'1.8', color:'#E8EDF5', marginBottom:'12px', whiteSpace:'pre-wrap' }}>{resultado.texto}</div>
                <button onClick={()=>navigator.clipboard.writeText(resultado.texto)} style={{ width:'100%', padding:'8px', background:'rgba(240,92,92,0.1)', border:'none', borderRadius:'8px', color:'#F05C5C', cursor:'pointer', fontSize:'12px', fontWeight:'600' }}>📋 Copiar</button>
              </>
            ) : <div style={{ fontSize:'12px', color:'#5A6478', padding:'20px', textAlign:'center' }}>Selecciona un producto con stock bajo para analizarlo</div>}
          </div>
        </div>
      )}

      {/* ── TAB LOGÍSTICO ── */}
      {tab === 'logistico' && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))', gap:'16px' }}>
          <div style={{ ...s, overflow:'hidden' }}>
            <div style={{ padding:'12px 16px', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontWeight:'700', marginBottom:'2px' }}>🚚 Rendimiento por transportadora — 30 días</div>
              <div style={{ fontSize:'11px', color:'#8B96A8' }}>El agente detecta transportadoras con bajo rendimiento y sugiere acciones</div>
            </div>
            {transportadorasMetrica.length === 0 ? (
              <div style={{ padding:'30px', textAlign:'center', color:'#5A6478', fontSize:'13px' }}>Sin datos de transportadora en los pedidos del período</div>
            ) : transportadorasMetrica.map((t,i) => {
              const alerta = t.tasa < 70
              return (
                <div key={i} style={{ padding:'12px 16px', borderBottom:'1px solid rgba(255,255,255,0.03)', display:'flex', alignItems:'center', gap:'10px', borderLeft:`3px solid ${alerta?'#F05C5C':'#2DD4A0'}` }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:'13px', fontWeight:'600' }}>{t.transportadora}</div>
                    <div style={{ fontSize:'10px', color:'#8B96A8' }}>{t.total} pedidos · {t.entregados} entregados</div>
                  </div>
                  <div style={{ textAlign:'right', marginRight:'8px' }}>
                    <div style={{ fontSize:'16px', fontWeight:'800', color:alerta?'#F05C5C':'#2DD4A0' }}>{t.tasa}%</div>
                    <div style={{ fontSize:'9px', color:'#5A6478' }}>tasa entrega</div>
                  </div>
                  <button onClick={async () => {
                    setCorriendo('logistico'); setResultado(null)
                    const prompt = `Eres el Agente Logístico de DIZGO. Analiza el rendimiento de esta transportadora.\n\nTRANSPORTADORA: ${t.transportadora}\nTotal pedidos (30 días): ${t.total}\nEntregados: ${t.entregados}\nTasa de entrega: ${t.tasa}%\nBenchmark Colombia: 75%-82%\n\nDiagnóstico en máximo 5 líneas:\n1. Evaluación del rendimiento vs benchmark\n2. Impacto económico de la tasa actual en el negocio\n3. Causa probable del bajo/alto rendimiento\n4. Acción recomendada (mantener, renegociar, cambiar, escalar)\n5. Ciudades o zonas donde puede estar el problema\n\nSé directo y usa los números reales.`
                    try {
                      const res = await fetch('/api/agentes', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({prompt}) })
                      const data = await res.json()
                      setResultado({ agente:'logistico', texto:data.texto||'' })
                      if (tenantId) await supabase.from('agentes_ia_logs').insert({ tenant_id:tenantId, agente:'logistico', trigger_tipo:'manual', input_resumen:`${t.transportadora}: ${t.tasa}% tasa entrega`, output_texto:(data.texto||'').slice(0,500), estado:'ok' })
                    } catch { setResultado({ agente:'logistico', texto:'❌ Error al conectar' }) }
                    setCorriendo(null)
                  }} disabled={corriendo==='logistico'}
                    style={{ padding:'6px 12px', background:'rgba(45,212,160,0.15)', border:'none', borderRadius:'7px', color:'#2DD4A0', cursor:corriendo?'wait':'pointer', fontSize:'10px', fontWeight:'700', whiteSpace:'nowrap' }}>
                    {corriendo==='logistico'?'⏳':'🤖 Analizar'}
                  </button>
                </div>
              )
            })}
          </div>
          <div style={{ ...s, padding:'18px' }}>
            <div style={{ fontSize:'12px', fontWeight:'700', color:'#2DD4A0', marginBottom:'12px' }}>💬 Diagnóstico logístico</div>
            {resultado?.agente==='logistico' ? (
              <>
                <div style={{ background:'rgba(45,212,160,0.06)', borderRadius:'10px', padding:'14px', border:'1px solid rgba(45,212,160,0.2)', fontSize:'13px', lineHeight:'1.8', color:'#E8EDF5', marginBottom:'12px', whiteSpace:'pre-wrap' }}>{resultado.texto}</div>
                <button onClick={()=>navigator.clipboard.writeText(resultado.texto)} style={{ width:'100%', padding:'8px', background:'rgba(45,212,160,0.1)', border:'none', borderRadius:'8px', color:'#2DD4A0', cursor:'pointer', fontSize:'12px', fontWeight:'600' }}>📋 Copiar</button>
              </>
            ) : <div style={{ fontSize:'12px', color:'#5A6478', padding:'20px', textAlign:'center' }}>Selecciona una transportadora para analizarla</div>}
          </div>
        </div>
      )}

      {/* ── HISTORIAL ── */}
      {logs.length > 0 && (
        <div style={{ ...s, overflow:'hidden', marginTop:'16px' }}>
          <div style={{ padding:'12px 16px', borderBottom:'1px solid rgba(255,255,255,0.06)', fontWeight:'700', fontSize:'13px' }}>
            🕐 Historial de ejecuciones recientes
          </div>
          {logs.slice(0,8).map((log,i) => {
            const ag = AGENTES.find(a=>a.key===log.agente)
            return (
              <div key={i} style={{ padding:'10px 16px', borderBottom:'1px solid rgba(255,255,255,0.03)', display:'flex', alignItems:'center', gap:'12px' }}>
                <span style={{ fontSize:'10px', padding:'2px 8px', borderRadius:'5px', background:`${ag?.color||'#5A6478'}15`, color:ag?.color||'#5A6478', fontWeight:'700', flexShrink:0 }}>{ag?.label||log.agente}</span>
                <div style={{ flex:1, fontSize:'11px', color:'#8B96A8', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{log.output_texto?.slice(0,80)}...</div>
                <span style={{ fontSize:'10px', color:'#5A6478', flexShrink:0 }}>{new Date(log.created_at).toLocaleString('es-CO',{hour:'2-digit',minute:'2-digit',day:'2-digit',month:'2-digit'})}</span>
                <span style={{ fontSize:'10px', color: log.estado==='ok'?'#2DD4A0':'#F05C5C' }}>{log.estado==='ok'?'✅':'❌'}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
