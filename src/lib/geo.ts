'use client'
import { useEffect, useState } from 'react'
import { paisPorCodigo } from './paises'

const ISO_A_CODE: Record<string, string> = {
  CO:'COL', EC:'ECU', MX:'MEX', PE:'PER', CL:'CHL', AR:'ARG',
  CR:'CRI', PY:'PRY', VE:'VEN', ES:'ESP', GT:'GTM', PA:'PAN',
}

const STORAGE_KEY = 'dizgo_pais_manual'

// Detecta el país del visitante por IP (sin pedir permiso de ubicación al navegador) para
// preseleccionar moneda/país en formularios públicos. El usuario siempre puede cambiarlo — la
// detección solo evita que tenga que buscar su propio país en una lista larga.
export function useGeoPais(defaultPais = 'COL') {
  const [pais, setPaisState] = useState(defaultPais)
  const [detectando, setDetectando] = useState(true)
  const [detectadoAuto, setDetectadoAuto] = useState(false)

  useEffect(() => {
    const guardado = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
    if (guardado && paisPorCodigo(guardado)) {
      setPaisState(guardado)
      setDetectando(false)
      return
    }
    fetch('https://ipwho.is/')
      .then(r => r.json())
      .then(d => {
        const code = d?.country_code ? ISO_A_CODE[d.country_code] : null
        if (code) { setPaisState(code); setDetectadoAuto(true) }
      })
      .catch(() => { /* si falla la detección, se queda con defaultPais */ })
      .finally(() => setDetectando(false))
  }, [])

  function setPais(code: string) {
    setPaisState(code)
    setDetectadoAuto(false)
    if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, code)
  }

  return { pais, setPais, detectando, detectadoAuto }
}
