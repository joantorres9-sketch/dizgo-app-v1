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

## Fase actual: FASE 0 — Base y orden
Lo que toca en esta fase:
- Dejar documentado el contexto (este archivo) y las reglas de trabajo con Claude.
- Ordenar la información de cada frente antes de construir cosas nuevas.
- En DIZGO.APP: estabilizar lo que ya existe (auth, carga de pedidos Shopify/Dropi,
  conciliación y wallet) antes de abrir módulos nuevos.

Hasta que se declare la Fase 1, se prioriza corregir y ordenar por encima de añadir.

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
