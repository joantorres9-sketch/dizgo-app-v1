import { NextRequest, NextResponse } from 'next/server'
import { verificarTenantStaff } from '@/lib/apiAuth'

// Notificación de decisión sobre una solicitud (registro de nuevo colaborador o autorregistro
// de novedad). Solo se llama para 'aprobado' — un rechazo NO envía correo (decisión explícita
// del negocio: una solicitud rechazada puede ser spam/maliciosa y no se le confirma nada al
// remitente, solo queda el registro de auditoría en nomina_solicitudes).
export async function POST(req: NextRequest) {
  try {
    const { tenantId, email, nombres, decision } = await req.json() as { tenantId: string; email: string; nombres: string; decision: string }
    if (!tenantId || !email || decision !== 'aprobado') {
      return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 })
    }

    const auth = await verificarTenantStaff(req, tenantId)
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({ error: 'RESEND_API_KEY no configurada.' }, { status: 500 })
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
        to: email,
        subject: '¡Bienvenido/a! Tu registro fue aprobado',
        html: `<p>Hola ${nombres || ''},</p><p>Tu registro fue aprobado. Recursos Humanos se pondrá en contacto contigo para completar tu vinculación (documentos, contrato y datos laborales).</p>`,
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return NextResponse.json({ error: data.message || 'Error al enviar el correo' }, { status: 502 })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Error notificando solicitud:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
