// Fuente única de verdad de los módulos operativos del dashboard — usada por el sidebar
// (src/app/dashboard/layout.tsx), la matriz de permisos (Superadmin → Gestión de Accesos) y el
// motor de enforcement (src/lib/permisos.ts). Superadmin y Centro DIZGO quedan fuera a propósito:
// nunca son asignables a un perfil `colaborador`, solo los ve rol IN ('owner','superadmin').

export interface ModuloNav {
  key: string
  href: string
  icon: string
  label: string
  grupo: 'PLANEAR' | 'HACER' | 'VERIFICAR' | 'ACTUAR'
}

export const GRUPOS: { key: ModuloNav['grupo']; color: string }[] = [
  { key: 'PLANEAR', color: '#3D8EF0' },
  { key: 'HACER', color: '#2DD4A0' },
  { key: 'VERIFICAR', color: '#F5A623' },
  { key: 'ACTUAR', color: '#9B6BFF' },
]

export const MODULOS: ModuloNav[] = [
  { key: 'nomina', href: '/dashboard/nomina', icon: '👥', label: 'Nómina', grupo: 'PLANEAR' },
  { key: 'costos', href: '/dashboard/costos', icon: '📊', label: 'Costos Fijos', grupo: 'PLANEAR' },
  { key: 'productos', href: '/dashboard/productos', icon: '🛍️', label: 'Catálogo', grupo: 'PLANEAR' },
  { key: 'precio', href: '/dashboard/precio', icon: '💡', label: 'Precio & Costeo', grupo: 'PLANEAR' },
  { key: 'inversion', href: '/dashboard/inversion', icon: '💰', label: 'Inversión', grupo: 'PLANEAR' },
  { key: 'equilibrio', href: '/dashboard/equilibrio', icon: '⚖️', label: 'Punto Equilibrio', grupo: 'PLANEAR' },
  { key: 'metas', href: '/dashboard/metas', icon: '🎯', label: 'Metas', grupo: 'PLANEAR' },
  { key: 'pedidos', href: '/dashboard/pedidos', icon: '📦', label: 'Pedidos', grupo: 'HACER' },
  { key: 'logistica', href: '/dashboard/logistica', icon: '🚚', label: 'Ciclo de Caja', grupo: 'HACER' },
  { key: 'pauta', href: '/dashboard/pauta', icon: '📡', label: 'Pauta Meta/TikTok', grupo: 'HACER' },
  { key: 'wallet', href: '/dashboard/wallet', icon: '💳', label: 'Wallet Dropi', grupo: 'HACER' },
  { key: 'pqrsf', href: '/dashboard/pqrsf', icon: '📬', label: 'PQRSF', grupo: 'HACER' },
  { key: 'bodega', href: '/dashboard/bodega', icon: '🏭', label: 'Bodega', grupo: 'HACER' },
  { key: 'pyg', href: '/dashboard/pyg', icon: '🏛️', label: 'P&G Dashboard', grupo: 'VERIFICAR' },
  { key: 'embudo', href: '/dashboard/embudo', icon: '🌀', label: 'Embudo', grupo: 'VERIFICAR' },
  { key: 'alertas', href: '/dashboard/alertas', icon: '🚨', label: 'Alertas', grupo: 'VERIFICAR' },
  { key: 'agentes', href: '/dashboard/agentes', icon: '🤖', label: 'Agentes IA', grupo: 'ACTUAR' },
  { key: 'cazador', href: '/dashboard/cazador', icon: '🔍', label: 'Cazador Productos', grupo: 'ACTUAR' },
]

// Sub-pestañas reales de navegación dentro de un módulo (distintas de simples filtros/escenarios
// como "modo de cálculo" en Equilibrio/Metas o "activo/costeo/temporada" en Precio, que no cambian
// qué sección se renderiza). Solo los módulos listados aquí tienen filas de sub-pestaña en la
// matriz de permisos — el resto se queda con una sola fila a nivel de módulo, como hoy.
export interface SubTab { key: string; label: string }

export const SUBTABS: Record<string, SubTab[]> = {
  nomina: [
    { key: 'organigrama', label: '🗂️ Organigrama' },
    { key: 'colaboradores', label: '👥 Colaboradores' },
    { key: 'solicitudes', label: '📥 Solicitudes' },
    { key: 'procesos', label: '🧭 Procesos' },
    { key: 'indicadores', label: '📈 Indicadores' },
    { key: 'novedades', label: '📋 Novedades' },
    { key: 'liquidacion', label: '💵 Liquidación' },
    { key: 'tasas', label: '⚙️ Tasas' },
  ],
  costos: [
    { key: 'dashboard', label: '📊 Dashboard' },
    { key: 'cf', label: '💰 Costos Fijos' },
    { key: 'cv', label: '📈 Costos Variables' },
    { key: 'pef', label: '🔍 Análisis PEF' },
    { key: 'historico', label: '📋 Histórico' },
  ],
  whatsapp: [
    { key: 'kanban', label: '📋 Kanban' },
    { key: 'lotes', label: '📦 Lotes' },
    { key: 'plantillas', label: '📝 Plantillas' },
  ],
  logistica: [
    { key: 'flujo_caja', label: '💰 Flujo de caja por etapa' },
    { key: 'transportadoras', label: '🚚 Transportadoras' },
    { key: 'novedades', label: '⚠️ Novedades' },
    { key: 'mapa', label: '🗺️ Mapa de cobertura' },
    { key: 'equipo', label: '👥 Equipo confirmador' },
  ],
  pauta: [
    { key: 'resumen', label: '📊 Resumen' },
    { key: 'campanas', label: '🎯 Por Campaña' },
    { key: 'dia_dia', label: '📅 Día a Día' },
    { key: 'carga', label: '⚙️ Configurar' },
  ],
  pqrsf: [
    { key: 'lista', label: '📋 Lista' },
    { key: 'nueva', label: '✏️ Nueva PQRSF' },
    { key: 'stats', label: '📊 Estadísticas' },
  ],
  bodega: [
    { key: 'stock', label: '📦 Stock por bodega' },
    { key: 'importacion', label: '🚢 Flujo de importación' },
    { key: 'piscinas', label: '☁️ Piscinas dropshipping' },
    { key: 'riesgo', label: '⚠️ Riesgo IA' },
    { key: 'proveedor', label: '🤝 Mi catálogo proveedor' },
  ],
  pyg: [
    { key: 'resultados', label: '📈 Estado de Resultados' },
    { key: 'producto', label: '📦 P&G por Producto' },
    { key: 'mezcla', label: '🔀 Mezcla de Productos' },
    { key: 'flujo_caja', label: '💧 Flujo de Caja' },
    { key: 'balance', label: '⚖️ Balance General' },
    { key: 'cxp', label: '📋 Cuentas por Pagar' },
    { key: 'libro_caja', label: '📒 Libro de Caja' },
  ],
  embudo: [
    { key: 'embudo', label: '🔬 Embudo visual' },
    { key: 'diagnostico', label: '🚨 Diagnóstico' },
    { key: 'simulador', label: '⚡ Simulador' },
    { key: 'mezcla', label: '🔀 Mezcla de productos' },
  ],
  alertas: [
    { key: 'alertas', label: '🚨 Alertas' },
    { key: 'pef', label: '🔍 Diagnóstico PEF' },
    { key: 'oportunidades', label: '💡 Oportunidades' },
    { key: 'nueva', label: '✏️ Nueva alerta' },
  ],
  agentes: [
    { key: 'confirmador', label: '📞 Confirmador' },
    { key: 'novedades', label: '⚠️ Novedades' },
    { key: 'contable', label: '📊 Contable' },
    { key: 'campanas', label: '📡 Campañas' },
    { key: 'inventario', label: '🏭 Inventario' },
    { key: 'logistico', label: '🚚 Logístico' },
  ],
}

// Clave compuesta de permiso para una sub-pestaña, ej. "nomina.liquidacion" — vive en la misma
// matriz plana que las claves de módulo, sin cambiar la forma del dato en profiles.permisos.
export function clavePermiso(moduloKey: string, subtabKey?: string): string {
  return subtabKey ? `${moduloKey}.${subtabKey}` : moduloKey
}

export const ACCIONES = ['ver', 'modificar', 'agregar', 'eliminar', 'descargar'] as const
export type Accion = typeof ACCIONES[number]

export const ACCION_LABELS: Record<Accion, string> = {
  ver: 'Puede ver',
  modificar: 'Puede modificar',
  agregar: 'Puede agregar',
  eliminar: 'Puede eliminar',
  descargar: 'Puede descargar',
}

export type PermisoModulo = Record<Accion, boolean>
export type MatrizPermisos = Record<string, PermisoModulo>

export function permisoVacio(): PermisoModulo {
  return { ver: false, modificar: false, agregar: false, eliminar: false, descargar: false }
}

// Todas las claves de fila (módulo + sus sub-pestañas, si tiene) en el orden en que deben
// renderizarse en la matriz de permisos.
export function todasLasClaves(): string[] {
  const claves: string[] = []
  for (const mod of MODULOS) {
    claves.push(mod.key)
    for (const sub of SUBTABS[mod.key] || []) claves.push(clavePermiso(mod.key, sub.key))
  }
  return claves
}

export function matrizTodoTrue(): MatrizPermisos {
  const m: MatrizPermisos = {}
  for (const clave of todasLasClaves()) m[clave] = { ver: true, modificar: true, agregar: true, eliminar: true, descargar: true }
  return m
}

export function matrizTodoFalse(): MatrizPermisos {
  const m: MatrizPermisos = {}
  for (const clave of todasLasClaves()) m[clave] = permisoVacio()
  return m
}

export const HORARIOS_ACCESO = [
  { value: 'manana', label: '🌅 Mañana (6am–12pm)', desde: 6, hasta: 12 },
  { value: 'tarde', label: '☀️ Tarde (12pm–6pm)', desde: 12, hasta: 18 },
  { value: 'noche', label: '🌙 Noche (6pm–12am)', desde: 18, hasta: 24 },
  { value: 'varios', label: '🕐 Varios horarios (6am–12am)', desde: 6, hasta: 24 },
  { value: 'todos', label: '🔓 Todo el día', desde: 0, hasta: 24 },
] as const
export type HorarioAcceso = typeof HORARIOS_ACCESO[number]['value']

export function horarioPermiteAhora(horario: string, fecha: Date = new Date()): boolean {
  const cfg = HORARIOS_ACCESO.find(h => h.value === horario) || HORARIOS_ACCESO[4]
  const hora = fecha.getHours()
  return hora >= cfg.desde && hora < cfg.hasta
}
