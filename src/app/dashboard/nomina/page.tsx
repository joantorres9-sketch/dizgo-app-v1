'use client'
import { useEffect, useState, Fragment } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PAISES, buscarPaises, paisPorCodigo, divisionesPorPais, etiquetaDivision, configRHPorPais } from '@/lib/paises'
import * as XLSX from 'xlsx'
import { construirColillaPDF } from '@/lib/colillaPdf'

// ── TEMA ──────────────────────────────────────────────────
const T = {
  bg:'#0D1E35', card:'#081426', card2:'#0A1628',
  accent:'#F58720', blue:'#3D8EF0', green:'#2DD4A0',
  red:'#F05C5C', yellow:'#F5A623', purple:'#9B6BFF',
  text:'#E8EDF5', muted:'#5A7A9A', border:'#152238',
}

// ── TIPOS ─────────────────────────────────────────────────
interface Colaborador {
  id: string; tenant_id: string; nombres: string; apellidos: string
  tipo_doc: string; num_doc: string; foto_url: string
  fecha_nacimiento: string; genero: string; estado_civil: string
  tiene_conyuge: boolean; datos_conyuge: Record<string, string>
  tiene_hijos: boolean; datos_hijos: Array<Record<string, string>>
  pais_code: string; pais_nacimiento_code: string; departamento: string; ciudad: string
  direccion: string; codigo_tel: string; celular: string; email: string; correo_personal: string
  contacto_emergencia: Record<string, string>
  nivel_formacion: string; cargo: string; cargo_id: string; proceso_id: string
  tipo_contrato: string; fecha_ingreso: string; fecha_fin: string
  jornada: string; lugar_ejecucion: string; sede: string
  salario_base: number; aux_transporte: number; tipo_salario: string
  nivel_arl: number; es_pensionado: boolean; aplica_ley1607: boolean
  tipo_cotizante: string; eps: string; pension: string; arl: string
  caja_comp: string; cesantias: string; banco: string
  tipo_cuenta: string; num_cuenta: string
  doc_pension_url: string; doc_ss_independiente_url: string
  docs_urls: Record<string, string>; activo: boolean
  carga_total_mes: number
}
interface Proceso {
  id: string; nombre: string; descripcion: string; orden: number; activo: boolean; tipo: string
  responsable_id: string | null
}
interface Cargo {
  id: string; proceso_id: string; nombre: string; tipo: string; activo: boolean
  reporta_a_id: string | null
}
interface Indicador {
  id: string; proceso_id: string; nombre: string; objetivo: string; formula: string
  unidad: string; frecuencia: string; meta: number; activo: boolean; origen: string
}
interface Medicion {
  id: string; indicador_id: string; fecha: string; valor: number; nota: string
}
interface TasaHistorico {
  id: string; pais_code: string; anio_fiscal: number
  vigencia_inicio: string; vigencia_fin: string; estado: string
  salario_minimo: number; aux_transporte: number
  salud_emp: number; pension_emp: number
  arl_nivel1: number; arl_nivel2: number; arl_nivel3: number
  arl_nivel4: number; arl_nivel5: number
  sena: number; icbf: number; caja_comp: number
  cesantias: number; intereses_ces: number; prima: number; vacaciones: number
  salud_trab: number; pension_trab: number; tope_exoneracion: number
}

// ── CONSTANTES POR PAÍS (consolidadas en src/lib/paises.ts) ──
// País operativo/domicilio: usa configRHPorPais(pais_code) para entidades EPS/pensión/ARL/banco,
// niveles de formación y tipos de cuenta. País de nacimiento es independiente (ver pais_nacimiento_code).

const TIPOS_NOVEDAD = [
  { cat: 'A. Incapacidades y Licencias', items: [
    { v:'inc_enfermedad',   l:'Incapacidad Enfermedad Común',      campos:['fecha_inicio','fecha_fin','dias','radicado'] },
    { v:'inc_at',           l:'Incapacidad Accidente Trabajo/EL',  campos:['fecha_inicio','fecha_fin','dias','radicado'] },
    { v:'lic_maternidad',   l:'Licencia Maternidad',               campos:['fecha_inicio','fecha_fin','dias'] },
    { v:'lic_paternidad',   l:'Licencia Paternidad',               campos:['fecha_inicio','fecha_fin','dias'] },
    { v:'lic_luto',         l:'Licencia por Luto (5 días hábiles)',campos:['fecha_inicio'] },
    { v:'lic_calamidad',    l:'Licencia Grave Calamidad',          campos:['fecha_inicio','fecha_fin','dias','descripcion'] },
    { v:'lic_remunerada',   l:'Licencia Remunerada',               campos:['fecha_inicio','fecha_fin','dias','descripcion'] },
    { v:'lic_no_remun',     l:'Licencia NO Remunerada',            campos:['fecha_inicio','fecha_fin','dias'] },
  ]},
  { cat: 'B. Disciplinarias', items: [
    { v:'suspension',       l:'Suspensión Disciplinaria',          campos:['fecha_inicio','dias','descripcion'] },
    { v:'sancion_impunt',   l:'Sanción por Impuntualidad',         campos:['fecha','valor','descripcion'] },
  ]},
  { cat: 'C. Descuentos', items: [
    { v:'prestamo',         l:'Préstamo Empresa',                  campos:['monto_total','valor_cuota','num_cuota'] },
    { v:'deduccion_daños',  l:'Deducción por Daños/Pérdidas',      campos:['valor','descripcion'] },
    { v:'anticipo',         l:'Anticipo de Nómina',                campos:['valor'] },
    { v:'libranza',         l:'Libranza Entidad Externa',          campos:['valor','entidad','descripcion'] },
    { v:'embargo',          l:'Embargo Judicial',                  campos:['valor','descripcion'] },
  ]},
  { cat: 'D. Adiciones y Devengos', items: [
    { v:'he_diurna',        l:'Hora Extra Diurna (+25%)',          campos:['cantidad_horas'] },
    { v:'he_nocturna',      l:'Hora Extra Nocturna (+75%)',        campos:['cantidad_horas'] },
    { v:'he_dom_diurna',    l:'HE Dominical Diurna (+100%)',       campos:['cantidad_horas'] },
    { v:'he_dom_nocturna',  l:'HE Dominical Nocturna (+150%)',     campos:['cantidad_horas'] },
    { v:'recargo_noc',      l:'Recargo Nocturno (+35%)',           campos:['cantidad_horas'] },
    { v:'recargo_dom',      l:'Recargo Dominical/Festivo (+75%)',  campos:['cantidad_horas'] },
    { v:'recargo_noc_dom',  l:'Recargo Nocturno Dominical (+110%)',campos:['cantidad_horas'] },
    { v:'bonif_habitual',   l:'Bonificación Habitual (suma SS)',   campos:['valor'] },
    { v:'bonif_no_hab',     l:'Bonificación NO Habitual',         campos:['valor'] },
    { v:'comision',         l:'Comisiones por Ventas',             campos:['valor'] },
    { v:'aux_rodamiento',   l:'Auxilio de Rodamiento/Herramientas',campos:['valor'] },
  ]},
  { cat: 'E. Autorregistradas por el colaborador', items: [
    { v:'vacaciones',    l:'Vacaciones (autorregistro)',    campos:['fecha_inicio','fecha_fin'] },
    { v:'incapacidad',   l:'Incapacidad (autorregistro)',   campos:['fecha_inicio','fecha_fin'] },
    { v:'auxilio',       l:'Auxilio (autorregistro)',       campos:['descripcion'] },
  ]},
]

const TASAS_COL_2025: Partial<TasaHistorico> = {
  pais_code:'COL', anio_fiscal:2025, estado:'activo',
  salario_minimo:1300000, aux_transporte:162000,
  salud_emp:8.5, pension_emp:12,
  arl_nivel1:0.522, arl_nivel2:1.044, arl_nivel3:2.436, arl_nivel4:4.350, arl_nivel5:6.960,
  sena:2, icbf:3, caja_comp:4,
  cesantias:8.33, intereses_ces:1, prima:8.33, vacaciones:4.17,
  salud_trab:4, pension_trab:4, tope_exoneracion:10,
}

// ── ESTILOS BASE ──────────────────────────────────────────
const inp: React.CSSProperties = {
  width:'100%', background:'#0A1628', border:`1.5px solid ${T.border}`,
  borderRadius:'8px', padding:'8px 10px', fontSize:'12px',
  color:T.text, outline:'none', boxSizing:'border-box',
}
const lbl: React.CSSProperties = { fontSize:'11px', color:T.muted, marginBottom:'4px', display:'block' }
const row2: React.CSSProperties = { display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))', gap:'8px', marginBottom:'10px' }
const row3: React.CSSProperties = { display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))', gap:'8px', marginBottom:'10px' }
const sec: React.CSSProperties = { fontSize:'11px', fontWeight:'700', letterSpacing:'0.05em', marginBottom:'8px', marginTop:'16px' }
// El ícono nativo del selector de fecha es negro y se vuelve invisible sobre fondo oscuro —
// color-scheme:dark hace que el navegador dibuje el ícono en tono claro.
const inpDate: React.CSSProperties = { ...inp, colorScheme: 'dark' }

// ── Tooltip de ayuda reutilizable (ícono ⓘ, texto al hover) ──
function Ayuda({ texto }: { texto: string }) {
  const [open, setOpen] = useState(false)
  return (
    <span style={{ position:'relative', display:'inline-block', marginLeft:'5px' }}>
      <span
        onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}
        style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:'13px', height:'13px', borderRadius:'50%', background:`${T.blue}30`, color:T.blue, fontSize:'9px', fontWeight:'700', cursor:'help' }}
      >ⓘ</span>
      {open && (
        <span style={{ position:'absolute', bottom:'18px', left:'0', zIndex:50, width:'220px', background:'#050B16', border:`1px solid ${T.border}`, borderRadius:'7px', padding:'8px 10px', fontSize:'10.5px', lineHeight:1.5, color:T.text, boxShadow:'0 6px 18px rgba(0,0,0,.5)' }}>
          {texto}
        </span>
      )}
    </span>
  )
}

// ── Input numérico con separador de miles en vivo (1.500.000, no 1500000) ──
function InputMiles({ value, onChange, style }: { value: number; onChange: (v: number) => void; style?: React.CSSProperties }) {
  const [texto, setTexto] = useState(value ? value.toLocaleString('es-CO') : '')
  useEffect(() => {
    const limpio = parseInt(texto.replace(/\D/g, ''), 10) || 0
    if (limpio !== value) setTexto(value ? value.toLocaleString('es-CO') : '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])
  return (
    <input
      style={style || inp}
      inputMode="numeric"
      value={texto}
      onChange={e => {
        const digitos = e.target.value.replace(/\D/g, '')
        const num = digitos ? parseInt(digitos, 10) : 0
        setTexto(num ? num.toLocaleString('es-CO') : '')
        onChange(num)
      }}
    />
  )
}

// ── Combo buscable (filtra mientras escribes) — país, banco, etc. ──
function ComboBuscable({ value, onChange, opciones, placeholder }: {
  value: string; onChange: (v: string) => void; opciones: string[]; placeholder?: string
}) {
  const [q, setQ] = useState(value)
  const [open, setOpen] = useState(false)
  useEffect(() => { setQ(value) }, [value])
  const filtradas = opciones.filter(o => o.toLowerCase().includes(q.toLowerCase())).slice(0, 30)
  return (
    <div style={{ position:'relative' }}>
      <input
        style={inp} value={q} placeholder={placeholder || 'Buscar...'}
        onChange={e => { setQ(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && filtradas.length > 0 && (
        <div style={{ position:'absolute', top:'calc(100% + 4px)', left:0, right:0, zIndex:50, maxHeight:'180px', overflowY:'auto', background:'#050B16', border:`1px solid ${T.border}`, borderRadius:'8px', boxShadow:'0 6px 18px rgba(0,0,0,.5)' }}>
          {filtradas.map(o => (
            <div key={o} onMouseDown={() => { onChange(o); setQ(o); setOpen(false) }}
              style={{ padding:'7px 10px', fontSize:'12px', color:T.text, cursor:'pointer' }}
              onMouseEnter={e => e.currentTarget.style.background = '#0F1E32'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              {o}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function fmt(v: number, pais = 'COL'): string {
  const cfgs: Record<string,{locale:string;currency:string;dec:number}> = {
    COL:{locale:'es-CO',currency:'COP',dec:0}, ECU:{locale:'en-US',currency:'USD',dec:2},
    MEX:{locale:'es-MX',currency:'MXN',dec:2}, PER:{locale:'es-PE',currency:'PEN',dec:2},
    CHL:{locale:'es-CL',currency:'CLP',dec:0}, ARG:{locale:'es-AR',currency:'ARS',dec:2},
  }
  const c = cfgs[pais] || cfgs.COL
  return new Intl.NumberFormat(c.locale,{style:'currency',currency:c.currency,minimumFractionDigits:c.dec}).format(v)
}

// Honorarios/Contratista: independientes que facturan por prestación de servicios — no
// acumulan prestaciones sociales (cesantías, prima, vacaciones) ni auxilio de transporte, y
// gestionan su propia seguridad social (la empresa solo verifica soporte de pago). Ver
// tipoEsIndependiente().
function tipoEsIndependiente(tipo_contrato: string): boolean {
  return tipo_contrato === 'Honorarios' || tipo_contrato === 'Contratista'
}

// Auxilio de transporte (Colombia): aplica solo si el salario base es ≤ 2 SMMLV vigentes y el
// contrato NO es independiente. Otros países: no se calcula automático (normativa no verificada).
function calcAuxTransporte(salario_base: number, tipo_contrato: string, pais_code: string, tasas: Partial<TasaHistorico>): number {
  if (pais_code !== 'COL') return 0
  if (tipoEsIndependiente(tipo_contrato)) return 0
  const dosSmmlv = (tasas.salario_minimo || 1300000) * 2
  return salario_base > 0 && salario_base <= dosSmmlv ? (tasas.aux_transporte || 162000) : 0
}

function calcCarga(colab: Partial<Colaborador>, tasas: Partial<TasaHistorico>): number {
  const s = colab.salario_base || 0
  if (tipoEsIndependiente(colab.tipo_contrato || '')) return Math.round(s)
  const arl_pcts = [tasas.arl_nivel1||0.522,tasas.arl_nivel2||1.044,tasas.arl_nivel3||2.436,tasas.arl_nivel4||4.350,tasas.arl_nivel5||6.960]
  const nivel = (colab.nivel_arl || 1) - 1
  const smmlv10 = (tasas.salario_minimo||1300000) * (tasas.tope_exoneracion||10)
  const exonera = s < smmlv10 && colab.aplica_ley1607
  const sena = exonera ? 0 : (tasas.sena||2)/100
  const icbf = exonera ? 0 : (tasas.icbf||3)/100
  const carga = s * (
    (tasas.salud_emp||8.5)/100 + (tasas.pension_emp||12)/100 +
    arl_pcts[nivel]/100 + sena + icbf + (tasas.caja_comp||4)/100 +
    (tasas.cesantias||8.33)/100 + (tasas.intereses_ces||1)/100 +
    (tasas.prima||8.33)/100 + (tasas.vacaciones||4.17)/100
  )
  return Math.round(s + carga + (colab.aux_transporte || 0))
}

// Multiplicador de horas extra/recargos (Código Sustantivo del Trabajo, Colombia) — mismo mapa
// usado en el registro de novedades, reutilizado aquí para no duplicar la tabla de porcentajes.
const MULT_HORAS: Record<string, number> = {
  he_diurna:1.25, he_nocturna:1.75, he_dom_diurna:2, he_dom_nocturna:2.5,
  recargo_noc:1.35, recargo_dom:1.75, recargo_noc_dom:2.10,
}

interface LineaLiquidacion { concepto: string; valor: number }
interface LiquidacionResultado {
  devengado: LineaLiquidacion[]; totalDevengado: number
  ibc: number
  deducciones: LineaLiquidacion[]; totalDeducciones: number
  neto: number
  apropiaciones: LineaLiquidacion[]; totalApropiaciones: number
  cargaTotal: number
  avisoPaisNoVerificado: boolean
  avisoFsp: boolean
}

// Motor de liquidación de nómina — fórmulas exactas de Colombia (Devengado/IBC/Deducciones/
// Apropiaciones) según el documento de mejoras del módulo. Para países ≠ COL se usa un cálculo
// simplificado (sin retefuente/FSP/exoneración, que son normativa colombiana específica) y se
// marca `avisoPaisNoVerificado` para que la UI muestre el aviso de verificar con asesor local.
function calcularLiquidacion(
  colab: Colaborador,
  novedadesPeriodo: Array<Record<string, unknown>>,
  tasas: Partial<TasaHistorico>,
  esquema: 'mensual' | 'quincenal',
): LiquidacionResultado {
  const esCOL = colab.pais_code === 'COL'
  const independiente = tipoEsIndependiente(colab.tipo_contrato)
  const diasPeriodo = esquema === 'quincenal' ? 15 : 30
  const salarioProp = independiente ? (colab.salario_base || 0) : Math.round((colab.salario_base || 0) / 30 * diasPeriodo)

  const auxTransporteMes = calcAuxTransporte(colab.salario_base || 0, colab.tipo_contrato, colab.pais_code, tasas)
  const auxTransporte = independiente ? 0 : (esquema === 'quincenal' ? Math.round(auxTransporteMes / 2) : auxTransporteMes)

  const novedadesColab = novedadesPeriodo.filter(n => n.colaborador_id === colab.id && n.estado === 'aprobada')
  const horasExtra = novedadesColab.filter(n => MULT_HORAS[String(n.tipo)]).reduce((a, n) => a + Number(n.valor || 0), 0)
  const comisionesBonif = novedadesColab.filter(n => ['bonif_habitual','bonif_no_hab','comision','aux_rodamiento'].includes(String(n.tipo))).reduce((a, n) => a + Number(n.valor || 0), 0)
  const otrosDescuentos = novedadesColab.filter(n => ['prestamo','deduccion_daños','anticipo','libranza','embargo','sancion_impunt'].includes(String(n.tipo))).reduce((a, n) => a + Number(n.valor || 0), 0)

  const devengado: LineaLiquidacion[] = [
    { concepto: esquema === 'quincenal' ? 'Sueldo (quincena)' : 'Sueldo proporcional', valor: salarioProp },
    ...(auxTransporte > 0 ? [{ concepto: 'Auxilio de transporte', valor: auxTransporte }] : []),
    ...(horasExtra > 0 ? [{ concepto: 'Horas extra / recargos', valor: horasExtra }] : []),
    ...(comisionesBonif > 0 ? [{ concepto: 'Comisiones / bonificaciones', valor: comisionesBonif }] : []),
  ]
  const totalDevengado = devengado.reduce((a, d) => a + d.valor, 0)

  // IBC excluye auxilio de transporte (mismo criterio que calcCarga) — sí incluye horas extra y
  // comisiones/bonificaciones habituales, que por ley sí cotizan a seguridad social.
  const ibc = salarioProp + horasExtra + comisionesBonif

  let deducciones: LineaLiquidacion[] = []
  let apropiaciones: LineaLiquidacion[] = []
  let avisoFsp = false

  if (esCOL && !independiente) {
    const salud = Math.round(ibc * (tasas.salud_trab || 4) / 100)
    const pension = Math.round(ibc * (tasas.pension_trab || 4) / 100)
    const smmlv = tasas.salario_minimo || 1300000
    // FSP progresivo desde 4 SMMLV (1%) y 16 SMMLV (2%) — tramos intermedios varían según
    // decreto vigente; se muestra `avisoFsp` para que RRHH verifique el tramo exacto con su
    // contador antes de pagar, en vez de asumir un porcentaje no verificado.
    let fsp = 0
    if (ibc >= smmlv * 16) { fsp = Math.round(ibc * 0.02); avisoFsp = true }
    else if (ibc >= smmlv * 4) { fsp = Math.round(ibc * 0.01); avisoFsp = true }
    deducciones = [
      { concepto: 'Salud (4%)', valor: salud },
      { concepto: 'Pensión (4%)', valor: pension },
      ...(fsp > 0 ? [{ concepto: 'Fondo de Solidaridad Pensional', valor: fsp }] : []),
      ...(otrosDescuentos > 0 ? [{ concepto: 'Otros descuentos (préstamos/embargos/anticipos)', valor: otrosDescuentos }] : []),
    ]

    const arl_pcts = [tasas.arl_nivel1||0.522,tasas.arl_nivel2||1.044,tasas.arl_nivel3||2.436,tasas.arl_nivel4||4.350,tasas.arl_nivel5||6.960]
    const nivel = (colab.nivel_arl || 1) - 1
    const smmlv10 = smmlv * (tasas.tope_exoneracion || 10)
    const exonera = ibc < smmlv10 && colab.aplica_ley1607
    const sena = exonera ? 0 : Math.round(ibc * (tasas.sena || 2) / 100)
    const icbf = exonera ? 0 : Math.round(ibc * (tasas.icbf || 3) / 100)
    apropiaciones = [
      { concepto: `Salud empleador (${tasas.salud_emp || 8.5}%)`, valor: Math.round(ibc * (tasas.salud_emp || 8.5) / 100) },
      { concepto: `Pensión empleador (${tasas.pension_emp || 12}%)`, valor: Math.round(ibc * (tasas.pension_emp || 12) / 100) },
      { concepto: `ARL nivel ${colab.nivel_arl || 1} (${arl_pcts[nivel]}%)`, valor: Math.round(ibc * arl_pcts[nivel] / 100) },
      { concepto: `Caja de Compensación (${tasas.caja_comp || 4}%)`, valor: Math.round(ibc * (tasas.caja_comp || 4) / 100) },
      ...(sena > 0 ? [{ concepto: `SENA (${tasas.sena || 2}%)`, valor: sena }] : []),
      ...(icbf > 0 ? [{ concepto: `ICBF (${tasas.icbf || 3}%)`, valor: icbf }] : []),
      { concepto: `Prima de servicios (${tasas.prima || 8.33}%)`, valor: Math.round(ibc * (tasas.prima || 8.33) / 100) },
      { concepto: `Cesantías (${tasas.cesantias || 8.33}%)`, valor: Math.round(ibc * (tasas.cesantias || 8.33) / 100) },
      { concepto: `Intereses cesantías (${tasas.intereses_ces || 1}%)`, valor: Math.round(ibc * (tasas.intereses_ces || 1) / 100) },
      { concepto: `Vacaciones (${tasas.vacaciones || 4.17}%)`, valor: Math.round(ibc * (tasas.vacaciones || 4.17) / 100) },
    ]
  } else if (otrosDescuentos > 0) {
    deducciones = [{ concepto: 'Otros descuentos', valor: otrosDescuentos }]
  }

  const totalDeducciones = deducciones.reduce((a, d) => a + d.valor, 0)
  const totalApropiaciones = apropiaciones.reduce((a, d) => a + d.valor, 0)
  const neto = totalDevengado - totalDeducciones

  return {
    devengado, totalDevengado, ibc, deducciones, totalDeducciones, neto,
    apropiaciones, totalApropiaciones, cargaTotal: totalDevengado + totalApropiaciones,
    avisoPaisNoVerificado: !esCOL, avisoFsp,
  }
}

// ── MODAL COLABORADOR (Formulario completo) ───────────────
function ModalColaborador({
  onClose, onSave, tenantId, editData, procesos, tasas, onProcesoCreado, cargos, onCargoCreado,
}: {
  onClose: () => void; onSave: () => void; tenantId: string
  editData: Colaborador | null; procesos: Proceso[]
  tasas: Partial<TasaHistorico>
  onProcesoCreado: (nombre: string, tipo: string) => Promise<string | null>
  cargos: Cargo[]
  onCargoCreado: (nombre: string, procesoId: string) => Promise<string | null>
}) {
  const supabase = createClient()
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState<Record<string,boolean>>({})
  const [fotoDisplayUrl, setFotoDisplayUrl] = useState('')
  const [mostrarNuevoProceso, setMostrarNuevoProceso] = useState(false)
  const [nuevoProcesoNombre, setNuevoProcesoNombre] = useState('')
  const [nuevoProcesoTipo, setNuevoProcesoTipo] = useState('Misional')
  const [mostrarNuevoCargo, setMostrarNuevoCargo] = useState(false)
  const [nuevoCargoNombre, setNuevoCargoNombre] = useState('')
  const [docUrls, setDocUrls] = useState<Record<string,string>>({
    ...(editData?.docs_urls || {}),
    ...(editData?.doc_pension_url ? { pension_doc: editData.doc_pension_url } : {}),
    ...(editData?.doc_ss_independiente_url ? { ss_independiente_doc: editData.doc_ss_independiente_url } : {}),
  })

  const [f, setF] = useState({
    nombres: editData?.nombres || '', apellidos: editData?.apellidos || '',
    tipo_doc: editData?.tipo_doc || 'CC', num_doc: editData?.num_doc || '',
    foto_url: editData?.foto_url || '', fecha_nacimiento: editData?.fecha_nacimiento || '',
    genero: editData?.genero || 'M', estado_civil: editData?.estado_civil || 'Soltero',
    tiene_conyuge: editData?.tiene_conyuge || false, datos_conyuge: editData?.datos_conyuge || {},
    tiene_hijos: editData?.tiene_hijos || false, datos_hijos: editData?.datos_hijos || [],
    pais_code: editData?.pais_code || 'COL', pais_nacimiento_code: editData?.pais_nacimiento_code || '',
    departamento: editData?.departamento || '',
    ciudad: editData?.ciudad || '', direccion: editData?.direccion || '',
    codigo_tel: editData?.codigo_tel || '+57', celular: editData?.celular || '',
    email: editData?.email || '', correo_personal: editData?.correo_personal || '',
    contacto_emergencia: editData?.contacto_emergencia || { nombre:'', parentesco:'', celular:'' },
    nivel_formacion: editData?.nivel_formacion || '',
    cargo: editData?.cargo || '', cargo_id: editData?.cargo_id || '', proceso_id: editData?.proceso_id || '',
    tipo_contrato: editData?.tipo_contrato || 'Empleado',
    fecha_ingreso: editData?.fecha_ingreso || '', fecha_fin: editData?.fecha_fin || '',
    jornada: editData?.jornada || 'Tiempo completo',
    lugar_ejecucion: editData?.lugar_ejecucion || '', sede: editData?.sede || '',
    salario_base: editData?.salario_base || 0, aux_transporte: editData?.aux_transporte || 0,
    tipo_salario: editData?.tipo_salario || 'Fijo',
    nivel_arl: editData?.nivel_arl || 1, es_pensionado: editData?.es_pensionado || false,
    aplica_ley1607: editData?.aplica_ley1607 || false, tipo_cotizante: editData?.tipo_cotizante || '1',
    eps: editData?.eps || '', pension: editData?.pension || '', arl: editData?.arl || '',
    caja_comp: editData?.caja_comp || '', cesantias: editData?.cesantias || '',
    banco: editData?.banco || '', tipo_cuenta: editData?.tipo_cuenta || 'Ahorros',
    num_cuenta: editData?.num_cuenta || '',
  })

  const paisConfig = configRHPorPais(f.pais_code)
  const paisNombre = paisPorCodigo(f.pais_code)?.nombre || f.pais_code
  const esIndependiente = tipoEsIndependiente(f.tipo_contrato)
  const cargaTotal = calcCarga(f as Partial<Colaborador>, tasas)

  // Alerta contrato término fijo
  const diasAlerta = f.fecha_fin ? Math.ceil((new Date(f.fecha_fin).getTime() - Date.now()) / 86400000) : null

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const v = e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value
    setF(prev => ({ ...prev, [k]: v }))
  }

  async function uploadDoc(id: string, file: File | null) {
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { alert('El archivo supera el máximo de 5MB'); return }
    setUploading(u => ({ ...u, [id]: true }))
    try {
      const path = `nomina/${tenantId}/${Date.now()}_${id}_${file.name}`
      const { error: err } = await supabase.storage.from('documentos-nomina').upload(path, file, { contentType: file.type || 'application/pdf' })
      if (err) throw err
      // Bucket privado: se guarda solo la ruta; la URL firmada (temporal) se genera al momento de ver el documento.
      setDocUrls(d => ({ ...d, [id]: path }))
    } catch (e: unknown) {
      console.error('Error subiendo documento de nómina:', e)
      const msg = e instanceof Error ? e.message : 'Error desconocido'
      alert(`Error al subir archivo: ${msg}`)
    }
    finally { setUploading(u => ({ ...u, [id]: false })) }
  }

  async function verDoc(path: string) {
    if (!path) return
    const { data, error: err } = await supabase.storage.from('documentos-nomina').createSignedUrl(path, 300)
    if (err || !data?.signedUrl) { alert('No se pudo generar el link del documento'); return }
    window.open(data.signedUrl, '_blank')
  }

  useEffect(() => {
    if (!f.foto_url) { setFotoDisplayUrl(''); return }
    supabase.storage.from('documentos-nomina').createSignedUrl(f.foto_url, 3600).then(({ data }) => {
      if (data?.signedUrl) setFotoDisplayUrl(data.signedUrl)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.foto_url])

  // Auxilio de transporte automático (Colombia, solo contratos dependientes) — el usuario puede
  // seguir editándolo manualmente para el resto de países.
  useEffect(() => {
    if (f.pais_code !== 'COL' || tipoEsIndependiente(f.tipo_contrato)) return
    const auto = calcAuxTransporte(f.salario_base, f.tipo_contrato, f.pais_code, tasas)
    setF(prev => prev.aux_transporte === auto ? prev : { ...prev, aux_transporte: auto })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.salario_base, f.tipo_contrato, f.pais_code])

  async function guardar() {
    if (!f.nombres || !f.num_doc || !f.cargo) { setError('Nombres, documento y cargo son obligatorios'); return }
    setSaving(true); setError('')
    try {
      const { pension_doc, ss_independiente_doc, ...restDocs } = docUrls
      const payload = {
        ...f, tenant_id: tenantId, activo: true, docs_urls: restDocs,
        doc_pension_url: pension_doc || null, doc_ss_independiente_url: ss_independiente_doc || null,
        carga_total_mes: cargaTotal,
      }
      if (editData?.id) {
        const { error: err } = await supabase.from('colaboradores').update(payload).eq('id', editData.id)
        if (err) throw err
      } else {
        const { error: err } = await supabase.from('colaboradores').insert(payload)
        if (err) throw err
      }
      onSave()
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Error') }
    finally { setSaving(false) }
  }

  const STEPS = ['👤 Info Básica', '🔐 Seguridad Social', '💼 Info Laboral', '📄 Documentos']

  const fileBtn = (id: string, label: string, req = false) => (
    <div style={{ marginBottom: '8px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'4px' }}>
        <label style={lbl}>{label}{req ? ' *' : ''}</label>
        {req && <span style={{ fontSize:'9px', color:T.red, padding:'1px 5px', borderRadius:'3px', background:`${T.red}15` }}>Obligatorio</span>}
      </div>
      <div style={{ display:'flex', gap:'6px' }}>
        <label style={{
          flex:1, display:'block', padding:'10px', textAlign:'center',
          background:'#0A1628', border:`1.5px dashed ${docUrls[id] ? T.green : T.border}`,
          borderRadius:'8px', cursor:'pointer', fontSize:'11px',
          color: docUrls[id] ? T.green : T.muted, boxSizing:'border-box',
        }}>
          {uploading[id] ? 'Subiendo...' : docUrls[id] ? '✓ Archivo cargado — clic para reemplazar' : '+ Subir PDF · máx. 5MB'}
          <input type="file" accept="application/pdf" style={{ display:'none' }} onChange={e => uploadDoc(id, e.target.files?.[0] || null)} />
        </label>
        {docUrls[id] && (
          <button type="button" onClick={() => verDoc(docUrls[id])}
            style={{ padding:'0 12px', background:`${T.blue}15`, border:`1px solid ${T.blue}30`, borderRadius:'8px', color:T.blue, cursor:'pointer', fontSize:'11px' }}>
            👁 Ver
          </button>
        )}
      </div>
    </div>
  )

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:'20px', backdropFilter:'blur(4px)' }}>
      <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:'14px', width:'min(700px,100%)', maxHeight:'90vh', overflow:'hidden', display:'flex', flexDirection:'column' }}>

        {/* Header + stepper */}
        <div style={{ padding:'16px 20px', borderBottom:`1px solid ${T.border}`, flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'12px' }}>
            <div style={{ fontSize:'14px', fontWeight:'700', color:T.text }}>{editData ? 'Editar colaborador' : 'Nuevo colaborador'}</div>
            <button onClick={onClose} style={{ background:'none', border:'none', color:T.muted, cursor:'pointer', fontSize:'18px' }}>✕</button>
          </div>
          {/* Barra de progreso */}
          <div style={{ display:'flex', gap:'0' }}>
            {STEPS.map((s, i) => (
              <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center' }}>
                <div style={{ display:'flex', alignItems:'center', width:'100%' }}>
                  {i > 0 && <div style={{ flex:1, height:'2px', background: i <= step ? T.accent : T.border }} />}
                  <button
                    onClick={() => setStep(i)}
                    style={{
                      width:'28px', height:'28px', borderRadius:'50%', flexShrink:0, border:'none',
                      background: i < step ? T.green : i === step ? T.accent : T.border,
                      color: i <= step ? T.card : T.muted, fontSize:'11px', fontWeight:'700', cursor:'pointer',
                    }}
                  >{i < step ? '✓' : i + 1}</button>
                  {i < 3 && <div style={{ flex:1, height:'2px', background: i < step ? T.accent : T.border }} />}
                </div>
                <div style={{ fontSize:'9px', color: i === step ? T.accent : T.muted, marginTop:'4px', whiteSpace:'nowrap' }}>{s}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Cuerpo */}
        <div style={{ overflowY:'auto', flex:1, padding:'18px 20px' }}>

          {/* Carga total preview */}
          <div style={{ background:`${T.blue}10`, border:`1px solid ${T.blue}20`, borderRadius:'8px', padding:'8px 14px', marginBottom:'14px', display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:'12px' }}>
            <span style={{ color:T.muted }}>Carga prestacional total estimada</span>
            <strong style={{ color:T.blue, fontSize:'14px' }}>{fmt(cargaTotal, f.pais_code)}/mes</strong>
          </div>

          {/* Alerta contrato fijo venciendo */}
          {diasAlerta !== null && diasAlerta <= 40 && (
            <div style={{ background:diasAlerta <= 0 ? `${T.red}15` : `${T.yellow}15`, border:`1px solid ${diasAlerta <= 0 ? T.red : T.yellow}30`, borderRadius:'8px', padding:'8px 14px', marginBottom:'12px', fontSize:'12px', color: diasAlerta <= 0 ? T.red : T.yellow }}>
              {diasAlerta <= 0 ? '🔴 Contrato VENCIDO' : `⚠️ Contrato vence en ${diasAlerta} días`} — {new Date(f.fecha_fin).toLocaleDateString('es-CO')}
            </div>
          )}

          {/* STEP 0: Info básica */}
          {step === 0 && (
            <div>
              <div style={{ ...sec, color:T.accent }}>📋 DATOS PERSONALES</div>
              {/* Foto */}
              <div style={{ marginBottom:'10px', textAlign:'center' }}>
                <div style={{ width:'72px', height:'72px', borderRadius:'50%', background:`${T.blue}20`, border:`2px dashed ${T.border}`, margin:'0 auto 6px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'28px', overflow:'hidden' }}>
                  {fotoDisplayUrl ? <img src={fotoDisplayUrl} alt="foto" style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : '👤'}
                </div>
                <label style={{ fontSize:'11px', color:T.accent, cursor:'pointer', textDecoration:'underline' }}>
                  {uploading.foto ? 'Subiendo...' : 'Subir foto'}
                  <input type="file" accept="image/*" style={{ display:'none' }} onChange={async (e) => {
                    const file = e.target.files?.[0]; if (!file) return
                    setUploading(u => ({ ...u, foto: true }))
                    const path = `nomina/${tenantId}/foto_${Date.now()}_${file.name}`
                    const { error: err } = await supabase.storage.from('documentos-nomina').upload(path, file, { contentType: file.type })
                    if (err) {
                      console.error('Error subiendo foto:', err)
                      alert(`Error al subir foto: ${err.message}`)
                    } else {
                      setF(prev => ({ ...prev, foto_url: path }))
                    }
                    setUploading(u => ({ ...u, foto: false }))
                  }} />
                </label>
              </div>

              <div style={row2}>
                <div><label style={lbl}>Nombres *</label><input style={inp} value={f.nombres} onChange={set('nombres')} placeholder="Joan Alexander" /></div>
                <div><label style={lbl}>Apellidos *</label><input style={inp} value={f.apellidos} onChange={set('apellidos')} placeholder="Torres Marín" /></div>
              </div>
              <div style={row2}>
                <div>
                  <label style={lbl}>Tipo documento</label>
                  <select style={{ ...inp, appearance:'none' as React.CSSProperties['appearance'] }} value={f.tipo_doc} onChange={set('tipo_doc')}>
                    {['CC','CE','Pasaporte','CI','DNI','CURP','NIF','DPI','TI','RUC'].map(v => <option key={v}>{v}</option>)}
                  </select>
                </div>
                <div><label style={lbl}>Número documento *</label><input style={inp} value={f.num_doc} onChange={set('num_doc')} /></div>
              </div>
              <div style={row2}>
                <div><label style={lbl}>Fecha nacimiento</label><input style={inpDate} type="date" value={f.fecha_nacimiento} onChange={set('fecha_nacimiento')} /></div>
                <div>
                  <label style={lbl}>Género</label>
                  <select style={{ ...inp, appearance:'none' as React.CSSProperties['appearance'] }} value={f.genero} onChange={set('genero')}>
                    {['M','F','Otro'].map(v => <option key={v}>{v}</option>)}
                  </select>
                </div>
              </div>

              <div style={row2}>
                <div>
                  <label style={lbl}>País de nacimiento<Ayuda texto="Independiente del país donde opera la tienda — busca por nombre, ej. si nació en Venezuela pero trabaja en Colombia." /></label>
                  <ComboBuscable
                    value={paisPorCodigo(f.pais_nacimiento_code)?.nombre || ''}
                    onChange={nombre => { const p = PAISES.find(x => x.nombre === nombre); if (p) setF(prev => ({ ...prev, pais_nacimiento_code: p.code })) }}
                    opciones={PAISES.map(p => p.nombre)}
                    placeholder="Escribe para buscar un país..."
                  />
                </div>
                <div>
                  <label style={lbl}>País de residencia (operación)</label>
                  <select style={{ ...inp, appearance:'none' as React.CSSProperties['appearance'] }} value={f.pais_code} onChange={e => {
                    const code = e.target.value
                    const p = paisPorCodigo(code)
                    setF(prev => ({ ...prev, pais_code: code, codigo_tel: p?.codigoTel || prev.codigo_tel, departamento: '' }))
                  }}>
                    {PAISES.map(p => <option key={p.code} value={p.code}>{p.nombre}</option>)}
                  </select>
                </div>
              </div>

              <div style={row3}>
                <div>
                  <label style={lbl}>{etiquetaDivision(f.pais_code)}</label>
                  {divisionesPorPais(f.pais_code) ? (
                    <select style={{ ...inp, appearance:'none' as React.CSSProperties['appearance'] }} value={f.departamento} onChange={set('departamento')}>
                      <option value="">Seleccionar...</option>
                      {divisionesPorPais(f.pais_code)!.map(d => <option key={d}>{d}</option>)}
                    </select>
                  ) : (
                    <input style={inp} value={f.departamento} onChange={set('departamento')} placeholder={etiquetaDivision(f.pais_code)} />
                  )}
                </div>
                <div><label style={lbl}>Ciudad</label><input style={inp} value={f.ciudad} onChange={set('ciudad')} /></div>
                <div><label style={lbl}>Dirección</label><input style={inp} value={f.direccion} onChange={set('direccion')} /></div>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'100px 1fr', gap:'8px', marginBottom:'10px' }}>
                <div>
                  <label style={lbl}>Código<Ayuda texto="Se autocompleta al elegir el país de residencia. Puedes cambiarlo manualmente si el colaborador usa otro número." /></label>
                  <select style={{ ...inp, appearance:'none' as React.CSSProperties['appearance'] }} value={f.codigo_tel} onChange={set('codigo_tel')}>
                    {PAISES.map(p => <option key={p.code} value={p.codigoTel}>{p.codigoTel}</option>)}
                  </select>
                </div>
                <div><label style={lbl}>Celular</label><input style={inp} value={f.celular} onChange={set('celular')} /></div>
              </div>
              <div style={row2}>
                <div><label style={lbl}>Correo de contacto</label><input style={inp} type="email" value={f.email} onChange={set('email')} placeholder="Notificaciones y nómina" /></div>
                <div><label style={lbl}>Correo personal</label><input style={inp} type="email" value={f.correo_personal} onChange={set('correo_personal')} placeholder="correo@gmail.com" /></div>
              </div>
              <div>
                <label style={lbl}>Nivel de formación</label>
                <select style={{ ...inp, appearance:'none' as React.CSSProperties['appearance'] }} value={f.nivel_formacion} onChange={set('nivel_formacion')}>
                  <option value="">Seleccionar...</option>
                  {configRHPorPais(f.pais_code).nivelesFormacion.map(v => <option key={v}>{v}</option>)}
                </select>
              </div>

              {/* Estado civil → cónyuge */}
              <div style={{ ...sec, color:T.blue }}>👨‍👩‍👧 ESTADO CIVIL Y FAMILIA</div>
              <div style={row2}>
                <div>
                  <label style={lbl}>Estado civil</label>
                  <select style={{ ...inp, appearance:'none' as React.CSSProperties['appearance'] }} value={f.estado_civil} onChange={set('estado_civil')}>
                    {['Soltero','Casado','Unión libre','Divorciado','Viudo','Otro'].map(v => <option key={v}>{v}</option>)}
                  </select>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:'8px', paddingTop:'20px' }}>
                  <input type="checkbox" checked={f.tiene_conyuge} onChange={set('tiene_conyuge')} id="conyuge" />
                  <label htmlFor="conyuge" style={{ fontSize:'12px', color:T.text, cursor:'pointer' }}>¿Tiene cónyuge/pareja?</label>
                </div>
              </div>

              {f.tiene_conyuge && (
                <div style={{ background:T.card2, border:`1px solid ${T.border}`, borderRadius:'8px', padding:'12px', marginBottom:'10px' }}>
                  <div style={{ fontSize:'11px', fontWeight:'600', color:T.blue, marginBottom:'8px' }}>Datos del cónyuge</div>
                  <div style={row2}>
                    <div><label style={lbl}>Nombres completos</label><input style={inp} value={f.datos_conyuge.nombres || ''} onChange={e => setF(p => ({ ...p, datos_conyuge: { ...p.datos_conyuge, nombres: e.target.value } }))} /></div>
                    <div><label style={lbl}>Celular</label><input style={inp} value={f.datos_conyuge.celular || ''} onChange={e => setF(p => ({ ...p, datos_conyuge: { ...p.datos_conyuge, celular: e.target.value } }))} /></div>
                  </div>
                  <div style={row2}>
                    <div><label style={lbl}>Fecha nacimiento</label><input style={inpDate} type="date" value={f.datos_conyuge.fecha_nac || ''} onChange={e => setF(p => ({ ...p, datos_conyuge: { ...p.datos_conyuge, fecha_nac: e.target.value } }))} /></div>
                    <div><label style={lbl}>Ocupación</label><input style={inp} value={f.datos_conyuge.ocupacion || ''} onChange={e => setF(p => ({ ...p, datos_conyuge: { ...p.datos_conyuge, ocupacion: e.target.value } }))} /></div>
                  </div>
                </div>
              )}

              <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'10px' }}>
                <input type="checkbox" checked={f.tiene_hijos} onChange={set('tiene_hijos')} id="hijos" />
                <label htmlFor="hijos" style={{ fontSize:'12px', color:T.text, cursor:'pointer' }}>¿Tiene hijos? (útil para Caja Compensación)</label>
              </div>

              {f.tiene_hijos && (
                <div style={{ background:T.card2, border:`1px solid ${T.border}`, borderRadius:'8px', padding:'12px', marginBottom:'10px' }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'8px' }}>
                    <div style={{ fontSize:'11px', fontWeight:'600', color:T.blue }}>Datos de hijos ({f.datos_hijos.length})</div>
                    <button onClick={() => setF(p => ({ ...p, datos_hijos: [...p.datos_hijos, { nombre:'', fecha_nac:'', celular:'' }] }))}
                      style={{ fontSize:'11px', color:T.green, background:'none', border:`1px solid ${T.green}40`, borderRadius:'6px', padding:'3px 10px', cursor:'pointer' }}>+ Agregar hijo</button>
                  </div>
                  {f.datos_hijos.map((h, i) => (
                    <div key={i} style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 32px', gap:'6px', marginBottom:'6px' }}>
                      <input style={inp} placeholder="Nombre" value={h.nombre || ''} onChange={e => setF(p => ({ ...p, datos_hijos: p.datos_hijos.map((x, j) => j === i ? { ...x, nombre: e.target.value } : x) }))} />
                      <input style={inpDate} type="date" value={h.fecha_nac || ''} onChange={e => setF(p => ({ ...p, datos_hijos: p.datos_hijos.map((x, j) => j === i ? { ...x, fecha_nac: e.target.value } : x) }))} />
                      <input style={inp} placeholder="Celular" value={h.celular || ''} onChange={e => setF(p => ({ ...p, datos_hijos: p.datos_hijos.map((x, j) => j === i ? { ...x, celular: e.target.value } : x) }))} />
                      <button onClick={() => setF(p => ({ ...p, datos_hijos: p.datos_hijos.filter((_, j) => j !== i) }))} style={{ background:`${T.red}15`, border:`1px solid ${T.red}30`, borderRadius:'6px', color:T.red, cursor:'pointer', fontSize:'12px' }}>✕</button>
                    </div>
                  ))}
                </div>
              )}

              {/* Contacto emergencia */}
              <div style={{ ...sec, color:T.red }}>🚨 CONTACTO DE EMERGENCIA</div>
              <div style={row3}>
                <div><label style={lbl}>Nombre</label><input style={inp} value={f.contacto_emergencia.nombre || ''} onChange={e => setF(p => ({ ...p, contacto_emergencia: { ...p.contacto_emergencia, nombre: e.target.value } }))} /></div>
                <div><label style={lbl}>Parentesco</label><input style={inp} value={f.contacto_emergencia.parentesco || ''} onChange={e => setF(p => ({ ...p, contacto_emergencia: { ...p.contacto_emergencia, parentesco: e.target.value } }))} /></div>
                <div><label style={lbl}>Celular</label><input style={inp} value={f.contacto_emergencia.celular || ''} onChange={e => setF(p => ({ ...p, contacto_emergencia: { ...p.contacto_emergencia, celular: e.target.value } }))} /></div>
              </div>
            </div>
          )}

          {/* STEP 1: Seguridad Social */}
          {step === 1 && (
            <div>
              <div style={{ ...sec, color:T.green }}>🔐 SEGURIDAD SOCIAL — {paisNombre}</div>

              {esIndependiente ? (
                <>
                  <div style={{ background:`${T.yellow}10`, border:`1px solid ${T.yellow}20`, borderRadius:'8px', padding:'10px 14px', marginBottom:'14px', fontSize:'11px', color:T.yellow }}>
                    Contrato por <strong>{f.tipo_contrato}</strong>: el colaborador gestiona su propia EPS, pensión y ARL de forma
                    independiente. La empresa solo verifica que esté al día con un soporte de pago.
                  </div>
                  {fileBtn('ss_independiente_doc', 'Soporte de pago de seguridad social (planilla/PILA independiente)', true)}
                </>
              ) : (
                <>
                  <div style={{ background:`${T.blue}10`, border:`1px solid ${T.blue}20`, borderRadius:'8px', padding:'10px 14px', marginBottom:'14px', fontSize:'11px', color:T.muted }}>
                    Las entidades se filtran según el país de residencia: <strong style={{ color:T.blue }}>{paisNombre}</strong>
                    {paisConfig.entidades.eps.length === 0 && <> — no tenemos catálogo de entidades cargado para este país aún; escribe el nombre manualmente.</>}
                  </div>

                  {[
                    { key:'eps', label:'EPS / Seguro Médico *', lista: paisConfig.entidades.eps, docKey:'cert_eps' },
                    { key:'pension', label:'Fondo de Pensiones *', lista: paisConfig.entidades.pension, docKey:'cert_pension' },
                    { key:'arl', label:'ARL / Riesgos Laborales', lista: paisConfig.entidades.arl, docKey:'cert_arl' },
                    { key:'caja_comp', label:'Caja de Compensación', lista: paisConfig.entidades.cajaComp, docKey:'cert_caja' },
                    { key:'cesantias', label:'Fondo de Cesantías', lista: paisConfig.entidades.cesantias, docKey:'cert_cesantias' },
                  ].map(item => (
                    <div key={item.key} style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))', gap:'8px', marginBottom:'10px', alignItems:'start' }}>
                      <div>
                        <label style={lbl}>{item.label}</label>
                        {item.lista.length > 0 ? (
                          <select style={{ ...inp, appearance:'none' as React.CSSProperties['appearance'] }} value={(f as unknown as Record<string,string>)[item.key] || ''} onChange={set(item.key)}>
                            <option value="">Seleccionar...</option>
                            {item.lista.map(v => <option key={v}>{v}</option>)}
                          </select>
                        ) : (
                          <input style={inp} value={(f as unknown as Record<string,string>)[item.key] || ''} onChange={set(item.key)} placeholder="Nombre de la entidad" />
                        )}
                      </div>
                      <div style={{ paddingTop:'2px' }}>
                        {fileBtn(item.docKey, 'Certificado PDF')}
                      </div>
                    </div>
                  ))}

                  {f.es_pensionado && (
                    <div style={{ marginBottom:'10px' }}>
                      {fileBtn('pension_doc', 'Resolución de pensión (vejez/invalidez)', true)}
                    </div>
                  )}

                  <div style={{ ...sec, color:T.yellow }}>⚙️ CONFIGURACIÓN ARL</div>
                  <div style={row2}>
                    <div>
                      <label style={lbl}>Nivel de riesgo ARL</label>
                      <select style={{ ...inp, appearance:'none' as React.CSSProperties['appearance'] }} value={f.nivel_arl} onChange={set('nivel_arl')}>
                        {[1,2,3,4,5].map(n => <option key={n} value={n}>Nivel {n} — {[0.522,1.044,2.436,4.350,6.960][n-1]}%</option>)}
                      </select>
                    </div>
                    <div />
                  </div>

                  <div style={{ marginBottom:'10px' }}>
                    {fileBtn('examen_medico', 'Examen médico de ingreso (obligatorio por ley)', true)}
                  </div>
                </>
              )}

              <div style={{ ...sec, color:T.blue }}>🏦 DATOS BANCARIOS</div>
              <div style={row2}>
                <div>
                  <label style={lbl}>Banco para pago nómina *<Ayuda texto="Escribe para buscar el banco según el país de residencia." /></label>
                  <ComboBuscable value={f.banco} onChange={v => setF(p => ({ ...p, banco: v }))} opciones={paisConfig.entidades.banco} placeholder="Buscar banco..." />
                </div>
                <div>
                  <label style={lbl}>Tipo de cuenta bancaria</label>
                  <select style={{ ...inp, appearance:'none' as React.CSSProperties['appearance'] }} value={f.tipo_cuenta} onChange={set('tipo_cuenta')}>
                    {paisConfig.tipoCuenta.map(v => <option key={v}>{v}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ marginBottom:'10px' }}><label style={lbl}>Número de cuenta</label><input style={inp} value={f.num_cuenta} onChange={set('num_cuenta')} /></div>

              {!esIndependiente && (
                <div style={{ display:'flex', gap:'16px', marginBottom:'10px' }}>
                  <label style={{ display:'flex', alignItems:'center', gap:'6px', cursor:'pointer', fontSize:'12px', color:T.text }}>
                    <input type="checkbox" checked={f.es_pensionado} onChange={set('es_pensionado')} />
                    ¿Es pensionado? (no aplica aporte pensión — requiere soporte de la resolución)
                  </label>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: Info Laboral */}
          {step === 2 && (
            <div>
              <div style={{ ...sec, color:T.purple }}>💼 INFORMACIÓN LABORAL</div>
              <div style={row2}>
                <div>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <label style={lbl}>Proceso/Área</label>
                    <button type="button" onClick={() => setMostrarNuevoProceso(s => !s)} style={{ fontSize:'10px', color:T.purple, background:'none', border:'none', cursor:'pointer', marginBottom:'4px' }}>+ nuevo</button>
                  </div>
                  <select style={{ ...inp, appearance:'none' as React.CSSProperties['appearance'] }} value={f.proceso_id} onChange={e => setF(p => ({ ...p, proceso_id: e.target.value, cargo: '', cargo_id: '' }))}>
                    <option value="">Sin proceso</option>
                    {['Estratégico','Misional','Apoyo'].map(tipo => {
                      const grupo = procesos.filter(p => (p.tipo || 'Misional') === tipo)
                      return grupo.length > 0 ? (
                        <optgroup key={tipo} label={tipo}>
                          {grupo.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                        </optgroup>
                      ) : null
                    })}
                  </select>
                  {mostrarNuevoProceso && (
                    <div style={{ display:'flex', gap:'6px', marginTop:'6px' }}>
                      <input style={{ ...inp, flex:1 }} placeholder="Nombre del proceso" value={nuevoProcesoNombre} onChange={e => setNuevoProcesoNombre(e.target.value)} />
                      <select style={{ ...inp, width:'110px' }} value={nuevoProcesoTipo} onChange={e => setNuevoProcesoTipo(e.target.value)}>
                        {['Estratégico','Misional','Apoyo'].map(t => <option key={t}>{t}</option>)}
                      </select>
                      <button type="button" onClick={async () => {
                        const id = await onProcesoCreado(nuevoProcesoNombre, nuevoProcesoTipo)
                        if (id) { setF(p => ({ ...p, proceso_id: id })); setNuevoProcesoNombre(''); setMostrarNuevoProceso(false) }
                      }} style={{ padding:'0 12px', background:T.green, border:'none', borderRadius:'8px', color:T.card, fontWeight:'700', cursor:'pointer', fontSize:'11px' }}>Crear</button>
                    </div>
                  )}
                </div>
                <div>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <label style={lbl}>Cargo *</label>
                    <button type="button" disabled={!f.proceso_id} onClick={() => setMostrarNuevoCargo(s => !s)} style={{ fontSize:'10px', color: f.proceso_id ? T.purple : T.muted, background:'none', border:'none', cursor: f.proceso_id ? 'pointer' : 'not-allowed', marginBottom:'4px' }}>+ nuevo</button>
                  </div>
                  {f.proceso_id ? (
                    <select style={{ ...inp, appearance:'none' as React.CSSProperties['appearance'] }} value={f.cargo_id} onChange={e => {
                      const c = cargos.find(x => x.id === e.target.value)
                      setF(p => ({ ...p, cargo_id: e.target.value, cargo: c?.nombre || '' }))
                    }}>
                      <option value="">Seleccionar...</option>
                      {cargos.filter(c => c.proceso_id === f.proceso_id).map(c => <option key={c.id} value={c.id}>{c.nombre} ({c.tipo})</option>)}
                    </select>
                  ) : (
                    <input style={inp} value={f.cargo} onChange={set('cargo')} placeholder="Elige un proceso para ver los cargos" />
                  )}
                  {mostrarNuevoCargo && f.proceso_id && (
                    <div style={{ display:'flex', gap:'6px', marginTop:'6px' }}>
                      <input style={{ ...inp, flex:1 }} placeholder="Nombre del cargo" value={nuevoCargoNombre} onChange={e => setNuevoCargoNombre(e.target.value)} />
                      <button type="button" onClick={async () => {
                        const id = await onCargoCreado(nuevoCargoNombre, f.proceso_id)
                        setF(p => ({ ...p, cargo: nuevoCargoNombre, cargo_id: id || '' })); setNuevoCargoNombre(''); setMostrarNuevoCargo(false)
                      }} style={{ padding:'0 12px', background:T.green, border:'none', borderRadius:'8px', color:T.card, fontWeight:'700', cursor:'pointer', fontSize:'11px' }}>Crear</button>
                    </div>
                  )}
                </div>
              </div>
              <div style={row2}>
                <div>
                  <label style={lbl}>Tipo contrato *<Ayuda texto="Honorarios/Contratista son prestadores independientes: sin vacaciones, prima, cesantías ni auxilio de transporte — esos costos van incluidos en su tarifa." /></label>
                  <select style={{ ...inp, appearance:'none' as React.CSSProperties['appearance'] }} value={f.tipo_contrato} onChange={set('tipo_contrato')}>
                    {['Empleado','Término fijo','Obra o labor','Contratista','Honorarios','Aprendiz SENA'].map(v => <option key={v}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Jornada</label>
                  <select style={{ ...inp, appearance:'none' as React.CSSProperties['appearance'] }} value={f.jornada} onChange={set('jornada')}>
                    {['Tiempo completo','Medio tiempo','Por horas','Turnos rotativos','Teletrabajo'].map(v => <option key={v}>{v}</option>)}
                  </select>
                </div>
              </div>
              <div style={row2}>
                <div><label style={lbl}>Fecha ingreso *</label><input style={inpDate} type="date" value={f.fecha_ingreso} onChange={set('fecha_ingreso')} /></div>
                {f.tipo_contrato.includes('fijo') || f.tipo_contrato === 'Obra o labor' ? (
                  <div>
                    <label style={lbl}>Fecha fin contrato</label>
                    <input style={{ ...inpDate, borderColor: diasAlerta !== null && diasAlerta <= 40 ? T.yellow : T.border }} type="date" value={f.fecha_fin} onChange={set('fecha_fin')} />
                    {diasAlerta !== null && diasAlerta <= 40 && <div style={{ fontSize:'10px', color:T.yellow, marginTop:'2px' }}>⚠️ Vence en {diasAlerta} días</div>}
                  </div>
                ) : <div />}
              </div>
              <div style={{ marginBottom:'10px' }}><label style={lbl}>Lugar de ejecución del contrato (requerido para ARL/teletrabajo)</label><input style={inp} value={f.lugar_ejecucion} onChange={set('lugar_ejecucion')} placeholder="Sede principal Medellín / Domicilio: Cra 70 #45-30" /></div>
              <div style={{ marginBottom:'10px' }}><label style={lbl}>Sede</label><input style={inp} value={f.sede} onChange={set('sede')} placeholder="Medellín / Remoto / Bogotá" /></div>

              <div style={{ ...sec, color:T.accent }}>💰 CONDICIONES SALARIALES</div>
              <div style={row2}>
                <div><label style={lbl}>Salario base *</label><InputMiles value={f.salario_base} onChange={v => setF(p => ({ ...p, salario_base: v }))} /></div>
                <div>
                  <label style={lbl}>
                    Auxilio de transporte
                    <Ayuda texto={f.pais_code === 'COL' && !esIndependiente ? 'Automático en Colombia: aplica si el salario base es ≤ 2 SMMLV vigentes. Se recalcula solo.' : 'Fuera de Colombia (o en contratos independientes) no calculamos esta regla automáticamente — verifica la normativa local.'} />
                  </label>
                  {f.pais_code === 'COL' && !esIndependiente ? (
                    <input style={{ ...inp, color:T.muted }} value={fmt(f.aux_transporte, f.pais_code)} readOnly />
                  ) : (
                    <InputMiles value={f.aux_transporte} onChange={v => setF(p => ({ ...p, aux_transporte: v }))} />
                  )}
                </div>
              </div>
              <div style={row2}>
                <div>
                  <label style={lbl}>Tipo de salario</label>
                  <select style={{ ...inp, appearance:'none' as React.CSSProperties['appearance'] }} value={f.tipo_salario} onChange={set('tipo_salario')}>
                    {['Fijo','Variable','Integral'].map(v => <option key={v}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Tipo cotizante SS<Ayuda texto="Clasificación PILA (Colombia) que usan EPS/pensión/ARL para calcular tus aportes correctamente. Si tu país no usa PILA, deja el que más se acerque." /></label>
                  <select style={{ ...inp, appearance:'none' as React.CSSProperties['appearance'] }} value={f.tipo_cotizante} onChange={set('tipo_cotizante')}>
                    {[
                      ['1','01 — Dependiente'],['2','02 — Independiente'],['3','03 — Servicio doméstico'],
                      ['12','12 — Dependiente sector público sin tope'],['15','15 — Aprendiz etapa lectiva (sin cotización)'],['51','51 — Aprendiz etapa práctica'],
                    ].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
              </div>
              {!esIndependiente && (
                <div style={{ display:'flex', gap:'16px', marginBottom:'10px' }}>
                  <label style={{ display:'flex', alignItems:'center', gap:'6px', cursor:'pointer', fontSize:'12px', color:T.text }}>
                    <input type="checkbox" checked={f.aplica_ley1607} onChange={set('aplica_ley1607')} />
                    Aplica Ley 1607 (exoneración parafiscal &lt; 10 SMMLV)
                    <Ayuda texto="Si tu empresa está exonerada de aportes a SENA, ICBF y salud del empleador para trabajadores que ganan menos de 10 SMMLV." />
                  </label>
                </div>
              )}

              {/* Carga prestacional detallada */}
              <div style={{ background:T.card2, border:`1px solid ${T.border}`, borderRadius:'8px', padding:'12px', marginTop:'4px' }}>
                <div style={{ fontSize:'11px', fontWeight:'700', color:T.blue, marginBottom:'8px' }}>📊 Carga prestacional calculada</div>
                {esIndependiente ? (
                  <div style={{ fontSize:'11px', color:T.muted, padding:'6px 0' }}>
                    Contrato independiente: la carga es el valor de la tarifa acordada — sin prestaciones sociales ni parafiscales a cargo de la empresa.
                  </div>
                ) : (
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))', gap:'4px' }}>
                    {[
                      ['Salario base', f.salario_base],
                      ['Auxilio de transporte', f.aux_transporte],
                      ['Salud empleador', Math.round(f.salario_base * (tasas.salud_emp||8.5)/100)],
                      ['Pensión empleador', Math.round(f.salario_base * (tasas.pension_emp||12)/100)],
                      ['ARL nivel '+f.nivel_arl, Math.round(f.salario_base * ([tasas.arl_nivel1||0.522,tasas.arl_nivel2||1.044,tasas.arl_nivel3||2.436,tasas.arl_nivel4||4.350,tasas.arl_nivel5||6.960][f.nivel_arl-1])/100)],
                      ['Cesantías', Math.round(f.salario_base * (tasas.cesantias||8.33)/100)],
                      ['Prima', Math.round(f.salario_base * (tasas.prima||8.33)/100)],
                      ['Vacaciones', Math.round(f.salario_base * (tasas.vacaciones||4.17)/100)],
                      ['SENA+ICBF+Caja', f.aplica_ley1607 ? 0 : Math.round(f.salario_base * ((tasas.sena||2)+(tasas.icbf||3)+(tasas.caja_comp||4))/100)],
                    ].map(([l, v]) => (
                      <div key={l as string} style={{ display:'flex', justifyContent:'space-between', fontSize:'11px', padding:'3px 0', borderBottom:`1px solid ${T.border}` }}>
                        <span style={{ color:T.muted }}>{l}</span>
                        <span style={{ color:T.text }}>{fmt(v as number, f.pais_code)}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ display:'flex', justifyContent:'space-between', marginTop:'8px', fontSize:'13px', fontWeight:'700' }}>
                  <span style={{ color:T.text }}>CARGA TOTAL</span>
                  <span style={{ color:T.blue }}>{fmt(cargaTotal, f.pais_code)}</span>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Documentos */}
          {step === 3 && (
            <div>
              <div style={{ ...sec, color:T.yellow }}>📄 DOCUMENTOS REQUERIDOS</div>
              <div style={{ background:`${T.yellow}10`, border:`1px solid ${T.yellow}20`, borderRadius:'8px', padding:'9px 12px', marginBottom:'14px', fontSize:'11px', color:T.yellow }}>
                Todos en formato PDF · máximo 5MB por archivo
              </div>
              {fileBtn('id_a', 'Documento identidad — Lado A (Frontal)', true)}
              {fileBtn('id_b', 'Documento identidad — Lado B (Posterior)', true)}
              {fileBtn('hoja_vida', 'Hoja de vida laboral', true)}
              <div style={{ ...sec, color:T.muted, marginTop:'14px' }}>Opcionales</div>
              {fileBtn('contrato', 'Contrato de trabajo firmado')}
              {fileBtn('cert_estudio', 'Certificado de estudio / título')}
              {fileBtn('carnet_eps', 'Carnet EPS')}
            </div>
          )}

          {error && <div style={{ background:`${T.red}15`, border:`1px solid ${T.red}30`, borderRadius:'8px', padding:'9px', fontSize:'12px', color:T.red, marginTop:'12px' }}>{error}</div>}
        </div>

        {/* Footer */}
        <div style={{ padding:'14px 20px', borderTop:`1px solid ${T.border}`, display:'flex', gap:'8px', flexShrink:0 }}>
          {step > 0 && <button onClick={() => setStep(s => s - 1)} style={{ padding:'10px 16px', background:T.card2, border:`1px solid ${T.border}`, borderRadius:'8px', color:T.muted, cursor:'pointer', fontSize:'13px' }}>← Anterior</button>}
          {step < 3 ? (
            <button onClick={() => setStep(s => s + 1)} style={{ flex:1, padding:'10px', background:T.blue, border:'none', borderRadius:'8px', color:'#fff', fontWeight:'700', cursor:'pointer', fontSize:'13px' }}>
              Siguiente →
            </button>
          ) : (
            <button onClick={guardar} disabled={saving} style={{ flex:1, padding:'10px', background:T.accent, border:'none', borderRadius:'8px', color:T.card, fontWeight:'700', cursor:saving?'wait':'pointer', fontSize:'13px', opacity:saving?0.7:1 }}>
              {saving ? 'Guardando...' : editData ? 'Guardar cambios' : '✅ Crear colaborador'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── ÁRBOL DE ORGANIGRAMA (drag-and-drop nativo, jerarquía real por cargo) ─
const COLOR_NIVEL: Record<string,string> = {
  Gerente:'#F05C5C', Director:'#F5A623', Coordinador:'#3D8EF0', Analista:'#2DD4A0', Auxiliar:'#9B6BFF',
}

function esDescendiente(cargos: Cargo[], posibleAncestroId: string, id: string): boolean {
  let actual = cargos.find(c => c.id === id)
  while (actual?.reporta_a_id) {
    if (actual.reporta_a_id === posibleAncestroId) return true
    actual = cargos.find(c => c.id === actual!.reporta_a_id)
  }
  return false
}

function CajaCargo({ cargo, cargos, colaboradores, procesos, tenantId, onReload, dragId, setDragId, nivel }: {
  cargo: Cargo; cargos: Cargo[]; colaboradores: Colaborador[]; procesos: Proceso[]; tenantId: string
  onReload: () => void; dragId: string | null; setDragId: (id: string | null) => void; nivel: number
}) {
  const supabase = createClient()
  const [showNuevo, setShowNuevo] = useState(false)
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [nuevoTipo, setNuevoTipo] = useState('Analista')
  const [showDetalle, setShowDetalle] = useState(false)

  const ocupantes = colaboradores.filter(c => c.cargo_id === cargo.id)
  const proceso = procesos.find(p => p.id === cargo.proceso_id)
  const cargaTotal = ocupantes.reduce((a,c) => a + (c.carga_total_mes || 0), 0)
  const vacante = ocupantes.length === 0
  const hijos = cargos.filter(c => c.reporta_a_id === cargo.id)
  const color = COLOR_NIVEL[cargo.tipo] || T.muted

  async function crearHijo() {
    if (!nuevoNombre.trim()) return
    await supabase.from('nomina_cargos').insert({
      tenant_id: tenantId, nombre: nuevoNombre, tipo: nuevoTipo,
      proceso_id: cargo.proceso_id, reporta_a_id: cargo.id, activo: true,
    })
    setNuevoNombre(''); setShowNuevo(false); onReload()
  }

  async function onDrop(e: React.DragEvent) {
    e.preventDefault(); e.stopPropagation()
    if (!dragId || dragId === cargo.id) return
    if (esDescendiente(cargos, dragId, cargo.id)) { alert('No puedes mover un cargo debajo de uno de sus propios subordinados'); return }
    await supabase.from('nomina_cargos').update({ reporta_a_id: cargo.id }).eq('id', dragId)
    setDragId(null); onReload()
  }

  return (
    <div style={{ marginLeft: nivel > 0 ? '22px' : 0, borderLeft: nivel > 0 ? `2px solid ${T.border}` : 'none', paddingLeft: nivel > 0 ? '14px' : 0, marginTop:'10px' }}>
      <div
        draggable
        onDragStart={() => setDragId(cargo.id)}
        onDragOver={e => e.preventDefault()}
        onDrop={onDrop}
        onClick={() => setShowDetalle(s => !s)}
        style={{
          background: vacante ? 'rgba(240,92,92,0.08)' : 'rgba(45,212,160,0.08)',
          border: `1px solid ${vacante ? `${T.red}40` : `${T.green}40`}`,
          borderLeft: `3px solid ${color}`, borderRadius:'8px', padding:'10px 12px', cursor:'grab', maxWidth:'340px',
        }}
      >
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:'8px' }}>
          <div style={{ fontSize:'12px', fontWeight:'700', color:T.text }}>{cargo.nombre}</div>
          <span style={{ fontSize:'9px', padding:'2px 6px', borderRadius:'4px', background:`${color}20`, color, fontWeight:'700', flexShrink:0 }}>{cargo.tipo}</span>
        </div>
        <div style={{ fontSize:'10px', color:T.purple, marginTop:'2px' }}>{proceso?.nombre || 'Sin proceso'}</div>
        <div style={{ display:'flex', justifyContent:'space-between', marginTop:'6px', fontSize:'10px' }}>
          <span style={{ color: vacante ? T.red : T.green, fontWeight:'700' }}>{vacante ? '○ Vacante' : `● ${ocupantes.length} persona${ocupantes.length>1?'s':''}`}</span>
          <span style={{ color:T.muted }}>{fmt(cargaTotal)}/mes</span>
        </div>
        {showDetalle && (
          <div style={{ marginTop:'8px', paddingTop:'8px', borderTop:`1px solid ${T.border}` }} onClick={e => e.stopPropagation()}>
            {ocupantes.length > 0 ? ocupantes.map(o => (
              <div key={o.id} style={{ fontSize:'10px', color:T.muted, padding:'2px 0' }}>👤 {o.nombres} {o.apellidos} · {o.tipo_contrato}</div>
            )) : <div style={{ fontSize:'10px', color:T.muted }}>Sin colaboradores activos en este cargo</div>}
            <button onClick={() => setShowNuevo(s => !s)} style={{ marginTop:'6px', fontSize:'10px', color, background:'none', border:'none', cursor:'pointer', padding:0 }}>+ cargo debajo de este</button>
            {showNuevo && (
              <div style={{ display:'flex', gap:'4px', marginTop:'6px' }} onClick={e => e.stopPropagation()}>
                <input style={{ ...inp, flex:1, fontSize:'11px', padding:'5px 8px' }} placeholder="Nombre del cargo" value={nuevoNombre} onChange={e => setNuevoNombre(e.target.value)} />
                <select style={{ ...inp, width:'90px', fontSize:'11px', padding:'5px 6px' }} value={nuevoTipo} onChange={e => setNuevoTipo(e.target.value)}>
                  {Object.keys(COLOR_NIVEL).map(t => <option key={t}>{t}</option>)}
                </select>
                <button onClick={crearHijo} style={{ padding:'0 10px', background:color, border:'none', borderRadius:'6px', color:T.card, fontWeight:'700', cursor:'pointer', fontSize:'10px' }}>Crear</button>
              </div>
            )}
          </div>
        )}
      </div>
      {hijos.map(h => (
        <CajaCargo key={h.id} cargo={h} cargos={cargos} colaboradores={colaboradores} procesos={procesos} tenantId={tenantId} onReload={onReload} dragId={dragId} setDragId={setDragId} nivel={nivel + 1} />
      ))}
    </div>
  )
}

function ArbolOrganigrama({ cargos, colaboradores, procesos, tenantId, onReload }: {
  cargos: Cargo[]; colaboradores: Colaborador[]; procesos: Proceso[]; tenantId: string; onReload: () => void
}) {
  const supabase = createClient()
  const [dragId, setDragId] = useState<string | null>(null)
  const [showNuevaRaiz, setShowNuevaRaiz] = useState(false)
  const [nombreRaiz, setNombreRaiz] = useState('')
  const [procesoRaiz, setProcesoRaiz] = useState('')

  const raices = cargos.filter(c => !c.reporta_a_id)
  const sinAsignar = colaboradores.filter(c => !c.cargo_id)

  async function crearRaiz() {
    if (!nombreRaiz.trim() || !procesoRaiz) return
    await supabase.from('nomina_cargos').insert({
      tenant_id: tenantId, nombre: nombreRaiz, tipo: 'Gerente', proceso_id: procesoRaiz, reporta_a_id: null, activo: true,
    })
    setNombreRaiz(''); setShowNuevaRaiz(false); onReload()
  }

  return (
    <div>
      <div style={{ background:`${T.blue}10`, border:`1px solid ${T.blue}20`, borderRadius:'8px', padding:'10px 14px', marginBottom:'16px', fontSize:'11px', color:T.muted }}>
        Arrastra una caja y suéltala sobre otra para reasignar a quién le reporta. Clic en una caja para ver quién la ocupa y agregar cargos debajo. Verde = ocupado, rojo = vacante — el headcount y la carga salen de los colaboradores reales, no se digitan a mano.
      </div>
      <div style={{ marginBottom:'14px' }}>
        {showNuevaRaiz ? (
          <div style={{ display:'flex', gap:'6px' }}>
            <input style={{ ...inp, width:'200px' }} placeholder="Nombre del cargo raíz" value={nombreRaiz} onChange={e => setNombreRaiz(e.target.value)} />
            <select style={{ ...inp, width:'200px' }} value={procesoRaiz} onChange={e => setProcesoRaiz(e.target.value)}>
              <option value="">Proceso...</option>
              {procesos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
            <button onClick={crearRaiz} style={{ padding:'0 14px', background:T.red, border:'none', borderRadius:'7px', color:'#fff', fontWeight:'700', cursor:'pointer', fontSize:'12px' }}>Crear</button>
            <button onClick={() => setShowNuevaRaiz(false)} style={{ padding:'0 12px', background:'transparent', border:`1px solid ${T.border}`, borderRadius:'7px', color:T.muted, cursor:'pointer', fontSize:'12px' }}>✕</button>
          </div>
        ) : (
          <button onClick={() => setShowNuevaRaiz(true)} style={{ padding:'8px 14px', background:`${T.red}15`, border:`1px solid ${T.red}40`, borderRadius:'8px', color:T.red, cursor:'pointer', fontSize:'12px', fontWeight:'600' }}>+ Cargo raíz (ej. Gerente General)</button>
        )}
      </div>

      {raices.length === 0 ? (
        <div style={{ textAlign:'center', padding:'48px', background:T.card, border:`1px solid ${T.border}`, borderRadius:'12px', color:T.muted, fontSize:'13px' }}>
          Sin cargos en el organigrama todavía
        </div>
      ) : raices.map(r => (
        <CajaCargo key={r.id} cargo={r} cargos={cargos} colaboradores={colaboradores} procesos={procesos} tenantId={tenantId} onReload={onReload} dragId={dragId} setDragId={setDragId} nivel={0} />
      ))}

      {sinAsignar.length > 0 && (
        <div style={{ marginTop:'20px', background:T.card, border:`1px solid ${T.border}`, borderRadius:'10px', padding:'14px', maxWidth:'340px' }}>
          <div style={{ fontSize:'12px', fontWeight:'700', color:T.muted, marginBottom:'8px' }}>Sin cargo asignado en el organigrama ({sinAsignar.length})</div>
          {sinAsignar.map(c => (
            <div key={c.id} style={{ fontSize:'11px', color:T.muted, padding:'3px 0' }}>{c.nombres} {c.apellidos} — {c.cargo || 'sin cargo'}</div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── TABLERO DE PROCESOS (drag-and-drop nativo, sin librerías) ─
const TIPOS_PROCESO = [
  { v:'Estratégico', c:T.red },
  { v:'Misional',    c:T.blue },
  { v:'Apoyo',       c:T.yellow },
] as const

function TableroProcesos({ procesos, colaboradores, tenantId, onReload }: {
  procesos: Proceso[]; colaboradores: Colaborador[]; tenantId: string; onReload: () => void
}) {
  const supabase = createClient()
  const [dragId, setDragId] = useState<string | null>(null)
  const [editando, setEditando] = useState<Proceso | null>(null)
  const [form, setForm] = useState({ nombre:'', descripcion:'', responsable_id:'' })
  const [showNuevo, setShowNuevo] = useState<string | null>(null)
  const [nuevoNombre, setNuevoNombre] = useState('')

  function abrirEditor(p: Proceso) {
    setEditando(p)
    setForm({ nombre: p.nombre, descripcion: p.descripcion || '', responsable_id: p.responsable_id || '' })
  }

  async function guardarEdicion() {
    if (!editando) return
    await supabase.from('nomina_procesos').update({
      nombre: form.nombre, descripcion: form.descripcion, responsable_id: form.responsable_id || null,
    }).eq('id', editando.id)
    setEditando(null); onReload()
  }

  async function crear(tipo: string) {
    if (!nuevoNombre.trim()) return
    const orden = procesos.filter(p => p.tipo === tipo).length + 1
    await supabase.from('nomina_procesos').insert({ tenant_id: tenantId, nombre: nuevoNombre, tipo, orden, activo: true })
    setNuevoNombre(''); setShowNuevo(null); onReload()
  }

  async function onDrop(tipo: string) {
    if (!dragId) return
    const orden = procesos.filter(p => p.tipo === tipo).length + 1
    await supabase.from('nomina_procesos').update({ tipo, orden }).eq('id', dragId)
    setDragId(null); onReload()
  }

  return (
    <div>
      <div style={{ background:`${T.blue}10`, border:`1px solid ${T.blue}20`, borderRadius:'8px', padding:'10px 14px', marginBottom:'16px', fontSize:'11px', color:T.muted }}>
        Arrastra una tarjeta entre columnas para reclasificarla. Clic en una tarjeta para editar nombre, descripción y responsable.
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))', gap:'14px', alignItems:'start' }}>
        {TIPOS_PROCESO.map(({ v: tipo, c: color }) => {
          const items = procesos.filter(p => (p.tipo || 'Misional') === tipo).sort((a,b) => a.orden - b.orden)
          return (
            <div key={tipo}
              onDragOver={e => e.preventDefault()}
              onDrop={() => onDrop(tipo)}
              style={{ background:T.card2, border:`1px solid ${T.border}`, borderTop:`3px solid ${color}`, borderRadius:'10px', padding:'12px', minHeight:'160px' }}
            >
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px' }}>
                <div style={{ fontSize:'12px', fontWeight:'700', color }}>{tipo.toUpperCase()} <span style={{ color:T.muted, fontWeight:'400' }}>({items.length})</span></div>
                <button onClick={() => setShowNuevo(s => s === tipo ? null : tipo)} style={{ fontSize:'11px', color, background:'none', border:'none', cursor:'pointer' }}>+ nuevo</button>
              </div>
              {showNuevo === tipo && (
                <div style={{ display:'flex', gap:'6px', marginBottom:'10px' }}>
                  <input style={{ ...inp, flex:1 }} placeholder="Nombre del proceso" value={nuevoNombre} onChange={e => setNuevoNombre(e.target.value)} />
                  <button onClick={() => crear(tipo)} style={{ padding:'0 10px', background:color, border:'none', borderRadius:'7px', color:T.card, fontWeight:'700', cursor:'pointer', fontSize:'11px' }}>Crear</button>
                </div>
              )}
              {items.map(p => {
                const responsable = colaboradores.find(c => c.id === p.responsable_id)
                return (
                  <div key={p.id}
                    draggable
                    onDragStart={() => setDragId(p.id)}
                    onClick={() => abrirEditor(p)}
                    style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:'8px', padding:'10px 12px', marginBottom:'8px', cursor:'grab' }}
                  >
                    <div style={{ fontSize:'12px', fontWeight:'600', color:T.text, marginBottom:'3px' }}>{p.nombre}</div>
                    {p.descripcion && <div style={{ fontSize:'10px', color:T.muted, marginBottom:'4px' }}>{p.descripcion}</div>}
                    <div style={{ fontSize:'10px', color:T.blue }}>{responsable ? `👤 ${responsable.nombres} ${responsable.apellidos}` : '— sin responsable'}</div>
                  </div>
                )
              })}
              {items.length === 0 && !showNuevo && <div style={{ fontSize:'11px', color:T.muted, textAlign:'center', padding:'10px 0' }}>Sin procesos</div>}
            </div>
          )
        })}
      </div>

      {editando && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:'20px', backdropFilter:'blur(4px)' }} onClick={() => setEditando(null)}>
          <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:'14px', width:'min(440px,100%)', padding:'20px' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize:'14px', fontWeight:'700', color:T.text, marginBottom:'14px' }}>Editar proceso</div>
            <div style={{ marginBottom:'10px' }}><label style={lbl}>Nombre</label><input style={inp} value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} /></div>
            <div style={{ marginBottom:'10px' }}><label style={lbl}>Descripción (misionalidad)</label><textarea style={{ ...inp, minHeight:'70px', resize:'vertical' as React.CSSProperties['resize'] }} value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} /></div>
            <div style={{ marginBottom:'16px' }}>
              <label style={lbl}>Responsable del proceso</label>
              <select style={{ ...inp, appearance:'none' as React.CSSProperties['appearance'] }} value={form.responsable_id} onChange={e => setForm(f => ({ ...f, responsable_id: e.target.value }))}>
                <option value="">Sin asignar</option>
                {colaboradores.map(c => <option key={c.id} value={c.id}>{c.nombres} {c.apellidos} — {c.cargo}</option>)}
              </select>
            </div>
            <div style={{ display:'flex', gap:'8px' }}>
              <button onClick={() => setEditando(null)} style={{ flex:1, padding:'9px', background:T.card2, border:`1px solid ${T.border}`, borderRadius:'8px', color:T.muted, cursor:'pointer', fontSize:'12px' }}>Cancelar</button>
              <button onClick={guardarEdicion} style={{ flex:1, padding:'9px', background:T.accent, border:'none', borderRadius:'8px', color:T.card, fontWeight:'700', cursor:'pointer', fontSize:'12px' }}>Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── MATRIZ DE INDICADORES ─────────────────────────────────
function semaforoIndicador(valor: number, meta: number): string {
  if (!meta) return T.muted
  const pct = valor / meta
  return pct >= 0.9 ? T.green : pct >= 0.7 ? T.yellow : T.red
}

function MatrizIndicadores({ indicadores, mediciones, procesos, tenantId, onReload }: {
  indicadores: Indicador[]; mediciones: Medicion[]; procesos: Proceso[]; tenantId: string; onReload: () => void
}) {
  const supabase = createClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ proceso_id:'', nombre:'', objetivo:'', formula:'', unidad:'%', frecuencia:'Mensual', meta:0 })
  const [midiendo, setMidiendo] = useState<string | null>(null)
  const [medForm, setMedForm] = useState({ fecha: new Date().toISOString().slice(0,10), valor:0, nota:'' })
  const [recalculando, setRecalculando] = useState<string | null>(null)

  async function crearIndicador() {
    if (!form.nombre || !form.proceso_id) return
    await supabase.from('nomina_indicadores').insert({ ...form, tenant_id: tenantId, activo: true })
    setForm({ proceso_id:'', nombre:'', objetivo:'', formula:'', unidad:'%', frecuencia:'Mensual', meta:0 })
    setShowForm(false); onReload()
  }

  async function registrarMedicion(indicadorId: string) {
    await supabase.from('nomina_indicador_mediciones').insert({ tenant_id: tenantId, indicador_id: indicadorId, ...medForm })
    setMedForm({ fecha: new Date().toISOString().slice(0,10), valor:0, nota:'' })
    setMidiendo(null); onReload()
  }

  // Recalcula el indicador desde los datos reales de pedidos/pauta — misma lógica y mismos
  // campos que ya usa el dashboard principal (src/app/dashboard/page.tsx), no un cálculo paralelo.
  async function recalcular(ind: Indicador) {
    setRecalculando(ind.id)
    try {
      const { data: ultimoPedido } = await supabase.from('pedidos').select('fecha_pedido')
        .eq('tenant_id', tenantId).order('fecha_pedido', { ascending: false }).limit(1).maybeSingle()
      const fechaRef = ultimoPedido?.fecha_pedido ? new Date(ultimoPedido.fecha_pedido) : new Date()
      const ini = new Date(fechaRef.getFullYear(), fechaRef.getMonth(), 1).toISOString().slice(0,10)
      const fin = new Date(fechaRef.getFullYear(), fechaRef.getMonth()+1, 0).toISOString().slice(0,10)

      let valor = 0
      if (ind.origen === 'pedidos_gestionados' || ind.origen === 'pedidos_tasa_entrega') {
        const { data: peds } = await supabase.from('pedidos').select('estado').eq('tenant_id', tenantId)
          .gte('fecha_pedido', ini).lte('fecha_pedido', fin + 'T23:59:59')
        const rows = (peds || []) as { estado: string }[]
        const total = rows.length
        const entregados = rows.filter(p => ['ENTREGADO','entregado'].includes(p.estado)).length
        const cancelados = rows.filter(p => ['CANCELADO','cancelado'].includes(p.estado)).length
        valor = ind.origen === 'pedidos_tasa_entrega'
          ? (total > 0 ? Math.round(entregados / total * 100) : 0)
          : (total > 0 ? Math.round((entregados + cancelados) / total * 100) : 0)
      } else if (ind.origen === 'pauta_roas') {
        const [{ data: peds }, { data: pauta }] = await Promise.all([
          supabase.from('pedidos').select('pvp,estado').eq('tenant_id', tenantId).gte('fecha_pedido', ini).lte('fecha_pedido', fin + 'T23:59:59'),
          supabase.from('pauta').select('inversion').eq('tenant_id', tenantId).gte('fecha', ini).lte('fecha', fin),
        ])
        const ventas = ((peds || []) as { pvp:number; estado:string }[]).filter(p => ['ENTREGADO','entregado'].includes(p.estado)).reduce((a,p) => a + Number(p.pvp||0), 0)
        const inversion = ((pauta || []) as { inversion:number }[]).reduce((a,r) => a + Number(r.inversion||0), 0)
        valor = inversion > 0 ? Math.round(ventas / inversion * 10) / 10 : 0
      }

      await supabase.from('nomina_indicador_mediciones').insert({
        tenant_id: tenantId, indicador_id: ind.id, fecha: new Date().toISOString().slice(0,10), valor,
        nota: `Recalculado automáticamente desde pedidos/pauta (${ini} a ${fin})`,
      })
      onReload()
    } finally { setRecalculando(null) }
  }

  const porProceso = procesos
    .map(p => ({ proceso: p, items: indicadores.filter(i => i.proceso_id === p.id) }))
    .filter(g => g.items.length > 0)
  const sinProceso = indicadores.filter(i => !i.proceso_id)

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:'14px' }}>
        <button onClick={() => setShowForm(s => !s)} style={{ padding:'8px 14px', background:`${T.green}15`, border:`1px solid ${T.green}40`, borderRadius:'8px', color:T.green, cursor:'pointer', fontSize:'12px', fontWeight:'600' }}>
          {showForm ? '✕ Cancelar' : '+ Nuevo indicador'}
        </button>
      </div>

      {showForm && (
        <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:'10px', padding:'16px', marginBottom:'16px' }}>
          <div style={row2}>
            <div>
              <label style={lbl}>Proceso *</label>
              <select style={{ ...inp, appearance:'none' as React.CSSProperties['appearance'] }} value={form.proceso_id} onChange={e => setForm(f => ({ ...f, proceso_id: e.target.value }))}>
                <option value="">Seleccionar...</option>
                {procesos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>
            <div><label style={lbl}>Nombre del indicador *</label><input style={inp} value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} placeholder="% Pedidos gestionados" /></div>
          </div>
          <div style={{ marginBottom:'10px' }}><label style={lbl}>Objetivo</label><input style={inp} value={form.objetivo} onChange={e => setForm(f => ({ ...f, objetivo: e.target.value }))} placeholder="Aumentar el % de pedidos confirmados" /></div>
          <div style={{ marginBottom:'10px' }}><label style={lbl}>Fórmula</label><input style={inp} value={form.formula} onChange={e => setForm(f => ({ ...f, formula: e.target.value }))} placeholder="Pedidos gestionados / Total asignados" /></div>
          <div style={row2}>
            <div>
              <label style={lbl}>Unidad</label>
              <select style={{ ...inp, appearance:'none' as React.CSSProperties['appearance'] }} value={form.unidad} onChange={e => setForm(f => ({ ...f, unidad: e.target.value }))}>
                {['%','$','#'].map(u => <option key={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Frecuencia de medición</label>
              <select style={{ ...inp, appearance:'none' as React.CSSProperties['appearance'] }} value={form.frecuencia} onChange={e => setForm(f => ({ ...f, frecuencia: e.target.value }))}>
                {['Diaria','Semanal','Mensual'].map(u => <option key={u}>{u}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginBottom:'12px' }}><label style={lbl}>Meta</label><input style={inp} type="number" value={form.meta || ''} onChange={e => setForm(f => ({ ...f, meta: parseFloat(e.target.value) || 0 }))} /></div>
          <button onClick={crearIndicador} style={{ padding:'9px 20px', background:T.green, border:'none', borderRadius:'8px', color:T.card, fontWeight:'700', cursor:'pointer', fontSize:'13px' }}>✅ Crear indicador</button>
        </div>
      )}

      {indicadores.length === 0 && !showForm ? (
        <div style={{ textAlign:'center', padding:'48px', background:T.card, border:`1px solid ${T.border}`, borderRadius:'12px' }}>
          <div style={{ fontSize:'32px', marginBottom:'10px' }}>📈</div>
          <div style={{ fontSize:'14px', fontWeight:'600', color:T.text }}>Sin indicadores todavía</div>
        </div>
      ) : (
        [...porProceso, ...(sinProceso.length ? [{ proceso: { id:'', nombre:'Sin proceso' } as Proceso, items: sinProceso }] : [])].map(g => (
          <div key={g.proceso.id || 'sin'} style={{ marginBottom:'18px' }}>
            <div style={{ fontSize:'11px', fontWeight:'700', letterSpacing:'0.05em', color:T.purple, marginBottom:'8px' }}>{g.proceso.nombre.toUpperCase()}</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))', gap:'12px' }}>
              {g.items.map(ind => {
                const meds = mediciones.filter(m => m.indicador_id === ind.id).sort((a,b) => b.fecha.localeCompare(a.fecha))
                const ultimo = meds[0]
                const color = ultimo ? semaforoIndicador(ultimo.valor, ind.meta) : T.muted
                return (
                  <div key={ind.id} style={{ background:T.card, border:`1px solid ${T.border}`, borderTop:`3px solid ${color}`, borderRadius:'10px', padding:'14px' }}>
                    <div style={{ fontSize:'12px', fontWeight:'700', color:T.text, marginBottom:'2px' }}>{ind.nombre}</div>
                    {ind.objetivo && <div style={{ fontSize:'10px', color:T.muted, marginBottom:'8px' }}>{ind.objetivo}</div>}
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:'6px' }}>
                      <span style={{ fontSize:'20px', fontWeight:'800', color }}>{ultimo ? `${ultimo.valor}${ind.unidad === '%' ? '%' : ''}` : '—'}</span>
                      <span style={{ fontSize:'11px', color:T.muted }}>Meta: {ind.meta}{ind.unidad === '%' ? '%' : ind.unidad === '$' ? '' : 'x'}</span>
                    </div>
                    <div style={{ fontSize:'9px', color:T.muted, marginBottom:'8px' }}>{ind.frecuencia} · {ind.formula}</div>
                    {meds.length > 0 && (
                      <div style={{ marginBottom:'8px' }}>
                        {meds.slice(0,3).map(m => (
                          <div key={m.id} style={{ display:'flex', justifyContent:'space-between', fontSize:'10px', color:T.muted, padding:'2px 0' }}>
                            <span>{new Date(m.fecha).toLocaleDateString('es-CO')}</span>
                            <span style={{ color:T.text }}>{m.valor}{ind.unidad === '%' ? '%' : ''}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {ind.origen !== 'manual' ? (
                      <button onClick={() => recalcular(ind)} disabled={recalculando === ind.id}
                        style={{ width:'100%', padding:'6px', background:`${T.blue}15`, border:`1px solid ${T.blue}30`, borderRadius:'6px', color:T.blue, cursor: recalculando === ind.id ? 'wait' : 'pointer', fontSize:'11px', fontWeight:'600' }}>
                        {recalculando === ind.id ? 'Calculando...' : '🔄 Recalcular desde pedidos/pauta'}
                      </button>
                    ) : midiendo === ind.id ? (
                      <div style={{ display:'flex', gap:'6px', alignItems:'center' }}>
                        <input style={{ ...inpDate, flex:1 }} type="date" value={medForm.fecha} onChange={e => setMedForm(f => ({ ...f, fecha: e.target.value }))} />
                        <input style={{ ...inp, width:'70px' }} type="number" value={medForm.valor || ''} onChange={e => setMedForm(f => ({ ...f, valor: parseFloat(e.target.value) || 0 }))} />
                        <button onClick={() => registrarMedicion(ind.id)} style={{ padding:'0 10px', background:T.green, border:'none', borderRadius:'6px', color:T.card, fontWeight:'700', cursor:'pointer', fontSize:'11px', height:'32px' }}>✓</button>
                      </div>
                    ) : (
                      <button onClick={() => setMidiendo(ind.id)} style={{ width:'100%', padding:'6px', background:'none', border:`1px dashed ${T.border}`, borderRadius:'6px', color:T.muted, cursor:'pointer', fontSize:'11px' }}>+ Registrar medición</button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))
      )}
    </div>
  )
}

// Fila de detalle Devengado/Deducciones con botón de ajuste manual opcional (solo antes de aprobar).
function LineaAjustable({ concepto, valor, editable, onAjustar }: {
  l: Record<string, unknown>; concepto: string; valor: number; editable: boolean; onAjustar: () => void
}) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:'11px', color:T.text, padding:'3px 0' }}>
      <span>{concepto}</span>
      <span style={{ display:'flex', alignItems:'center', gap:'6px' }}>
        {fmt(valor)}
        {editable && (
          <button onClick={onAjustar} title="Ajuste manual" style={{ background:'none', border:'none', color:T.muted, cursor:'pointer', fontSize:'10px', padding:0 }}>✏️</button>
        )}
      </span>
    </div>
  )
}

// ── MODAL DETALLE DE SOLICITUD ─────────────────────────────
// RRHH debe poder ver toda la información (y el documento adjunto, si lo hay) antes de aprobar
// o rechazar — aprobar sin revisar el soporte de una incapacidad, por ejemplo, es exactamente
// el tipo de error que puede terminar en una liquidación mal hecha o un reclamo.
function ModalDetalleSolicitud({ s, onClose, onAprobar, onRechazar }: {
  s: Record<string, unknown>; onClose: () => void
  onAprobar: () => void; onRechazar: () => void
}) {
  const supabase = createClient()
  const esNovedad = ['vacaciones', 'incapacidad', 'auxilio'].includes(String(s.tipo))
  const label = TIPOS_NOVEDAD.flatMap(c => c.items).find(it => it.v === s.tipo)?.l
  const soportePath = ((s.docs_urls as Record<string, string>) || {}).soporte
  const [soporteUrl, setSoporteUrl] = useState('')
  const [cargando, setCargando] = useState(!!soportePath)

  useEffect(() => {
    if (!soportePath) { setCargando(false); return }
    supabase.storage.from('documentos-nomina').createSignedUrl(soportePath, 600).then(({ data, error: err }) => {
      if (!err && data?.signedUrl) setSoporteUrl(data.signedUrl)
      setCargando(false)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [soportePath])

  const esImagen = /\.(png|jpe?g|gif|webp)$/i.test(soportePath || '')
  const campos = (s.campos as Record<string, unknown>) || {}

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.6)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100, padding:'20px' }} onClick={onClose}>
      <div style={{ width:'min(560px,100%)', maxHeight:'90vh', overflowY:'auto', background:T.card, border:`1px solid ${T.border}`, borderRadius:'14px', padding:'22px' }} onClick={e => e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
          <div>
            <div style={{ fontSize:'15px', fontWeight:'700', color:T.text }}>{String(s.nombres)} {String(s.apellidos)}</div>
            {esNovedad && <span style={{ fontSize:'10px', padding:'2px 7px', borderRadius:'4px', background:`${T.yellow}20`, color:T.yellow }}>{label}</span>}
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:T.muted, cursor:'pointer', fontSize:'18px' }}>✕</button>
        </div>

        <div style={{ marginTop:'16px', display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:'10px', fontSize:'12px' }}>
          {esNovedad ? (
            <>
              {(s.fecha_inicio as string) && <div><span style={{ color:T.muted }}>Fecha inicio: </span>{String(s.fecha_inicio)}</div>}
              {(s.fecha_fin as string) && <div><span style={{ color:T.muted }}>Fecha fin: </span>{String(s.fecha_fin)}</div>}
              {campos.subtipo != null && <div><span style={{ color:T.muted }}>Subtipo: </span>{String(campos.subtipo)}</div>}
              {campos.descripcion ? <div style={{ gridColumn:'1 / -1' }}><span style={{ color:T.muted }}>Descripción: </span>{String(campos.descripcion)}</div> : null}
            </>
          ) : (
            <>
              <div><span style={{ color:T.muted }}>Documento: </span>{String(s.tipo_doc)} {String(s.numero_doc)}</div>
              <div><span style={{ color:T.muted }}>Celular: </span>{String(s.celular)}</div>
              <div><span style={{ color:T.muted }}>Correo: </span>{String(s.email)}</div>
              <div><span style={{ color:T.muted }}>País: </span>{String(s.pais_code || '—')}</div>
              <div><span style={{ color:T.muted }}>Ciudad: </span>{String(s.ciudad || '—')}</div>
              <div><span style={{ color:T.muted }}>Nivel de formación: </span>{String(s.nivel_formacion || '—')}</div>
              <div><span style={{ color:T.muted }}>Estado civil: </span>{String(s.estado_civil || '—')}</div>
            </>
          )}
        </div>

        {soportePath && (
          <div style={{ marginTop:'18px' }}>
            <div style={{ fontSize:'11px', fontWeight:'700', color:T.blue, marginBottom:'8px' }}>📎 DOCUMENTO ADJUNTO</div>
            {cargando ? (
              <div style={{ fontSize:'12px', color:T.muted }}>Cargando documento...</div>
            ) : soporteUrl ? (
              <div>
                {esImagen ? (
                  <img src={soporteUrl} alt="Soporte adjunto" style={{ maxWidth:'100%', maxHeight:'360px', borderRadius:'8px', border:`1px solid ${T.border}` }} />
                ) : (
                  <iframe src={soporteUrl} style={{ width:'100%', height:'360px', border:`1px solid ${T.border}`, borderRadius:'8px' }} title="Documento adjunto" />
                )}
                <a href={soporteUrl} target="_blank" rel="noreferrer" style={{ display:'inline-block', marginTop:'8px', fontSize:'11px', color:T.blue }}>Abrir en pestaña nueva ↗</a>
              </div>
            ) : (
              <div style={{ fontSize:'12px', color:T.red }}>No se pudo cargar el documento.</div>
            )}
          </div>
        )}

        <div style={{ display:'flex', gap:'8px', marginTop:'22px' }}>
          <button onClick={onAprobar} style={{ flex:1, padding:'10px', background:T.green, border:'none', borderRadius:'8px', color:T.card, fontWeight:'700', cursor:'pointer', fontSize:'13px' }}>✓ Aprobar</button>
          <button onClick={onRechazar} style={{ flex:1, padding:'10px', background:`${T.red}15`, border:`1px solid ${T.red}30`, borderRadius:'8px', color:T.red, cursor:'pointer', fontSize:'13px' }}>✕ Rechazar</button>
        </div>
      </div>
    </div>
  )
}

// ── MODAL AJUSTE MANUAL DE LIQUIDACIÓN ─────────────────────
// Cuando el cálculo automático no entiende un acuerdo especial, RRHH puede corregir una línea
// puntual dejando motivo y usuario en `ajustes_manuales` (auditoría) sin perder el valor que
// calculó el sistema originalmente.
function ModalAjuste({ concepto, valorSistema, onClose, onGuardar }: {
  concepto: string; valorSistema: number; onClose: () => void
  onGuardar: (valorAjustado: number, motivo: string) => void
}) {
  const [valor, setValor] = useState(valorSistema)
  const [motivo, setMotivo] = useState('')
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.6)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100, padding:'20px' }}>
      <div style={{ width:'min(400px,100%)', background:T.card, border:`1px solid ${T.border}`, borderRadius:'14px', padding:'22px' }}>
        <div style={{ fontSize:'14px', fontWeight:'700', color:T.text, marginBottom:'4px' }}>✏️ Ajuste manual</div>
        <div style={{ fontSize:'12px', color:T.muted, marginBottom:'14px' }}>{concepto}</div>
        <label style={lbl}>Valor calculado por el sistema</label>
        <div style={{ fontSize:'13px', color:T.muted, marginBottom:'10px' }}>{fmt(valorSistema)}</div>
        <label style={lbl}>Valor ajustado</label>
        <InputMiles value={valor} onChange={setValor} />
        <label style={{ ...lbl, marginTop:'10px' }}>Motivo del ajuste *</label>
        <textarea style={{ ...inp, minHeight:'60px', resize:'vertical' }} value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Ej: acuerdo especial con el colaborador, corrección de novedad no capturada..." />
        <div style={{ display:'flex', gap:'8px', marginTop:'16px' }}>
          <button onClick={onClose} style={{ flex:1, padding:'9px', background:'none', border:`1px solid ${T.border}`, borderRadius:'8px', color:T.muted, cursor:'pointer', fontSize:'12px' }}>Cancelar</button>
          <button
            onClick={() => { if (!motivo.trim()) { alert('El motivo es obligatorio'); return }; if (!confirm(`¿Confirmar ajuste de ${fmt(valorSistema)} a ${fmt(valor)}?`)) return; onGuardar(valor, motivo) }}
            style={{ flex:1, padding:'9px', background:T.accent, border:'none', borderRadius:'8px', color:T.card, fontWeight:'700', cursor:'pointer', fontSize:'12px' }}>
            Guardar ajuste
          </button>
        </div>
      </div>
    </div>
  )
}

// ── PÁGINA PRINCIPAL ──────────────────────────────────────
export default function NominaPage() {
  const supabase = createClient()
  const [tab, setTab] = useState<'organigrama'|'colaboradores'|'solicitudes'|'procesos'|'indicadores'|'novedades'|'liquidacion'|'tasas'>('colaboradores')
  const [solicitudes, setSolicitudes] = useState<Array<Record<string, unknown>>>([])
  const [detalleSolicitud, setDetalleSolicitud] = useState<Record<string, unknown> | null>(null)
  const [tenantId, setTenantId] = useState('')
  const [loading, setLoading] = useState(true)
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([])
  const [procesos, setProcesos] = useState<Proceso[]>([])
  const [cargos, setCargos] = useState<Cargo[]>([])
  const [indicadores, setIndicadores] = useState<Indicador[]>([])
  const [mediciones, setMediciones] = useState<Medicion[]>([])
  const [tasas, setTasas] = useState<Partial<TasaHistorico>>(TASAS_COL_2025)
  const [showModal, setShowModal] = useState(false)
  const [editData, setEditData] = useState<Colaborador | null>(null)
  const [buscar, setBuscar] = useState('')
  const [anioFiscal, setAnioFiscal] = useState(2025)

  // Creación rápida de proceso desde el wizard de colaborador
  const [nuevoProceso, setNuevoProceso] = useState('')

  // Novedades
  const [novedad, setNovedad] = useState({ empleado_id:'', tipo:'', campos:{} as Record<string,string|number> })
  const [novedades, setNovedades] = useState<Array<Record<string,unknown>>>([])
  const [soporteNovedad, setSoporteNovedad] = useState<File | null>(null)
  const [guardandoNovedad, setGuardandoNovedad] = useState(false)

  // Tasas edición
  const [editTasa, setEditTasa] = useState(false)
  const [pagandoNomina, setPagandoNomina] = useState(false)
  const [formTasa, setFormTasa] = useState<Partial<TasaHistorico>>(TASAS_COL_2025)

  // Liquidación
  const [esquemaNomina, setEsquemaNomina] = useState<'mensual' | 'quincenal'>('mensual')
  const [periodoLiquidacion, setPeriodoLiquidacion] = useState(() => new Date().toISOString().slice(0, 7) + '-01')
  const [liquidaciones, setLiquidaciones] = useState<Array<Record<string, unknown>>>([])
  const [calculandoLiquidacion, setCalculandoLiquidacion] = useState(false)
  const [expandidoLiq, setExpandidoLiq] = useState<string | null>(null)
  const [ajusteEdit, setAjusteEdit] = useState<{ liqId: string; concepto: string; valorSistema: number } | null>(null)
  const [colillasSeleccionadas, setColillasSeleccionadas] = useState<Set<string>>(new Set())
  const [enviandoColillas, setEnviandoColillas] = useState(false)
  const [empresa, setEmpresa] = useState<{ nombre: string; nit: string | null; moneda: string }>({ nombre: '', nit: null, moneda: 'COP' })

  async function loadData() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single()
    if (!profile?.tenant_id) { setLoading(false); return }
    setTenantId(profile.tenant_id)

    const [{ data: cols }, { data: procs }, { data: novs }, { data: tasa }, { data: sols }, { data: cargs }, { data: inds }, { data: meds }, { data: tenant }] = await Promise.all([
      supabase.from('colaboradores').select('*').eq('tenant_id', profile.tenant_id).eq('activo', true).order('nombres'),
      supabase.from('nomina_procesos').select('*').eq('tenant_id', profile.tenant_id).eq('activo', true).order('orden'),
      supabase.from('nomina_novedades').select('*').eq('tenant_id', profile.tenant_id).order('created_at', { ascending: false }),
      supabase.from('nomina_tasas_historico').select('*').eq('tenant_id', profile.tenant_id).eq('anio_fiscal', anioFiscal).eq('estado', 'activo').single(),
      supabase.from('nomina_solicitudes').select('*').eq('tenant_id', profile.tenant_id).eq('estado', 'pendiente').order('created_at', { ascending: false }),
      supabase.from('nomina_cargos').select('*').eq('tenant_id', profile.tenant_id).eq('activo', true).order('nombre'),
      supabase.from('nomina_indicadores').select('*').eq('tenant_id', profile.tenant_id).eq('activo', true).order('nombre'),
      supabase.from('nomina_indicador_mediciones').select('*').eq('tenant_id', profile.tenant_id).order('fecha', { ascending: false }),
      supabase.from('tenants').select('esquema_nomina, nombre, nit, moneda').eq('id', profile.tenant_id).single(),
    ])

    setColaboradores((cols || []) as Colaborador[])
    setProcesos((procs || []) as Proceso[])
    setNovedades(novs || [])
    if (tasa) { setTasas(tasa as TasaHistorico); setFormTasa(tasa as TasaHistorico) }
    setSolicitudes(sols || [])
    setCargos((cargs || []) as Cargo[])
    setIndicadores((inds || []) as Indicador[])
    setMediciones((meds || []) as Medicion[])
    if (tenant?.esquema_nomina) setEsquemaNomina(tenant.esquema_nomina as 'mensual' | 'quincenal')
    if (tenant) setEmpresa({ nombre: tenant.nombre || '', nit: tenant.nit || null, moneda: tenant.moneda || 'COP' })
    setLoading(false)
  }

  async function guardarNit(nit: string) {
    await supabase.from('tenants').update({ nit }).eq('id', tenantId)
    setEmpresa(e => ({ ...e, nit }))
  }

  async function cargarLiquidaciones(periodo: string, tid: string) {
    const { data } = await supabase.from('nomina_liquidaciones_snapshot')
      .select('*').eq('tenant_id', tid).eq('periodo', periodo).order('created_at')
    setLiquidaciones(data || [])
  }

  useEffect(() => {
    if (tenantId) cargarLiquidaciones(periodoLiquidacion, tenantId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, periodoLiquidacion])

  async function aprobarSolicitud(s: Record<string, unknown>) {
    const esNovedad = ['vacaciones', 'incapacidad', 'auxilio'].includes(String(s.tipo))
    const { data: { user } } = await supabase.auth.getUser()

    if (esNovedad) {
      if (!confirm(`¿Aprobar la solicitud de ${s.nombres} ${s.apellidos}?`)) return
      const campos = (s.campos as Record<string, unknown>) || {}
      const soporte_url = ((s.docs_urls as Record<string, string>) || {}).soporte || null
      const { error: err } = await supabase.from('nomina_novedades').insert({
        tenant_id: tenantId,
        colaborador_id: s.colaborador_id,
        tipo: s.tipo,
        campos,
        valor: 0,
        fecha_inicio: s.fecha_inicio || null,
        fecha_fin: s.fecha_fin || null,
        periodo: new Date().toISOString().slice(0, 10),
        soporte_url,
        origen: 'colaborador',
        estado: 'aprobada',
        created_by: user?.id,
      })
      if (err) { alert(`Error al aprobar: ${err.message}`); return }
      await supabase.from('nomina_solicitudes')
        .update({ estado: 'aprobado', aprobado_por: user?.id, revisado_por: user?.id, revisado_en: new Date().toISOString() })
        .eq('id', s.id as string)
      loadData()
      return
    }

    if (!confirm(`¿Convertir la solicitud de ${s.nombres} ${s.apellidos} en colaborador activo?`)) return
    const { error: err } = await supabase.from('colaboradores').insert({
      tenant_id: tenantId,
      nombres: s.nombres, apellidos: s.apellidos, tipo_doc: s.tipo_doc, num_doc: s.numero_doc,
      celular: s.celular, email: s.email, correo_personal: s.email,
      pais_code: s.pais_code, pais_nacimiento_code: s.pais_code, ciudad: s.ciudad,
      nivel_formacion: s.nivel_formacion, estado_civil: s.estado_civil,
      datos_conyuge: s.datos_conyuge || {}, datos_hijos: s.datos_hijos || [],
      docs_urls: s.docs_urls || {}, cargo: 'Por definir', tipo_contrato: 'Empleado',
      fecha_ingreso: new Date().toISOString().slice(0, 10), activo: true, carga_total_mes: 0,
    })
    if (err) { alert(`Error al aprobar: ${err.message}`); return }
    await supabase.from('nomina_solicitudes')
      .update({ estado: 'aprobado', aprobado_por: user?.id, revisado_por: user?.id, revisado_en: new Date().toISOString() })
      .eq('id', s.id as string)
    supabase.auth.getSession().then(({ data: { session } }) => {
      fetch('/api/nomina/notificar-solicitud', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ tenantId, email: s.email, nombres: s.nombres, decision: 'aprobado' }),
      }).catch(() => {})
    })
    alert('Colaborador creado — completa su información laboral y salarial desde "Colaboradores".')
    loadData()
  }

  async function rechazarSolicitud(id: string) {
    if (!confirm('¿Rechazar esta solicitud?')) return
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('nomina_solicitudes')
      .update({ estado: 'rechazado', revisado_por: user?.id, revisado_en: new Date().toISOString() })
      .eq('id', id)
    loadData()
  }

  function copiarLinkRegistro() {
    const url = `${window.location.origin}/registro-colaborador/${tenantId}`
    navigator.clipboard.writeText(url)
    alert(`Link copiado:\n${url}`)
  }

  function copiarLinkSolicitudes(colaboradorId: string) {
    const url = `${window.location.origin}/mis-solicitudes/${colaboradorId}`
    navigator.clipboard.writeText(url)
    alert(`Link personal copiado:\n${url}`)
  }

  async function verSoporteNovedad(path: string) {
    if (!path) return
    const { data, error: err } = await supabase.storage.from('documentos-nomina').createSignedUrl(path, 300)
    if (err || !data?.signedUrl) { alert('No se pudo generar el link del soporte'); return }
    window.open(data.signedUrl, '_blank')
  }

  async function aprobarNovedad(n: Record<string, unknown>) {
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('nomina_novedades')
      .update({ estado: 'aprobada', revisado_por: user?.id, revisado_en: new Date().toISOString() })
      .eq('id', n.id as string)
    loadData()
  }

  async function rechazarNovedad(id: string) {
    if (!confirm('¿Rechazar esta novedad?')) return
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('nomina_novedades')
      .update({ estado: 'rechazada', revisado_por: user?.id, revisado_en: new Date().toISOString() })
      .eq('id', id)
    loadData()
  }

  useEffect(() => { loadData() }, [anioFiscal])

  async function crearProceso(nombre?: string, tipo?: string) {
    const n = (nombre ?? nuevoProceso).trim()
    if (!n) return null
    const { data, error: err } = await supabase.from('nomina_procesos')
      .insert({ nombre: n, tipo: tipo || 'Misional', tenant_id: tenantId, orden: procesos.length + 1, activo: true })
      .select('id').single()
    setNuevoProceso(''); await loadData()
    return err ? null : data?.id || null
  }

  async function crearCargo(nombre: string, procesoId: string) {
    const n = nombre.trim()
    if (!n || !procesoId) return null
    const { data, error: err } = await supabase.from('nomina_cargos')
      .insert({ tenant_id: tenantId, proceso_id: procesoId, nombre: n, tipo: 'Analista', activo: true })
      .select('id').single()
    await loadData()
    return err ? null : data?.id || null
  }

  async function eliminarColaborador(id: string) {
    if (!confirm('¿Desactivar este colaborador?')) return
    await supabase.from('colaboradores').update({ activo: false }).eq('id', id)
    loadData()
  }

  async function guardarTasas() {
    await supabase.from('nomina_tasas_historico').upsert(
      { ...formTasa, tenant_id: tenantId, anio_fiscal: anioFiscal, estado: 'activo', vigencia_inicio: `${anioFiscal}-01-01` },
      { onConflict: 'tenant_id,pais_code,anio_fiscal' }
    )
    setEditTasa(false); loadData()
  }

  // Conexión real → Libro de Caja (módulo P&G) — registro agregado de la nómina pagada
  async function calcularLiquidacionPeriodo() {
    if (!tenantId || colaboradores.length === 0) return
    setCalculandoLiquidacion(true)
    // No se recalculan liquidaciones ya aprobadas/pagadas de este periodo — evita borrar el
    // rastro de auditoría (aprobado_por/pagado_por) de un colaborador ya cerrado si RRHH vuelve
    // a presionar "Calcular" tras agregar una novedad para otro colaborador del mismo periodo.
    const yaCerradas = new Set(liquidaciones.filter(l => ['aprobada', 'pagada'].includes(String(l.estado))).map(l => l.colaborador_id as string))
    const colabsACalcular = colaboradores.filter(c => !yaCerradas.has(c.id))
    const filas = colabsACalcular.map(c => {
      const r = calcularLiquidacion(c, novedades, tasas, esquemaNomina)
      return {
        tenant_id: tenantId, colaborador_id: c.id, periodo: periodoLiquidacion,
        tipo_contrato: c.tipo_contrato, salario_base: c.salario_base,
        devengados: r.totalDevengado, deducciones: r.totalDeducciones, neto_pagar: r.neto,
        total_ss_emp: r.totalApropiaciones, carga_total: r.cargaTotal,
        proceso_id: c.proceso_id || null,
        estado: 'calculada', ajustes_manuales: [],
        snapshot: { devengado: r.devengado, deducciones: r.deducciones, apropiaciones: r.apropiaciones, ibc: r.ibc, avisoPaisNoVerificado: r.avisoPaisNoVerificado, avisoFsp: r.avisoFsp, esquema: esquemaNomina },
      }
    })
    if (filas.length > 0) {
      const { error: err } = await supabase.from('nomina_liquidaciones_snapshot')
        .upsert(filas, { onConflict: 'tenant_id,colaborador_id,periodo' })
      if (err) { setCalculandoLiquidacion(false); alert(`Error al calcular la liquidación: ${err.message}`); return }
    }
    setCalculandoLiquidacion(false)
    if (yaCerradas.size > 0) {
      alert(`${yaCerradas.size} liquidación(es) ya aprobada(s)/pagada(s) de este periodo no se recalcularon.`)
    }
    cargarLiquidaciones(periodoLiquidacion, tenantId)
  }

  async function revisarLiquidacion(liq: Record<string, unknown>) {
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('nomina_liquidaciones_snapshot')
      .update({ estado: 'revisada', revisado_por: user?.id, revisado_en: new Date().toISOString() })
      .eq('id', liq.id as string)
    cargarLiquidaciones(periodoLiquidacion, tenantId)
  }

  async function aprobarLiquidacion(liq: Record<string, unknown>) {
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('nomina_liquidaciones_snapshot')
      .update({ estado: 'aprobada', aprobado: true, aprobado_por: user?.id })
      .eq('id', liq.id as string)
    cargarLiquidaciones(periodoLiquidacion, tenantId)
  }

  async function pagarLiquidacionesDelPeriodo() {
    const aprobadas = liquidaciones.filter(l => l.estado === 'aprobada')
    if (aprobadas.length === 0) { alert('No hay liquidaciones aprobadas para pagar en este periodo.'); return }
    if (!confirm(`¿Pagar ${aprobadas.length} liquidación(es) aprobada(s) de este periodo?`)) return
    setPagandoNomina(true)
    const { data: { user } } = await supabase.auth.getUser()
    const totalNeto = aprobadas.reduce((a, l) => a + Number(l.neto_pagar || 0), 0)
    const hoy = new Date().toISOString().slice(0, 10)
    await supabase.from('libro_caja').insert({
      tenant_id: tenantId, fecha: hoy,
      concepto: `Nómina ${periodoLiquidacion} — ${aprobadas.length} colaborador(es)`,
      tipo: 'salida', valor: Math.round(totalNeto), origen: 'nomina',
      categoria_flujo: 'operativo',
    })
    await supabase.from('nomina_liquidaciones_snapshot')
      .update({ estado: 'pagada', pagado_por: user?.id, pagado_en: new Date().toISOString() })
      .in('id', aprobadas.map(l => l.id as string))
    setPagandoNomina(false)
    alert(`Nómina pagada: ${fmt(Math.round(totalNeto))} registrada en Libro de Caja (módulo P&G)`)
    cargarLiquidaciones(periodoLiquidacion, tenantId)
  }

  async function guardarAjusteManual(liq: Record<string, unknown>, concepto: string, valorSistema: number, valorAjustado: number, motivo: string) {
    const { data: { user } } = await supabase.auth.getUser()
    const ajustesPrevios = (liq.ajustes_manuales as Array<Record<string, unknown>>) || []
    const delta = valorAjustado - valorSistema
    const ajustes = [...ajustesPrevios, { concepto, valor_sistema: valorSistema, valor_ajustado: valorAjustado, motivo, usuario: user?.id, fecha: new Date().toISOString() }]
    const nuevoNeto = Number(liq.neto_pagar || 0) + delta
    const { error: err } = await supabase.from('nomina_liquidaciones_snapshot')
      .update({ ajustes_manuales: ajustes, neto_pagar: nuevoNeto })
      .eq('id', liq.id as string)
    if (err) { alert(`Error al guardar el ajuste: ${err.message}`); return }
    cargarLiquidaciones(periodoLiquidacion, tenantId)
  }

  function exportarExcelLiquidacion() {
    const filas = liquidaciones.map(l => {
      const col = colaboradores.find(c => c.id === l.colaborador_id)
      return {
        Colaborador: col ? `${col.nombres} ${col.apellidos}` : '—',
        Cargo: col?.cargo || '—',
        'Salario Base': l.salario_base,
        Devengado: l.devengados,
        Deducciones: l.deducciones,
        'Neto a Pagar': l.neto_pagar,
        'Carga Total Empleador': l.carga_total,
        Estado: l.estado,
      }
    })
    const ws = XLSX.utils.json_to_sheet(filas)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Liquidación')
    XLSX.writeFile(wb, `liquidacion_${periodoLiquidacion}.xlsx`)
  }

  function datosColillaDe(l: Record<string, unknown>, col: Colaborador) {
    const snap = (l.snapshot as Record<string, unknown>) || {}
    return {
      empresaNombre: empresa.nombre, empresaNit: empresa.nit,
      colaboradorNombre: `${col.nombres} ${col.apellidos}`, colaboradorDoc: `${col.tipo_doc} ${col.num_doc}`,
      cargo: col.cargo || '—', periodo: periodoLiquidacion, esquema: esquemaNomina,
      devengado: (snap.devengado as LineaLiquidacion[]) || [], totalDevengado: Number(l.devengados || 0),
      deducciones: (snap.deducciones as LineaLiquidacion[]) || [], totalDeducciones: Number(l.deducciones || 0),
      neto: Number(l.neto_pagar || 0),
      banco: col.banco, tipoCuenta: col.tipo_cuenta, numCuenta: col.num_cuenta,
      moneda: empresa.moneda,
    }
  }

  function descargarColillaPDF(l: Record<string, unknown>) {
    const col = colaboradores.find(c => c.id === l.colaborador_id)
    if (!col) return
    const doc = construirColillaPDF(datosColillaDe(l, col))
    doc.save(`colilla_${col.nombres}_${col.apellidos}_${periodoLiquidacion}.pdf`)
  }

  async function enviarColillasSeleccionadas() {
    if (colillasSeleccionadas.size === 0) return
    setEnviandoColillas(true)
    const { data: { session } } = await supabase.auth.getSession()
    const colillas = liquidaciones
      .filter(l => colillasSeleccionadas.has(String(l.id)))
      .map(l => {
        const col = colaboradores.find(c => c.id === l.colaborador_id)
        if (!col) return null
        return { email: col.email || col.correo_personal, nombre: col.nombres, datos: datosColillaDe(l, col) }
      })
      .filter(Boolean)

    const res = await fetch('/api/nomina/enviar-colilla', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ tenantId, colillas }),
    })
    const data = await res.json().catch(() => ({}))
    setEnviandoColillas(false)
    if (!res.ok) { alert(`Error al enviar colillas: ${data.error || res.statusText}`); return }
    const fallidas = (data.resultados || []).filter((r: { ok: boolean }) => !r.ok)
    if (fallidas.length > 0) {
      alert(`Enviadas ${data.resultados.length - fallidas.length} de ${data.resultados.length}. Fallaron: ${fallidas.map((f: { email: string; error: string }) => `${f.email || '(sin correo)'}: ${f.error}`).join('; ')}`)
    } else {
      alert(`✅ ${data.resultados.length} colilla(s) enviada(s) por correo.`)
    }
    setColillasSeleccionadas(new Set())
  }

  const colsFiltrados = colaboradores.filter(c =>
    !buscar || `${c.nombres} ${c.apellidos} ${c.cargo}`.toLowerCase().includes(buscar.toLowerCase())
  )

  const totalNomina = colaboradores.reduce((a, c) => a + (c.carga_total_mes || 0), 0)
  const alertasVencimiento = colaboradores.filter(c => {
    if (!c.fecha_fin) return false
    const dias = Math.ceil((new Date(c.fecha_fin).getTime() - Date.now()) / 86400000)
    return dias <= 40
  })

  // Por proceso: agrupar colaboradores
  const porProceso = procesos.map(p => ({
    ...p,
    colaboradores: colaboradores.filter(c => c.proceso_id === p.id),
    carga: colaboradores.filter(c => c.proceso_id === p.id).reduce((a, c) => a + (c.carga_total_mes || 0), 0),
  }))

  const TABS = [
    { v:'organigrama',   l:'🗂️ Organigrama',  c:T.purple },
    { v:'procesos',      l:'🧭 Procesos',      c:T.purple },
    { v:'indicadores',   l:'📈 Indicadores',   c:T.green },
    { v:'colaboradores', l:'👥 Colaboradores', c:T.blue },
    { v:'solicitudes',   l:`📥 Solicitudes${solicitudes.length ? ` (${solicitudes.length})` : ''}`, c:T.red },
    { v:'novedades',     l:'📋 Novedades',     c:T.yellow },
    { v:'liquidacion',   l:'💵 Liquidación',   c:T.green },
    { v:'tasas',         l:'⚙️ Tasas',         c:T.accent },
  ]

  return (
    <div style={{ color:T.text, fontFamily:'"DM Sans", system-ui, sans-serif' }}>
      {showModal && (
        <ModalColaborador
          onClose={() => { setShowModal(false); setEditData(null) }}
          onSave={() => { setShowModal(false); setEditData(null); loadData() }}
          tenantId={tenantId}
          editData={editData}
          procesos={procesos}
          tasas={tasas}
          onProcesoCreado={crearProceso}
          cargos={cargos}
          onCargoCreado={crearCargo}
        />
      )}

      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:'20px', flexWrap:'wrap', gap:'10px' }}>
        <div>
          <h1 style={{ fontSize:'22px', fontWeight:'700', color:T.text, marginBottom:'4px' }}>👥 Gestión de Nómina</h1>
          <p style={{ fontSize:'12px', color:T.muted }}>Tu equipo es tu mayor activo — gestiona con precisión</p>
        </div>
        <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
          <button onClick={copiarLinkRegistro}
            style={{ padding:'9px 16px', background:`${T.blue}15`, border:`1px solid ${T.blue}40`, borderRadius:'9px', color:T.blue, fontWeight:'700', cursor:'pointer', fontSize:'13px' }}>
            🔗 Copiar link de registro
          </button>
          <button onClick={() => { setEditData(null); setShowModal(true) }}
            style={{ padding:'9px 18px', background:T.accent, border:'none', borderRadius:'9px', color:T.card, fontWeight:'700', cursor:'pointer', fontSize:'13px' }}>
            + Nuevo colaborador
          </button>
        </div>
      </div>

      {/* Alertas contratos */}
      {alertasVencimiento.length > 0 && (
        <div style={{ background:`${T.yellow}12`, border:`1px solid ${T.yellow}30`, borderRadius:'9px', padding:'10px 16px', marginBottom:'14px', display:'flex', alignItems:'center', gap:'10px', fontSize:'12px', color:T.yellow }}>
          <span style={{ fontSize:'18px' }}>⚠️</span>
          <span>{alertasVencimiento.length} contrato(s) a término fijo vencen en los próximos 40 días: <strong>{alertasVencimiento.map(c => `${c.nombres} ${c.apellidos}`).join(', ')}</strong></span>
        </div>
      )}

      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:'10px', marginBottom:'20px' }}>
        {[
          { l:'Total colaboradores', v:colaboradores.length, sub:'Activos', c:T.blue },
          { l:'Carga nómina total', v:fmt(totalNomina), sub:'Costo empleador mes', c:T.accent },
          { l:'Carga por área Admin', v:fmt(porProceso.find(p=>p.nombre.toLowerCase().includes('admin'))?.carga||0), sub:'CF corporativo', c:T.green },
          { l:'Carga área Ventas', v:fmt(porProceso.find(p=>p.nombre.toLowerCase().includes('vent')||p.nombre.toLowerCase().includes('comerc'))?.carga||0), sub:'Absorbe en CAC', c:T.purple },
        ].map(k => (
          <div key={k.l} style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:'10px', padding:'12px 16px', borderTop:`3px solid ${k.c}` }}>
            <div style={{ fontSize:'11px', color:T.muted, marginBottom:'4px' }}>{k.l}</div>
            <div style={{ fontSize:'18px', fontWeight:'700', color:k.c, marginBottom:'2px' }}>{k.v}</div>
            <div style={{ fontSize:'10px', color:T.muted }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:'6px', marginBottom:'16px', flexWrap:'wrap' }}>
        {TABS.map(t => (
          <button key={t.v} onClick={() => setTab(t.v as typeof tab)}
            style={{ padding:'8px 14px', borderRadius:'8px', cursor:'pointer', fontSize:'13px', fontWeight:tab===t.v?'600':'400', border:`1px solid ${tab===t.v?t.c:T.border}`, background:tab===t.v?`${t.c}15`:'transparent', color:tab===t.v?t.c:T.muted }}>
            {t.l}
          </button>
        ))}
      </div>

      {/* ══ ORGANIGRAMA (árbol real por cargo) ══ */}
      {tab === 'organigrama' && (
        <ArbolOrganigrama cargos={cargos} colaboradores={colaboradores} procesos={procesos} tenantId={tenantId} onReload={loadData} />
      )}

      {/* ══ PROCESOS (tablero drag-and-drop) ══ */}
      {tab === 'procesos' && (
        <TableroProcesos procesos={procesos} colaboradores={colaboradores} tenantId={tenantId} onReload={loadData} />
      )}

      {/* ══ MATRIZ DE INDICADORES ══ */}
      {tab === 'indicadores' && (
        <MatrizIndicadores indicadores={indicadores} mediciones={mediciones} procesos={procesos} tenantId={tenantId} onReload={loadData} />
      )}

      {/* ══ COLABORADORES ══ */}
      {tab === 'colaboradores' && (
        <div>
          <div style={{ marginBottom:'12px' }}>
            <input style={{ ...inp, width:'280px' }} placeholder="🔍 Buscar por nombre o cargo..." value={buscar} onChange={e => setBuscar(e.target.value)} />
          </div>
          <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:'12px', overflow:'hidden' }}>
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr style={{ background:'#060E1C' }}>
                    {['#','Colaborador','Cargo','Área','Tipo','Salario','Carga Total','SS','Acciones'].map(h => (
                      <th key={h} style={{ padding:'10px 12px', textAlign:'left', fontSize:'11px', color:T.muted, fontWeight:'600', whiteSpace:'nowrap', borderBottom:`1px solid ${T.border}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={9} style={{ textAlign:'center', padding:'40px', color:T.muted }}>Cargando...</td></tr>
                  ) : colsFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ textAlign:'center', padding:'48px' }}>
                        <div style={{ fontSize:'32px', marginBottom:'10px' }}>👥</div>
                        <div style={{ fontSize:'14px', fontWeight:'600', color:T.text, marginBottom:'6px' }}>No hay colaboradores aún</div>
                        <button onClick={() => setShowModal(true)} style={{ padding:'9px 20px', background:T.accent, border:'none', borderRadius:'8px', color:T.card, fontWeight:'700', cursor:'pointer', fontSize:'13px' }}>+ Agregar primer colaborador</button>
                      </td>
                    </tr>
                  ) : colsFiltrados.map((c, i) => {
                    const proc = procesos.find(p => p.id === c.proceso_id)
                    const vence = c.fecha_fin ? Math.ceil((new Date(c.fecha_fin).getTime() - Date.now()) / 86400000) : null
                    return (
                      <tr key={c.id} style={{ borderBottom:`1px solid ${T.border}`, background:i%2===0?'transparent':'#080F1C' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#0F1E32'}
                        onMouseLeave={e => e.currentTarget.style.background = i%2===0?'transparent':'#080F1C'}>
                        <td style={{ padding:'8px 12px', fontSize:'11px', color:T.muted }}>#{String(i+1).padStart(3,'0')}</td>
                        <td style={{ padding:'8px 12px' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                            <div style={{ width:'30px', height:'30px', borderRadius:'50%', background:`${T.blue}20`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'11px', fontWeight:'700', color:T.blue, flexShrink:0 }}>
                              {(c.nombres[0]||'')+(c.apellidos[0]||'')}
                            </div>
                            <div>
                              <div style={{ fontSize:'12px', fontWeight:'600', color:T.text }}>{c.nombres} {c.apellidos}</div>
                              <div style={{ fontSize:'10px', color:T.muted }}>{c.email}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding:'8px 12px', fontSize:'12px', color:T.text }}>{c.cargo}</td>
                        <td style={{ padding:'8px 12px', fontSize:'11px', color:T.purple }}>{proc?.nombre || '—'}</td>
                        <td style={{ padding:'8px 12px' }}>
                          <span style={{ fontSize:'10px', padding:'2px 7px', borderRadius:'4px', background:`${T.blue}20`, color:T.blue }}>
                            {c.tipo_contrato}
                          </span>
                          {vence !== null && vence <= 40 && (
                            <div style={{ fontSize:'9px', color:T.yellow, marginTop:'2px' }}>⚠️ Vence {vence}d</div>
                          )}
                        </td>
                        <td style={{ padding:'8px 12px', fontSize:'12px', color:T.text }}>{fmt(c.salario_base, c.pais_code)}</td>
                        <td style={{ padding:'8px 12px', fontSize:'12px', fontWeight:'700', color:T.accent }}>{fmt(c.carga_total_mes || 0, c.pais_code)}</td>
                        <td style={{ padding:'8px 12px', fontSize:'11px', color:T.muted, whiteSpace:'nowrap' }}>
                          <div>{c.eps || '—'}</div>
                          <div style={{ fontSize:'10px' }}>{c.pension || '—'}</div>
                        </td>
                        <td style={{ padding:'8px 12px' }}>
                          <div style={{ display:'flex', gap:'6px' }}>
                            <button onClick={() => { setEditData(c); setShowModal(true) }} style={{ padding:'4px 8px', background:`${T.blue}15`, border:`1px solid ${T.blue}30`, borderRadius:'5px', color:T.blue, cursor:'pointer', fontSize:'10px' }}>✏️</button>
                            <button onClick={() => copiarLinkSolicitudes(c.id)} title="Copiar link personal de solicitudes" style={{ padding:'4px 8px', background:`${T.yellow}15`, border:`1px solid ${T.yellow}30`, borderRadius:'5px', color:T.yellow, cursor:'pointer', fontSize:'10px' }}>🔗</button>
                            <button onClick={() => eliminarColaborador(c.id)} style={{ padding:'4px 8px', background:`${T.red}15`, border:`1px solid ${T.red}30`, borderRadius:'5px', color:T.red, cursor:'pointer', fontSize:'10px' }}>🗑</button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
          {colsFiltrados.length > 0 && <div style={{ textAlign:'center', marginTop:'10px', fontSize:'12px', color:T.muted }}>Total carga nómina: <strong style={{ color:T.accent }}>{fmt(totalNomina)}</strong></div>}
        </div>
      )}

      {/* ══ SOLICITUDES (autorregistro) ══ */}
      {tab === 'solicitudes' && (
        <div>
          <div style={{ background:`${T.blue}10`, border:`1px solid ${T.blue}20`, borderRadius:'8px', padding:'10px 14px', marginBottom:'14px', fontSize:'11px', color:T.muted }}>
            Comparte el link de registro con el nuevo colaborador, o el link personal de solicitudes con un colaborador activo — al enviar el formulario aparece aquí para tu aprobación.
          </div>
          {solicitudes.length === 0 ? (
            <div style={{ textAlign:'center', padding:'48px', background:T.card, border:`1px solid ${T.border}`, borderRadius:'12px' }}>
              <div style={{ fontSize:'32px', marginBottom:'10px' }}>📥</div>
              <div style={{ fontSize:'14px', fontWeight:'600', color:T.text, marginBottom:'6px' }}>Sin solicitudes pendientes</div>
              <button onClick={copiarLinkRegistro} style={{ padding:'9px 20px', background:T.blue, border:'none', borderRadius:'8px', color:'#fff', fontWeight:'700', cursor:'pointer', fontSize:'13px' }}>🔗 Copiar link de registro</button>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
              {solicitudes.map(s => {
                const esNovedad = ['vacaciones', 'incapacidad', 'auxilio'].includes(String(s.tipo))
                const label = TIPOS_NOVEDAD.flatMap(c => c.items).find(it => it.v === s.tipo)?.l
                const soporte = ((s.docs_urls as Record<string, string>) || {}).soporte
                return (
                  <div key={String(s.id)} style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:'10px', padding:'14px', display:'flex', justifyContent:'space-between', alignItems:'center', gap:'12px', flexWrap:'wrap' }}>
                    <div>
                      <div style={{ fontSize:'13px', fontWeight:'700', color:T.text }}>
                        {String(s.nombres)} {String(s.apellidos)}
                        {esNovedad && <span style={{ marginLeft:'8px', fontSize:'10px', padding:'2px 7px', borderRadius:'4px', background:`${T.yellow}20`, color:T.yellow }}>{label}</span>}
                        {soporte && <span style={{ marginLeft:'6px', fontSize:'10px', color:T.blue }}>📎</span>}
                      </div>
                      {esNovedad ? (
                        <div style={{ fontSize:'11px', color:T.muted }}>
                          {s.fecha_inicio ? `${String(s.fecha_inicio)} → ${String(s.fecha_fin || s.fecha_inicio)}` : ''}
                        </div>
                      ) : (
                        <>
                          <div style={{ fontSize:'11px', color:T.muted }}>{String(s.tipo_doc)} {String(s.numero_doc)} · {String(s.email)} · {String(s.celular)}</div>
                          <div style={{ fontSize:'10px', color:T.muted, marginTop:'2px' }}>{s.ciudad ? `${s.ciudad}, ` : ''}{String(s.pais_code || '')}</div>
                        </>
                      )}
                    </div>
                    <div style={{ display:'flex', gap:'8px' }}>
                      <button onClick={() => setDetalleSolicitud(s)} style={{ padding:'7px 14px', background:`${T.blue}15`, border:`1px solid ${T.blue}30`, borderRadius:'8px', color:T.blue, fontWeight:'700', cursor:'pointer', fontSize:'12px' }}>👁 Ver detalle</button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          {detalleSolicitud && (
            <ModalDetalleSolicitud
              s={detalleSolicitud}
              onClose={() => setDetalleSolicitud(null)}
              onAprobar={() => { aprobarSolicitud(detalleSolicitud); setDetalleSolicitud(null) }}
              onRechazar={() => { rechazarSolicitud(String(detalleSolicitud.id)); setDetalleSolicitud(null) }}
            />
          )}
        </div>
      )}

      {/* ══ NOVEDADES ══ */}
      {tab === 'novedades' && (
        <div>
          <div style={{ marginBottom:'16px' }}>
            <div className="dz-grid-side-l" style={{ ['--side-w' as any]:'200px', gap:'10px', background:T.card, border:`1px solid ${T.border}`, borderRadius:'10px', padding:'16px' }}>
              <div>
                <label style={lbl}>Colaborador</label>
                <select style={{ ...inp, appearance:'none' as React.CSSProperties['appearance'] }} value={novedad.empleado_id} onChange={e => setNovedad(n => ({ ...n, empleado_id: e.target.value }))}>
                  <option value="">Seleccionar...</option>
                  {colaboradores.map(c => <option key={c.id} value={c.id}>{c.nombres} {c.apellidos}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Tipo de novedad</label>
                <select style={{ ...inp, appearance:'none' as React.CSSProperties['appearance'] }} value={novedad.tipo} onChange={e => setNovedad(n => ({ ...n, tipo: e.target.value, campos: {} }))}>
                  <option value="">Seleccionar...</option>
                  {TIPOS_NOVEDAD.map(cat => (
                    <optgroup key={cat.cat} label={cat.cat}>
                      {cat.items.map(it => <option key={it.v} value={it.v}>{it.l}</option>)}
                    </optgroup>
                  ))}
                </select>
              </div>
            </div>


            {/* Campos dinámicos según tipo */}
            {novedad.tipo && (
              <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:'10px', padding:'14px', marginTop:'10px' }}>
                <div style={{ fontSize:'12px', fontWeight:'600', color:T.accent, marginBottom:'10px' }}>
                  {TIPOS_NOVEDAD.flatMap(c => c.items).find(i => i.v === novedad.tipo)?.l}
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))', gap:'8px' }}>
                  {(TIPOS_NOVEDAD.flatMap(c => c.items).find(i => i.v === novedad.tipo)?.campos || []).map(campo => {
                    const esMoneda = ['valor','valor_monto','monto_total','valor_cuota'].includes(campo)
                    return (
                      <div key={campo}>
                        <label style={lbl}>{campo.replace(/_/g,' ')}</label>
                        {esMoneda ? (
                          <InputMiles
                            value={Number(novedad.campos[campo] || 0)}
                            onChange={v => setNovedad(n => ({ ...n, campos: { ...n.campos, [campo]: v } }))}
                          />
                        ) : (
                          <input
                            style={inp}
                            type={campo.includes('fecha') ? 'date' : campo.includes('horas') || campo.includes('cuota') || campo.includes('dias') || campo.includes('num') ? 'number' : 'text'}
                            value={(novedad.campos[campo] as string) || ''}
                            onChange={e => setNovedad(n => ({ ...n, campos: { ...n.campos, [campo]: e.target.value } }))}
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
                <div style={{ marginTop:'10px' }}>
                  <label style={lbl}>Soporte (PDF/imagen) — opcional</label>
                  <input
                    type="file" accept=".pdf,image/*"
                    onChange={e => setSoporteNovedad(e.target.files?.[0] || null)}
                    style={{ fontSize:'11px', color:T.muted }}
                  />
                </div>
                <button
                  disabled={guardandoNovedad}
                  onClick={async () => {
                    if (!novedad.empleado_id || !novedad.tipo) return
                    const col = colaboradores.find(c => c.id === novedad.empleado_id)
                    if (!col) return
                    setGuardandoNovedad(true)
                    let valor = 0
                    const horas = parseFloat(String(novedad.campos.cantidad_horas || 0))
                    const valHora = col.salario_base / 240
                    const pcts: Record<string,number> = { he_diurna:1.25, he_nocturna:1.75, he_dom_diurna:2, he_dom_nocturna:2.5, recargo_noc:1.35, recargo_dom:1.75, recargo_noc_dom:2.10 }
                    if (horas > 0 && pcts[novedad.tipo]) valor = Math.round(horas * valHora * pcts[novedad.tipo])
                    else valor = Number(novedad.campos.valor || novedad.campos.valor_monto || novedad.campos.monto_total || 0)

                    let soporte_url: string | null = null
                    if (soporteNovedad) {
                      if (soporteNovedad.size > 5 * 1024 * 1024) {
                        alert('El soporte supera el máximo de 5MB'); setGuardandoNovedad(false); return
                      }
                      const path = `nomina-novedades/${tenantId}/${Date.now()}_${novedad.empleado_id}_${soporteNovedad.name}`
                      const { error: upErr } = await supabase.storage.from('documentos-nomina')
                        .upload(path, soporteNovedad, { contentType: soporteNovedad.type || 'application/pdf' })
                      if (upErr) { alert(`Error al subir el soporte: ${upErr.message}`); setGuardandoNovedad(false); return }
                      soporte_url = path
                    }

                    const { data: { user } } = await supabase.auth.getUser()
                    const { error: err } = await supabase.from('nomina_novedades').insert({
                      tenant_id: tenantId,
                      colaborador_id: novedad.empleado_id,
                      tipo: novedad.tipo,
                      campos: novedad.campos,
                      valor,
                      fecha_inicio: novedad.campos.fecha_inicio || novedad.campos.fecha || null,
                      fecha_fin: novedad.campos.fecha_fin || null,
                      periodo: new Date().toISOString().slice(0,10),
                      soporte_url,
                      origen: 'rrhh',
                      estado: 'aprobada',
                      created_by: user?.id,
                    })
                    if (err) { alert(`Error al registrar la novedad: ${err.message}`); setGuardandoNovedad(false); return }
                    setNovedad({ empleado_id:'', tipo:'', campos:{} })
                    setSoporteNovedad(null)
                    setGuardandoNovedad(false)
                    loadData()
                  }}
                  style={{ marginTop:'12px', padding:'9px 20px', background:T.accent, border:'none', borderRadius:'8px', color:T.card, fontWeight:'700', cursor: guardandoNovedad?'wait':'pointer', fontSize:'13px', opacity: guardandoNovedad?0.7:1 }}
                >
                  {guardandoNovedad ? 'Guardando...' : '✅ Registrar novedad'}
                </button>
              </div>
            )}
          </div>

          {/* Historial de novedades */}
          <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:'12px', overflow:'hidden' }}>
            <div style={{ padding:'14px 16px', borderBottom:`1px solid ${T.border}`, fontSize:'13px', fontWeight:'600', color:T.yellow }}>
              📋 Historial de novedades registradas
            </div>
            {(novedades as Array<Record<string,unknown>>).length === 0 ? (
              <div style={{ textAlign:'center', padding:'40px', color:T.muted, fontSize:'13px' }}>
                No hay novedades registradas aún
              </div>
            ) : (
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead>
                    <tr style={{ background:'#060E1C' }}>
                      {['Colaborador','Tipo','Valor','Periodo','Soporte','Estado','Acciones'].map(h => (
                        <th key={h} style={{ padding:'9px 12px', textAlign:'left', fontSize:'11px', color:T.muted, fontWeight:'600', borderBottom:`1px solid ${T.border}` }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(novedades as Array<Record<string,unknown>>).map((n, i) => {
                      const col = colaboradores.find(c => c.id === n.colaborador_id)
                      const estado = String(n.estado || 'aprobada')
                      const badgeColor = estado === 'aprobada' ? T.green : estado === 'rechazada' ? T.red : T.yellow
                      const label = TIPOS_NOVEDAD.flatMap(c => c.items).find(it => it.v === n.tipo)?.l || String(n.tipo || '—')
                      return (
                        <tr key={String(n.id ?? i)} style={{ borderBottom:`1px solid ${T.border}` }}>
                          <td style={{ padding:'8px 12px', fontSize:'12px', color:T.text }}>{col ? `${col.nombres} ${col.apellidos}` : '—'}</td>
                          <td style={{ padding:'8px 12px', fontSize:'11px', color:T.yellow }}>{label}</td>
                          <td style={{ padding:'8px 12px', fontSize:'12px', color:T.accent, fontWeight:'600' }}>{fmt(Number(n.valor || 0))}</td>
                          <td style={{ padding:'8px 12px', fontSize:'11px', color:T.muted }}>{String(n.periodo || '—')}</td>
                          <td style={{ padding:'8px 12px' }}>
                            {n.soporte_url ? (
                              <button onClick={() => verSoporteNovedad(String(n.soporte_url))} style={{ background:'none', border:'none', color:T.blue, cursor:'pointer', fontSize:'11px', padding:0 }}>📎 Ver</button>
                            ) : <span style={{ fontSize:'11px', color:T.muted }}>—</span>}
                          </td>
                          <td style={{ padding:'8px 12px' }}>
                            <span style={{ fontSize:'10px', padding:'2px 7px', borderRadius:'4px', background:`${badgeColor}20`, color:badgeColor }}>
                              {estado}
                            </span>
                          </td>
                          <td style={{ padding:'8px 12px' }}>
                            {estado === 'pendiente' && (
                              <div style={{ display:'flex', gap:'6px' }}>
                                <button onClick={() => aprobarNovedad(n)} style={{ padding:'4px 9px', background:T.green, border:'none', borderRadius:'6px', color:T.card, fontWeight:'700', cursor:'pointer', fontSize:'10px' }}>✓</button>
                                <button onClick={() => rechazarNovedad(String(n.id))} style={{ padding:'4px 9px', background:`${T.red}15`, border:`1px solid ${T.red}30`, borderRadius:'6px', color:T.red, cursor:'pointer', fontSize:'10px' }}>✕</button>
                              </div>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ LIQUIDACIÓN ══ */}
      {tab === 'liquidacion' && (() => {
        const porProcesoLiq = procesos.map(p => ({
          ...p,
          carga: liquidaciones.filter(l => l.proceso_id === p.id).reduce((a, l) => a + Number(l.carga_total || 0), 0),
        })).filter(p => p.carga > 0)
        const aprobadasCount = liquidaciones.filter(l => l.estado === 'aprobada').length
        const paisesNoCol = colaboradores.some(c => c.pais_code !== 'COL')
        return (
        <div>
          <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:'12px', padding:'16px', marginBottom:'16px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'12px' }}>
              <div>
                <div style={{ fontSize:'13px', fontWeight:'700', color:T.green, marginBottom:'6px' }}>💵 LIQUIDACIÓN DE NÓMINA</div>
                <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
                  <label style={{ ...lbl, marginBottom:0 }}>Mes</label>
                  <input type="month" style={{ ...inp, width:'140px' }} value={periodoLiquidacion.slice(0,7)}
                    onChange={e => setPeriodoLiquidacion(`${e.target.value}-${periodoLiquidacion.slice(8,10) === '16' ? '16' : '01'}`)} />
                  {esquemaNomina === 'quincenal' && (
                    <select style={{ ...inp, width:'150px', appearance:'none' as React.CSSProperties['appearance'] }}
                      value={periodoLiquidacion.slice(8,10) === '16' ? '16' : '01'}
                      onChange={e => setPeriodoLiquidacion(`${periodoLiquidacion.slice(0,7)}-${e.target.value}`)}>
                      <option value="01">1ª quincena (1-15)</option>
                      <option value="16">2ª quincena (16-fin)</option>
                    </select>
                  )}
                  <span style={{ fontSize:'10px', padding:'3px 8px', borderRadius:'4px', background:`${T.blue}20`, color:T.blue }}>{esquemaNomina === 'quincenal' ? 'Quincenal' : 'Mensual'}</span>
                  <label style={{ ...lbl, marginBottom:0, marginLeft:'8px' }}>NIT empresa</label>
                  <input style={{ ...inp, width:'130px' }} defaultValue={empresa.nit || ''} placeholder="Para colillas" onBlur={e => { if (e.target.value !== (empresa.nit || '')) guardarNit(e.target.value) }} />
                </div>
              </div>
              <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
                <button onClick={calcularLiquidacionPeriodo} disabled={calculandoLiquidacion || colaboradores.length === 0}
                  style={{ padding:'9px 16px', background:T.blue, border:'none', borderRadius:'8px', color:'#fff', fontWeight:'700', cursor: calculandoLiquidacion?'wait':'pointer', fontSize:'12px', opacity: calculandoLiquidacion?0.7:1 }}>
                  {calculandoLiquidacion ? 'Calculando...' : '🧮 Calcular liquidación del periodo'}
                </button>
                {liquidaciones.length > 0 && (
                  <button onClick={exportarExcelLiquidacion} style={{ padding:'9px 16px', background:'none', border:`1px solid ${T.border}`, borderRadius:'8px', color:T.text, cursor:'pointer', fontSize:'12px' }}>
                    📊 Excel
                  </button>
                )}
                {colillasSeleccionadas.size > 0 && (
                  <button onClick={enviarColillasSeleccionadas} disabled={enviandoColillas}
                    style={{ padding:'9px 16px', background:T.yellow, border:'none', borderRadius:'8px', color:T.card, fontWeight:'700', cursor: enviandoColillas?'wait':'pointer', fontSize:'12px', opacity: enviandoColillas?0.7:1 }}>
                    {enviandoColillas ? 'Enviando...' : `✉️ Enviar ${colillasSeleccionadas.size} colilla(s)`}
                  </button>
                )}
                {aprobadasCount > 0 && (
                  <button onClick={pagarLiquidacionesDelPeriodo} disabled={pagandoNomina}
                    style={{ padding:'9px 16px', background:T.accent, border:'none', borderRadius:'8px', color:T.card, fontWeight:'700', cursor: pagandoNomina?'not-allowed':'pointer', fontSize:'12px', opacity: pagandoNomina?0.6:1 }}>
                    {pagandoNomina ? 'Pagando...' : `💰 Pagar ${aprobadasCount} aprobada(s)`}
                  </button>
                )}
              </div>
            </div>
            {paisesNoCol && (
              <div style={{ marginTop:'10px', fontSize:'11px', color:T.yellow, background:`${T.yellow}10`, border:`1px solid ${T.yellow}20`, borderRadius:'6px', padding:'8px 10px' }}>
                ⚠️ Hay colaboradores fuera de Colombia — su liquidación usa tasas configurables genéricas. Verifica con tu asesor legal local antes de pagar.
              </div>
            )}
          </div>

          {porProcesoLiq.length > 0 && (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:'10px', marginBottom:'16px' }}>
              {porProcesoLiq.map(p => (
                <div key={p.id} style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:'10px', padding:'12px' }}>
                  <div style={{ fontSize:'11px', color:T.purple, fontWeight:'600' }}>{p.nombre}</div>
                  <div style={{ fontSize:'15px', fontWeight:'700', color:T.accent, marginTop:'4px' }}>{fmt(p.carga)}</div>
                </div>
              ))}
            </div>
          )}

          <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:'12px', overflow:'hidden' }}>
            {liquidaciones.length === 0 ? (
              <div style={{ textAlign:'center', padding:'40px', color:T.muted, fontSize:'13px' }}>
                No hay liquidación calculada para este periodo — usa &quot;Calcular liquidación del periodo&quot;.
              </div>
            ) : (
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead>
                    <tr style={{ background:'#060E1C' }}>
                      <th style={{ padding:'10px 12px', borderBottom:`1px solid ${T.border}` }}>
                        <input type="checkbox"
                          checked={liquidaciones.some(l => ['aprobada','pagada'].includes(String(l.estado))) && liquidaciones.filter(l => ['aprobada','pagada'].includes(String(l.estado))).every(l => colillasSeleccionadas.has(String(l.id)))}
                          onChange={e => {
                            const elegibles = liquidaciones.filter(l => ['aprobada','pagada'].includes(String(l.estado))).map(l => String(l.id))
                            setColillasSeleccionadas(e.target.checked ? new Set(elegibles) : new Set())
                          }} />
                      </th>
                      {['','Colaborador','Devengado','Deducciones','NETO A PAGAR','Carga Empleador','Estado','Acciones'].map(h => (
                        <th key={h} style={{ padding:'10px 12px', textAlign:'left', fontSize:'11px', color:T.muted, fontWeight:'600', borderBottom:`1px solid ${T.border}`, whiteSpace:'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {liquidaciones.map((l, i) => {
                      const col = colaboradores.find(c => c.id === l.colaborador_id)
                      const snap = (l.snapshot as Record<string, unknown>) || {}
                      const expandido = expandidoLiq === l.id
                      const estado = String(l.estado || 'calculada')
                      const estadoColor = estado === 'pagada' ? T.green : estado === 'aprobada' ? T.blue : estado === 'revisada' ? T.purple : T.yellow
                      return (
                        <Fragment key={String(l.id)}>
                          <tr style={{ borderBottom:`1px solid ${T.border}`, background:i%2===0?'transparent':'#080F1C', cursor:'pointer' }}
                            onClick={() => setExpandidoLiq(expandido ? null : String(l.id))}>
                            <td style={{ padding:'8px 12px' }} onClick={e => e.stopPropagation()}>
                              {['aprobada','pagada'].includes(estado) && (
                                <input type="checkbox" checked={colillasSeleccionadas.has(String(l.id))}
                                  onChange={e => setColillasSeleccionadas(prev => {
                                    const next = new Set(prev)
                                    if (e.target.checked) next.add(String(l.id)); else next.delete(String(l.id))
                                    return next
                                  })} />
                              )}
                            </td>
                            <td style={{ padding:'8px 12px', fontSize:'11px', color:T.muted }}>{expandido ? '▾' : '▸'}</td>
                            <td style={{ padding:'8px 12px', fontSize:'12px', color:T.text, fontWeight:'500' }}>{col ? `${col.nombres} ${col.apellidos}` : '—'}</td>
                            <td style={{ padding:'8px 12px', fontSize:'12px', color:T.text }}>{fmt(Number(l.devengados || 0))}</td>
                            <td style={{ padding:'8px 12px', fontSize:'12px', color:T.red }}>-{fmt(Number(l.deducciones || 0))}</td>
                            <td style={{ padding:'8px 12px', fontSize:'13px', fontWeight:'700', color:T.green }}>{fmt(Number(l.neto_pagar || 0))}</td>
                            <td style={{ padding:'8px 12px', fontSize:'12px', color:T.accent }}>{fmt(Number(l.carga_total || 0))}</td>
                            <td style={{ padding:'8px 12px' }}>
                              <span style={{ fontSize:'10px', padding:'2px 7px', borderRadius:'4px', background:`${estadoColor}20`, color:estadoColor }}>{estado}</span>
                            </td>
                            <td style={{ padding:'8px 12px' }} onClick={e => e.stopPropagation()}>
                              <div style={{ display:'flex', gap:'6px' }}>
                                {estado === 'calculada' && <button onClick={() => revisarLiquidacion(l)} style={{ padding:'4px 9px', background:`${T.purple}15`, border:`1px solid ${T.purple}30`, borderRadius:'6px', color:T.purple, cursor:'pointer', fontSize:'10px' }}>Revisar</button>}
                                {estado === 'revisada' && <button onClick={() => aprobarLiquidacion(l)} style={{ padding:'4px 9px', background:`${T.blue}15`, border:`1px solid ${T.blue}30`, borderRadius:'6px', color:T.blue, cursor:'pointer', fontSize:'10px' }}>Aprobar</button>}
                                {(estado === 'aprobada' || estado === 'pagada') && <button onClick={() => descargarColillaPDF(l)} style={{ padding:'4px 9px', background:`${T.green}15`, border:`1px solid ${T.green}30`, borderRadius:'6px', color:T.green, cursor:'pointer', fontSize:'10px' }}>📄 Colilla</button>}
                              </div>
                            </td>
                          </tr>
                          {expandido && (
                            <tr key={`${String(l.id)}-detalle`} style={{ background:'#050B16' }}>
                              <td colSpan={9} style={{ padding:'14px 20px' }}>
                                {(snap.avisoPaisNoVerificado as boolean) && (
                                  <div style={{ fontSize:'11px', color:T.yellow, marginBottom:'10px' }}>⚠️ País fuera de Colombia — tasas genéricas, verificar con asesor local.</div>
                                )}
                                {(snap.avisoFsp as boolean) && (
                                  <div style={{ fontSize:'11px', color:T.yellow, marginBottom:'10px' }}>⚠️ Este colaborador supera 4 SMMLV — verifica el tramo exacto del Fondo de Solidaridad Pensional con tu contador.</div>
                                )}
                                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:'18px' }}>
                                  <div>
                                    <div style={{ fontSize:'11px', fontWeight:'700', color:T.green, marginBottom:'6px' }}>DEVENGADO</div>
                                    {((snap.devengado as LineaLiquidacion[]) || []).map((d, di) => (
                                      <LineaAjustable key={di} l={l} concepto={d.concepto} valor={d.valor} editable={estado === 'calculada' || estado === 'revisada'} onAjustar={() => setAjusteEdit({ liqId: String(l.id), concepto: d.concepto, valorSistema: d.valor })} />
                                    ))}
                                  </div>
                                  <div>
                                    <div style={{ fontSize:'11px', fontWeight:'700', color:T.red, marginBottom:'6px' }}>DEDUCCIONES</div>
                                    {((snap.deducciones as LineaLiquidacion[]) || []).map((d, di) => (
                                      <LineaAjustable key={di} l={l} concepto={d.concepto} valor={d.valor} editable={estado === 'calculada' || estado === 'revisada'} onAjustar={() => setAjusteEdit({ liqId: String(l.id), concepto: d.concepto, valorSistema: d.valor })} />
                                    ))}
                                  </div>
                                  <div>
                                    <div style={{ fontSize:'11px', fontWeight:'700', color:T.accent, marginBottom:'6px' }}>APROPIACIONES (carga empleador)</div>
                                    {((snap.apropiaciones as LineaLiquidacion[]) || []).map((d, di) => (
                                      <div key={di} style={{ display:'flex', justifyContent:'space-between', fontSize:'11px', color:T.muted, padding:'3px 0' }}>
                                        <span>{d.concepto}</span><span>{fmt(d.valor)}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                                {((l.ajustes_manuales as Array<Record<string, unknown>>) || []).length > 0 && (
                                  <div style={{ marginTop:'12px', fontSize:'10.5px', color:T.muted }}>
                                    <div style={{ fontWeight:'700', marginBottom:'4px' }}>Ajustes manuales:</div>
                                    {((l.ajustes_manuales as Array<Record<string, unknown>>)).map((a, ai) => (
                                      <div key={ai}>• {String(a.concepto)}: {fmt(Number(a.valor_sistema))} → {fmt(Number(a.valor_ajustado))} ({String(a.motivo)})</div>
                                    ))}
                                  </div>
                                )}
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div style={{ marginTop:'10px', fontSize:'11px', color:T.muted }}>
            Flujo: Calcular → Revisar → Aprobar → Pagar. Al pagar, se registra como salida en el Libro de Caja (módulo P&G).
          </div>

          {ajusteEdit && (
            <ModalAjuste
              concepto={ajusteEdit.concepto}
              valorSistema={ajusteEdit.valorSistema}
              onClose={() => setAjusteEdit(null)}
              onGuardar={(valorAjustado, motivo) => {
                const liq = liquidaciones.find(l => String(l.id) === ajusteEdit.liqId)
                if (liq) guardarAjusteManual(liq, ajusteEdit.concepto, ajusteEdit.valorSistema, valorAjustado, motivo)
                setAjusteEdit(null)
              }}
            />
          )}
        </div>
        )
      })()}

      {/* ══ TASAS ══ */}
      {tab === 'tasas' && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))', gap:'16px' }}>
          <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:'12px', padding:'20px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }}>
              <div style={{ fontSize:'12px', fontWeight:'700', color:T.accent }}>⚙️ TASAS {anioFiscal} — COLOMBIA</div>
              <div style={{ display:'flex', gap:'6px', alignItems:'center' }}>
                <select style={{ ...inp, width:'90px', padding:'4px 8px' }} value={anioFiscal} onChange={e => setAnioFiscal(Number(e.target.value))}>
                  {[2023,2024,2025,2026].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                <button onClick={() => setEditTasa(!editTasa)} style={{ padding:'6px 12px', background:editTasa?`${T.red}15`:`${T.blue}15`, border:`1px solid ${editTasa?T.red:T.blue}30`, borderRadius:'7px', color:editTasa?T.red:T.blue, cursor:'pointer', fontSize:'11px' }}>
                  {editTasa ? '✕ Cancelar' : '✏️ Editar'}
                </button>
                {editTasa && (
                  <button onClick={guardarTasas} style={{ padding:'6px 12px', background:T.accent, border:'none', borderRadius:'7px', color:T.card, fontWeight:'700', cursor:'pointer', fontSize:'11px' }}>
                    💾 Guardar
                  </button>
                )}
              </div>
            </div>
            {[
              { l:'Salud empleador %', k:'salud_emp' as keyof typeof formTasa },
              { l:'Pensión empleador %', k:'pension_emp' as keyof typeof formTasa },
              { l:'Salud trabajador %', k:'salud' as keyof typeof formTasa },
              { l:'Pensión trabajador %', k:'pension' as keyof typeof formTasa },
              { l:'SENA %', k:'sena' as keyof typeof formTasa },
              { l:'ICBF %', k:'icbf' as keyof typeof formTasa },
              { l:'Caja compensación %', k:'caja_comp' as keyof typeof formTasa },
              { l:'Cesantías %', k:'cesantias' as keyof typeof formTasa },
              { l:'Intereses cesantías %', k:'intereses_ces' as keyof typeof formTasa },
              { l:'Prima %', k:'prima' as keyof typeof formTasa },
              { l:'Vacaciones %', k:'vacaciones' as keyof typeof formTasa },
            ].map(({ l, k }) => (
              <div key={String(k)} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 0', borderBottom:`1px solid ${T.border}` }}>
                <span style={{ fontSize:'12px', color:T.muted }}>{l}</span>
                {editTasa ? (
                  <input
                    type="number"
                    step="0.01"
                    style={{ ...inp, width:'80px', padding:'4px 8px', textAlign:'right' }}
                    value={Number(formTasa[k] || 0)}
                    onChange={e => setFormTasa(f => ({ ...f, [k]: parseFloat(e.target.value) }))}
                  />
                ) : (
                  <span style={{ fontSize:'12px', fontWeight:'700', color:T.accent }}>{Number(tasas[k] || 0).toFixed(2)}%</span>
                )}
              </div>
            ))}
          </div>

          <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:'12px', padding:'20px' }}>
            <div style={{ fontSize:'12px', fontWeight:'700', color:T.blue, marginBottom:'12px' }}>📊 RESUMEN CARGA EMPLEADOR</div>
            {[
              { grupo:'Seguridad Social', items:[
                { l:'Salud emp', v:Number(tasas.salud_emp||8.5) },
                { l:'Pensión emp', v:Number(tasas.pension_emp||12) },
              ], color:T.red },
              { grupo:'Parafiscales', items:[
                { l:'SENA', v:Number(tasas.sena||2) },
                { l:'ICBF', v:Number(tasas.icbf||3) },
                { l:'Caja', v:Number(tasas.caja_comp||4) },
              ], color:T.purple },
              { grupo:'Prestaciones', items:[
                { l:'Cesantías', v:Number(tasas.cesantias||8.33) },
                { l:'Int. Ces.', v:Number(tasas.intereses_ces||1) },
                { l:'Prima', v:Number(tasas.prima||8.33) },
                { l:'Vacaciones', v:Number(tasas.vacaciones||4.17) },
              ], color:T.blue },
            ].map((g, i) => (
              <div key={i} style={{ marginBottom:'14px' }}>
                <div style={{ fontSize:'11px', fontWeight:'700', color:g.color, marginBottom:'6px' }}>{g.grupo}</div>
                {g.items.map((it, j) => (
                  <div key={j} style={{ display:'flex', justifyContent:'space-between', padding:'4px 0', borderBottom:`1px solid ${T.border}`, fontSize:'12px' }}>
                    <span style={{ color:T.muted }}>{it.l}</span>
                    <span style={{ color:g.color, fontWeight:'700' }}>{it.v.toFixed(2)}%</span>
                  </div>
                ))}
                <div style={{ display:'flex', justifyContent:'space-between', padding:'5px 0', fontSize:'12px', fontWeight:'700' }}>
                  <span style={{ color:T.muted }}>Subtotal</span>
                  <span style={{ color:g.color }}>{g.items.reduce((a,it)=>a+it.v,0).toFixed(2)}%</span>
                </div>
              </div>
            ))}
            <div style={{ padding:'10px 12px', background:`${T.red}08`, borderRadius:'8px', border:`1px solid ${T.red}20`, display:'flex', justifyContent:'space-between' }}>
              <span style={{ fontSize:'12px', fontWeight:'700' }}>CARGA TOTAL EMPLEADOR</span>
              <span style={{ fontSize:'16px', fontWeight:'900', color:T.red }}>
                {(Number(tasas.salud_emp||8.5)+Number(tasas.pension_emp||12)+Number(tasas.sena||2)+Number(tasas.icbf||3)+Number(tasas.caja_comp||4)+Number(tasas.cesantias||8.33)+Number(tasas.intereses_ces||1)+Number(tasas.prima||8.33)+Number(tasas.vacaciones||4.17)).toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
