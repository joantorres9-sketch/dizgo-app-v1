'use client'
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'

export type ModoTema = 'oscuro' | 'claro'

export interface PaletaColores {
  bg: string; card: string; card2: string; border: string
  text: string; muted: string
  accent: string; blue: string; green: string; red: string; yellow: string; purple: string
  // índice abierto -- algunos componentes (BotonesPlantilla, etc.) tipan su prop `theme` como
  // Record<string,string> con llaves sueltas; sin esto TS rechaza pasarles T directamente.
  [k: string]: string
}

// Mismo set de llaves que ya usaban los `const T = {...}` / `const C = {...}` hardcodeados en
// cada página -- así migrar una página es cambiar de dónde sale el objeto, no reescribir cada
// style prop. Valores verificados con contraste WCAG AA (>=4.5:1) contra su fondo real -- el
// 'muted' oscuro anterior (#5A7A9A) daba 4.34:1 contra el bg, por debajo del mínimo; por eso
// era el color que "no se lograba ver".
export const PALETA_OSCURA: PaletaColores = {
  bg: '#0A0D14', card: '#111520', card2: '#161C2E', border: 'rgba(255,255,255,0.08)',
  text: '#E8EDF5', muted: '#9BAAC2',
  accent: '#F58720', blue: '#3D8EF0', green: '#2DD4A0', red: '#F05C5C', yellow: '#F5A623', purple: '#9B6BFF',
}

// Los tonos de marca (naranja, verde, amarillo...) tal cual se usan en oscuro no alcanzan
// 4.5:1 sobre blanco -- se oscurecieron lo justo para pasar AA sin perder de qué color son.
export const PALETA_CLARA: PaletaColores = {
  bg: '#F4F6FA', card: '#FFFFFF', card2: '#F0F2F7', border: 'rgba(10,13,20,0.10)',
  text: '#0F1524', muted: '#4B5567',
  accent: '#A34C00', blue: '#1D6FD1', green: '#067A57', red: '#D93636', yellow: '#8F5A00', purple: '#7C4FE0',
}

const CLAVE_STORAGE = 'dizgo_tema'

function leerPreferenciaGuardada(): ModoTema | null {
  if (typeof window === 'undefined') return null
  const v = localStorage.getItem(CLAVE_STORAGE)
  return v === 'claro' || v === 'oscuro' ? v : null
}

function detectarPreferenciaSistema(): ModoTema {
  if (typeof window === 'undefined') return 'oscuro'
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'claro' : 'oscuro'
}

function aplicarAtributoHtml(modo: ModoTema) {
  if (typeof document !== 'undefined') document.documentElement.setAttribute('data-theme', modo)
}

interface ContextoTema { modo: ModoTema; T: PaletaColores; alternar: () => void; cambiarModo: (nuevo: ModoTema) => void }
const TemaContext = createContext<ContextoTema | null>(null)

// Fuente de verdad ÚNICA para el tema -- probado en vivo: antes cada `useTema()` tenía su
// propio useState aislado, así que el switch cambiaba SU PROPIO texto pero ninguna otra página
// se enteraba (el resto seguía con los colores viejos). Con Context, un solo cambiarModo()
// dispara un re-render de todo lo que consume el tema, en toda la app.
export function TemaProvider({ children }: { children: ReactNode }) {
  // Arranca SIEMPRE en 'oscuro' -- igual en server y en el primer render del cliente, para no
  // romper la hidratación (ver nota larga que tenía este archivo antes). El valor real llega
  // en el useEffect, un instante después.
  const [modo, setModoState] = useState<ModoTema>('oscuro')

  useEffect(() => {
    const guardado = leerPreferenciaGuardada()
    const inicial = guardado || detectarPreferenciaSistema()
    setModoState(inicial)
    aplicarAtributoHtml(inicial)
  }, [])

  const cambiarModo = useCallback((nuevo: ModoTema) => {
    setModoState(nuevo)
    aplicarAtributoHtml(nuevo)
    if (typeof window !== 'undefined') localStorage.setItem(CLAVE_STORAGE, nuevo)
  }, [])

  const alternar = useCallback(() => {
    setModoState(actual => {
      const nuevo: ModoTema = actual === 'oscuro' ? 'claro' : 'oscuro'
      aplicarAtributoHtml(nuevo)
      if (typeof window !== 'undefined') localStorage.setItem(CLAVE_STORAGE, nuevo)
      return nuevo
    })
  }, [])

  const T = modo === 'oscuro' ? PALETA_OSCURA : PALETA_CLARA

  return <TemaContext.Provider value={{ modo, T, alternar, cambiarModo }}>{children}</TemaContext.Provider>
}

// Cada página migrada reemplaza su `const T = {...}` hardcodeado por `const { T } = useTema()`
// -- el resto del archivo (todos los `T.xxx` en los style props) no cambia.
export function useTema(): ContextoTema {
  const ctx = useContext(TemaContext)
  if (!ctx) throw new Error('useTema() debe usarse dentro de <TemaProvider> (ya está en el layout raíz)')
  return ctx
}
