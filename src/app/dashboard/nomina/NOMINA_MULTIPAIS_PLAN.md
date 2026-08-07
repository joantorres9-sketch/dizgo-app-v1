# Nómina multipaís — estado actual y plan de ajuste

DIZGO soporta 11 países en el selector de "País de residencia" del formulario de colaborador
(`src/lib/paises.ts` → `PAISES`), pero durante mucho tiempo el formulario de Nómina asumía
normatividad colombiana sin importar qué país eligiera el admin (Caja de Compensación, Cesantías,
niveles de ARL, tipos de contrato, tipo de cotizante PILA, Ley 1607, auxilio de transporte —
todo hardcodeado a Colombia). Esto se detectó al probar la creación de un colaborador en un
tenant de cortesía en Ecuador.

## Qué queda resuelto en este cambio (Colombia + Ecuador)

`src/lib/paises.ts` — `PaisConfigRH` ahora incluye rasgos normativos por país, no solo catálogos
de entidades:

```ts
tieneCajaComp: boolean
tieneCesantias: boolean
tieneARLNiveles: boolean
tieneAuxTransporte: boolean
tieneExoneracionParafiscal: boolean   // "Ley 1607" — concepto específico de Colombia
tiposContrato: string[]
tiposCotizante: { value: string; label: string }[]
```

El formulario de colaborador (`src/app/dashboard/nomina/page.tsx`) lee estos flags para
mostrar/ocultar cada campo — un país sin Caja de Compensación no ve un campo vacío para
llenar, simplemente no ve el campo. Igual con Cesantías, niveles de ARL, auxilio de
transporte y la exoneración tipo Ley 1607.

**Ecuador (verificado con fuentes oficiales 2026 — ver enlaces al final):**
- IESS aporte patronal: 11.15% · IECE: 0.5% · SECAP: 0.5%
- Décimo tercer sueldo: 1/12 del salario anual (provisión mensual 8.33%)
- Décimo cuarto sueldo: 1 SBU/año dividido en 12 — **monto fijo, no depende del salario del
  colaborador** (SBU 2026 = $482, Acuerdo MDT-2025-195)
- Fondo de reserva: 8.33%, exigible legalmente desde el mes 13 de antigüedad continua (se
  provisiona desde el mes 1 en la calculadora, igual que se provisionan las cesantías
  colombianas, para que el costo total no se subestime)
- Vacaciones: 15 días/año (equivalente a 4.17% mensual)
- Sin Caja de Compensación, sin fondos privados de cesantías, sin niveles de ARL (una sola
  entidad: IESS Riesgos del Trabajo), sin auxilio de transporte legal
- 14 tipos de contrato y 10 tipos de cotizante IESS cargados tal como los especificó el negocio

Esto alimenta una función de carga prestacional propia (`calcCargaECU` en `nomina/page.tsx`),
separada de `calcCargaCOL`. Los demás 9 países (`calcCarga(...)` con país distinto a COL/ECU)
**muestran solo el salario base** en la carga total en vez de aplicar por defecto la fórmula
colombiana — antes se mostraba una cifra falsa con apariencia de real.

## Qué falta — investigar y cargar país por país

Para cada país pendiente hay que verificar con una fuente oficial (ministerio de trabajo o
seguridad social del país) y cargar en `CONFIG_RH_BASE` (`src/lib/paises.ts`):

| País | Sistema de seguridad social | Aporte patronal aprox. | Beneficios anuales tipo "décimo/aguinaldo" | Prioridad sugerida |
|---|---|---|---|---|
| 🇲🇽 México | IMSS | Variable por rubro (~30% agregado) | Aguinaldo (15 días/año mín.), prima vacacional 25% | Alta — ya operamos ahí |
| 🇵🇪 Perú | EsSalud/ONP/AFP | 9% EsSalud + CTS + gratificaciones | Gratificaciones jul/dic (1 sueldo c/u), CTS 8.33% | Alta — ya operamos ahí |
| 🇨🇱 Chile | AFP + Isapre/Fonasa | ~3% patronal (seguro cesantía+mutual) | Sin aguinaldo legal general, feriado 15 días | Media |
| 🇦🇷 Argentina | ANSES/obra social | ~24-27% patronal | SAC (aguinaldo) 2 cuotas/año = 1 sueldo/año | Media |
| 🇨🇷 Costa Rica | CCSS | ~26.5% patronal | Aguinaldo (1 sueldo/año, dic) | Baja |
| 🇵🇾 Paraguay | IPS | 16.5% patronal | Aguinaldo (1 sueldo/año) | Baja |
| 🇻🇪 Venezuela | IVSS/FAOV/INCES | Variable, moneda inestable | Utilidades (15-120 días según empresa) | Baja |
| 🇪🇸 España | Seguridad Social | ~30-32% patronal | 2 pagas extra (verano/navidad) prorrateables | Baja |
| 🇬🇹 Guatemala | IGSS | 12.67% patronal | Aguinaldo + Bono 14 (2 sueldos extra/año) | Baja |
| 🇵🇦 Panamá | CSS | ~12.25% patronal | Décimo tercer mes (3 cuotas/año) | Baja |

La prioridad sugerida sigue dónde ya hay tenants reales operando (México y Perú aparecen en el
catálogo de entidades de `configRHPorPais` desde antes, señal de que ya se les prestó atención
parcial). El resto quedó con `GENERICO_LABORAL` (placeholders neutros, no términos legales
reales) hasta que se investigue cada uno — **no inventar porcentajes ni nombres de trámites
sin fuente oficial**, el precedente de esta sesión es exactamente ese error para Colombia
aplicado a Ecuador.

## Receta para agregar un país nuevo (una vez investigado)

1. En `src/lib/paises.ts` → `CONFIG_RH_BASE[código]`: agregar `entidades` reales (o dejar listas
   vacías si no se tiene catálogo verificado — el formulario ya maneja ese caso con un input de
   texto libre), `tiposContrato` y `tiposCotizante` con los términos legales reales del país, y
   los 5 flags booleanos (`tieneCajaComp`, `tieneCesantias`, `tieneARLNiveles`,
   `tieneAuxTransporte`, `tieneExoneracionParafiscal`) según si el país tiene o no cada concepto.
2. En `src/app/dashboard/nomina/page.tsx`: agregar `calcCarga<PAIS>()` (mismo patrón que
   `calcCargaECU`) con la fórmula real de aportes patronales, y una rama más en el `if` de
   `calcCarga()` y en el desglose visual "Carga prestacional calculada" (busca
   `f.pais_code === 'ECU'` como referencia de dónde agregar el siguiente `else if`).
3. Si el país tiene un beneficio anual de monto fijo (como el décimo cuarto ecuatoriano, que no
   es % del salario sino 1 salario mínimo/año), tratarlo aparte del resto de porcentajes, igual
   que se hizo con `SBU_ECU_2026`.
4. Confirmar con `npx tsc --noEmit` y una revisión visual del formulario en ese país antes de
   dar por cerrado.

## Fuera de alcance de este ajuste (pendiente como proyecto aparte)

- **Pestaña "Tasas" del admin** (`src/app/dashboard/nomina/page.tsx`, tabla
  `nomina_tasas_historico`) sigue siendo 100% Colombia — campos como `sena`, `icbf`, `arl_nivel1..5`
  no tienen sentido para otro país. Hoy Ecuador usa una constante fija en código
  (`SBU_ECU_2026`) en vez de una tabla editable por el admin como sí existe para Colombia. Antes
  de escalar a más países con tasas que cambian año a año (como el SBU), conviene generalizar
  esa tabla/pestaña para que cada país tenga su propio histórico editable, no una constante
  hardcodeada que hay que tocar en código cada vez que cambie el SBU.
- **Motor de Liquidación** (`calcularLiquidacionCOL`, pestaña "Liquidación") es exclusivamente
  colombiano — corridas de nómina, novedades, colillas de pago. Construir el equivalente para
  Ecuador (con décimo tercero/cuarto como pagos reales, no solo provisión, fondo de reserva
  acumulado por colaborador, retención de tabla del IESS) es un proyecto del mismo tamaño que el
  que ya existe para Colombia — no algo que se resuelve extendiendo el formulario de creación de
  colaborador.

## Fuentes usadas para Ecuador (2026)

- [Tabla Aportes IESS Ecuador 2026](https://misalario.ec/tabla-aportes-iess-ecuador/)
- [Aporte Patronal IESS 2026: 11,15%](https://tagline-soluciones.com/blog/talento-humano/aportacion-iess-empleador-ecuador/)
- [Fondo de Reserva Ecuador 2026](https://misalario.ec/como-calcular-fondo-de-reserva-ecuador/)
- [Cálculo del sueldo en Ecuador 2026 — ContApp](https://www.contapp.ec/blogs/calcular-sueldo-ecuador)
- [SBU 2026: USD 482 — Buró Tributario](https://burotributario.com.ec/ecuador-fija-el-salario-basico-unificado-para-2026-en-482/)
- [Costo de Trabajador (desglose 11.15% + 0.5% + 0.5%) — IMGroup](https://imgroup.com.ec/herramientas/calculo-costo-trabajador)
