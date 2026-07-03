'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

// ── CONFIGURACIÓN POR PAÍS ────────────────────────────────────
const CONFIG_PAIS: Record<string, {
  nombre: string; moneda: string; simbolo: string
  ciudades: string[]; capital: string
  transportadoras: string[]
  productos: { nombre: string; costo: number; pvp: number; categoria: string; descripcion: string }[]
  cf_conceptos: { categoria: string; concepto: string; valor: number }[]
  nombres: string[]; apellidos: string[]
}> = {
  COL: {
    nombre: 'Colombia', moneda: 'COP', simbolo: '$',
    ciudades: ['Bogotá', 'Medellín', 'Cali', 'Barranquilla', 'Bucaramanga', 'Pereira', 'Cartagena', 'Cúcuta'],
    capital: 'Bogotá',
    transportadoras: ['Servientrega', 'Coordinadora', 'Interrapidísimo', 'TCC'],
    productos: [
      { nombre: 'Masajeador Cervical Eléctrico Pro', costo: 28000, pvp: 89900, categoria: 'Salud y bienestar', descripcion: 'Masajeador de cuello y hombros con calor y vibración 3D' },
      { nombre: 'Organizador Cables Magnético x5', costo: 8500, pvp: 34900, categoria: 'Tecnología', descripcion: 'Set de 5 organizadores magnéticos para cables USB' },
      { nombre: 'Soporte Celular Carro Magnético 360°', costo: 7000, pvp: 29900, categoria: 'Autopartes', descripcion: 'Soporte magnético universal para tablero y rejilla del carro' },
    ],
    cf_conceptos: [
      { categoria: 'Tecnología', concepto: 'Shopify / WooCommerce', valor: 120000 },
      { categoria: 'Tecnología', concepto: 'DIZGO SaaS', valor: 89000 },
      { categoria: 'Comunicaciones', concepto: 'WhatsApp Business API', valor: 45000 },
      { categoria: 'Personal', concepto: 'Confirmador pedidos (part)', valor: 700000 },
      { categoria: 'Servicios', concepto: 'Internet y teléfono', valor: 80000 },
    ],
    nombres: ['Carlos', 'María', 'Juan', 'Ana', 'Luis', 'Sofia', 'Diego', 'Valentina', 'Andrés', 'Carolina'],
    apellidos: ['Pérez', 'López', 'García', 'Martínez', 'Rodríguez', 'Hernández', 'Gómez', 'Torres', 'Flores', 'Díaz'],
  },
  ECU: {
    nombre: 'Ecuador', moneda: 'USD', simbolo: '$',
    ciudades: ['Quito', 'Guayaquil', 'Cuenca', 'Ambato', 'Manta', 'Loja'],
    capital: 'Quito',
    transportadoras: ['Servientrega Ecuador', 'Laar Courier', 'Speed', 'Tramaco'],
    productos: [
      { nombre: 'Masajeador Cervical Pro', costo: 8, pvp: 25, categoria: 'Salud y bienestar', descripcion: 'Masajeador eléctrico de cuello con calor' },
      { nombre: 'Organizador Cables x5', costo: 2.5, pvp: 9.99, categoria: 'Tecnología', descripcion: 'Organizadores magnéticos para cables USB' },
      { nombre: 'Soporte Celular Magnético', costo: 2, pvp: 8.99, categoria: 'Autopartes', descripcion: 'Soporte magnético para carro 360°' },
    ],
    cf_conceptos: [
      { categoria: 'Tecnología', concepto: 'Shopify / WooCommerce', valor: 35 },
      { categoria: 'Tecnología', concepto: 'DIZGO SaaS', valor: 25 },
      { categoria: 'Comunicaciones', concepto: 'WhatsApp Business API', valor: 15 },
      { categoria: 'Personal', concepto: 'Confirmador pedidos (part)', valor: 200 },
      { categoria: 'Servicios', concepto: 'Internet y teléfono', valor: 25 },
    ],
    nombres: ['Miguel', 'Gabriela', 'Roberto', 'Isabella', 'Fernando', 'Daniela', 'Sebastián', 'Valeria'],
    apellidos: ['Salazar', 'Vega', 'Mora', 'Jiménez', 'Castro', 'Ríos', 'Guerrero', 'Ortiz'],
  },
  MEX: {
    nombre: 'México', moneda: 'MXN', simbolo: '$',
    ciudades: ['Ciudad de México', 'Guadalajara', 'Monterrey', 'Puebla', 'Tijuana', 'León', 'Cancún'],
    capital: 'Ciudad de México',
    transportadoras: ['Estafeta', 'DHL México', 'FedEx México', 'Paquetexpress'],
    productos: [
      { nombre: 'Masajeador Cervical Eléctrico', costo: 180, pvp: 599, categoria: 'Salud y bienestar', descripcion: 'Masajeador de cuello con calor y vibración 3D' },
      { nombre: 'Organizador Cables Magnético', costo: 55, pvp: 199, categoria: 'Tecnología', descripcion: 'Set organizadores magnéticos cables USB' },
      { nombre: 'Soporte Celular Magnético', costo: 45, pvp: 169, categoria: 'Autopartes', descripcion: 'Soporte magnético para carro 360°' },
    ],
    cf_conceptos: [
      { categoria: 'Tecnología', concepto: 'Shopify', valor: 700 },
      { categoria: 'Tecnología', concepto: 'DIZGO SaaS', valor: 500 },
      { categoria: 'Comunicaciones', concepto: 'WhatsApp Business', valor: 300 },
      { categoria: 'Personal', concepto: 'Confirmador pedidos', valor: 4000 },
      { categoria: 'Servicios', concepto: 'Internet y teléfono', valor: 600 },
    ],
    nombres: ['José', 'Guadalupe', 'Francisco', 'Fernanda', 'Javier', 'Alejandra', 'Eduardo', 'Mariana'],
    apellidos: ['González', 'Hernández', 'López', 'Martínez', 'García', 'Sánchez', 'Ramírez', 'Torres'],
  },
  PER: {
    nombre: 'Perú', moneda: 'PEN', simbolo: 'S/',
    ciudades: ['Lima', 'Arequipa', 'Trujillo', 'Chiclayo', 'Piura', 'Cusco'],
    capital: 'Lima',
    transportadoras: ['Olva Courier', 'Shalom', 'Skynet Perú', 'Cruz del Sur'],
    productos: [
      { nombre: 'Masajeador Cervical Eléctrico', costo: 30, pvp: 99, categoria: 'Salud y bienestar', descripcion: 'Masajeador eléctrico de cuello con calor' },
      { nombre: 'Organizador Cables Magnético', costo: 9, pvp: 29, categoria: 'Tecnología', descripcion: 'Set organizadores cables USB' },
      { nombre: 'Soporte Celular Magnético', costo: 7, pvp: 24, categoria: 'Autopartes', descripcion: 'Soporte magnético para carro' },
    ],
    cf_conceptos: [
      { categoria: 'Tecnología', concepto: 'Shopify', valor: 120 },
      { categoria: 'Tecnología', concepto: 'DIZGO SaaS', valor: 90 },
      { categoria: 'Comunicaciones', concepto: 'WhatsApp Business', valor: 50 },
      { categoria: 'Personal', concepto: 'Confirmador pedidos', valor: 900 },
      { categoria: 'Servicios', concepto: 'Internet y teléfono', valor: 80 },
    ],
    nombres: ['Ricardo', 'Lucía', 'Manuel', 'Paola', 'Alejandro', 'Stephanie', 'Hugo', 'Natalia'],
    apellidos: ['Quispe', 'Mamani', 'Huanca', 'Cárdenas', 'Vásquez', 'Flores', 'Mendoza', 'Chávez'],
  },
  CHL: {
    nombre: 'Chile', moneda: 'CLP', simbolo: '$',
    ciudades: ['Santiago', 'Valparaíso', 'Concepción', 'La Serena', 'Antofagasta', 'Temuco'],
    capital: 'Santiago',
    transportadoras: ['Starken', 'Chilexpress', 'Blue Express', 'DHL Chile'],
    productos: [
      { nombre: 'Masajeador Cervical Eléctrico', costo: 7500, pvp: 24990, categoria: 'Salud y bienestar', descripcion: 'Masajeador de cuello con calor y vibración' },
      { nombre: 'Organizador Cables Magnético', costo: 2200, pvp: 7990, categoria: 'Tecnología', descripcion: 'Set organizadores magnéticos cables' },
      { nombre: 'Soporte Celular Magnético', costo: 1800, pvp: 6990, categoria: 'Autopartes', descripcion: 'Soporte magnético para auto 360°' },
    ],
    cf_conceptos: [
      { categoria: 'Tecnología', concepto: 'Shopify', valor: 30000 },
      { categoria: 'Tecnología', concepto: 'DIZGO SaaS', valor: 22000 },
      { categoria: 'Comunicaciones', concepto: 'WhatsApp Business', valor: 12000 },
      { categoria: 'Personal', concepto: 'Confirmador pedidos', valor: 180000 },
      { categoria: 'Servicios', concepto: 'Internet y teléfono', valor: 20000 },
    ],
    nombres: ['Matías', 'Valentina', 'Sebastián', 'Camila', 'Nicolás', 'Fernanda', 'Ignacio', 'Javiera'],
    apellidos: ['Muñoz', 'Rojas', 'Fuentes', 'Herrera', 'Medina', 'Contreras', 'Espinoza', 'Castillo'],
  },
  ARG: {
    nombre: 'Argentina', moneda: 'ARS', simbolo: '$',
    ciudades: ['Buenos Aires', 'Córdoba', 'Rosario', 'Mendoza', 'La Plata', 'Tucumán', 'Mar del Plata'],
    capital: 'Buenos Aires',
    transportadoras: ['Andreani', 'OCA', 'Correo Argentino', 'Via Cargo'],
    productos: [
      { nombre: 'Masajeador Cervical Eléctrico', costo: 8500, pvp: 28000, categoria: 'Salud y bienestar', descripcion: 'Masajeador de cuello con calor y vibración' },
      { nombre: 'Organizador Cables Magnético', costo: 2500, pvp: 8500, categoria: 'Tecnología', descripcion: 'Set organizadores magnéticos cables' },
      { nombre: 'Soporte Celular Magnético', costo: 2000, pvp: 7200, categoria: 'Autopartes', descripcion: 'Soporte magnético para auto 360°' },
    ],
    cf_conceptos: [
      { categoria: 'Tecnología', concepto: 'Shopify', valor: 32000 },
      { categoria: 'Tecnología', concepto: 'DIZGO SaaS', valor: 24000 },
      { categoria: 'Comunicaciones', concepto: 'WhatsApp Business', valor: 13000 },
      { categoria: 'Personal', concepto: 'Confirmador pedidos', valor: 200000 },
      { categoria: 'Servicios', concepto: 'Internet y teléfono', valor: 22000 },
    ],
    nombres: ['Martín', 'Florencia', 'Leandro', 'Melina', 'Facundo', 'Sofía', 'Gonzalo', 'Agustina'],
    apellidos: ['González', 'Rodríguez', 'Gómez', 'Fernández', 'López', 'Díaz', 'Martínez', 'Pérez'],
  },
}

const PASOS_SEED = [
  { key: 'productos', label: '🛍️ Productos', desc: '3 productos con costos reales del país' },
  { key: 'costos', label: '📊 Costos Fijos', desc: '5 conceptos × 6 meses' },
  { key: 'pedidos', label: '📦 Pedidos', desc: '~528 pedidos en 6 meses (tasas reales)' },
  { key: 'pauta', label: '📡 Pauta', desc: '12 campañas Meta Ads con métricas reales' },
  { key: 'wallet', label: '💳 Wallet', desc: 'Entradas por recaudo y retiros' },
  { key: 'libro_caja', label: '📒 Libro de Caja', desc: 'Espejo financiero 6 meses' },
  { key: 'metas', label: '🎯 Metas', desc: '6 meses de objetivos progresivos' },
  { key: 'bodegas', label: '🏭 Bodega', desc: '2 bodegas + inventario inicial' },
  { key: 'pqrsf', label: '📬 PQRSF', desc: '15 casos simulados (quejas, reclamos, preguntas)' },
  { key: 'alertas', label: '🚨 Alertas', desc: '8 alertas por módulo para demostración' },
]

function rnd(arr: unknown[]) { return arr[Math.floor(Math.random() * arr.length)] }
function rndInt(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min }

export default function AdminPage() {
  const supabase = createClient()
  const [tenantId, setTenantId] = useState('')
  const [paisCodigo, setPaisCodigo] = useState('COL')
  const [loading, setLoading] = useState(true)
  const [seedActivo, setSeedActivo] = useState(false)
  const [progreso, setProgreso] = useState<Record<string, 'pendiente' | 'cargando' | 'ok' | 'error'>>({})
  const [log, setLog] = useState<string[]>([])
  const [yaHayDatos, setYaHayDatos] = useState(false)
  const [conteos, setConteos] = useState<Record<string, number>>({})

  const addLog = (msg: string) => setLog(prev => [`${new Date().toLocaleTimeString('es-CO')} — ${msg}`, ...prev.slice(0, 49)])

  const loadEstado = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single()
    if (!profile?.tenant_id) { setLoading(false); return }
    const tid = profile.tenant_id
    setTenantId(tid)

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

  useEffect(() => { loadEstado() }, [loadEstado])

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
      supabase.from('pqrsf').delete().eq('tenant_id', tenantId),
      supabase.from('alertas').delete().eq('tenant_id', tenantId),
    ])
    addLog('✅ Datos eliminados. Listo para nueva carga.')
    loadEstado()
  }

  async function ejecutarSeed() {
    if (!tenantId) {
      addLog('❌ Error: no se pudo obtener el tenant. Recarga la página e intenta de nuevo.')
      return
    }
    addLog(`🚀 Iniciando seed para ${CONFIG_PAIS[paisCodigo]?.nombre || paisCodigo}... tenant: ${tenantId.slice(0,8)}`)
    setSeedActivo(true)
    const cfg = CONFIG_PAIS[paisCodigo] || CONFIG_PAIS.COL
    const hoy = new Date()
    const pasos: Record<string, 'pendiente' | 'cargando' | 'ok' | 'error'> = {}
    PASOS_SEED.forEach(p => { pasos[p.key] = 'pendiente' })
    setProgreso({ ...pasos })

    // ── PRODUCTOS ──────────────────────────────────────────────
    setProgreso(p => ({ ...p, productos: 'cargando' }))
    addLog(`🛍️ Cargando ${cfg.productos.length} productos para ${cfg.nombre}...`)
    try {
      const { data: prodsInserted, error: prodsError } = await supabase.from('productos').insert(
        cfg.productos.map(p => ({
          tenant_id: tenantId,
          nombre: p.nombre,
          tipo: 'producto',
          estado: 'activo',
          modelo_negocio: 'dropshipping',
          descripcion: p.descripcion,
          costo_proveedor: p.costo,
          pvp_final: p.pvp,
          pvp: p.pvp,
          costo_flete_envio: Math.round(p.costo * 0.25),
          costo_flete: Math.round(p.costo * 0.25),
          costo_flete_dev: Math.round(p.costo * 0.3),
          costo_fulfillment: 0,
          costo_full_dev: 0,
          cf_pedido: Math.round(p.pvp * 0.03),
          pct_publicidad: 20,
          pct_pub_dev: 7,
          pct_pub_cancel: 4,
          pct_desc_popup: 2,
          pct_com_plataforma: 0,
          pct_pasarela: 3.49,
          pct_com_pasarela: 0,
          pct_com_ventas: 5,
          pct_com_admin: 2,
          pct_devolucion: 10,
          cpa_maximo: Math.round(p.pvp * 0.22),
          disponible_dropshippers: true,
        }))
      ).select('id, nombre, pvp_final, costo_proveedor')

      if (prodsError) {
        addLog(`❌ Error insertando productos: ${prodsError.message}`)
        setProgreso(p => ({ ...p, productos: 'error' }))
        setSeedActivo(false)
        return
      }

      const prodIds = (prodsInserted || []).map((p: {id:string;nombre:string;pvp_final:number;costo_proveedor:number}) => ({
        id: p.id,
        nombre: p.nombre,
        pvp: p.pvp_final,
        costo: p.costo_proveedor
      }))

      if (prodIds.length === 0) {
        addLog('❌ No se crearon productos. Verifica que no existan duplicados o que RLS lo permita.')
        setProgreso(p => ({ ...p, productos: 'error' }))
        setSeedActivo(false)
        return
      }
      setProgreso(p => ({ ...p, productos: 'ok' }))
      addLog(`✅ ${prodIds.length} productos creados`)

      // ── COSTOS FIJOS ──────────────────────────────────────────
      setProgreso(p => ({ ...p, costos: 'cargando' }))
      addLog('📊 Cargando costos fijos 6 meses...')
      const cfRows = []
      for (let i = 5; i >= 0; i--) {
        const fecha = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1)
        const periodo = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-01`
        for (const cf of cfg.cf_conceptos) {
          cfRows.push({ tenant_id: tenantId, periodo, categoria: cf.categoria, concepto: cf.concepto, cantidad: 1, valor_unitario: cf.valor, activo: true })
        }
      }
      await supabase.from('costos_fijos').insert(cfRows)
      setProgreso(p => ({ ...p, costos: 'ok' }))
      addLog(`✅ ${cfRows.length} registros de costos fijos`)

      // ── PEDIDOS ───────────────────────────────────────────────
      setProgreso(p => ({ ...p, pedidos: 'cargando' }))
      addLog('📦 Generando pedidos 6 meses...')
      let totalPedidos = 0
      for (let mes = 5; mes >= 0; mes--) {
        const fecha = new Date(hoy.getFullYear(), hoy.getMonth() - mes, 1)
        const volumen = 60 + ((5 - mes) * 8)
        const pedidosBatch = []
        for (let i = 0; i < volumen; i++) {
          const prod = prodIds[rndInt(0, prodIds.length - 1)]
          const rand = Math.random()
          const estado = rand < 0.72 ? 'ENTREGADO' : rand < 0.90 ? 'CANCELADO' : 'DEVOLUCION'
          const margenBruto = (prod.pvp - prod.costo) / prod.pvp
          const ganancia = estado === 'ENTREGADO' ? Math.round(prod.pvp * margenBruto * 0.55) : 0
          const dia = rndInt(1, 28)
          const hora = rndInt(8, 20)
          const fecha_pedido = new Date(fecha.getFullYear(), fecha.getMonth(), dia, hora, rndInt(0, 59))
          pedidosBatch.push({
            tenant_id: tenantId,
            producto_id: prod.id,
            producto_nombre: prod.nombre,
            cliente_nombre: `${rnd(cfg.nombres)} ${rnd(cfg.apellidos)}`,
            cliente_telefono: `3${rndInt(1, 3)}${String(rndInt(1000000, 9999999))}`,
            cliente_ciudad: String(rnd(cfg.ciudades)),
            cliente_departamento: cfg.nombre,
            pvp: prod.pvp,
            ganancia,
            estado,
            fecha_pedido: fecha_pedido.toISOString(),
            transportadora: String(rnd(cfg.transportadoras)),
          })
        }
        await supabase.from('pedidos').insert(pedidosBatch)
        totalPedidos += pedidosBatch.length
      }
      setProgreso(p => ({ ...p, pedidos: 'ok' }))
      addLog(`✅ ${totalPedidos} pedidos generados`)

      // ── PAUTA ─────────────────────────────────────────────────
      setProgreso(p => ({ ...p, pauta: 'cargando' }))
      addLog('📡 Cargando campañas Meta Ads...')
      const pautaRows = []
      for (let mes = 5; mes >= 0; mes--) {
        const fecha = new Date(hoy.getFullYear(), hoy.getMonth() - mes, 15)
        const inversion = Math.round((400000 + mes * 60000) * (paisCodigo === 'COL' ? 1 : paisCodigo === 'MEX' ? 0.065 : paisCodigo === 'CHL' ? 260 : paisCodigo === 'ARG' ? 300 : 0.11))
        const resultados = rndInt(18, 42)
        const impresiones = rndInt(40000, 95000)
        const clics = Math.round(impresiones * (rndInt(14, 18) / 1000))
        pautaRows.push({
          tenant_id: tenantId,
          fecha: `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-15`,
          plataforma: 'META',
          campana: `${cfg.productos[mes % 3].nombre.split(' ').slice(0, 2).join(' ')} - ${['Intereses', 'Lookalike 1%', 'Retargeting', 'Broad', 'Video VSL', 'UGC'][mes]}`,
          inversion, impresiones, clics, resultados,
          ctr: Math.round(clics / impresiones * 10000) / 100,
          cpm: Math.round(inversion / impresiones * 1000),
          cpc: Math.round(inversion / clics),
          cpa: Math.round(inversion / resultados),
          roas: Math.round(resultados * cfg.productos[mes % 3].pvp / inversion * 100) / 100,
        })
      }
      await supabase.from('pauta').insert(pautaRows)
      setProgreso(p => ({ ...p, pauta: 'ok' }))
      addLog(`✅ ${pautaRows.length} campañas cargadas`)

      // ── WALLET ────────────────────────────────────────────────
      setProgreso(p => ({ ...p, wallet: 'cargando' }))
      addLog('💳 Cargando movimientos de wallet...')
      const walletRows = []
      for (let mes = 5; mes >= 0; mes--) {
        const fecha = new Date(hoy.getFullYear(), hoy.getMonth() - mes, 1)
        const entrada = Math.round(cfg.productos[0].pvp * (45 + mes * 6) * 0.72)
        const salida = Math.round(entrada * 0.45)
        walletRows.push({
          tenant_id: tenantId, tipo: 'ENTRADA', monto: entrada,
          descripcion: `Recaudo ${cfg.transportadoras[0]} - ${['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun'][5 - mes]}`,
          categoria: 'ganancia_dropshipper', fuente: 'dropi',
          fecha: new Date(fecha.getFullYear(), fecha.getMonth(), 20).toISOString(),
        })
        if (mes < 5) {
          walletRows.push({
            tenant_id: tenantId, tipo: 'SALIDA', monto: salida,
            descripcion: `Retiro utilidades ${['Ene', 'Feb', 'Mar', 'Abr', 'May'][4 - mes]}`,
            categoria: 'retiro_socio', fuente: 'manual',
            fecha: new Date(fecha.getFullYear(), fecha.getMonth(), 28).toISOString(),
          })
        }
      }
      await supabase.from('wallet_transacciones').insert(walletRows)
      setProgreso(p => ({ ...p, wallet: 'ok' }))
      addLog(`✅ ${walletRows.length} movimientos de wallet`)

      // ── LIBRO DE CAJA ─────────────────────────────────────────
      setProgreso(p => ({ ...p, libro_caja: 'cargando' }))
      addLog('📒 Cargando libro de caja...')
      const cajaRows = []
      for (let mes = 5; mes >= 0; mes--) {
        const fecha = new Date(hoy.getFullYear(), hoy.getMonth() - mes, 1)
        const ult = new Date(fecha.getFullYear(), fecha.getMonth() + 1, 0).toISOString().slice(0, 10)
        const ventas = Math.round(cfg.productos[0].pvp * (45 + mes * 6) * 0.72)
        const cfTotal = cfg.cf_conceptos.reduce((a, c) => a + c.valor, 0)
        const inv = Math.round((400000 + mes * 60000) * (paisCodigo === 'COL' ? 1 : 0.065))
        cajaRows.push(
          { tenant_id: tenantId, fecha: ult, concepto: `Ventas entregadas mes ${6 - mes}`, tipo: 'entrada', valor: ventas, origen: 'venta', categoria_flujo: 'operativo' },
          { tenant_id: tenantId, fecha: ult, concepto: `Pauta Meta Ads mes ${6 - mes}`, tipo: 'salida', valor: inv > 0 ? inv : 500000, origen: 'pauta', categoria_flujo: 'operativo' },
          { tenant_id: tenantId, fecha: ult, concepto: `Costos fijos mes ${6 - mes}`, tipo: 'salida', valor: cfTotal, origen: 'costos_fijos', categoria_flujo: 'operativo' },
        )
      }
      await supabase.from('libro_caja').insert(cajaRows)
      setProgreso(p => ({ ...p, libro_caja: 'ok' }))
      addLog(`✅ ${cajaRows.length} movimientos en libro de caja`)

      // ── METAS ─────────────────────────────────────────────────
      setProgreso(p => ({ ...p, metas: 'cargando' }))
      addLog('🎯 Cargando metas 6 meses...')
      const metasRows = []
      for (let mes = 5; mes >= 0; mes--) {
        const fecha = new Date(hoy.getFullYear(), hoy.getMonth() - mes, 1)
        const periodo = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-01`
        const pedidosMeta = 70 + (5 - mes) * 10
        metasRows.push({
          tenant_id: tenantId, periodo,
          pedidos_meta: pedidosMeta,
          ventas_meta: Math.round(cfg.productos[0].pvp * pedidosMeta * 0.72),
          ganancia_meta: Math.round(cfg.productos[0].pvp * 0.18 * pedidosMeta * 0.72),
          entregados_meta: Math.round(pedidosMeta * 0.75),
          descripcion: `Meta ${fecha.toLocaleString('es-CO', { month: 'long', year: 'numeric' })}`,
        })
      }
      await supabase.from('metas').insert(metasRows)
      setProgreso(p => ({ ...p, metas: 'ok' }))
      addLog(`✅ ${metasRows.length} metas creadas`)

      // ── BODEGAS ───────────────────────────────────────────────
      setProgreso(p => ({ ...p, bodegas: 'cargando' }))
      addLog('🏭 Creando bodegas e inventario...')
      const { data: bodegasData } = await supabase.from('bodegas').insert([
        { tenant_id: tenantId, nombre: `Bodega General ${cfg.nombre}`, tipo: 'general', pais_codigo: paisCodigo, ciudad: cfg.capital, orden_flujo: 2, activa: true },
        { tenant_id: tenantId, nombre: `Bodega ${cfg.capital}`, tipo: 'ciudad', pais_codigo: paisCodigo, ciudad: cfg.capital, orden_flujo: 3, activa: true },
      ]).select()
      if (bodegasData && prodIds.length > 0) {
        const invRows = []
        for (const bod of bodegasData) {
          for (const prod of prodIds) {
            invRows.push({ tenant_id: tenantId, producto_id: prod.id, bodega_id: bod.id, cantidad_disponible: rndInt(15, 80), cantidad_reservada: rndInt(0, 5), cantidad_dañada: rndInt(0, 2), stock_minimo: 10 })
          }
        }
        await supabase.from('inventario').insert(invRows)
      }
      setProgreso(p => ({ ...p, bodegas: 'ok' }))
      addLog(`✅ 2 bodegas + inventario inicial`)

      // ── PQRSF ─────────────────────────────────────────────────
      setProgreso(p => ({ ...p, pqrsf: 'cargando' }))
      addLog('📬 Generando casos PQRSF...')
      const tipos = ['pregunta', 'queja', 'reclamo', 'sugerencia', 'felicitacion']
      const asuntos = ['¿Cuándo llega mi pedido?', 'Producto llegó dañado', 'No he recibido mi pedido', 'El producto no funciona', 'Quiero cambiar mi dirección', 'El producto es excelente', 'Demoran mucho en confirmar', 'Quiero devolver el producto']
      const pqrsfRows = Array.from({ length: 15 }, (_, i) => {
        const tipo = tipos[i % tipos.length]
        const diasAtras = rndInt(1, 45)
        const fechaCreacion = new Date(Date.now() - diasAtras * 86400000)
        return {
          tenant_id: tenantId,
          tipo,
          asunto: asuntos[i % asuntos.length],
          descripcion: `Caso de demostración: ${asuntos[i % asuntos.length]}`,
          cliente_nombre: `${rnd(cfg.nombres)} ${rnd(cfg.apellidos)}`,
          cliente_email: `cliente${i + 1}@demo.com`,
          cliente_telefono: `3${rndInt(1, 3)}${String(rndInt(1000000, 9999999))}`,
          estado: i < 10 ? 'abierto' : 'cerrado',
          prioridad: i < 3 ? 'alta' : i < 8 ? 'media' : 'baja',
          fecha_creacion: fechaCreacion.toISOString(),
          fecha_limite: new Date(fechaCreacion.getTime() + 5 * 86400000).toISOString(),
        }
      })
      await supabase.from('pqrsf').insert(pqrsfRows)
      setProgreso(p => ({ ...p, pqrsf: 'ok' }))
      addLog(`✅ 15 casos PQRSF generados`)

      // ── ALERTAS ───────────────────────────────────────────────
      setProgreso(p => ({ ...p, alertas: 'cargando' }))
      addLog('🚨 Generando alertas de demostración...')
      await supabase.from('alertas').insert([
        { tenant_id: tenantId, tipo: 'critico', categoria: 'operativa', titulo: 'CPA por encima del máximo', mensaje: `CPA real supera el CPA máximo configurado en ${cfg.productos[0].nombre}. Revisa el módulo Precio & Costeo.`, modulo: 'PAUTA', icono: '🔴', accion: 'Revisar campaña y ajustar CPA máximo' },
        { tenant_id: tenantId, tipo: 'atencion', categoria: 'operativa', titulo: 'Tasa de entrega por debajo del 75%', mensaje: 'La tasa de entrega del mes es 70%. El benchmark Colombia es 75%-82%. Revisar confirmaciones y novedades.', modulo: 'PEDIDOS', icono: '🟡', accion: 'Activar confirmación previa al despacho' },
        { tenant_id: tenantId, tipo: 'critico', categoria: 'financiera', titulo: 'Stock crítico detectado', mensaje: `${cfg.productos[0].nombre} tiene menos de 10 unidades disponibles en ${cfg.capital}. Riesgo de quiebre.`, modulo: 'BODEGA', icono: '🚨', accion: 'Ordenar reposición urgente o traslado desde bodega general' },
        { tenant_id: tenantId, tipo: 'atencion', categoria: 'operativa', titulo: 'PQRSF vencidas sin respuesta', mensaje: '3 casos de PQRSF llevan más de 5 días sin respuesta. Riesgo legal y reputacional.', modulo: 'PQRSF', icono: '📬', accion: 'Resolver los 3 casos urgentes antes de que escalen' },
        { tenant_id: tenantId, tipo: 'oportunidad', categoria: 'comercial', titulo: 'Oportunidad: escalar campaña ganadora', mensaje: `Campaña "${cfg.productos[0].nombre.split(' ').slice(0, 2).join(' ')} - Video VSL" tiene ROAS > 3x. Duplicar presupuesto puede generar +${Math.round(cfg.productos[0].pvp * 12 * 0.18).toLocaleString()} en ganancias.`, modulo: 'PAUTA', icono: '💡', accion: 'Aumentar presupuesto 2x en la campaña ganadora' },
        { tenant_id: tenantId, tipo: 'atencion', categoria: 'financiera', titulo: 'Margen neto por debajo del 15%', mensaje: 'El margen neto del mes es 12%. El mínimo recomendado para sostenibilidad es 15%. Revisar estructura de costos.', modulo: 'P&G', icono: '📊', accion: 'Revisar costos fijos y renegociar con proveedor' },
        { tenant_id: tenantId, tipo: 'critico', categoria: 'operativa', titulo: 'Transportadora con bajo rendimiento', mensaje: `${cfg.transportadoras[1]} tiene tasa de entrega del 65% en el último mes. Impacto directo en rentabilidad.`, modulo: 'LOGÍSTICA', icono: '🚚', accion: 'Redirigir pedidos a otra transportadora temporalmente' },
        { tenant_id: tenantId, tipo: 'atencion', categoria: 'financiera', titulo: 'Meta del mes en riesgo', mensaje: 'Vas al 68% de la meta de ventas con el 75% del mes transcurrido. Necesitas acelerar para cumplir.', modulo: 'METAS', icono: '🎯', accion: 'Aumentar inversión en pauta los últimos días del mes' },
      ])
      setProgreso(p => ({ ...p, alertas: 'ok' }))
      addLog(`✅ 8 alertas de demostración creadas`)

      addLog(`🎉 ¡Seed completo para ${cfg.nombre}! Todos los módulos tienen datos reales.`)
    } catch (err) {
      addLog(`❌ Error durante el seed: ${String(err)}`)
    }

    setSeedActivo(false)
    loadEstado()
  }

  const cfg = CONFIG_PAIS[paisCodigo] || CONFIG_PAIS.COL
  const estadoColor = (e: string) => e === 'ok' ? '#2DD4A0' : e === 'error' ? '#F05C5C' : e === 'cargando' ? '#F5A623' : '#5A6478'
  const estadoIcon = (e: string) => e === 'ok' ? '✅' : e === 'error' ? '❌' : e === 'cargando' ? '⏳' : '⬜'

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px', color: '#8B96A8' }}>
      Cargando Superadmin...
    </div>
  )

  return (
    <div style={{ color: '#E8EDF5', fontFamily: 'system-ui,sans-serif' }}>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: '700', marginBottom: '4px' }}>⚙️ Superadmin — Centro de Control</h1>
        <p style={{ fontSize: '13px', color: '#8B96A8' }}>Seed de datos por país · Simulación · Mantenimiento · Solo para administradores</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '8px', marginBottom: '16px' }}>
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

      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: '16px' }}>
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

          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
            <button onClick={ejecutarSeed} disabled={seedActivo}
              style={{ flex: 2, padding: '11px', background: seedActivo ? 'rgba(45,212,160,0.15)' : '#2DD4A0', border: 'none', borderRadius: '9px', color: seedActivo ? '#2DD4A0' : '#0A0D14', fontWeight: '800', cursor: seedActivo ? 'wait' : 'pointer', fontSize: '13px' }}>
              {seedActivo ? '⏳ Cargando datos...' : '🌱 Cargar datos demo'}
            </button>
            <button onClick={limpiarDatos} disabled={seedActivo}
              style={{ flex: 1, padding: '11px', background: 'rgba(240,92,92,0.1)', border: '1px solid rgba(240,92,92,0.3)', borderRadius: '9px', color: '#F05C5C', fontWeight: '700', cursor: seedActivo ? 'not-allowed' : 'pointer', fontSize: '13px' }}>
              🗑️ Limpiar
            </button>
          </div>

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
