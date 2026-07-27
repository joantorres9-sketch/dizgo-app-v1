import { getSupabaseAdmin } from './apiAuth'

// Palabras que activan escalamiento a humano — si el lead las usa, no se genera respuesta de
// IA y se apaga ia_modo_activo para que Joan tome la conversación directamente.
const SEÑALES_ESCALAMIENTO = ['hablar con alguien', 'hablar con una persona', 'asesor humano', 'hablar con joan', 'con un humano', 'persona real']

export function requiereEscalamiento(texto: string): boolean {
  const t = texto.toLowerCase()
  return SEÑALES_ESCALAMIENTO.some(s => t.includes(s))
}

// Genera la respuesta del agente de ventas de DIZGO para un lead — usa el mismo patrón de
// llamada directa a la API de Claude que src/app/api/agentes/route.ts, pero con system prompt
// + catálogo real (crm_config_agente) + historial de conversación (crm_mensajes).
export async function generarRespuestaAgente(leadId: string, mensajeEntrante: string): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) { console.error('ANTHROPIC_API_KEY no configurada — agente de ventas inactivo'); return null }

  const supabase = getSupabaseAdmin()
  const { data: config } = await supabase.from('crm_config_agente').select('prompt_sistema, catalogo').eq('id', 1).single()
  if (!config) { console.error('crm_config_agente sin fila — sembrar antes de usar el agente'); return null }

  const { data: historial } = await supabase
    .from('crm_mensajes')
    .select('direccion, texto')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: true })
    .limit(20)

  const systemPrompt = `${config.prompt_sistema}\n\nCatálogo disponible (JSON, precios reales — nunca inventes uno distinto):\n${JSON.stringify(config.catalogo)}`

  const messages = (historial || []).map(m => ({
    role: m.direccion === 'entrante' ? ('user' as const) : ('assistant' as const),
    content: m.texto,
  }))
  if (messages.length === 0 || messages[messages.length - 1].content !== mensajeEntrante) {
    messages.push({ role: 'user', content: mensajeEntrante })
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 500,
      system: systemPrompt,
      messages,
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) { console.error('Error llamando al agente de ventas:', data); return null }
  const texto = data?.content?.[0]?.text
  return typeof texto === 'string' ? texto : null
}
