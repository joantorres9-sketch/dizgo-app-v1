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

export interface FilaInventario {
  producto: string
  bodega: string
  cantidad: number
  costo_unitario?: number
}

export const configInventarioInicial: ConfigPlantilla<FilaInventario> = {
  moduloKey: 'inventario_inicial',
  nombreHoja: 'Inventario Inicial',
  nombreArchivo: 'plantilla_inventario_inicial_dizgo.xlsx',
  columnas: [
    { key: 'producto', header: 'Producto', tipo: 'texto', requerido: true, ejemplo: 'Reloj deportivo X200', ayuda: 'Debe coincidir EXACTAMENTE con el nombre de un producto ya creado en Catálogo. Si no existe, créalo primero.' },
    { key: 'bodega', header: 'Bodega', tipo: 'texto', requerido: true, ejemplo: 'Bodega Bogotá', ayuda: 'Debe coincidir EXACTAMENTE con una bodega ya creada en esta página.' },
    { key: 'cantidad', header: 'Cantidad', tipo: 'numero', requerido: true, ejemplo: 100, ayuda: 'Unidades disponibles al momento de la carga.' },
  ],
}

export const configInventarioCompra: ConfigPlantilla<FilaInventario> = {
  moduloKey: 'inventario_compra',
  nombreHoja: 'Compras',
  nombreArchivo: 'plantilla_inventario_compras_dizgo.xlsx',
  columnas: [
    { key: 'producto', header: 'Producto', tipo: 'texto', requerido: true, ejemplo: 'Reloj deportivo X200', ayuda: 'Debe coincidir EXACTAMENTE con el nombre de un producto ya creado en Catálogo.' },
    { key: 'bodega', header: 'Bodega', tipo: 'texto', requerido: true, ejemplo: 'Bodega Bogotá', ayuda: 'Debe coincidir EXACTAMENTE con una bodega ya creada en esta página.' },
    { key: 'cantidad', header: 'Cantidad comprada', tipo: 'numero', requerido: true, ejemplo: 50, ayuda: 'Unidades que entran por esta compra.' },
    { key: 'costo_unitario', header: 'Costo unitario ($)', tipo: 'moneda', requerido: false, default: 0, ejemplo: 32000, ayuda: 'Opcional, costo de compra por unidad.' },
  ],
}

export interface FilaPedidoDropi {
  'FECHA DE REPORTE'?: string
  ID: string
  HORA?: string
  FECHA: string
  'NOMBRE CLIENTE': string
  TELÉFONO: string
  EMAIL?: string
  'TIPO DE IDENTIFICACION'?: string
  'NRO DE IDENTIFICACION'?: string
  'NÚMERO GUIA': string
  ESTATUS: string
  'TIPO DE ENVIO'?: string
  'DEPARTAMENTO DESTINO': string
  'CIUDAD DESTINO': string
  DIRECCION: string
  NOTAS?: string
  TRANSPORTADORA: string
  'TOTAL DE LA ORDEN': number
  GANANCIA: number
  'PRECIO FLETE': number
  'COSTO DEVOLUCION FLETE'?: number
  COMISION?: number
  '% COMISION DE LA PLATAFORMMA'?: number
  'PRECIO PROVEEDOR'?: number
  'PRECIO PROVEEDOR X CANTIDAD': number
  'PRODUCTO ID': string
  SKU: string
  'VARIACION ID': string
  PRODUCTO: string
  VARIACION?: string
  CANTIDAD: number
  NOVEDAD?: string
  'FUE SOLUCIONADA LA NOVEDAD'?: string
  'HORA DE NOVEDAD'?: string
  'FECHA DE NOVEDAD'?: string
  'SOLUCIÓN'?: string
  'HORA DE SOLUCIÓN'?: string
  'FECHA DE SOLUCIÓN'?: string
  'OBSERVACIÓN'?: string
  'HORA DE ÚLTIMO MOVIMIENTO'?: string
  'FECHA DE ÚLTIMO MOVIMIENTO'?: string
  'ÚLTIMO MOVIMIENTO'?: string
  'CONCEPTO ÚLTIMO MOVIMIENTO'?: string
  'UBICACIÓN DE ÚLTIMO MOVIMIENTO'?: string
  VENDEDOR?: string
  'TIPO DE TIENDA'?: string
  TIENDA?: string
  'ID DE ORDEN DE TIENDA'?: string
  'NUMERO DE PEDIDO DE TIENDA'?: string
  TAGS?: string
  'FECHA GUIA GENERADA'?: string
  'CONTADOR DE INDEMNIZACIONES'?: number
  'CONCEPTO ÚLTIMA INDENMIZACIÓN'?: string
}

// Mismas cabeceras EXACTAS del export real de Dropi ("Exportar" en Órdenes) -- se puede
// subir directo el archivo que Dropi genera, sin reformatear nada. ID + PRODUCTO ID +
// VARIACION ID son la llave de línea (una orden puede traer varias filas, una por producto)
// que permite hacer upsert real en vez de duplicar en cada carga del día.
export const configPedidosDropi: ConfigPlantilla<FilaPedidoDropi> = {
  moduloKey: 'pedidos_dropi',
  nombreHoja: 'Sheet1',
  nombreArchivo: 'plantilla_pedidos_dropi.xlsx',
  columnas: [
    { key: 'FECHA DE REPORTE', header: 'FECHA DE REPORTE', tipo: 'texto', requerido: false, ejemplo: '04-08-2026', ayuda: 'Opcional -- fecha en que Dropi generó el reporte.' },
    { key: 'ID', header: 'ID', tipo: 'texto', requerido: true, ejemplo: 6397955, ayuda: 'ID de la orden en Dropi -- clave para no duplicar al recargar el mismo archivo.' },
    { key: 'HORA', header: 'HORA', tipo: 'texto', requerido: false, ejemplo: '19:33', ayuda: 'Opcional.' },
    { key: 'FECHA', header: 'FECHA', tipo: 'texto', requerido: true, ejemplo: '04-08-2026', ayuda: 'Formato DD-MM-AAAA, igual al export de Dropi.' },
    { key: 'NOMBRE CLIENTE', header: 'NOMBRE CLIENTE', tipo: 'texto', requerido: true, ejemplo: 'Wellington Basurto', ayuda: '' },
    { key: 'TELÉFONO', header: 'TELÉFONO', tipo: 'texto', requerido: false, ejemplo: '980508656', ayuda: 'Opcional.' },
    { key: 'EMAIL', header: 'EMAIL', tipo: 'texto', requerido: false, ejemplo: 'cliente@correo.com', ayuda: 'Opcional.' },
    { key: 'TIPO DE IDENTIFICACION', header: 'TIPO DE IDENTIFICACION', tipo: 'texto', requerido: false, ejemplo: '', ayuda: 'Opcional.' },
    { key: 'NRO DE IDENTIFICACION', header: 'NRO DE IDENTIFICACION', tipo: 'texto', requerido: false, ejemplo: '', ayuda: 'Opcional.' },
    { key: 'NÚMERO GUIA', header: 'NÚMERO GUIA', tipo: 'texto', requerido: false, ejemplo: '', ayuda: 'Opcional.' },
    { key: 'ESTATUS', header: 'ESTATUS', tipo: 'texto', requerido: false, default: 'PENDIENTE', ejemplo: 'PENDIENTE CONFIRMACION', ayuda: 'Estatus de Dropi -- se traduce automáticamente al estado de DIZGO.' },
    { key: 'TIPO DE ENVIO', header: 'TIPO DE ENVIO', tipo: 'texto', requerido: false, ejemplo: 'CON RECAUDO', ayuda: 'Opcional -- CON RECAUDO o SIN RECAUDO.' },
    { key: 'DEPARTAMENTO DESTINO', header: 'DEPARTAMENTO DESTINO', tipo: 'texto', requerido: false, ejemplo: 'GUAYAS', ayuda: 'Opcional.' },
    { key: 'CIUDAD DESTINO', header: 'CIUDAD DESTINO', tipo: 'texto', requerido: true, ejemplo: 'DAULE', ayuda: '' },
    { key: 'DIRECCION', header: 'DIRECCION', tipo: 'texto', requerido: false, ejemplo: '', ayuda: 'Opcional.' },
    { key: 'NOTAS', header: 'NOTAS', tipo: 'texto', requerido: false, ejemplo: '', ayuda: 'Opcional.' },
    { key: 'TRANSPORTADORA', header: 'TRANSPORTADORA', tipo: 'texto', requerido: false, ejemplo: 'SERVIENTREGA', ayuda: 'Opcional.' },
    { key: 'TOTAL DE LA ORDEN', header: 'TOTAL DE LA ORDEN', tipo: 'moneda', requerido: true, ejemplo: 89900, ayuda: 'Valor total de la orden.' },
    { key: 'GANANCIA', header: 'GANANCIA', tipo: 'moneda', requerido: false, ejemplo: '', ayuda: 'Dropi la reporta solo cuando la orden ya se liquidó -- alimenta el histórico de utilidad en P&G.' },
    { key: 'PRECIO FLETE', header: 'PRECIO FLETE', tipo: 'moneda', requerido: false, ejemplo: 6.48, ayuda: 'Costo de envío de esta línea.' },
    { key: 'COSTO DEVOLUCION FLETE', header: 'COSTO DEVOLUCION FLETE', tipo: 'moneda', requerido: false, default: 0, ejemplo: 0, ayuda: 'Opcional.' },
    { key: 'COMISION', header: 'COMISION', tipo: 'moneda', requerido: false, default: 0, ejemplo: 0, ayuda: 'Opcional.' },
    { key: '% COMISION DE LA PLATAFORMMA', header: '% COMISION DE LA PLATAFORMMA', tipo: 'porcentaje', requerido: false, default: 0, ejemplo: 0, ayuda: 'Opcional (encabezado tal cual lo exporta Dropi, con la doble M).' },
    { key: 'PRECIO PROVEEDOR', header: 'PRECIO PROVEEDOR', tipo: 'moneda', requerido: false, ejemplo: 1, ayuda: 'Costo del proveedor por unidad -- distinto de "PRECIO PROVEEDOR X CANTIDAD".' },
    { key: 'PRECIO PROVEEDOR X CANTIDAD', header: 'PRECIO PROVEEDOR X CANTIDAD', tipo: 'moneda', requerido: false, ejemplo: 1, ayuda: 'Costo del proveedor para la cantidad de esta línea.' },
    { key: 'PRODUCTO ID', header: 'PRODUCTO ID', tipo: 'texto', requerido: true, ejemplo: 113346, ayuda: 'ID del producto en Dropi -- junto con ID de orden evita duplicar la línea.' },
    { key: 'SKU', header: 'SKU', tipo: 'texto', requerido: false, ejemplo: 'PULS-GU-517', ayuda: 'Preferido para identificar el producto -- si no hay match por SKU se intenta por nombre.' },
    { key: 'VARIACION ID', header: 'VARIACION ID', tipo: 'texto', requerido: false, ejemplo: '', ayuda: 'Opcional -- solo si el producto tiene variaciones (talla, color, etc).' },
    { key: 'PRODUCTO', header: 'PRODUCTO', tipo: 'texto', requerido: true, ejemplo: 'Pulsera Grano de Café Mujer', ayuda: 'Debe existir ya en tu Catálogo (por SKU o por nombre).' },
    { key: 'VARIACION', header: 'VARIACION', tipo: 'texto', requerido: false, ejemplo: '', ayuda: 'Opcional -- nombre de la variación (talla, color, etc).' },
    { key: 'CANTIDAD', header: 'CANTIDAD', tipo: 'numero', requerido: false, default: 1, ejemplo: 1, ayuda: '' },
    { key: 'NOVEDAD', header: 'NOVEDAD', tipo: 'texto', requerido: false, ejemplo: '', ayuda: 'Opcional.' },
    { key: 'FUE SOLUCIONADA LA NOVEDAD', header: 'FUE SOLUCIONADA LA NOVEDAD', tipo: 'texto', requerido: false, ejemplo: '', ayuda: 'Opcional.' },
    { key: 'HORA DE NOVEDAD', header: 'HORA DE NOVEDAD', tipo: 'texto', requerido: false, ejemplo: '', ayuda: 'Opcional.' },
    { key: 'FECHA DE NOVEDAD', header: 'FECHA DE NOVEDAD', tipo: 'texto', requerido: false, ejemplo: '', ayuda: 'Opcional.' },
    { key: 'SOLUCIÓN', header: 'SOLUCIÓN', tipo: 'texto', requerido: false, ejemplo: '', ayuda: 'Opcional.' },
    { key: 'HORA DE SOLUCIÓN', header: 'HORA DE SOLUCIÓN', tipo: 'texto', requerido: false, ejemplo: '', ayuda: 'Opcional.' },
    { key: 'FECHA DE SOLUCIÓN', header: 'FECHA DE SOLUCIÓN', tipo: 'texto', requerido: false, ejemplo: '', ayuda: 'Opcional.' },
    { key: 'OBSERVACIÓN', header: 'OBSERVACIÓN', tipo: 'texto', requerido: false, ejemplo: '', ayuda: 'Opcional.' },
    { key: 'HORA DE ÚLTIMO MOVIMIENTO', header: 'HORA DE ÚLTIMO MOVIMIENTO', tipo: 'texto', requerido: false, ejemplo: '', ayuda: 'Opcional.' },
    { key: 'FECHA DE ÚLTIMO MOVIMIENTO', header: 'FECHA DE ÚLTIMO MOVIMIENTO', tipo: 'texto', requerido: false, ejemplo: '', ayuda: 'Opcional.' },
    { key: 'ÚLTIMO MOVIMIENTO', header: 'ÚLTIMO MOVIMIENTO', tipo: 'texto', requerido: false, ejemplo: '', ayuda: 'Opcional.' },
    { key: 'CONCEPTO ÚLTIMO MOVIMIENTO', header: 'CONCEPTO ÚLTIMO MOVIMIENTO', tipo: 'texto', requerido: false, ejemplo: '', ayuda: 'Opcional.' },
    { key: 'UBICACIÓN DE ÚLTIMO MOVIMIENTO', header: 'UBICACIÓN DE ÚLTIMO MOVIMIENTO', tipo: 'texto', requerido: false, ejemplo: '', ayuda: 'Opcional.' },
    { key: 'VENDEDOR', header: 'VENDEDOR', tipo: 'texto', requerido: false, ejemplo: '', ayuda: 'Opcional.' },
    { key: 'TIPO DE TIENDA', header: 'TIPO DE TIENDA', tipo: 'texto', requerido: false, ejemplo: 'SHOPIFY', ayuda: 'Opcional.' },
    { key: 'TIENDA', header: 'TIENDA', tipo: 'texto', requerido: false, ejemplo: '', ayuda: 'Opcional -- nombre de la tienda en Dropi.' },
    { key: 'ID DE ORDEN DE TIENDA', header: 'ID DE ORDEN DE TIENDA', tipo: 'texto', requerido: false, ejemplo: '', ayuda: 'Opcional -- ID de la orden en Shopify/WooCommerce.' },
    { key: 'NUMERO DE PEDIDO DE TIENDA', header: 'NUMERO DE PEDIDO DE TIENDA', tipo: 'texto', requerido: false, ejemplo: '', ayuda: 'Opcional.' },
    { key: 'TAGS', header: 'TAGS', tipo: 'texto', requerido: false, ejemplo: '', ayuda: 'Opcional.' },
    { key: 'FECHA GUIA GENERADA', header: 'FECHA GUIA GENERADA', tipo: 'texto', requerido: false, ejemplo: '', ayuda: 'Opcional.' },
    { key: 'CONTADOR DE INDEMNIZACIONES', header: 'CONTADOR DE INDEMNIZACIONES', tipo: 'numero', requerido: false, default: 0, ejemplo: 0, ayuda: 'Opcional.' },
    { key: 'CONCEPTO ÚLTIMA INDENMIZACIÓN', header: 'CONCEPTO ÚLTIMA INDENMIZACIÓN', tipo: 'texto', requerido: false, ejemplo: '', ayuda: 'Opcional (encabezado tal cual lo exporta Dropi).' },
  ],
}

export interface FilaPedido {
  cliente_nombre: string
  cliente_telefono?: string
  cliente_ciudad: string
  cliente_departamento?: string
  producto: string
  cantidad: number
  pvp: number
  estado: string
  origen: string
  fecha_pedido: string
  transportadora?: string
}

const ESTADOS_PEDIDO = ['ingresado', 'en_gestion', 'confirmado', 'cancelado', 'en_bodega', 'despachado', 'en_transito', 'novedad', 'entregado', 'devolucion']

// Plantilla genérica de DIZGO para quien no usa Dropi.
export const configPedidos: ConfigPlantilla<FilaPedido> = {
  moduloKey: 'pedidos',
  nombreHoja: 'Pedidos',
  nombreArchivo: 'plantilla_pedidos_dizgo.xlsx',
  columnas: [
    { key: 'cliente_nombre', header: 'Nombre del cliente', tipo: 'texto', requerido: true, ejemplo: 'María Pérez', ayuda: '' },
    { key: 'cliente_telefono', header: 'Teléfono', tipo: 'texto', requerido: false, ejemplo: '3001234567', ayuda: 'Opcional.' },
    { key: 'cliente_ciudad', header: 'Ciudad', tipo: 'texto', requerido: true, ejemplo: 'Bogotá', ayuda: '' },
    { key: 'cliente_departamento', header: 'Departamento', tipo: 'texto', requerido: false, ejemplo: 'Cundinamarca', ayuda: 'Opcional.' },
    { key: 'producto', header: 'Producto', tipo: 'texto', requerido: true, ejemplo: 'Reloj deportivo X200', ayuda: 'Debe coincidir con un producto ya creado en Catálogo.' },
    { key: 'cantidad', header: 'Cantidad', tipo: 'numero', requerido: false, default: 1, ejemplo: 1, ayuda: '' },
    { key: 'pvp', header: 'Valor de la orden ($)', tipo: 'moneda', requerido: true, ejemplo: 89900, ayuda: '' },
    { key: 'estado', header: 'Estado', tipo: 'select', requerido: false, opciones: ESTADOS_PEDIDO, default: 'ingresado', ejemplo: 'ingresado', ayuda: ESTADOS_PEDIDO.join(', ') },
    { key: 'origen', header: 'Origen', tipo: 'select', requerido: false, opciones: ['Shopify', 'WooCommerce', 'Funnel', 'Manual', 'Recompra_Directa', 'Referido', 'Redes'], default: 'Manual', ejemplo: 'Manual', ayuda: '' },
    { key: 'fecha_pedido', header: 'Fecha del pedido', tipo: 'fecha', requerido: true, ejemplo: '15/03/2025', ayuda: 'Formato DD/MM/AAAA.' },
    { key: 'transportadora', header: 'Transportadora', tipo: 'texto', requerido: false, ejemplo: '', ayuda: 'Opcional.' },
  ],
}

export interface FilaColaborador {
  nombres: string
  apellidos: string
  tipo_doc: string
  num_doc: string
  cargo: string
  tipo_contrato: string
  fecha_ingreso: string
  fecha_fin?: string
  jornada: string
  sede?: string
  salario_base: number
  aux_transporte: number
  tipo_salario: string
  nivel_arl: number
  eps?: string
  pension?: string
  arl?: string
  caja_comp?: string
  cesantias?: string
  banco?: string
  tipo_cuenta: string
  num_cuenta?: string
  ciudad?: string
  direccion?: string
  celular?: string
  email?: string
}

export const configColaboradores: ConfigPlantilla<FilaColaborador> = {
  moduloKey: 'colaboradores',
  nombreHoja: 'Colaboradores',
  nombreArchivo: 'plantilla_colaboradores_dizgo.xlsx',
  columnas: [
    { key: 'nombres', header: 'Nombres', tipo: 'texto', requerido: true, ejemplo: 'Laura', ayuda: 'Nombres del colaborador.' },
    { key: 'apellidos', header: 'Apellidos', tipo: 'texto', requerido: true, ejemplo: 'Gómez Ríos', ayuda: 'Apellidos del colaborador.' },
    { key: 'tipo_doc', header: 'Tipo de documento', tipo: 'select', requerido: false, opciones: ['CC', 'CE', 'PA', 'NIT', 'TI'], default: 'CC', ejemplo: 'CC', ayuda: 'CC, CE, PA, NIT o TI.' },
    { key: 'num_doc', header: 'Número de documento', tipo: 'texto', requerido: true, ejemplo: '1020304050', ayuda: 'Sin puntos ni espacios.' },
    { key: 'cargo', header: 'Cargo', tipo: 'texto', requerido: true, ejemplo: 'Comprador', ayuda: 'Debe coincidir EXACTAMENTE con un cargo ya creado en Nómina → Organigrama. Si no existe, crea el cargo primero en la app.' },
    { key: 'tipo_contrato', header: 'Tipo de contrato', tipo: 'select', requerido: false, opciones: ['Empleado', 'Honorarios', 'Contratista'], default: 'Empleado', ejemplo: 'Empleado', ayuda: 'Empleado, Honorarios o Contratista.' },
    { key: 'fecha_ingreso', header: 'Fecha de ingreso', tipo: 'fecha', requerido: true, ejemplo: '01/02/2024', ayuda: 'Formato DD/MM/AAAA.' },
    { key: 'fecha_fin', header: 'Fecha fin (si aplica)', tipo: 'fecha', requerido: false, ejemplo: '', ayuda: 'Solo si el contrato es a término fijo.' },
    { key: 'jornada', header: 'Jornada', tipo: 'select', requerido: false, opciones: ['Tiempo completo', 'Medio tiempo', 'Por horas'], default: 'Tiempo completo', ejemplo: 'Tiempo completo', ayuda: '' },
    { key: 'sede', header: 'Sede', tipo: 'texto', requerido: false, ejemplo: 'Bogotá', ayuda: 'Opcional.' },
    { key: 'salario_base', header: 'Salario base ($)', tipo: 'moneda', requerido: true, ejemplo: 1600000, ayuda: 'Solo el número.' },
    { key: 'aux_transporte', header: 'Auxilio de transporte ($)', tipo: 'moneda', requerido: false, default: 0, ejemplo: 162000, ayuda: 'Déjalo en 0 si no aplica.' },
    { key: 'tipo_salario', header: 'Tipo de salario', tipo: 'select', requerido: false, opciones: ['Fijo', 'Variable', 'Integral'], default: 'Fijo', ejemplo: 'Fijo', ayuda: '' },
    { key: 'nivel_arl', header: 'Nivel ARL', tipo: 'numero', requerido: false, default: 1, ejemplo: 1, ayuda: 'Del 1 al 5 según riesgo del cargo.' },
    { key: 'eps', header: 'EPS', tipo: 'texto', requerido: false, ejemplo: 'Sura', ayuda: 'Opcional.' },
    { key: 'pension', header: 'Fondo de pensión', tipo: 'texto', requerido: false, ejemplo: 'Porvenir', ayuda: 'Opcional.' },
    { key: 'arl', header: 'ARL', tipo: 'texto', requerido: false, ejemplo: 'Sura', ayuda: 'Opcional.' },
    { key: 'caja_comp', header: 'Caja de compensación', tipo: 'texto', requerido: false, ejemplo: 'Compensar', ayuda: 'Opcional.' },
    { key: 'cesantias', header: 'Fondo de cesantías', tipo: 'texto', requerido: false, ejemplo: 'Porvenir', ayuda: 'Opcional.' },
    { key: 'banco', header: 'Banco', tipo: 'texto', requerido: false, ejemplo: 'Bancolombia', ayuda: 'Opcional.' },
    { key: 'tipo_cuenta', header: 'Tipo de cuenta', tipo: 'select', requerido: false, opciones: ['Ahorros', 'Corriente'], default: 'Ahorros', ejemplo: 'Ahorros', ayuda: '' },
    { key: 'num_cuenta', header: 'Número de cuenta', tipo: 'texto', requerido: false, ejemplo: '', ayuda: 'Opcional.' },
    { key: 'ciudad', header: 'Ciudad', tipo: 'texto', requerido: false, ejemplo: 'Bogotá', ayuda: 'Opcional.' },
    { key: 'direccion', header: 'Dirección', tipo: 'texto', requerido: false, ejemplo: '', ayuda: 'Opcional.' },
    { key: 'celular', header: 'Celular', tipo: 'texto', requerido: false, ejemplo: '3001234567', ayuda: 'Opcional.' },
    { key: 'email', header: 'Correo electrónico', tipo: 'texto', requerido: false, ejemplo: 'laura@empresa.com', ayuda: 'Opcional.' },
  ],
}

export interface FilaWalletDropi {
  ID: number
  MONTO: number
  FECHA: string
  TIPO: string
  'MONTO PREVIO': number
  'ORDEN ID': number
  'NUMERO DE GUIA': string
  DESCRIPCIÓN: string
  CUENTA: string
  'CONCEPTO DE RETIRO': string
}

// Solo se usa para generar la plantilla de descarga -- el import real ya funciona (handleFile
// en wallet/page.tsx) y NO pasa por parsearArchivo, así que aquí no se declaran validaciones
// estrictas, solo la estructura/ayuda para que el archivo generado calce con lo que Dropi
// exporta de verdad (mismas cabeceras que ya lee el parser existente).
export const configWalletDropi: ConfigPlantilla<FilaWalletDropi> = {
  moduloKey: 'wallet_dropi',
  nombreHoja: 'Wallet',
  nombreArchivo: 'plantilla_wallet_dropi.xlsx',
  columnas: [
    { key: 'ID', header: 'ID', tipo: 'numero', requerido: true, ejemplo: 123456, ayuda: 'ID único de la transacción en Dropi.' },
    { key: 'MONTO', header: 'MONTO', tipo: 'moneda', requerido: true, ejemplo: 50000, ayuda: 'Valor de la transacción.' },
    { key: 'FECHA', header: 'FECHA', tipo: 'texto', requerido: true, ejemplo: '15-03-2025 10:30', ayuda: 'Formato DD-MM-AAAA HH:MM, igual al export de Dropi.' },
    { key: 'TIPO', header: 'TIPO', tipo: 'select', requerido: false, opciones: ['ENTRADA', 'SALIDA'], default: 'ENTRADA', ejemplo: 'ENTRADA', ayuda: 'ENTRADA o SALIDA.' },
    { key: 'MONTO PREVIO', header: 'MONTO PREVIO', tipo: 'moneda', requerido: false, default: 0, ejemplo: 120000, ayuda: 'Saldo antes de esta transacción.' },
    { key: 'ORDEN ID', header: 'ORDEN ID', tipo: 'numero', requerido: false, ejemplo: 987654, ayuda: 'Opcional, si la transacción viene de un pedido.' },
    { key: 'NUMERO DE GUIA', header: 'NUMERO DE GUIA', tipo: 'texto', requerido: false, ejemplo: '', ayuda: 'Opcional.' },
    { key: 'DESCRIPCIÓN', header: 'DESCRIPCIÓN', tipo: 'texto', requerido: false, ejemplo: 'Ganancia dropshipper', ayuda: 'Descripción de la transacción.' },
    { key: 'CUENTA', header: 'CUENTA', tipo: 'texto', requerido: false, ejemplo: '', ayuda: 'Opcional.' },
    { key: 'CONCEPTO DE RETIRO', header: 'CONCEPTO DE RETIRO', tipo: 'texto', requerido: false, ejemplo: '', ayuda: 'Solo si TIPO es SALIDA.' },
  ],
}

export interface FilaLibroCaja {
  fecha: string
  concepto: string
  tipo: string
  valor: number
  categoria_flujo: string
}

export const configLibroCaja: ConfigPlantilla<FilaLibroCaja> = {
  moduloKey: 'libro_caja',
  nombreHoja: 'Libro de Caja',
  nombreArchivo: 'plantilla_libro_caja_dizgo.xlsx',
  columnas: [
    { key: 'fecha', header: 'Fecha', tipo: 'fecha', requerido: true, ejemplo: '15/03/2025', ayuda: 'Formato DD/MM/AAAA.' },
    { key: 'concepto', header: 'Concepto', tipo: 'texto', requerido: true, ejemplo: 'Pago arriendo bodega', ayuda: 'Descripción del movimiento.' },
    { key: 'tipo', header: 'Tipo', tipo: 'select', requerido: true, opciones: ['entrada', 'salida'], ejemplo: 'salida', ayuda: 'entrada o salida de efectivo.' },
    { key: 'valor', header: 'Valor ($)', tipo: 'moneda', requerido: true, ejemplo: 850000, ayuda: 'Solo el número, sin símbolo de moneda.' },
    { key: 'categoria_flujo', header: 'Categoría de flujo', tipo: 'select', requerido: false, opciones: ['operativo', 'inversion', 'financiacion'], default: 'operativo', ejemplo: 'operativo', ayuda: 'operativo, inversion o financiacion.' },
  ],
}

export interface FilaInversionActivo {
  nombre: string
  tipo: string
  valor: number
  vida_util_meses: number
  fecha_compra?: string
}

const TIPOS_ACTIVO = ['hardware', 'mobiliario', 'transporte', 'equipos', 'enseres', 'planta', 'otros']

export const configInversionActivos: ConfigPlantilla<FilaInversionActivo> = {
  moduloKey: 'inversion_activos',
  nombreHoja: 'Activos',
  nombreArchivo: 'plantilla_inversion_activos_dizgo.xlsx',
  columnas: [
    { key: 'nombre', header: 'Nombre del activo', tipo: 'texto', requerido: true, ejemplo: 'Vehículo de reparto', ayuda: 'Nombre o descripción del activo.' },
    { key: 'tipo', header: 'Tipo', tipo: 'select', requerido: false, opciones: TIPOS_ACTIVO, default: 'otros', ejemplo: 'transporte', ayuda: 'hardware, mobiliario, transporte, equipos, enseres, planta u otros.' },
    { key: 'valor', header: 'Valor de compra ($)', tipo: 'moneda', requerido: true, ejemplo: 45000000, ayuda: 'Valor de adquisición, solo el número.' },
    { key: 'vida_util_meses', header: 'Vida útil (meses)', tipo: 'numero', requerido: false, default: 36, ejemplo: 60, ayuda: 'Meses de vida útil para depreciación.' },
    { key: 'fecha_compra', header: 'Fecha de compra', tipo: 'fecha', requerido: false, ejemplo: '15/01/2025', ayuda: 'Opcional, formato DD/MM/AAAA.' },
  ],
}

export interface FilaPauta {
  fecha: string
  plataforma: string
  campana: string
  inversion: number
  impresiones: number
  clics: number
  resultados: number
}

// Complementa (no reemplaza) la carga nativa de CSV de Meta/TikTok, que sigue siendo el
// flujo principal por ser más resiliente a que Meta/TikTok cambien sus nombres de columna.
// Esta plantilla es para digitación manual o consolidación de datos históricos.
export const configPauta: ConfigPlantilla<FilaPauta> = {
  moduloKey: 'pauta',
  nombreHoja: 'Pauta',
  nombreArchivo: 'plantilla_pauta_dizgo.xlsx',
  columnas: [
    { key: 'fecha', header: 'Fecha', tipo: 'fecha', requerido: true, ejemplo: '15/03/2025', ayuda: 'Formato DD/MM/AAAA.' },
    { key: 'plataforma', header: 'Plataforma', tipo: 'select', requerido: true, opciones: ['META', 'TIKTOK'], ejemplo: 'META', ayuda: 'META o TIKTOK.' },
    { key: 'campana', header: 'Campaña', tipo: 'texto', requerido: true, ejemplo: 'Reloj deportivo X200 - Conversión', ayuda: 'Nombre de la campaña.' },
    { key: 'inversion', header: 'Inversión ($)', tipo: 'moneda', requerido: true, ejemplo: 350000, ayuda: 'Gasto total del día en esta campaña.' },
    { key: 'impresiones', header: 'Impresiones', tipo: 'numero', requerido: false, default: 0, ejemplo: 45000, ayuda: 'Opcional.' },
    { key: 'clics', header: 'Clics', tipo: 'numero', requerido: false, default: 0, ejemplo: 900, ayuda: 'Opcional.' },
    { key: 'resultados', header: 'Resultados (conversiones)', tipo: 'numero', requerido: false, default: 0, ejemplo: 20, ayuda: 'Compras, leads o el objetivo configurado en la campaña.' },
  ],
}
