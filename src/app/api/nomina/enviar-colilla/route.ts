import { NextRequest, NextResponse } from 'next/server'
import { construirColillaPDF, DatosColilla } from '@/lib/colillaPdf'
import { verificarTenantStaff } from '@/lib/apiAuth'

interface ColillaEnvio { email: string; nombre: string; datos: DatosColilla }

// Envío de colillas por correo (Resend) — la data de cada colilla ya viene calculada desde el
// cliente (misma fuente que descargarColillaPDF en nomina/page.tsx), este endpoint solo genera
// el PDF server-side y lo adjunta. Requiere RESEND_API_KEY; si falta, se avisa claramente en vez
// de fallar en silencio.
export async function POST(req: NextRequest) {
  try {
    const { tenantId, colillas } = await req.json() as { tenantId: string; colillas: ColillaEnvio[] }
    if (!tenantId || !Array.isArray(colillas) || colillas.length === 0) {
      return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })
    }

    const auth = await verificarTenantStaff(req, tenantId)
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({ error: 'RESEND_API_KEY no configurada. Pide al administrador que la agregue en las variables de entorno.' }, { status: 500 })
    }

    const resultados = []
    for (const c of colillas) {
      if (!c.email) { resultados.push({ email: null, ok: false, error: 'Sin correo registrado' }); continue }
      const doc = construirColillaPDF(c.datos)
      const base64 = Buffer.from(doc.output('arraybuffer')).toString('base64')

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
        body: JSON.stringify({
          from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
          to: c.email,
          subject: `Colilla de pago — ${c.datos.periodo}`,
          html: `<p>Hola ${c.nombre},</p><p>Adjunto tu colilla de pago correspondiente al periodo ${c.datos.periodo}.</p><p>Si tienes dudas sobre tu liquidación, contacta a Recursos Humanos.</p>`,
          attachments: [{ filename: `colilla_${c.datos.periodo}.pdf`, content: base64 }],
        }),
      })
      const data = await res.json().catch(() => ({}))
      resultados.push({ email: c.email, ok: res.ok, error: res.ok ? null : (data.message || JSON.stringify(data)) })
    }

    return NextResponse.json({ ok: true, resultados })
  } catch (err) {
    console.error('Error enviando colillas:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
