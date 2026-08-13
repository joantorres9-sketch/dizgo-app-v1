'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CONFIG_PAIS, PASOS_SEED, sembrarTenantDemo } from '@/lib/seedDemoTenant'
import { usePermisos } from '@/lib/permisos'

const DOC_LABELS_REGISTRO: Record<string, string> = { id_a: '🪪 Identidad Lado A', id_b: '🪪 Identidad Lado B', doc_legal: '📄 Doc. legal' }

function CamposFormulario({ s, onVerDoc }: { s: any; onVerDoc: (url: string) => void }) {
  const docs: Record<string, string> = s.docs_urls || {}
  const campos = [
    { l: 'Documento', v: s.tipo_doc && s.numero_doc ? `${s.tipo_doc} ${s.numero_doc}` : '—' },
    { l: 'Teléfono', v: s.celular ? `${s.codigo_pais_tel || ''} ${s.celular}`.trim() : '—' },
    { l: 'Email personal', v: s.email_personal || '—' },
    { l: 'Email tienda', v: s.email_tienda || '—' },
    { l: 'Sitio web', v: s.sitio_web || '—' },
    { l: 'País matriz', v: s.pais_matriz || '—' },
    { l: 'Países operación', v: (s.paises_operacion && s.paises_operacion.length > 0) ? s.paises_operacion.join(', ') : '—' },
  ]
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: '6px 12px', padding: '8px 10px', background: 'rgba(255,255,255,0.02)', borderRadius: '7px' }}>
        {campos.map(c => (
          <div key={c.l}>
            <div style={{ fontSize: '9.5px', color: '#5A6478', textTransform: 'uppercase', letterSpacing: '.3px' }}>{c.l}</div>
            <div style={{ fontSize: '11.5px', color: '#E8EDF5' }}>{c.v}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {Object.keys(docs).length === 0 ? (
          <span style={{ fontSize: '10.5px', color: '#5A6478' }}>Sin documentos adjuntos</span>
        ) : Object.entries(docs).map(([key, url]) => (
          <button key={key} onClick={() => onVerDoc(url)}
            style={{ padding: '5px 10px', background: 'rgba(74,158,245,0.08)', border: '1px solid rgba(74,158,245,0.25)', borderRadius: '6px', color: '#4A9EF5', fontSize: '10.5px', fontWeight: '600', cursor: 'pointer' }}>
            {DOC_LABELS_REGISTRO[key] || `📄 ${key.replace('doc_', '')}`}
          </button>
        ))}
      </div>
    </>
  )
}

function rnd(arr: unknown[]) { return arr[Math.floor(Math.random() * arr.length)] }
function rndInt(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min }

export default function AdminPage() {
  const supabase = createClient()
  const { perfil, cargando: cargandoPermisos } = usePermisos()
  const [tenantId, setTenantId] = useState('')
  const [paisCodigo, setPaisCodigo] = useState('COL')
  const [loading, setLoading] = useState(true)
  const [seedActivo, setSeedActivo] = useState(false)
  const [progreso, setProgreso] = useState<Record<string, 'pendiente' | 'cargando' | 'ok' | 'error'>>({})
  const [log, setLog] = useState<string[]>([])
  const [yaHayDatos, setYaHayDatos] = useState(false)
  const [conteos, setConteos] = useState<Record<string, number>>({})
  const [solicitudes, setSolicitudes] = useState<any[]>([])
  const [cargandoSolicitudes, setCargandoSolicitudes] = useState(true)
  const [procesando, setProcesando] = useState<string | null>(null)
  const [tenantPlan, setTenantPlan] = useState('')
  const [borrandoPrueba, setBorrandoPrueba] = useState(false)
  const [autorizado, setAutorizado] = useState<boolean | null>(null)

  const addLog = (msg: string) => setLog(prev => [`${new Date().toLocaleTimeString('es-CO')} — ${msg}`, ...prev.slice(0, 49)])

  // El perfil (rol, tenant_id, es_cortesia) ya lo trajo usePermisos() -- una sola vez, compartido
  // con el resto del dashboard -- así que acá solo se piden datos que esta página necesita y
  // nadie más: el plan del tenant y los 4 conteos.
  const loadEstado = useCallback(async (tid: string) => {
    setLoading(true)
    const { data: tenant } = await supabase.from('tenants').select('plan').eq('id', tid).single()
    setTenantPlan(tenant?.plan || '')

    const [{ count: c1 }, { count: c2 }, { count: c3 }, { count: c4 }] = await Promise.all([
      supabase.from('productos').select('id', { count: 'exact', head: true }).eq('tenant_id', tid),
      supabase.from('pedidos').select('id', { count: 'exact', head: true }).eq('tenant_id', tid),
      supabase.from('pauta').select('id', { count: 'exact', head: true }).eq('tenant_id', tid),
      supabase.from('metas').select('id', { count: 'exact', head: true }).eq('tenant_id', tid),
    ])
    setConteos({ productos: c1 || 0, pedidos: c2 || 0, pauta: c3 || 0, metas: c4 || 0 })
    setYaHayDatos((c2 || 0) > 10)
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    if (cargandoPermisos) return
    if (!perfil?.tenantId) { setLoading(false); setAutorizado(false); return }
    // Superadmin/owner siempre; un `colaborador` solo si es la cuenta de cortesía dueña de este
    // tenant (necesita llegar aquí para su propio botón de "Borrar datos de prueba").
    const puedeEntrar = perfil.rol === 'owner' || perfil.rol === 'superadmin' || perfil.esCortesia === true
    if (!puedeEntrar) { setLoading(false); setAutorizado(false); return }
    setAutorizado(true)
    setTenantId(perfil.tenantId)
    loadEstado(perfil.tenantId)
  }, [cargandoPermisos, perfil, loadEstado])

  const loadSolicitudes = useCallback(async () => {
    setCargandoSolicitudes(true)
    const { data } = await supabase.from('solicitudes_registro').select('*').order('created_at', { ascending: false }).limit(200)
    setSolicitudes(data || [])
    setCargandoSolicitudes(false)
  }, [supabase])

  useEffect(() => { loadSolicitudes() }, [loadSolicitudes])

  async function verDocRegistro(urlGuardada: string) {
    if (!urlGuardada) return
    // docs_urls guarda la URL pública completa, pero el bucket es privado — hay que extraer la
    // ruta relativa y pedir un link firmado, igual que verDoc() en nomina/page.tsx.
    const marcador = '/documentos-registro/'
    const idx = urlGuardada.indexOf(marcador)
    const path = idx >= 0 ? decodeURIComponent(urlGuardada.slice(idx + marcador.length)) : urlGuardada
    const { data, error: err } = await supabase.storage.from('documentos-registro').createSignedUrl(path, 300)
    if (err || !data?.signedUrl) { alert('No se pudo generar el link del documento'); return }
    window.open(data.signedUrl, '_blank')
  }

  async function solicitarAjustes(solicitudId: string) {
    const nota = prompt('¿Qué necesitas que ajuste el solicitante? (se le enviará por correo)')
    if (!nota?.trim()) return
    setProcesando(solicitudId)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/admin/solicitar-ajustes-registro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ solicitudId, nota }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error solicitando ajustes')
      addLog(`✏️ Ajustes solicitados y correo enviado`)
      loadSolicitudes()
    } catch (err: any) {
      alert(err.message || 'Error solicitando ajustes')
    } finally { setProcesando(null) }
  }

  async function accionSolicitud(solicitudId: string, accion: 'aprobar' | 'rechazar') {
    if (accion === 'rechazar' && !confirm('¿Rechazar esta solicitud de registro?')) return
    setProcesando(solicitudId)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/admin/aprobar-registro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ solicitudId, accion }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error procesando la solicitud')
      addLog(accion === 'aprobar' ? `✅ Solicitud aprobada — tenant creado` : `🚫 Solicitud rechazada`)
      loadSolicitudes()
    } catch (err: any) {
      alert(err.message || 'Error procesando la solicitud')
    } finally { setProcesando(null) }
  }

  async function limpiarDatos() {
    if (!tenantId) return
    if (!confirm('¿Eliminar TODOS los datos de demostración? Esta acción no se puede deshacer.')) return
    addLog('🧹 Limpiando datos anteriores...')
    await Promise.all([
      supabase.from('pedidos').delete().eq('tenant_id', tenantId),
      supabase.from('productos').delete().eq('tenant_id', tenantId),
      supabase.from('costos_fijos').delete().eq('tenant_id', tenantId),
      supabase.from('pauta').delete().eq('tenant_id', tenantId),
      supabase.from('wallet_transacciones').delete().eq('tenant_id', tenantId),
      supabase.from('libro_caja').delete().eq('tenant_id', tenantId),
      supabase.from('metas').delete().eq('tenant_id', tenantId),
      supabase.from('bodegas').delete().eq('tenant_id', tenantId),
      supabase.from('inventario').delete().eq('tenant_id', tenantId),
      supabase.from('pqrsf').delete().eq('tenant_id', tenantId),
      supabase.from('alertas').delete().eq('tenant_id', tenantId),
      supabase.from('colaboradores').delete().eq('tenant_id', tenantId),
      supabase.from('nomina_tasas_historico').delete().eq('tenant_id', tenantId),
      supabase.from('nomina_procesos').delete().eq('tenant_id', tenantId),
      supabase.from('inversiones_activos').delete().eq('tenant_id', tenantId),
      supabase.from('inversiones_creditos').delete().eq('tenant_id', tenantId),
      supabase.from('inversiones_capital').delete().eq('tenant_id', tenantId),
      supabase.from('inversiones_socios').delete().eq('tenant_id', tenantId),
      supabase.from('cuentas_por_pagar').delete().eq('tenant_id', tenantId),
      supabase.from('metas_seguimiento_diario').delete().eq('tenant_id', tenantId),
      supabase.from('pe_configuraciones').delete().eq('tenant_id', tenantId),
      supabase.from('whatsapp_store_context').delete().eq('tenant_id', tenantId),
      supabase.from('whatsapp_templates_config').delete().eq('tenant_id', tenantId),
    ])
    addLog('✅ Datos eliminados. Listo para nueva carga.')
    loadEstado(tenantId)
  }

  async function borrarDatosPrueba() {
    if (!tenantId) return
    if (!confirm('Ya exploraste los módulos con datos de prueba. Después de borrar no podrás ver los ejemplos y tu tienda quedará lista para operar con datos reales. ¿Continuar?')) return
    if (!confirm('Esta acción no se puede deshacer. ¿Confirmas que quieres borrar TODOS los datos de prueba ahora?')) return
    setBorrandoPrueba(true)
    addLog('🗑️ Borrando datos de prueba y pasando a datos reales...')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/admin/borrar-datos-prueba', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ tenantId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error borrando datos de prueba')
      addLog('✅ Datos de prueba eliminados. Tu tienda ya está lista para datos reales.')
      await loadEstado(tenantId)
    } catch (err: any) {
      addLog(`❌ ${err.message}`)
    } finally { setBorrandoPrueba(false) }
  }

  async function ejecutarSeed() {
    if (!tenantId) {
      addLog('❌ Error: no se pudo obtener el tenant. Recarga la página e intenta de nuevo.')
      return
    }
    const cfg = CONFIG_PAIS[paisCodigo] || CONFIG_PAIS.COL
    addLog(`🚀 Iniciando seed para ${cfg.nombre}... tenant: ${tenantId.slice(0,8)}`)
    setSeedActivo(true)
    const pasos: Record<string, 'pendiente' | 'cargando' | 'ok' | 'error'> = {}
    PASOS_SEED.forEach(p => { pasos[p.key] = 'pendiente' })
    setProgreso({ ...pasos })
    try {
      await sembrarTenantDemo(supabase, tenantId, paisCodigo, (pasoKey, estado, mensaje) => {
        setProgreso(p => ({ ...p, [pasoKey]: estado }))
        if (mensaje) addLog(mensaje)
      })
      addLog(`🎉 ¡Seed completo para ${cfg.nombre}! Todos los módulos tienen datos reales.`)
    } catch (err) {
      addLog(`❌ Error durante el seed: ${String(err)}`)
    }
    setSeedActivo(false)
    loadEstado(tenantId)
  }

  const solicitudesPendientes = solicitudes.filter(s => s.estado === 'pendiente')
  const solicitudesResueltas = solicitudes.filter(s => s.estado !== 'pendiente')

  const cfg = CONFIG_PAIS[paisCodigo] || CONFIG_PAIS.COL
  const estadoColor = (e: string) => e === 'ok' ? '#2DD4A0' : e === 'error' ? '#F05C5C' : e === 'cargando' ? '#F5A623' : '#5A6478'
  const estadoIcon = (e: string) => e === 'ok' ? '✅' : e === 'error' ? '❌' : e === 'cargando' ? '⏳' : '⬜'

  if (loading || autorizado === null) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px', color: '#8B96A8' }}>
      Cargando Superadmin...
    </div>
  )
  if (!autorizado) return (
    <div style={{ padding: '40px', textAlign: 'center', color: '#8B96A8' }}>No tienes acceso a esta sección.</div>
  )

  return (
    <div style={{ color: '#E8EDF5', fontFamily: 'system-ui,sans-serif' }}>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: '700', marginBottom: '4px' }}>⚙️ Superadmin — Centro de Control</h1>
        <p style={{ fontSize: '13px', color: '#8B96A8' }}>Seed de datos por país · Simulación · Mantenimiento · Solo para administradores</p>
      </div>

      <div style={{ background: '#111520', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '18px 20px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div style={{ fontSize: '12px', fontWeight: '700', color: '#F5A623' }}>📋 SOLICITUDES DE REGISTRO PENDIENTES</div>
          {solicitudesPendientes.length > 0 && <span style={{ fontSize: '11px', fontWeight: '700', color: '#0A0D14', background: '#F5A623', borderRadius: '10px', padding: '2px 10px' }}>{solicitudesPendientes.length}</span>}
        </div>
        {cargandoSolicitudes ? (
          <div style={{ fontSize: '12px', color: '#5A6478', padding: '12px 0' }}>Cargando solicitudes...</div>
        ) : solicitudesPendientes.length === 0 ? (
          <div style={{ fontSize: '12px', color: '#5A6478', padding: '12px 0' }}>No hay solicitudes pendientes.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {solicitudesPendientes.map(s => {
              const esPago = s.plan_elegido && s.plan_elegido !== 'explorador'
              const pagado = s.pago_estado === 'pagado'
              const bloqueado = esPago && !pagado
              return (
                <div key={s.id} style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '10px 14px', background: '#0A0D14', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '9px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: '200px' }}>
                      <div style={{ fontSize: '12px', fontWeight: '700', color: '#E8EDF5' }}>{s.nombre_tienda} <span style={{ color: '#5A6478', fontWeight: '400' }}>· {s.nombres} {s.apellidos}</span></div>
                      <div style={{ fontSize: '11px', color: '#8B96A8' }}>{s.email_personal} · {s.pais_matriz}</div>
                    </div>
                    <span style={{ fontSize: '10px', fontWeight: '700', padding: '3px 9px', borderRadius: '20px', background: esPago ? 'rgba(232,160,32,0.15)' : 'rgba(74,158,245,0.15)', color: esPago ? '#E8A020' : '#4A9EF5', textTransform: 'uppercase' }}>
                      {s.plan_elegido || 'explorador'}
                    </span>
                    {esPago && (
                      <span style={{ fontSize: '10px', fontWeight: '700', padding: '3px 9px', borderRadius: '20px', background: pagado ? 'rgba(45,212,160,0.15)' : 'rgba(240,92,92,0.15)', color: pagado ? '#2DD4A0' : '#F05C5C' }}>
                        {pagado ? `✓ Pagado (${s.proveedor_pago})` : '✕ Sin pago'}
                      </span>
                    )}
                    <button onClick={() => solicitarAjustes(s.id)} disabled={procesando === s.id}
                      style={{ padding: '7px 12px', background: 'rgba(245,166,35,0.1)', border: '1px solid rgba(245,166,35,0.3)', borderRadius: '7px', color: '#F5A623', fontWeight: '700', fontSize: '11px', cursor: 'pointer' }}>
                      ✏️ Solicitar ajustes
                    </button>
                    <button onClick={() => accionSolicitud(s.id, 'aprobar')} disabled={bloqueado || procesando === s.id}
                      title={bloqueado ? 'No se puede aprobar hasta confirmar el pago' : ''}
                      style={{ padding: '7px 14px', background: bloqueado ? 'rgba(45,212,160,0.08)' : '#2DD4A0', border: 'none', borderRadius: '7px', color: bloqueado ? '#2DD4A0' : '#0A0D14', fontWeight: '700', fontSize: '11px', cursor: bloqueado ? 'not-allowed' : 'pointer', opacity: bloqueado ? 0.5 : 1 }}>
                      {procesando === s.id ? '...' : '✓ Aprobar'}
                    </button>
                    <button onClick={() => accionSolicitud(s.id, 'rechazar')} disabled={procesando === s.id}
                      style={{ padding: '7px 14px', background: 'rgba(240,92,92,0.1)', border: '1px solid rgba(240,92,92,0.3)', borderRadius: '7px', color: '#F05C5C', fontWeight: '700', fontSize: '11px', cursor: 'pointer' }}>
                      ✕ Rechazar
                    </button>
                  </div>

                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.04)', marginTop: '2px', paddingTop: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <CamposFormulario s={s} onVerDoc={verDocRegistro} />
                  </div>

                  {s.notas_admin && (
                    <div style={{ fontSize: '10.5px', color: '#F5A623', background: 'rgba(245,166,35,0.06)', borderRadius: '6px', padding: '6px 10px' }}>
                      ✏️ Última nota enviada: {s.notas_admin}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {solicitudesResueltas.length > 0 && (
        <div style={{ background: '#111520', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '18px 20px', marginBottom: '16px' }}>
          <div style={{ fontSize: '12px', fontWeight: '700', color: '#8B96A8', marginBottom: '12px' }}>🗂️ HISTORIAL DE SOLICITUDES ({solicitudesResueltas.length})</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {solicitudesResueltas.map(s => {
              const aprobada = s.estado === 'aprobado'
              return (
                <div key={s.id} style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '10px 14px', background: '#0A0D14', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '9px', opacity: 0.9 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: '200px' }}>
                      <div style={{ fontSize: '12px', fontWeight: '700', color: '#E8EDF5' }}>{s.nombre_tienda} <span style={{ color: '#5A6478', fontWeight: '400' }}>· {s.nombres} {s.apellidos}</span></div>
                      <div style={{ fontSize: '11px', color: '#8B96A8' }}>
                        {s.email_personal} · {s.celular ? `${s.codigo_pais_tel || ''} ${s.celular}` : ''} · {s.pais_matriz}
                        {s.sitio_web ? ` · ${s.sitio_web}` : ''}
                      </div>
                    </div>
                    <span style={{ fontSize: '10px', fontWeight: '700', padding: '3px 9px', borderRadius: '20px', background: 'rgba(74,158,245,0.15)', color: '#4A9EF5', textTransform: 'uppercase' }}>
                      {s.plan_elegido || 'explorador'}
                    </span>
                    {s.proveedor_pago && (
                      <span style={{ fontSize: '10px', fontWeight: '700', padding: '3px 9px', borderRadius: '20px', background: 'rgba(45,212,160,0.15)', color: '#2DD4A0' }}>
                        ✓ Pagado ({s.proveedor_pago})
                      </span>
                    )}
                    <span style={{ fontSize: '10px', fontWeight: '700', padding: '3px 9px', borderRadius: '20px', background: aprobada ? 'rgba(45,212,160,0.15)' : 'rgba(240,92,92,0.15)', color: aprobada ? '#2DD4A0' : '#F05C5C' }}>
                      {aprobada ? '✓ Aprobado' : '✕ Rechazado'} · {s.fecha_aprobacion ? new Date(s.fecha_aprobacion).toLocaleDateString('es-CO') : ''}
                    </span>
                  </div>
                  <CamposFormulario s={s} onVerDoc={verDocRegistro} />
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: '8px', marginBottom: '16px' }}>
        {[
          { l: 'Productos', v: conteos.productos || 0, c: '#3D8EF0' },
          { l: 'Pedidos', v: conteos.pedidos || 0, c: '#2DD4A0' },
          { l: 'Campañas pauta', v: conteos.pauta || 0, c: '#9B6BFF' },
          { l: 'Metas', v: conteos.metas || 0, c: '#F5A623' },
        ].map((k, i) => (
          <div key={i} style={{ background: '#111520', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '14px', borderTop: `2px solid ${k.c}` }}>
            <div style={{ fontSize: '10px', color: '#8B96A8', marginBottom: '4px' }}>{k.l}</div>
            <div style={{ fontSize: '24px', fontWeight: '900', color: k.c }}>{k.v.toLocaleString()}</div>
          </div>
        ))}
      </div>

      <div className="dz-grid-side-l" style={{ ['--side-w' as any]:'380px', gap: '16px' }}>
        <div style={{ background: '#111520', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '20px' }}>
          <div style={{ fontSize: '12px', fontWeight: '700', color: '#F5A623', marginBottom: '16px' }}>🌱 SEED DE DATOS DEMO</div>

          <div style={{ marginBottom: '14px' }}>
            <label style={{ fontSize: '11px', color: '#5A6478', display: 'block', marginBottom: '6px' }}>País del tenant</label>
            <select value={paisCodigo} onChange={e => setPaisCodigo(e.target.value)}
              style={{ width: '100%', background: '#0A0D14', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#E8EDF5', padding: '9px 12px', fontSize: '13px', outline: 'none' }}>
              {Object.entries(CONFIG_PAIS).map(([code, c]) => (
                <option key={code} value={code}>{c.nombre} ({c.moneda})</option>
              ))}
            </select>
          </div>

          <div style={{ padding: '12px', background: 'rgba(45,212,160,0.06)', borderRadius: '10px', marginBottom: '14px', fontSize: '11px', color: '#8B96A8', lineHeight: '1.7' }}>
            <div style={{ fontWeight: '700', color: '#2DD4A0', marginBottom: '4px' }}>📦 Se cargarán datos para {cfg.nombre}:</div>
            <div>• 3 productos con precios en {cfg.moneda}</div>
            <div>• ~528 pedidos en: {cfg.ciudades.slice(0, 4).join(', ')}</div>
            <div>• Transportadoras: {cfg.transportadoras.slice(0, 2).join(', ')}</div>
            <div>• 6 meses de operación (Ene–Jun 2026)</div>
          </div>

          {yaHayDatos && (
            <div style={{ padding: '10px 12px', background: 'rgba(245,166,35,0.08)', borderRadius: '8px', marginBottom: '12px', fontSize: '11px', color: '#F5A623' }}>
              ⚠️ Ya hay {conteos.pedidos?.toLocaleString()} pedidos cargados. Si ejecutas el seed se agregarán más datos. Usa &quot;Limpiar&quot; primero si quieres empezar de cero.
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
            <button onClick={ejecutarSeed} disabled={seedActivo}
              style={{ flex: 2, padding: '11px', background: seedActivo ? 'rgba(45,212,160,0.15)' : '#2DD4A0', border: 'none', borderRadius: '9px', color: seedActivo ? '#2DD4A0' : '#0A0D14', fontWeight: '800', cursor: seedActivo ? 'wait' : 'pointer', fontSize: '13px' }}>
              {seedActivo ? '⏳ Cargando datos...' : '🌱 Cargar datos demo'}
            </button>
            <button onClick={limpiarDatos} disabled={seedActivo}
              style={{ flex: 1, padding: '11px', background: 'rgba(240,92,92,0.1)', border: '1px solid rgba(240,92,92,0.3)', borderRadius: '9px', color: '#F05C5C', fontWeight: '700', cursor: seedActivo ? 'not-allowed' : 'pointer', fontSize: '13px' }}>
              🗑️ Limpiar
            </button>
          </div>

          {tenantPlan === 'cortesia' && (
            <div style={{ marginTop: '10px', padding: '14px', background: 'rgba(240,92,92,0.08)', border: '1.5px solid rgba(240,92,92,0.35)', borderRadius: '10px' }}>
              <div style={{ fontSize: '11.5px', fontWeight: '700', color: '#F05C5C', marginBottom: '6px' }}>🎁 Este es un tenant de cortesía (modo prueba)</div>
              <div style={{ fontSize: '10.5px', color: '#8B96A8', marginBottom: '10px', lineHeight: '1.6' }}>
                Cuando termines de explorar los módulos con datos de prueba, usa este botón para dejar tu tienda lista y operar con datos reales.
              </div>
              <button onClick={borrarDatosPrueba} disabled={borrandoPrueba}
                style={{ width: '100%', padding: '11px', background: '#F05C5C', border: 'none', borderRadius: '9px', color: '#fff', fontWeight: '800', cursor: borrandoPrueba ? 'wait' : 'pointer', fontSize: '13px' }}>
                {borrandoPrueba ? '⏳ Borrando datos de prueba...' : '🗑️ Borrar datos de prueba y empezar con datos reales'}
              </button>
            </div>
          )}

          <div style={{ marginTop: '14px' }}>
            <div style={{ fontSize: '11px', color: '#5A6478', marginBottom: '8px' }}>PROGRESO POR MÓDULO:</div>
            {PASOS_SEED.map(paso => (
              <div key={paso.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                <span style={{ fontSize: '13px' }}>{estadoIcon(progreso[paso.key] || 'pendiente')}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '11px', fontWeight: '600', color: estadoColor(progreso[paso.key] || 'pendiente') }}>{paso.label}</div>
                  <div style={{ fontSize: '10px', color: '#5A6478' }}>{paso.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: '#111520', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', fontWeight: '700', fontSize: '13px' }}>
            🖥️ Log de operaciones
          </div>
          <div style={{ padding: '12px 16px', height: '480px', overflowY: 'auto', fontFamily: 'monospace' }}>
            {log.length === 0 ? (
              <div style={{ color: '#5A6478', fontSize: '12px', textAlign: 'center', padding: '40px' }}>
                El log aparecerá aquí cuando ejecutes el seed...
              </div>
            ) : log.map((l, i) => (
              <div key={i} style={{ fontSize: '11px', color: l.includes('✅') ? '#2DD4A0' : l.includes('❌') ? '#F05C5C' : l.includes('🎉') ? '#F5A623' : '#8B96A8', padding: '3px 0', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                {l}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
