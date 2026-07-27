// Envío de mensajes vía WhatsApp Cloud API (Meta) — usado solo por el CRM interno de ventas
// de DIZGO (src/app/api/crm/*), no por el módulo whatsapp de los tenants (ese sigue siendo
// enlaces wa.me manuales, un sistema aparte).

const GRAPH_VERSION = 'v21.0'

export async function enviarMensajeWhatsapp(telefono: string, texto: string): Promise<{ ok: true; messageId: string } | { ok: false; error: string }> {
  const token = process.env.META_WHATSAPP_TOKEN
  const phoneNumberId = process.env.META_PHONE_NUMBER_ID
  if (!token || !phoneNumberId) {
    return { ok: false, error: 'META_WHATSAPP_TOKEN o META_PHONE_NUMBER_ID no configurados' }
  }

  const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: telefono.replace(/\D/g, ''),
      type: 'text',
      text: { body: texto },
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) return { ok: false, error: data?.error?.message || `Error ${res.status} enviando WhatsApp` }
  return { ok: true, messageId: data?.messages?.[0]?.id || '' }
}
