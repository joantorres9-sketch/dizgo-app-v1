# DIZGO.APP — Plataforma de gestión para e-commerce LATAM

> "Encuentra el dinero que no sabías que estabas perdiendo."

## Stack
- **Frontend**: Next.js 14 + TypeScript
- **Backend/DB**: Supabase (PostgreSQL + Auth + RLS)
- **Hosting**: Vercel
- **UI**: Tailwind CSS
- **Gráficos**: Recharts
- **Excel**: SheetJS

## Setup local

```bash
git clone https://github.com/joantorres9-sketch/dizgo-app
cd dizgo-app
npm install
# Crea .env.local con tus keys de Supabase
npm run dev
```

## Variables de entorno

```
NEXT_PUBLIC_SUPABASE_URL=tu_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_key
NEXT_PUBLIC_APP_URL=https://dizgo.app
```

## Estructura

```
src/
├── app/
│   ├── auth/login/     # Login DIZGO
│   ├── dashboard/      # Módulos principales
│   │   ├── wallet/     # Historial cartera Dropi
│   │   ├── pedidos/    # Gestión de pedidos
│   │   └── ...
│   └── admin/          # Panel superadmin
├── components/
│   └── layout/Sidebar  # Navegación PHVA
└── lib/
    └── supabase.ts     # Cliente + tipos
```

## PHVA
- **PLANEAR**: Costos, Catálogo, Precios, Inversión, Metas
- **HACER**: Pedidos, WhatsApp, Logística, Pauta, Wallet
- **VERIFICAR**: P&G, Embudo, Alertas, Dashboard
- **ACTUAR**: Diagnóstico, Formación, Estrategias
