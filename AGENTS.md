# AGENTS.md — Guía para agents de código

## Qué es este proyecto

Atria Fitness — sistema de gestión interna para estudio fitness. Next.js 16 (App Router), TypeScript, Tailwind CSS 4, Shadcn/UI, Prisma + Supabase (auth + PostgreSQL).

## Comandos

```bash
npm run dev          # servidor de desarrollo (puerto 3000)
npm run build        # prisma generate && next build (verifica tipos)
npm run lint         # eslint
npx playwright test  # E2E (levanta dev server automáticamente)
```

**No hay comando de typecheck separado.** La verificación de tipos se hace en `npm run build`.

## Arquitectura — lo que no es obvio

- **Middleware no está en la raíz.** Vive en `src/proxy.ts`, no en `middleware.ts`. Solo refresca sesiones y redirige. No valida roles.
- **RBAC en Server Actions**, no en middleware. `ensureRole()` en `src/lib/auth-utils.ts` valida permisos. Intenta metadata de Supabase primero, fallback a Prisma.
- **Capa de datos dual.** Existe código legacy de localStorage en `src/lib/storage.ts` junto a Supabase/Prisma. `src/lib/migration.ts` Migra datos de localStorage a la DB.
- **Prisma singleton** en `src/lib/prisma.ts` — evita leak de conexiones en hot-reload de desarrollo.
- **Supabase Admin** (`src/lib/supabase-admin.ts`) usa `SUPABASE_SERVICE_ROLE_KEY`. **NUNCA importar en componentes cliente.**

## Estructura de código

- `src/actions/` — Server Actions con `'use server'`. Toda lógica de negocio del lado del servidor.
- `src/lib/schemas.ts` — Validación con **Zod v4** (no v3). Cada Server Action tiene su esquema.
- `src/lib/error-utils.ts` — `handleActionError()` convierte errores de Prisma en mensajes en español para el usuario.
- `src/lib/supabase/` — `server.ts` (SSR con cookies) y `client.ts` (browser).
- `src/constants/config.ts` — Disciplinas (Telas, Lira, Glúteos, Pilates, Kangoo, Heels, Flexibilidad, Yoga, Pole) y Salas.
- `src/hooks/useAuth.ts` — Hook cliente para auth + resolución de roles.
- `src/components/ui/` — Componentes Shadcn/UI (estilo `new-york`, Radix, Lucide).

## Convenciones

- **Todo el texto de UI y mensajes de error en español.**
- Path alias: `@/*` → `./src/*`
- IDs de Supabase/Prisma: UUID o CUID.
- Validación estricta con Zod en cada Server Action antes de tocar la DB.
- Roles: `ADMIN`, `INSTRUCTOR`, `STUDENT` (enum de Prisma). El User model tiene `role` singular y `roles` array.

## Testing

- Solo **Playwright E2E** en `e2e/`. No hay framework de tests unitarios.
- Solo Chromium. Config en `playwright.config.ts`.
- Credenciales de test: `master@atriafit.com` / `12345678` (admin), `val@atriafit.com` / `atria2026` (instructor).

## Seguridad

- `.env` está en `.gitignore`. Nunca commitear credenciales.
- `supabase-admin.ts` (service role) solo en Server Actions, nunca en el cliente.
- Las credenciales de test están hardcodeadas en `e2e/01-auth.spec.ts`.
