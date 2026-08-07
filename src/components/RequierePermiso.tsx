'use client'
import { usePermisos } from '@/lib/permisos'
import type { Accion } from '@/lib/modulos'

// Envoltorio de página para el enforcement de permisos (Fase 4 lo aplica en cada module page.tsx).
// accion por defecto 'ver' — el gate más básico es simplemente poder entrar al módulo.
export function RequierePermiso({ modulo, accion = 'ver', children }: { modulo: string; accion?: Accion; children: React.ReactNode }) {
  const { cargando, puede, enHorario } = usePermisos()

  if (cargando) {
    return <div style={{ padding: '60px 20px', textAlign: 'center', color: '#5A6478', fontSize: '13px' }}>Cargando...</div>
  }
  if (!enHorario) {
    return (
      <BloqueoAcceso
        titulo="⏰ Fuera de horario"
        mensaje="Tu horario de acceso configurado no permite entrar a DIZGO en este momento. Contacta al administrador de tu cuenta si necesitas ajustarlo."
      />
    )
  }
  if (!puede(modulo, accion)) {
    return (
      <BloqueoAcceso
        titulo="🔒 Sin acceso a este módulo"
        mensaje="No tienes permiso para ver esta sección. Si crees que es un error, contacta al administrador de tu cuenta."
      />
    )
  }
  return <>{children}</>
}

function BloqueoAcceso({ titulo, mensaje }: { titulo: string; mensaje: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', textAlign: 'center', gap: '10px' }}>
      <div style={{ fontSize: '17px', fontWeight: 700, color: '#E8EDF5' }}>{titulo}</div>
      <div style={{ fontSize: '13px', color: '#8B96A8', maxWidth: '360px', lineHeight: 1.6 }}>{mensaje}</div>
    </div>
  )
}
