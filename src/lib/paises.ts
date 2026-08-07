// Fuente única de países soportados por DIZGO — antes duplicado (y desincronizado) en
// auth/login, registro, nomina y admin. Cualquier país nuevo se agrega solo aquí.

export type Pais = {
  code: string
  nombre: string
  moneda: string
  codigoTel: string
  flag: string
  docId: string
  locale: string
  decimales: number
  /** Respaldo estático si /api/tasas (ver src/lib/tasas.ts) no responde — cuántas unidades de esta moneda equivalen a 1 USD. No se usa para cobros reales, solo referencia informativa. */
  usdAprox: number
}

export const PAISES: Pais[] = [
  { code:'COL', nombre:'Colombia',    moneda:'COP', codigoTel:'+57',  docId:'CC/CE', flag:'https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.2.3/flags/4x3/co.svg', locale:'es-CO', decimales:0, usdAprox:4000 },
  { code:'ECU', nombre:'Ecuador',     moneda:'USD', codigoTel:'+593', docId:'CI',    flag:'https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.2.3/flags/4x3/ec.svg', locale:'en-US', decimales:2, usdAprox:1 },
  { code:'MEX', nombre:'México',      moneda:'MXN', codigoTel:'+52',  docId:'CURP',  flag:'https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.2.3/flags/4x3/mx.svg', locale:'es-MX', decimales:2, usdAprox:17 },
  { code:'PER', nombre:'Perú',        moneda:'PEN', codigoTel:'+51',  docId:'DNI',   flag:'https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.2.3/flags/4x3/pe.svg', locale:'es-PE', decimales:2, usdAprox:3.7 },
  { code:'CHL', nombre:'Chile',       moneda:'CLP', codigoTel:'+56',  docId:'RUN',   flag:'https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.2.3/flags/4x3/cl.svg', locale:'es-CL', decimales:0, usdAprox:950 },
  { code:'ARG', nombre:'Argentina',   moneda:'ARS', codigoTel:'+54',  docId:'DNI',   flag:'https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.2.3/flags/4x3/ar.svg', locale:'es-AR', decimales:0, usdAprox:1200 },
  { code:'CRI', nombre:'Costa Rica',  moneda:'CRC', codigoTel:'+506', docId:'Cédula',flag:'https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.2.3/flags/4x3/cr.svg', locale:'es-CR', decimales:0, usdAprox:520 },
  { code:'PRY', nombre:'Paraguay',    moneda:'PYG', codigoTel:'+595', docId:'CI',    flag:'https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.2.3/flags/4x3/py.svg', locale:'es-PY', decimales:0, usdAprox:7300 },
  { code:'VEN', nombre:'Venezuela',   moneda:'VES', codigoTel:'+58',  docId:'CI',    flag:'https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.2.3/flags/4x3/ve.svg', locale:'es-VE', decimales:2, usdAprox:0 },
  { code:'ESP', nombre:'España',      moneda:'EUR', codigoTel:'+34',  docId:'NIF',   flag:'https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.2.3/flags/4x3/es.svg', locale:'es-ES', decimales:2, usdAprox:0.92 },
  { code:'GTM', nombre:'Guatemala',   moneda:'GTQ', codigoTel:'+502', docId:'DPI',   flag:'https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.2.3/flags/4x3/gt.svg', locale:'es-GT', decimales:2, usdAprox:7.8 },
  { code:'PAN', nombre:'Panamá',      moneda:'USD', codigoTel:'+507', docId:'Cédula',flag:'https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.2.3/flags/4x3/pa.svg', locale:'en-US', decimales:2, usdAprox:1 },
]

export function paisPorCodigo(code: string): Pais | undefined {
  return PAISES.find(p => p.code === code)
}

// Formatea un valor en la moneda del país, con el símbolo siempre al inicio (algunos locales
// como es-ES lo ponen al final por defecto — aquí se fuerza al inicio para que la moneda se
// sienta "propia" sin importar el idioma del navegador).
export function formatMoneda(valor: number, paisCode: string): string {
  const p = paisPorCodigo(paisCode) || PAISES[0]
  const s = new Intl.NumberFormat(p.locale, { style:'currency', currency:p.moneda, minimumFractionDigits:p.decimales, maximumFractionDigits:p.decimales }).format(valor || 0)
  const m = s.match(/^([\d.,\s]+)\s*([^\d\s]+)$/) // símbolo quedó al final -> moverlo al inicio
  return m ? `${m[2]} ${m[1]}` : s
}

export function buscarPaises(query: string): Pais[] {
  const q = query.trim().toLowerCase()
  if (!q) return PAISES
  return PAISES.filter(p => p.nombre.toLowerCase().includes(q) || p.code.toLowerCase().includes(q))
}

// Departamentos/provincias — solo Colombia y Ecuador tienen división política aplicable a
// "Departamento" tal como lo pidió el negocio; el resto de países usa un campo de texto libre
// con la etiqueta correcta (ver `etiquetaDivision`).
export const DEPARTAMENTOS_COL = [
  'Amazonas','Antioquia','Arauca','Atlántico','Bogotá D.C.','Bolívar','Boyacá','Caldas','Caquetá',
  'Casanare','Cauca','Cesar','Chocó','Córdoba','Cundinamarca','Guainía','Guaviare','Huila',
  'La Guajira','Magdalena','Meta','Nariño','Norte de Santander','Putumayo','Quindío','Risaralda',
  'San Andrés y Providencia','Santander','Sucre','Tolima','Valle del Cauca','Vaupés','Vichada',
]

export const PROVINCIAS_ECU = [
  'Azuay','Bolívar','Cañar','Carchi','Chimborazo','Cotopaxi','El Oro','Esmeraldas','Galápagos',
  'Guayas','Imbabura','Loja','Los Ríos','Manabí','Morona Santiago','Napo','Orellana','Pastaza',
  'Pichincha','Santa Elena','Santo Domingo de los Tsáchilas','Sucumbíos','Tungurahua','Zamora Chinchipe',
]

export function divisionesPorPais(paisCode: string): string[] | null {
  if (paisCode === 'COL') return DEPARTAMENTOS_COL
  if (paisCode === 'ECU') return PROVINCIAS_ECU
  return null
}

export function etiquetaDivision(paisCode: string): string {
  if (paisCode === 'COL') return 'Departamento'
  if (paisCode === 'ECU') return 'Provincia'
  if (paisCode === 'MEX') return 'Estado'
  if (paisCode === 'ARG') return 'Provincia'
  if (paisCode === 'ESP') return 'Provincia'
  return 'Departamento/Estado/Provincia'
}

// Entidades de seguridad social y catálogos — con detalle real solo para los países donde
// DIZGO opera activamente hoy (COL/ECU/MEX/PER); el resto queda con listas vacías (el usuario
// escribe la entidad manualmente) para no inventar datos que no podemos verificar.
export type PaisConfigRH = {
  entidades: { eps: string[]; pension: string[]; arl: string[]; banco: string[]; cajaComp: string[]; cesantias: string[] }
  nivelesFormacion: string[]
  tipoCuenta: string[]
  // Rasgos normativos laborales — controlan qué campos/conceptos se muestran en el formulario de
  // colaborador y en el cálculo de carga prestacional. `false`/`[]` significa que el concepto NO
  // EXISTE en ese país (se oculta el campo), no que está vacío pendiente de llenar.
  tieneCajaComp: boolean
  tieneCesantias: boolean
  tieneARLNiveles: boolean
  tieneAuxTransporte: boolean
  tieneExoneracionParafiscal: boolean
  tiposContrato: string[]
  tiposCotizante: { value: string; label: string }[]
}

// Países donde DIZGO aún no tiene la normatividad laboral verificada — placeholders neutros
// (NO son términos legales reales de cada país) hasta que se investigue y confirme cada uno.
// Ver src/app/dashboard/nomina/NOMINA_MULTIPAIS_PLAN.md para el plan de ajuste país por país.
const GENERICO_LABORAL = {
  tieneCajaComp: false, tieneCesantias: false, tieneARLNiveles: false, tieneAuxTransporte: false, tieneExoneracionParafiscal: false,
  tiposContrato: ['Indefinido','A plazo fijo','Por obra o servicio','Prestación de servicios'],
  tiposCotizante: [] as { value: string; label: string }[],
}

const CONFIG_RH_BASE: Record<string, PaisConfigRH> = {
  COL: {
    entidades: {
      eps: ['Sura','Compensar','Nueva EPS','Sanitas','Coomeva','Famisanar','Salud Total','Coosalud'],
      pension: ['Protección','Porvenir','Colfondos','Colpensiones','Skandia'],
      arl: ['Sura','Positiva','Colmena','Bolívar','Liberty'],
      banco: ['Bancolombia','Davivienda','Banco de Bogotá','BBVA','Nequi','Daviplata','Banco Agrario','Banco Caja Social','Scotiabank Colpatria'],
      cajaComp: ['Comfama','Comfenalco','Compensar','Cafam','Comfandi'],
      cesantias: ['Protección','Porvenir','Colfondos','Skandia'],
    },
    nivelesFormacion: ['Primaria','Bachillerato','Técnico','Tecnólogo','Profesional','Especialización','Maestría','Doctorado'],
    tipoCuenta: ['Ahorros','Corriente'],
    tieneCajaComp: true, tieneCesantias: true, tieneARLNiveles: true, tieneAuxTransporte: true, tieneExoneracionParafiscal: true,
    tiposContrato: ['Empleado','Término fijo','Obra o labor','Contratista','Honorarios','Aprendiz SENA'],
    tiposCotizante: [
      { value:'1', label:'01 — Dependiente' }, { value:'2', label:'02 — Independiente' }, { value:'3', label:'03 — Servicio doméstico' },
      { value:'12', label:'12 — Dependiente sector público sin tope' }, { value:'15', label:'15 — Aprendiz etapa lectiva (sin cotización)' }, { value:'51', label:'51 — Aprendiz etapa práctica' },
    ],
  },
  // Ecuador: sin Caja de Compensación, sin múltiples fondos privados de cesantías, sin niveles de
  // ARL (IESS Riesgos del Trabajo es una sola entidad) ni auxilio de transporte legal. Tipos de
  // contrato y de cotizante IESS verificados en 2026 — ver NOMINA_MULTIPAIS_PLAN.md.
  ECU: {
    entidades: {
      eps: ['IESS','Salud S.A.','Humana','Colonial'],
      pension: ['IESS Pensión'],
      arl: ['IESS Riesgos del Trabajo'],
      banco: ['Banco Pichincha','Produbanco','Banco Guayaquil','Banco del Pacífico','Banco Internacional'],
      cajaComp: [],
      cesantias: [],
    },
    nivelesFormacion: ['Primaria','Secundaria','Bachillerato','Técnico','Tecnólogo','Tercer Nivel','Cuarto Nivel'],
    tipoCuenta: ['Ahorros','Corriente'],
    tieneCajaComp: false, tieneCesantias: false, tieneARLNiveles: false, tieneAuxTransporte: false, tieneExoneracionParafiscal: false,
    tiposContrato: [
      'Contrato Indefinido','Contrato Eventual','Contrato Ocasional','Contrato por Obra Cierta',
      'Contrato por Obra o Servicio dentro del Giro del Negocio','Contrato por Temporada','Contrato de Aprendizaje',
      'Contrato Especial Emergente','Contrato Joven','Contrato de Emprendimiento',
      'Contratos Sectoriales (Agrícola, Ganadero, Turístico, Florícola, Construcción, etc.)',
      'Contrato a Jornada Parcial Permanente','Contrato de Teletrabajo',
    ],
    tiposCotizante: [
      { value:'privado_dependencia', label:'Trabajador sector privado (bajo relación de dependencia)' },
      { value:'publico_dependencia', label:'Servidor público (bajo relación de dependencia)' },
      { value:'domestico', label:'Trabajador del hogar / doméstico (bajo relación de dependencia)' },
      { value:'independiente', label:'Trabajador independiente / autónomo (sin relación de dependencia)' },
      { value:'cultural', label:'Actor o gestor cultural (registrado en el RUAC)' },
      { value:'voluntario_residente', label:'Afiliado voluntario residente en Ecuador' },
      { value:'voluntario_exterior', label:'Afiliado voluntario ecuatoriano en el exterior' },
      { value:'seguro_campesino', label:'Cotizante del Seguro Social Campesino' },
      { value:'no_remunerado_hogar', label:'Trabajo No Remunerado del Hogar' },
      { value:'joven', label:'Afiliado Joven (15 a 24 años: voluntario o emprendedor)' },
    ],
  },
  MEX: {
    entidades: {
      eps: ['IMSS','ISSSTE'],
      pension: ['AFORE XXI Banorte','AFORE SURA','Profuturo','Citibanamex AFORE'],
      arl: ['IMSS RT'],
      banco: ['BBVA México','Santander','Banorte','HSBC','Scotiabank'],
      cajaComp: [],
      cesantias: [],
    },
    nivelesFormacion: ['Primaria','Secundaria','Preparatoria','Técnico','Licenciatura','Especialidad','Maestría','Doctorado'],
    tipoCuenta: ['Débito','Nómina'],
    ...GENERICO_LABORAL,
  },
  PER: {
    entidades: {
      eps: ['EsSalud','Pacífico Salud','Rímac'],
      pension: ['ONP','AFP Integra','Prima AFP','Habitat','Profuturo'],
      arl: ['La Positiva','Rímac','MAPFRE'],
      banco: ['BCP','Scotiabank','BBVA Perú','Interbank','BanBif'],
      cajaComp: [],
      cesantias: [],
    },
    nivelesFormacion: ['Primaria','Secundaria','Técnico','Universitario','Posgrado'],
    tipoCuenta: ['Ahorros','Corriente'],
    ...GENERICO_LABORAL,
  },
}

const CONFIG_RH_GENERICO: PaisConfigRH = {
  entidades: { eps: [], pension: [], arl: [], banco: [], cajaComp: [], cesantias: [] },
  nivelesFormacion: ['Primaria','Secundaria','Técnico','Universitario','Posgrado'],
  tipoCuenta: ['Ahorros','Corriente'],
  ...GENERICO_LABORAL,
}

export function configRHPorPais(paisCode: string): PaisConfigRH {
  return CONFIG_RH_BASE[paisCode] || CONFIG_RH_GENERICO
}

// Varios módulos (Precio, Productos, Pedidos, Costos, Contact Center) eligen el país para
// moneda/benchmarks vía localStorage('dizgo_pais'), pero nunca se sembraba desde el país real
// del tenant — dos módulos podían mostrar países distintos para el mismo negocio. Este helper
// siembra localStorage con el país real del tenant SOLO la primera vez (si el usuario ya eligió
// un país manualmente en algún módulo, esa preferencia se respeta y no se sobreescribe).
export function inicializarPaisTenant(paisTenant: string | null | undefined) {
  if (typeof window === 'undefined' || !paisTenant) return
  if (!localStorage.getItem('dizgo_pais')) {
    localStorage.setItem('dizgo_pais', paisTenant)
  }
}
