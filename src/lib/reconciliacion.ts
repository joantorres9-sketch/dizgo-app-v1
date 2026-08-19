// Motor de la Reconciliación Meta Ads → Shopify → Dropi (Embudo → sub-pestaña "Reconciliación").
// Funciones puras, sin Supabase ni dependencias de red -- todo el cruce corre client-side sobre
// los 3 archivos que el usuario sube en el momento. No hay tabla ni persistencia: es un análisis
// bajo demanda, igual que Precio & Costeo o el Simulador público.
//
// Por qué el cruce es por teléfono y no por ID: Shopify y Dropi son sistemas independientes, no
// comparten un identificador de orden común -- el único dato confiable que aparece en ambos
// exports es el teléfono del cliente (y, como respaldo de confianza, el nombre y la fecha). Meta
// Ads no se cruza registro a registro: sus reportes de anuncios no exponen nombre/teléfono del
// comprador, así que solo se compara en total (resultados reportados vs. pedidos reales creados).

import type { FilaImportada } from './plantillasExcel'
import type { FilaPedidoDropi, FilaPedidoShopify } from './plantillasConfig'

export interface PedidoNormalizado {
  fuente: 'shopify' | 'dropi'
  ordenId: string
  nombre: string
  telefono: string
  telefonoNorm: string
  fecha: string // ISO YYYY-MM-DD
  valor: number
  producto: string
}

// Deja solo dígitos y compara por los últimos 9 -- verificado contra datos reales (export de
// Dropi + export de Shopify de la misma tienda): Dropi guarda el celular ecuatoriano como 9
// dígitos sin el 0 inicial ("980508656"), pero el export de Shopify es inconsistente fila a
// fila -- unas veces incluye ese 0 inicial ("+5930980508656") y otras no ("+593980508656") para
// el MISMO número. slice(-10) no absorbía esto (longitudes distintas → strings distintos);
// slice(-9) sí, porque el 0 inicial es siempre el único dígito de más. Para Colombia (10 dígitos,
// siempre empiezan en 3) no pierde información real: el 3 es constante entre operadores, así que
// recortarlo no genera colisiones entre números distintos.
export function normalizarTelefono(raw: string | null | undefined): string {
  const digitos = String(raw || '').replace(/\D/g, '')
  return digitos.slice(-9)
}

export function normalizarNombre(raw: string | null | undefined): string {
  return String(raw || '').trim().toLowerCase().replace(/\s+/g, ' ')
}

function diffDias(fechaA: string, fechaB: string): number {
  const a = new Date(fechaA).getTime()
  const b = new Date(fechaB).getTime()
  if (isNaN(a) || isNaN(b)) return Infinity
  return Math.abs(a - b) / 86400000
}

// Shopify exporta una fila por línea de producto -- un pedido con 3 productos trae 3 filas con
// el mismo "Name". Se agrupa por Name antes de cruzar, quedándose con el primer valor no vacío
// de cliente/teléfono/fecha/valor de cada grupo (Shopify a veces solo llena esos campos en la
// primera línea del pedido) y sumando los nombres de producto para referencia.
export function agruparPedidosShopify(filas: FilaImportada<FilaPedidoShopify>[]): PedidoNormalizado[] {
  const grupos = new Map<string, PedidoNormalizado & { productos: string[] }>()
  for (const f of filas) {
    if (!f.valido) continue
    const d = f.datos
    const ordenId = String(d.Name || '').trim()
    if (!ordenId) continue
    const telefono = String(d['Shipping Phone'] || d.Phone || '').trim()
    let g = grupos.get(ordenId)
    if (!g) {
      g = {
        fuente: 'shopify', ordenId,
        nombre: String(d['Billing Name'] || '').trim(),
        telefono, telefonoNorm: normalizarTelefono(telefono),
        fecha: String(d['Created at'] || '').slice(0, 10),
        valor: Number(d.Total || 0),
        producto: '', productos: [],
      }
      grupos.set(ordenId, g)
    }
    if (d['Lineitem name']) g.productos.push(String(d['Lineitem name']))
  }
  return Array.from(grupos.values()).map(g => ({ ...g, producto: g.productos.join(', ') || '—' }))
}

// Mismo tipo de normalización para el lado Dropi -- una fila por línea de producto también
// (ID + PRODUCTO ID + VARIACION ID), se agrupa por ID de orden igual que en agruparPedidosShopify.
export function agruparPedidosDropi(filas: FilaImportada<FilaPedidoDropi>[]): PedidoNormalizado[] {
  const grupos = new Map<string, PedidoNormalizado & { productos: string[] }>()
  for (const f of filas) {
    if (!f.valido) continue
    const d = f.datos
    const ordenId = String(d.ID || '').trim()
    if (!ordenId) continue
    const telefono = String(d['TELÉFONO'] || '').trim()
    let g = grupos.get(ordenId)
    if (!g) {
      g = {
        fuente: 'dropi', ordenId,
        nombre: String(d['NOMBRE CLIENTE'] || '').trim(),
        telefono, telefonoNorm: normalizarTelefono(telefono),
        fecha: String(d.FECHA || '').slice(0, 10),
        valor: Number(d['TOTAL DE LA ORDEN'] || 0),
        producto: '', productos: [],
      }
      grupos.set(ordenId, g)
    }
    if (d.PRODUCTO) g.productos.push(String(d.PRODUCTO))
  }
  return Array.from(grupos.values()).map(g => ({ ...g, producto: g.productos.join(', ') || '—' }))
}

export interface ResultadoCruce {
  matched: { shopify: PedidoNormalizado; dropi: PedidoNormalizado }[]
  sinMatch: PedidoNormalizado[] // pedidos de Shopify que nunca aparecen en Dropi
}

// Cruza por teléfono normalizado (clave primaria -- confiable entre plataformas) validando que
// la fecha quede dentro de una ventana de tolerancia (por el desfase normal entre que se crea el
// pedido en Shopify y se sube/factura en Dropi). El nombre no se usa como filtro estricto --
// puede venir con variaciones de escritura -- solo queda disponible para que el usuario lo revise
// a simple vista en la lista de resultados. Un pedido de Shopify sin teléfono no se puede cruzar
// de forma confiable y cae directo a sinMatch.
export function cruzarShopifyDropi(shopify: PedidoNormalizado[], dropi: PedidoNormalizado[], ventanaDias = 3): ResultadoCruce {
  const porTelefono = new Map<string, PedidoNormalizado[]>()
  for (const d of dropi) {
    if (!d.telefonoNorm) continue
    const lista = porTelefono.get(d.telefonoNorm) || []
    lista.push(d)
    porTelefono.set(d.telefonoNorm, lista)
  }

  const matched: ResultadoCruce['matched'] = []
  const sinMatch: PedidoNormalizado[] = []
  const usados = new Set<string>() // evita que un mismo pedido Dropi se use para 2 matches de Shopify

  for (const s of shopify) {
    const candidatos = (s.telefonoNorm ? porTelefono.get(s.telefonoNorm) : undefined) || []
    const disponibles = candidatos.filter(c => !usados.has(c.ordenId))
    const mejor = disponibles
      .map(c => ({ c, dias: diffDias(s.fecha, c.fecha) }))
      .filter(x => x.dias <= ventanaDias)
      .sort((a, b) => a.dias - b.dias)[0]

    if (mejor) {
      usados.add(mejor.c.ordenId)
      matched.push({ shopify: s, dropi: mejor.c })
    } else {
      sinMatch.push(s)
    }
  }

  return { matched, sinMatch }
}

export interface RangoFechas { desde: string; hasta: string }

// Rango de fechas que AMBAS fuentes cubren realmente. Verificado con datos reales: un export de
// Dropi que solo llega hasta el 4-ago comparado contra Shopify hasta el 18-ago da un "79% de
// fuga" que es puro artefacto -- los pedidos del 5 al 18 simplemente todavía no le tocaba
// aparecer en un archivo de Dropi tomado el día 4. Fuera de este rango solapado, "sin match" no
// significa que se perdió el pedido, significa que una de las 2 fuentes no llega tan atrás/
// adelante en el tiempo. Con el mismo par de archivos, la fuga real dentro del rango solapado
// bajó de 79% a 17% -- la diferencia entre un número que asusta sin motivo y uno accionable.
export function rangoSolapado(a: PedidoNormalizado[], b: PedidoNormalizado[]): RangoFechas | null {
  const fechasA = a.map(p => p.fecha).filter(Boolean).sort()
  const fechasB = b.map(p => p.fecha).filter(Boolean).sort()
  if (!fechasA.length || !fechasB.length) return null
  const desde = fechasA[0] > fechasB[0] ? fechasA[0] : fechasB[0]
  const hasta = fechasA[fechasA.length - 1] < fechasB[fechasB.length - 1] ? fechasA[fechasA.length - 1] : fechasB[fechasB.length - 1]
  if (desde > hasta) return null
  return { desde, hasta }
}

export function dentroDeRango(fecha: string, rango: RangoFechas | null): boolean {
  if (!rango) return true
  return fecha >= rango.desde && fecha <= rango.hasta
}

export interface GapMeta { resultadosMeta: number; totalShopify: number; gap: number; pctFuga: number }

// Comparación agregada -- Meta no expone identidad del comprador en sus reportes, así que este
// tramo del embudo no se puede cruzar registro a registro como Shopify↔Dropi, solo en total.
export function compararConMeta(resultadosMeta: number, totalShopify: number): GapMeta {
  const gap = Math.max(0, resultadosMeta - totalShopify)
  const pctFuga = resultadosMeta > 0 ? Math.round((gap / resultadosMeta) * 100) : 0
  return { resultadosMeta, totalShopify, gap, pctFuga }
}

export interface RegistroMeta {
  campana: string; inversion: number; impresiones: number; clics: number
  ctr: number; cpm: number; cpc: number; resultados: number; cpa: number; fecha: string
}

// Movido desde src/app/dashboard/pauta/page.tsx (antes vivía inline ahí) -- ahora lo comparten
// Pauta (carga de resultados de campaña) y Reconciliación (conteo agregado de "resultados" para
// compararlo contra los pedidos reales de Shopify). Alias en español/inglés porque Meta y TikTok
// Ads Manager pueden nombrar las columnas distinto según el idioma de la cuenta.
export function parsearCSVMeta(texto: string): Partial<RegistroMeta>[] {
  const lineas = texto.split('\n').filter(l => l.trim())
  if (lineas.length < 2) return []
  const headers = lineas[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''))

  const idx = (...nombres: string[]) => {
    for (const n of nombres) {
      const i = headers.findIndex(h => h.includes(n))
      if (i >= 0) return i
    }
    return -1
  }
  const iCampana = idx('nombre de la campaña', 'campaign name', 'campaña', 'campaign')
  const iInversion = idx('importe gastado', 'amount spent', 'gasto', 'cost')
  const iAlcance = idx('alcance', 'reach', 'impresiones', 'impressions')
  const iClics = idx('clics en el enlace', 'link clicks', 'clics', 'clicks')
  const iCtr = idx('ctr')
  const iCpm = idx('cpm')
  const iCpc = idx('cpc')
  const iResultados = idx('resultados', 'results', 'conversions', 'conversiones')
  const iCosteResultado = idx('costo por resultado', 'cost per result', 'cost per conversion', 'costo por conversión')
  const iFecha = idx('día', 'day', 'fecha', 'date')

  return lineas.slice(1).map(linea => {
    const cols = linea.split(',').map(c => c.trim().replace(/"/g, ''))
    const num = (i: number) => (i >= 0 ? parseFloat(cols[i]?.replace(/[^0-9.-]/g, '')) || 0 : 0)
    return {
      campana: iCampana >= 0 ? cols[iCampana] : 'Sin nombre',
      inversion: num(iInversion), impresiones: num(iAlcance), clics: num(iClics),
      ctr: num(iCtr), cpm: num(iCpm), cpc: num(iCpc),
      resultados: num(iResultados), cpa: iCosteResultado >= 0 ? num(iCosteResultado) : 0,
      fecha: iFecha >= 0 && cols[iFecha] ? cols[iFecha] : new Date().toISOString().slice(0, 10),
    }
  }).filter(r => r.campana && r.campana !== 'Sin nombre')
}
