// Configuraciones de columnas por módulo para el sistema de plantillas Excel / carga masiva
// (src/lib/plantillasExcel.ts). Verificadas contra el schema real de Supabase, no contra
// supabase-schema.sql (desactualizado).

import type { ConfigPlantilla } from './plantillasExcel'

// Mismas opciones que costos/page.tsx (CATS_CF_BASE, CATS_CV, MODELOS) — duplicadas aquí
// porque ese archivo no las exporta y es un componente de página, no una fuente compartida.
const CATS_CF_BASE = [
  '👥 Personal Operativo', '🏢 Gastos Administrativos', '⚖️ Honorarios',
  '🔌 Servicios & Arriendo', '💻 Plataformas & Apps',
  '🧪 Testeos de Productos', '🎓 Formación & Mentoría', '📦 Otros',
]
const CATS_CV = [
  'Pauta Publicitaria', 'Logística / Flete', 'Flete Devolución',
  'Costo Producto / Proveedor', 'Fulfillment', 'Pasarela de Pago',
  'Comisiones', 'Empaque / Etiquetado', 'Aranceles / Aduana', 'Otros',
]
const MODELOS = ['dropshipping', 'importador', 'produccion_propia', 'hibrido', 'todos']

export interface FilaCostoFijo {
  periodo: string
  categoria: string
  concepto: string
  cantidad: number
  valor_unitario: number
  notas?: string
}

export const configCostosFijos: ConfigPlantilla<FilaCostoFijo> = {
  moduloKey: 'costos_fijos',
  nombreHoja: 'Costos Fijos',
  nombreArchivo: 'plantilla_costos_fijos_dizgo.xlsx',
  columnas: [
    { key: 'periodo', header: 'Periodo (Mes)', tipo: 'fecha', requerido: true, ejemplo: '01/03/2025', ayuda: 'Primer día del mes, formato DD/MM/AAAA. Un archivo puede tener varios meses.' },
    { key: 'categoria', header: 'Categoría', tipo: 'select', requerido: true, opciones: CATS_CF_BASE, ejemplo: CATS_CF_BASE[0], ayuda: 'Debe ser exactamente una de las categorías listadas.' },
    { key: 'concepto', header: 'Concepto', tipo: 'texto', requerido: true, ejemplo: 'Arriendo bodega', ayuda: 'Nombre del gasto.' },
    { key: 'cantidad', header: 'Cantidad', tipo: 'numero', requerido: false, default: 1, ejemplo: 1, ayuda: 'Unidades, normalmente 1.' },
    { key: 'valor_unitario', header: 'Valor unitario', tipo: 'moneda', requerido: true, ejemplo: 500000, ayuda: 'Solo el número, sin símbolo de moneda ni separadores.' },
    { key: 'notas', header: 'Notas', tipo: 'texto', requerido: false, ejemplo: '', ayuda: 'Opcional.' },
  ],
}

export interface FilaCostoVariable {
  periodo: string
  concepto: string
  tipo: string
  modelo: string
  valor: number
  pct_sobre_pvp: number
}

export const configCostosVariables: ConfigPlantilla<FilaCostoVariable> = {
  moduloKey: 'costos_variables',
  nombreHoja: 'Costos Variables',
  nombreArchivo: 'plantilla_costos_variables_dizgo.xlsx',
  columnas: [
    { key: 'periodo', header: 'Periodo (Mes)', tipo: 'fecha', requerido: true, ejemplo: '01/03/2025', ayuda: 'Primer día del mes, formato DD/MM/AAAA. Un archivo puede tener varios meses.' },
    { key: 'concepto', header: 'Concepto', tipo: 'texto', requerido: true, ejemplo: 'Comisión pasarela', ayuda: 'Nombre del costo.' },
    { key: 'tipo', header: 'Tipo de costo', tipo: 'select', requerido: true, opciones: CATS_CV, ejemplo: CATS_CV[0], ayuda: 'Debe ser exactamente uno de los tipos listados.' },
    { key: 'modelo', header: 'Modelo de negocio', tipo: 'select', requerido: false, opciones: MODELOS, default: 'dropshipping', ejemplo: 'dropshipping', ayuda: 'dropshipping, importador, produccion_propia, hibrido o todos.' },
    { key: 'valor', header: 'Valor fijo', tipo: 'moneda', requerido: false, default: 0, ejemplo: 0, ayuda: 'Si el costo es un valor fijo por unidad (no un %).' },
    { key: 'pct_sobre_pvp', header: '% sobre PVP', tipo: 'porcentaje', requerido: false, default: 0, ejemplo: 3, ayuda: 'Si el costo es un porcentaje del precio de venta.' },
  ],
}

export interface FilaMeta {
  periodo: string
  meta_pedidos: number
  meta_ventas: number
  meta_utilidad: number
  meta_cpa: number
  meta_confirmacion: number
  meta_despacho: number
  meta_entrega: number
  meta_devolucion_max: number
  meta_iso_objetivo: number
  meta_inversion_pauta: number
  meta_roas: number
  meta_recompra: number
  meta_ltv: number
  meta_pqrsf_resolucion: number
  meta_tiempo_confirmacion: number
  meta_tiempo_despacho: number
  meta_nps: number
}

export interface FilaProducto {
  nombre: string
  pvp_final: number
  costo_proveedor: number
  pct_publicidad: number
  pct_devolucion: number
  estado: string
}

const ESTADOS_PRODUCTO = ['activo', 'testeo', 'borrador', 'inactivo']

export const configProductos: ConfigPlantilla<FilaProducto> = {
  moduloKey: 'productos',
  nombreHoja: 'Productos',
  nombreArchivo: 'plantilla_productos_dizgo.xlsx',
  columnas: [
    { key: 'nombre', header: 'Nombre del producto', tipo: 'texto', requerido: true, ejemplo: 'Reloj deportivo X200', ayuda: 'Nombre con el que se va a mostrar en el catálogo.' },
    { key: 'pvp_final', header: 'PVP (precio de venta)', tipo: 'moneda', requerido: true, ejemplo: 89900, ayuda: 'Solo el número, sin símbolo de moneda.' },
    { key: 'costo_proveedor', header: 'Costo proveedor', tipo: 'moneda', requerido: true, ejemplo: 32000, ayuda: 'Lo que te cuesta comprarlo/producirlo.' },
    { key: 'pct_publicidad', header: '% Publicidad', tipo: 'porcentaje', requerido: false, default: 20, ejemplo: 20, ayuda: 'Porcentaje del PVP que se destina a pauta.' },
    { key: 'pct_devolucion', header: '% Devolución', tipo: 'porcentaje', requerido: false, default: 20, ejemplo: 20, ayuda: 'Porcentaje esperado de devoluciones.' },
    { key: 'estado', header: 'Estado', tipo: 'select', requerido: false, opciones: ESTADOS_PRODUCTO, default: 'borrador', ejemplo: 'borrador', ayuda: 'activo, testeo, borrador o inactivo.' },
  ],
}

export const configMetas: ConfigPlantilla<FilaMeta> = {
  moduloKey: 'metas',
  nombreHoja: 'Metas',
  nombreArchivo: 'plantilla_metas_dizgo.xlsx',
  columnas: [
    { key: 'periodo', header: 'Periodo (Mes)', tipo: 'fecha', requerido: true, ejemplo: '01/03/2025', ayuda: 'Primer día del mes. Una fila por mes histórico.' },
    { key: 'meta_pedidos', header: 'Meta pedidos/mes', tipo: 'numero', requerido: false, ejemplo: 500, ayuda: 'Cantidad de pedidos objetivo del mes.' },
    { key: 'meta_ventas', header: 'Meta ventas ($)', tipo: 'moneda', requerido: false, ejemplo: 35000000, ayuda: 'Ventas totales objetivo.' },
    { key: 'meta_utilidad', header: 'Meta utilidad ($)', tipo: 'moneda', requerido: false, ejemplo: 4500000, ayuda: 'Utilidad neta objetivo.' },
    { key: 'meta_cpa', header: 'Meta CPA ($)', tipo: 'moneda', requerido: false, ejemplo: 15000, ayuda: 'Costo por adquisición máximo objetivo.' },
    { key: 'meta_confirmacion', header: 'Meta % confirmación', tipo: 'porcentaje', requerido: false, ejemplo: 75, ayuda: '% de pedidos confirmados objetivo.' },
    { key: 'meta_despacho', header: 'Meta % despacho', tipo: 'porcentaje', requerido: false, ejemplo: 90, ayuda: '% de pedidos despachados objetivo.' },
    { key: 'meta_entrega', header: 'Meta % entrega', tipo: 'porcentaje', requerido: false, ejemplo: 80, ayuda: '% de pedidos entregados objetivo.' },
    { key: 'meta_devolucion_max', header: 'Meta % devolución máx', tipo: 'porcentaje', requerido: false, ejemplo: 12, ayuda: '% máximo de devoluciones tolerable.' },
    { key: 'meta_iso_objetivo', header: 'Meta ISO objetivo', tipo: 'porcentaje', requerido: false, ejemplo: 75, ayuda: 'Índice de satisfacción operativa objetivo.' },
    { key: 'meta_inversion_pauta', header: 'Meta inversión pauta ($)', tipo: 'moneda', requerido: false, ejemplo: 1500000, ayuda: 'Presupuesto de pauta planeado.' },
    { key: 'meta_roas', header: 'Meta ROAS', tipo: 'numero', requerido: false, ejemplo: 2, ayuda: 'Retorno sobre inversión publicitaria objetivo.' },
    { key: 'meta_recompra', header: 'Meta % recompra', tipo: 'porcentaje', requerido: false, ejemplo: 15, ayuda: '% de clientes que recompran, objetivo.' },
    { key: 'meta_ltv', header: 'Meta LTV ($)', tipo: 'moneda', requerido: false, ejemplo: 0, ayuda: 'Valor de vida del cliente objetivo.' },
    { key: 'meta_pqrsf_resolucion', header: 'Meta % resolución PQRSF', tipo: 'porcentaje', requerido: false, ejemplo: 95, ayuda: '% de casos PQRSF resueltos, objetivo.' },
    { key: 'meta_tiempo_confirmacion', header: 'Meta tiempo confirmación (h)', tipo: 'numero', requerido: false, ejemplo: 2, ayuda: 'Horas máximas para confirmar un pedido.' },
    { key: 'meta_tiempo_despacho', header: 'Meta tiempo despacho (h)', tipo: 'numero', requerido: false, ejemplo: 24, ayuda: 'Horas máximas para despachar un pedido.' },
    { key: 'meta_nps', header: 'Meta NPS', tipo: 'numero', requerido: false, ejemplo: 70, ayuda: 'Net Promoter Score objetivo.' },
  ],
}
