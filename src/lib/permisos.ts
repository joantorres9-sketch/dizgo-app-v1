'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { type Accion, type MatrizPermisos, horarioPermiteAhora } from '@/lib/modulos'

// Motor de permisos del Centro de Control de Accesos. Solo los perfiles rol='colaborador' quedan
// sujetos a la matriz — owner/superadmin siempre tienen acceso total (para que el dueño del
// tenant nunca quede bloqueado de su propia cuenta).

export interface PerfilAcceso {
  rol: string
  tenantId: string | null
  permisos: MatrizPermisos
  horarioAcceso: string
  esCortesia: boolean
  activo: boolean
}

const UMBRAL_DESCARGAS = 5
const VENTANA_DESCARGAS_MIN = 15

export function usePermisos() {
  const supabase = createClient()
  const [perfil, setPerfil] = useState<PerfilAcceso | null>(null)
  const [cargando, setCargando] = useState(true)

  const cargar = useCallback(async () => {
    setCargando(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setPerfil(null); setCargando(false); return }
    const { data } = await supabase.from('profiles')
      .select('rol, permisos, tenant_id, horario_acceso, es_cortesia, activo')
      .eq('id', user.id).single()
    if (!data) { setPerfil(null); setCargando(false); return }
    setPerfil({
      rol: data.rol,
      tenantId: data.tenant_id,
      permisos: (data.permisos || {}) as MatrizPermisos,
      horarioAcceso: data.horario_acceso || 'todos',
      esCortesia: !!data.es_cortesia,
      activo: data.activo !== false,
    })
    setCargando(false)
  }, [supabase])

  useEffect(() => { cargar() }, [cargar])

  const puede = useCallback((modulo: string, accion: Accion): boolean => {
    if (!perfil) return false
    if (perfil.rol === 'owner' || perfil.rol === 'superadmin') return true
    return !!perfil.permisos?.[modulo]?.[accion]
  }, [perfil])

  const enHorario = perfil ? (perfil.rol === 'owner' || perfil.rol === 'superadmin' || horarioPermiteAhora(perfil.horarioAcceso)) : true

  return { perfil, cargando, puede, enHorario, recargar: cargar }
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
