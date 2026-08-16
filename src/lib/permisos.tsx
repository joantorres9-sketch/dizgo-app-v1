'use client'
import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { type Accion, type MatrizPermisos, horarioPermiteAhora } from '@/lib/modulos'

// Motor de permisos del Centro de Control de Accesos. Solo los perfiles rol='colaborador' quedan
// sujetos a la matriz — owner/superadmin siempre tienen acceso total (para que el dueño del
// tenant nunca quede bloqueado de su propia cuenta).

export interface PerfilAcceso {
  rol: string
  tenantId: string | null
  permisos: MatrizPermisos
  // Techo que controla DIZGO sobre el tenant completo (tenants.permisos_dizgo) — null significa
  // sin restricción. Se aplica por ENCIMA de la matriz por colaborador y de owner/superadmin: si
  // DIZGO apaga un módulo para el tenant, nadie en ese tenant lo usa, ni siquiera el dueño.
  permisosDizgo: MatrizPermisos | null
  // Códigos de país (tenants.paises_habilitados) que DIZGO habilita para este tenant — null
  // significa sin restricción, los 11 países disponibles. Mismo dueño de la decisión que
  // permisosDizgo: solo lo edita el superadmin de DIZGO, nunca el propio tenant.
  paisesHabilitados: string[] | null
  horarioAcceso: string
  esCortesia: boolean
  activo: boolean
}

const UMBRAL_DESCARGAS = 5
const VENTANA_DESCARGAS_MIN = 15

interface ContextoPermisos {
  perfil: PerfilAcceso | null
  cargando: boolean
  puede: (modulo: string, accion: Accion) => boolean
  puedePais: (paisCode: string) => boolean
  enHorario: boolean
  recargar: () => Promise<void>
}
const PermisosContext = createContext<ContextoPermisos | null>(null)

// Fuente de verdad ÚNICA para permisos, igual que TemaProvider (src/lib/tema.tsx) resolvió el
// mismo problema con el tema. Antes cada usePermisos() traía su propio auth→profiles→tenants
// por separado -- una sola vista de página lo disparaba 3-4 veces (layout + la página +
// RequierePermiso), todo secuencial y sin caché: confirmado en producción, ~950ms de puro
// esperar-una-cosa-tras-otra duplicados. Con Context se pide una sola vez por navegación y todo
// lo que llama usePermisos() lee ese mismo resultado ya cargado.
export function PermisosProvider({ children }: { children: ReactNode }) {
  const supabase = createClient()
  const [perfil, setPerfil] = useState<PerfilAcceso | null>(null)
  const [cargando, setCargando] = useState(true)

  const cargar = useCallback(async () => {
    setCargando(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setPerfil(null); setCargando(false); return }
    // Un error transitorio de Supabase (ej. 503 momentáneo) no debe dejar al usuario sin ver
    // ningún módulo hasta que cierre sesión -- se reintenta una vez antes de rendirse. Solo una
    // ausencia real de perfil (fila que de verdad no existe, sin error) limpia perfil a null.
    let data: { rol: string; permisos: unknown; tenant_id: string | null; horario_acceso: string; es_cortesia: boolean; activo: boolean } | null = null
    for (let intento = 0; intento < 2; intento++) {
      const resp = await supabase.from('profiles')
        .select('rol, permisos, tenant_id, horario_acceso, es_cortesia, activo')
        .eq('id', user.id).single()
      if (resp.data) { data = resp.data; break }
      if (!resp.error) break // fila realmente no existe -- no tiene sentido reintentar
      if (intento === 0) await new Promise(r => setTimeout(r, 800))
    }
    if (!data) { setCargando(false); return } // conserva el perfil anterior si había uno, en vez de vaciarlo

    let permisosDizgo: MatrizPermisos | null = null
    let paisesHabilitados: string[] | null = null
    if (data.tenant_id) {
      const { data: tenant } = await supabase.from('tenants').select('permisos_dizgo, paises_habilitados').eq('id', data.tenant_id).single()
      permisosDizgo = (tenant?.permisos_dizgo as MatrizPermisos) || null
      paisesHabilitados = (tenant?.paises_habilitados as string[]) || null
    }

    setPerfil({
      rol: data.rol,
      tenantId: data.tenant_id,
      permisos: (data.permisos || {}) as MatrizPermisos,
      permisosDizgo,
      paisesHabilitados,
      horarioAcceso: data.horario_acceso || 'todos',
      esCortesia: !!data.es_cortesia,
      activo: data.activo !== false,
    })
    setCargando(false)
  }, [supabase])

  useEffect(() => { cargar() }, [cargar])

  const puede = useCallback((modulo: string, accion: Accion): boolean => {
    if (!perfil) return false
    // Techo de DIZGO primero — bloquea a TODOS en el tenant, incluido owner/superadmin. Solo
    // bloquea si quedó explícitamente en false; una clave ausente (módulo agregado después de
    // guardar el techo) no restringe por defecto.
    if (perfil.permisosDizgo?.[modulo]?.[accion] === false) return false
    if (perfil.rol === 'owner' || perfil.rol === 'superadmin') return true
    return !!perfil.permisos?.[modulo]?.[accion]
  }, [perfil])

  // Sin restricción (paisesHabilitados null) o país explícitamente incluido. Se aplica parejo a
  // owner/superadmin/colaborador — a diferencia de puede(), acá no hay bypass por rol: los
  // países que DIZGO habilita son un techo sobre TODO el tenant.
  const puedePais = useCallback((paisCode: string): boolean => {
    if (!perfil) return false
    return perfil.paisesHabilitados === null || perfil.paisesHabilitados.includes(paisCode)
  }, [perfil])

  const enHorario = perfil ? (perfil.rol === 'owner' || perfil.rol === 'superadmin' || horarioPermiteAhora(perfil.horarioAcceso)) : true

  return (
    <PermisosContext.Provider value={{ perfil, cargando, puede, puedePais, enHorario, recargar: cargar }}>
      {children}
    </PermisosContext.Provider>
  )
}

export function usePermisos(): ContextoPermisos {
  const ctx = useContext(PermisosContext)
  if (!ctx) throw new Error('usePermisos() debe usarse dentro de <PermisosProvider> (ya está en dashboard/layout.tsx)')
  return ctx
}

// Inserta el evento en log_accesos y, para descargas, revisa si el propio perfil superó el
// umbral en la ventana reciente — si es así, dispara la alerta de seguridad server-side
// (POST /api/seguridad/notificar-actividad, que además envía correo si el perfil lo pidió).
export async function logAccion(modulo: string, accion: Accion | 'login' | 'fuera_horario') {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  const { data: profile } = await supabase.from('profiles').select('tenant_id, rol').eq('id', user.id).single()
  if (!profile?.tenant_id) return

  await supabase.from('log_accesos').insert({ tenant_id: profile.tenant_id, profile_id: user.id, modulo, accion })

  // owner/superadmin no están sujetos a la matriz — tampoco tiene sentido alertar sobre ellos.
  if (profile.rol === 'owner' || profile.rol === 'superadmin') return

  if (accion === 'descargar') {
    const desde = new Date(Date.now() - VENTANA_DESCARGAS_MIN * 60 * 1000).toISOString()
    const { count } = await supabase.from('log_accesos')
      .select('id', { count: 'exact', head: true })
      .eq('profile_id', user.id).eq('accion', 'descargar').gte('created_at', desde)
    if ((count || 0) >= UMBRAL_DESCARGAS) {
      await notificarActividad(profile.tenant_id, modulo, 'Descargas masivas sospechosas',
        `${count} descargas en los últimos ${VENTANA_DESCARGAS_MIN} minutos, muy por encima de lo normal.`)
    }
  }

  if (accion === 'fuera_horario') {
    await notificarActividad(profile.tenant_id, modulo, 'Acceso fuera del horario permitido',
      `Se intentó entrar a DIZGO fuera de la ventana de horario configurada para este usuario.`)
  }
}

async function notificarActividad(tenantId: string, modulo: string, titulo: string, mensaje: string) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) return
  await fetch('/api/seguridad/notificar-actividad', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ tenantId, modulo, titulo, mensaje }),
  }).catch(() => {})
}
