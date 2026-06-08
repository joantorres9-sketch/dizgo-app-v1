export { createClient } from './client'

export function formatMoney(valor: number, moneda: string = 'COP'): string {
  const configs: Record<string, { locale: string }> = {
    COP: { locale: 'es-CO' }, USD: { locale: 'en-US' },
    MXN: { locale: 'es-MX' }, PEN: { locale: 'es-PE' },
    CLP: { locale: 'es-CL' }, ARS: { locale: 'es-AR' },
    CRC: { locale: 'es-CR' }, PYG: { locale: 'es-PY' },
    VES: { locale: 'es-VE' }, EUR: { locale: 'es-ES' },
    GTQ: { locale: 'es-GT' },
  }
  const cfg = configs[moneda] || configs.COP
  return new Intl.NumberFormat(cfg.locale, {
    style: 'currency', currency: moneda,
    minimumFractionDigits: 0, maximumFractionDigits: 2,
  }).format(valor)
}
