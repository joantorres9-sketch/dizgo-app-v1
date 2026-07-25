import { createHash } from 'crypto'

export const WOMPI_MONTO_POR_PLAN: Record<string, number | undefined> = {
  emprendedor: 89000,
  empresarial: 249000,
}

export function wompiApiBase(): string {
  return process.env.WOMPI_ENV === 'production'
    ? 'https://production.wompi.co/v1'
    : 'https://sandbox.wompi.co/v1'
}

// Firma de integridad exigida por Wompi para el Widget/Checkout Web:
// SHA-256("<reference><amountInCents><currency><integritySecret>")
export function firmaIntegridadWompi(reference: string, amountInCents: number, currency: string): string {
  const secret = process.env.WOMPI_INTEGRITY_SECRET
  if (!secret) throw new Error('WOMPI_INTEGRITY_SECRET no configurada')
  const cadena = `${reference}${amountInCents}${currency}${secret}`
  return createHash('sha256').update(cadena).digest('hex')
}
