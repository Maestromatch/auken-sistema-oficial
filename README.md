# Aukén Sistema

Sistema de automatización con IA para ópticas en Chile.

## Stack

- React 18 + Vite
- Supabase (PostgreSQL + Auth + Storage)
- Claude API (Anthropic Sonnet 4.6)
- WhatsApp Meta Cloud API
- Vercel (deployment)

## Instalación local

```bash
npm install
cp .env.example .env
# Editar .env con tus keys
npm run dev
```

## Deploy en Vercel

```bash
vercel --prod
```

Configurar env vars en Vercel:
- `ANTHROPIC_API_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `WORKER_SECRET`
- `CRON_SECRET`

## Rutas principales

- `/` - Landing/overview
- `/optica` - Monitor de chat en vivo
- `/optica/dashboard` - Dashboard de gestión
- `/admin` - Panel SuperAdmin

## Migraciones Supabase

En orden:
1. `migrations/000_cleanup_ultra.sql`
2. `migrations/001_complete_schema.sql`

## Estructura
- `api/`  → Serverless functions
- `src/`          → React app
- `migrations/`   → SQL schemas
- `public/`       → Assets estáticos

## Cliente piloto Óptica Glow Vision - Punitaqui, Región de Coquimbo
