import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, verificarTenantStaff } from '@/lib/apiAuth'

// Disparado por logAccion() (src/lib/permisos.ts) cuando un perfil `colaborador` supera el
// umbral de descargas en una ventana corta, o intenta entrar fuera de su horario de acceso.
// Siempre queda una alerta visible en /dashboard/alertas (mismo patrón que usa Pauta/Costos
// para alertas operativas); el correo es un canal adicional, solo si el perfil objetivo tiene
// notificar_actividad_inusual activo. Usa el service role porque un `colaborador` no tiene
// permiso de insertar en `alertas` directamente (esa tabla es solo owner/superadmin) — este
// endpoint valida su identidad primero (verificarTenantStaff) y hace el insert por él.
export async function POST(req: NextRequest) {
  try {
    const { tenantId, modulo, titulo, mensaje } = await req.json() as {
      tenantId: string; modulo: string; titulo: string; mensaje: string
    }
    if (!tenantId || !modulo || !titulo || !mensaje) {
      return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })
    }

    const auth = await verificarTenantStaff(req, tenantId)
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const supabase = getSupabaseAdmin()

    const { data: perfilOrigen } = await supabase.from('profiles')
      .select('nombre, email, notificar_actividad_inusual').eq('id', auth.userId).single()

    await supabase.from('alertas').insert({
      tenant_id: tenantId, tipo: 'critico', categoria: 'seguridad',
      titulo, mensaje: `${mensaje} (usuario: ${perfilOrigen?.nombre || perfilOrigen?.email || auth.userId})`,
      modulo: modulo.toUpperCase(), icono: '🛡️',
      accion: 'Revisar Gestión de Accesos → Todos los usuarios y confirmar si la actividad es legítima',
    })

    if (perfilOrigen?.notificar_actividad_inusual && process.env.RESEND_API_KEY) {
      const { data: owners } = await supabase.from('profiles')
        .select('email').eq('tenant_id', tenantId).in('rol', ['owner', 'superadmin'])
      const destinatarios = (owners || []).map(o => o.email).filter(Boolean)
      if (destinatarios.length) {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
          body: JSON.stringify({
            from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
            to: destinatarios,
            subject: `🛡️ Actividad inusual detectada — ${titulo}`,
            html: `<p><strong>${titulo}</strong></p><p>${mensaje}</p><p>Usuario: ${perfilOrigen?.nombre || perfilOrigen?.email}</p><p>Revisa el detalle en DIZGO → Superadmin → Gestión de Accesos.</p>`,
          }),
        }).catch(() => {})
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Error notificando actividad inusual:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
