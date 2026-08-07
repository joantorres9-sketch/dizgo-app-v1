// Helper server-only, compartido entre la creación de acceso para colaboradores de nómina
// (/api/admin/crear-acceso-colaborador) y la creación de usuarios de cortesía
// (/api/admin/crear-usuario-cortesia). Mismo patrón de fetch directo a Resend que ya usa
// src/app/api/nomina/enviar-colilla/route.ts.

interface InvitacionParams {
  email: string
  nombre: string
  passwordTemporal: string
  guia?: string[]
}

export async function enviarCorreoInvitacion({ email, nombre, passwordTemporal, guia }: InvitacionParams): Promise<{ ok: boolean; error?: string }> {
  if (!process.env.RESEND_API_KEY) {
    return { ok: false, error: 'RESEND_API_KEY no configurada — la cuenta se creó igual, pero no se pudo enviar el correo de acceso.' }
  }

  const guiaHtml = guia?.length
    ? `<p><strong>Qué puedes explorar:</strong></p><ul>${guia.map(g => `<li>${g}</li>`).join('')}</ul>`
    : ''

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
      to: email,
      subject: '🎉 Ya puedes acceder a DIZGO',
      html: `<p>Hola ${nombre},</p>
<p>Ya tienes acceso a DIZGO. Ingresa con estos datos:</p>
<p><strong>Usuario:</strong> ${email}<br/><strong>Contraseña temporal:</strong> ${passwordTemporal}</p>
<p><a href="https://app.dizgo.app/auth/login">Ir a DIZGO →</a></p>
<p>Te recomendamos cambiar la contraseña la primera vez que ingreses.</p>
${guiaHtml}`,
    }),
  })
  const data = await res.json().catch(() => ({}))
  return res.ok ? { ok: true } : { ok: false, error: data.message || JSON.stringify(data) }
}

export function generarPasswordTemporal(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  let out = ''
  for (let i = 0; i < 12; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}
