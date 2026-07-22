// Fuente única de países soportados por DIZGO — antes duplicado (y desincronizado) en
// auth/login, registro, nomina y admin. Cualquier país nuevo se agrega solo aquí.

export type Pais = {
  code: string
  nombre: string
  moneda: string
  codigoTel: string
  flag: string
  docId: string
}

export const PAISES: Pais[] = [
  { code:'COL', nombre:'Colombia',    moneda:'COP', codigoTel:'+57',  docId:'CC/CE', flag:'https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.2.3/flags/4x3/co.svg' },
  { code:'ECU', nombre:'Ecuador',     moneda:'USD', codigoTel:'+593', docId:'CI',    flag:'https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.2.3/flags/4x3/ec.svg' },
  { code:'MEX', nombre:'México',      moneda:'MXN', codigoTel:'+52',  docId:'CURP',  flag:'https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.2.3/flags/4x3/mx.svg' },
  { code:'PER', nombre:'Perú',        moneda:'PEN', codigoTel:'+51',  docId:'DNI',   flag:'https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.2.3/flags/4x3/pe.svg' },
  { code:'CHL', nombre:'Chile',       moneda:'CLP', codigoTel:'+56',  docId:'RUN',   flag:'https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.2.3/flags/4x3/cl.svg' },
  { code:'ARG', nombre:'Argentina',   moneda:'ARS', codigoTel:'+54',  docId:'DNI',   flag:'https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.2.3/flags/4x3/ar.svg' },
  { code:'CRI', nombre:'Costa Rica',  moneda:'CRC', codigoTel:'+506', docId:'Cédula',flag:'https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.2.3/flags/4x3/cr.svg' },
  { code:'PRY', nombre:'Paraguay',    moneda:'PYG', codigoTel:'+595', docId:'CI',    flag:'https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.2.3/flags/4x3/py.svg' },
  { code:'VEN', nombre:'Venezuela',   moneda:'VES', codigoTel:'+58',  docId:'CI',    flag:'https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.2.3/flags/4x3/ve.svg' },
  { code:'ESP', nombre:'España',      moneda:'EUR', codigoTel:'+34',  docId:'NIF',   flag:'https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.2.3/flags/4x3/es.svg' },
  { code:'GTM', nombre:'Guatemala',   moneda:'GTQ', codigoTel:'+502', docId:'DPI',   flag:'https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.2.3/flags/4x3/gt.svg' },
  { code:'PAN', nombre:'Panamá',      moneda:'USD', codigoTel:'+507', docId:'Cédula',flag:'https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.2.3/flags/4x3/pa.svg' },
]

export function paisPorCodigo(code: string): Pais | undefined {
  return PAISES.find(p => p.code === code)
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
  },
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
  },
}

const CONFIG_RH_GENERICO: PaisConfigRH = {
  entidades: { eps: [], pension: [], arl: [], banco: [], cajaComp: [], cesantias: [] },
  nivelesFormacion: ['Primaria','Secundaria','Técnico','Universitario','Posgrado'],
  tipoCuenta: ['Ahorros','Corriente'],
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
