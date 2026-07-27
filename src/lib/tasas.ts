'use client'
import { useEffect, useState } from 'react'
import { PAISES, paisPorCodigo } from './paises'

const CACHE_KEY = 'dizgo_tasas_cache'
const CACHE_TTL_MS = 6 * 60 * 60 * 1000 // 6 horas, igual que el backend — no tiene sentido refrescar más seguido

export type TasasUSD = Record<string, number> // código de moneda -> unidades por 1 USD

function tasasAproximadas(): TasasUSD {
  const t: TasasUSD = { USD: 1 }
  PAISES.forEach(p => { if (p.usdAprox) t[p.moneda] = p.usdAprox })
  return t
}

// Tasas de cambio en vivo (vía /api/tasas, con caché de 6h en el servidor y otras 6h en el
// navegador). Si la fuente en vivo falla o todavía no responde, se usan las tasas aproximadas
// de src/lib/paises.ts como respaldo — la web nunca se queda sin número que mostrar.
export function useTasasCambio() {
  const [tasas, setTasas] = useState<TasasUSD>(tasasAproximadas)
  const [actualizado, setActualizado] = useState<string | null>(null)
  const [enVivo, setEnVivo] = useState(false)

  useEffect(() => {
    try {
      const cache = localStorage.getItem(CACHE_KEY)
      if (cache) {
        const { tasas: t, actualizado: a, ts } = JSON.parse(cache)
        if (Date.now() - ts < CACHE_TTL_MS) {
          setTasas(t); setActualizado(a); setEnVivo(true)
          return
        }
      }
    } catch { /* caché corrupta, se ignora y se refresca */ }

    fetch('/api/tasas')
      .then(r => r.json())
      .then(d => {
        if (!d?.rates) return
        const combinadas = { ...tasasAproximadas(), ...d.rates }
        setTasas(combinadas); setActualizado(d.actualizado || null); setEnVivo(true)
        localStorage.setItem(CACHE_KEY, JSON.stringify({ tasas: combinadas, actualizado: d.actualizado, ts: Date.now() }))
      })
      .catch(() => { /* se queda con las tasas aproximadas por defecto */ })
  }, [])

  return { tasas, actualizado, enVivo }
}

export function copAUsdConTasas(valorCOP: number, tasas: TasasUSD) {
  return valorCOP / (tasas.COP || 4000)
}

export function copAMonedaConTasas(valorCOP: number, paisCode: string, tasas: TasasUSD): number | null {
  const p = paisPorCodigo(paisCode)
  if (!p) return null
  const tasa = tasas[p.moneda]
  if (!tasa) return null
  return copAUsdConTasas(valorCOP, tasas) * tasa
}
