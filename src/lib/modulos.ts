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
  { key: 'whatsapp', href: '/dashboard/whatsapp', icon: '💬', label: 'Centro Contacto', grupo: 'HACER' },
  { key: 'logistica', href: '/dashboard/logistica', icon: '🚚', label: 'Logística', grupo: 'HACER' },
  { key: 'pauta', href: '/dashboard/pauta', icon: '📡', label: 'Pauta Meta/TikTok', grupo: 'HACER' },
  { key: 'wallet', href: '/dashboard/wallet', icon: '💳', label: 'Wallet Dropi', grupo: 'HACER' },
  { key: 'pqrsf', href: '/dashboard/pqrsf', icon: '📬', label: 'PQRSF', grupo: 'HACER' },
  { key: 'bodega', href: '/dashboard/bodega', icon: '🏭', label: 'Bodega', grupo: 'HACER' },
  { key: 'pyg', href: '/dashboard/pyg', icon: '🏛️', label: 'P&G Dashboard', grupo: 'VERIFICAR' },
  { key: 'embudo', href: '/dashboard/embudo', icon: '🌀', label: 'Embudo', grupo: 'VERIFICAR' },
  { key: 'alertas', href: '/dashboard/alertas', icon: '🚨', label: 'Alertas', grupo: 'VERIFICAR' },
  { key: 'agentes', href: '/dashboard/agentes', icon: '🤖', label: 'Agentes IA', grupo: 'ACTUAR' },
  { key: 'cazador', href: '/dashboard/cazador', icon: '🔍', label: 'Cazador Productos', grupo: 'ACTUAR' },
  { key: 'formacion', href: '/dashboard/formacion', icon: '🎓', label: 'Formación', grupo: 'ACTUAR' },
]

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

export function matrizTodoTrue(): MatrizPermisos {
  const m: MatrizPermisos = {}
  for (const mod of MODULOS) m[mod.key] = { ver: true, modificar: true, agregar: true, eliminar: true, descargar: true }
  return m
}

export function matrizTodoFalse(): MatrizPermisos {
  const m: MatrizPermisos = {}
  for (const mod of MODULOS) m[mod.key] = permisoVacio()
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
