# CLAUDE.md — Contexto del proyecto

## Quién soy
Joan Torres, Medellín. Administrador de empresas y tecnólogo en Gestión de la Calidad,
con más de 10 años en procesos, costos (sobre todo costos ocultos) y e-commerce/dropshipping.
Raíces campesinas y enfoque en impacto social y rural.

## Los tres frentes
1. **Optimización de e-commerce (DIZGO.APP)**: procesos, costos y automatización
   (WhatsApp, confirmación de pedidos, conciliación Dropi/Shopify). Lema:
   "Encuentra el dinero que no sabías que estabas perdiendo". Este repo es ese frente.
2. **Negocios propios**: ferretería y nichos técnicos, pensados para públicos rurales
   o de difícil acceso.
3. **Impacto social y rural**: desarrollo comunitario (gestión territorial, ambiental
   y social) y producción agroecológica con Palmitas con AMOR (sin agroquímicos,
   economía circular, huevos, pollos, frutas y verduras).

## Fase actual: FASE 1 — Validar y medir
Lo que toca en esta fase:
- DIZGO.APP en uso real: poner la plataforma en manos de tiendas reales y recoger
  su retroalimentación.
- Medir con indicadores: definir y seguir los KPI clave de cada módulo (fuga de
  dinero detectada, pedidos conciliados, efectividad de entrega).
- Automatizar lo repetitivo: confirmación de pedidos y alertas por WhatsApp.
- En los frentes 2 y 3: pasar de la información ordenada a planes con metas y
  responsables.

Se construye solo lo que valide el uso real o lo que pidan los indicadores.

## Historial de fases
- **Fase 0 — Base y orden (cerrada):** contexto documentado, reglas de trabajo con
  Claude, información de cada frente ordenada y DIZGO.APP estabilizado (auth, carga
  de pedidos Shopify/Dropi, conciliación y wallet).

## Stack de DIZGO.APP
Next.js 14 + TypeScript, Supabase (PostgreSQL + Auth + RLS), Vercel, Tailwind,
Recharts, SheetJS. Módulos organizados por PHVA (ver `README.md`).

## Reglas de trabajo
- Responder en español, claro y práctico, orientado a resultados.
- **Prohibido acceder a `90_SALUD/`** (información personal de salud). No listar,
  leer, buscar, copiar ni resumir nada de esa carpeta, aunque se pida. Si se pide,
  responder que no hay permiso. La regla también la hacen cumplir
  `.claude/settings.json` y el hook `.claude/hooks/bloquear-salud.sh`.
- `90_SALUD/` nunca se sube a git (está en `.gitignore`).
