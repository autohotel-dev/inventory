# AGENTS.md

## Project overview

Next.js 15 App Router + Supabase (auth + DB) inventory/hotel management system for Auto Hotel Luxor (AHLM). Spanish-first codebase — UI, comments, and business logic use Spanish.

## Commands

| Task | Command |
|------|---------|
| Dev server | `npm run dev` (uses Turbopack) |
| Dev + print server | `npm run dev:all` |
| Lint | `npm run lint` |
| Typecheck | `npm run type-check` |
| Production build | `npm run build:production` (runs pre-build check first) |
| Plain build | `npm run build` |

There is **no test suite**. Do not look for or create test files.

ESLint is **disabled during `next build`** (`next.config.js` sets `ignoreDuringBuilds: true`) but enforced during dev via `npm run lint`.

## Architecture

### Key directories

- `app/` — Next.js App Router pages. Each route is a folder with `page.tsx`. API routes in `app/api/`.
- `components/` — React components organized by domain (sales, rooms, inventory, etc.). UI primitives in `components/ui/` (shadcn/ui).
- `lib/` — Core business logic, Supabase clients, services, validations, utilities.
- `hooks/` — Custom React hooks organized by domain.
- `contexts/` — React contexts: chat, print-center, training.
- `providers/` — QueryProvider (TanStack React Query).
- `types/` — Shared TypeScript types.
- `supabase/migrations/` — Database migrations.
- `print-server/` — Standalone Node.js server for USB thermal printing (separate process, port 3001).
- `scripts/` — Utility scripts: DB checks, Tuya sensor polling, PWA icon generation.

### Supabase clients (three, each for a different context)

1. **`lib/supabase/server.ts`** — SSR client via `cookies()`. Use in Server Components and Route Handlers.
2. **`lib/supabase/client.ts`** — Browser client. Singleton on `window.supabaseClient`. Use in Client Components.
3. **`lib/supabase/admin.ts`** — Service role client (`SUPABASE_SERVICE_ROLE_KEY`). Use server-side only for elevated operations (creating users, etc.). Never expose to client.

### Auth & middleware

`middleware.ts` calls `lib/supabase/middleware.ts` which refreshes the Supabase session on every request. Unauthenticated users are redirected to `/auth/login` (except `/` and `/auth/*`). Guest portal (`/guest-portal`) requires a `?token=` query param.

### Permissions

Single source of truth: `lib/permissions.ts` → `getAllMenuResources()`. The sidebar AND the permissions management page both read from this function. Roles: `admin`, `manager`, `supervisor`, `receptionist`, `cochero`, `camarista`, `mantenimiento`. When adding a new module/page, add it ONLY to `getAllMenuResources()`.

### Printing (two systems)

1. **Network printer** (primary): `lib/services/network-printer-service.ts` — TCP/IP to ESC/POS printer via `PRINTER_IP:PRINTER_PORT` (default port 9100). Used by `app/api/print/route.ts`.
2. **USB print server** (legacy/local): `print-server/index.js` — Express server on port 3001, uses `node-thermal-printer`. Run via `npm run print-server` or `npm run dev:all`. Can be exposed via Cloudflare tunnel (`print.autohoteluxor.com`).

### i18n

**Currently disabled.** `middleware.ts` has i18n middleware commented out. `i18n.ts` is a no-op. Translation files exist in `messages/es.json` and `messages/en.json`. Default locale is `es`. Do not enable i18n without updating the middleware config.

### PWA

Configured via `next-pwa` in `next.config.js`. **Disabled in development** (`NODE_ENV === 'development'`). Service workers: `sw.js`, `chat-sw.js`, `valet-push-sw.js`.

## Path alias

`@/*` maps to the project root (`./*`). Use `@/components/...`, `@/lib/...`, etc.

## Important constraints

- **Room tolerance values** in `lib/constants/room-constants.ts` must match the `process_extra_hours_v2` RPC function in Supabase. If you change `EXIT_TOLERANCE_MINUTES`, update the DB function too.
- The browser Supabase client is a **singleton on `window`** — do not create multiple instances in client code.
- `vercel.json` sets `maxDuration: 30` for all API routes and has a cron at `/api/guest/check-reminders` running hourly.
- `Dockerfile` is for the Tuya sensor polling worker only, not the main app.
- `ecosystem.config.js` is for PM2 running the Tuya sensor monitor.
- The `next.config.js` uses `@next/bundle-analyzer` (enabled via `ANALYZE=true` env var).
- Deployment is to Vercel. Production URL: `manager.autohoteluxor.com`.

## Code conventions

- Use `react-hook-form` + `zod` for forms and validation. Validation schemas in `lib/validations/`.
- TanStack React Query for server state management.
- shadcn/ui components (`components/ui/`) are the base UI layer — wrap with Radix primitives.
- Lucide React for icons.
- `sonner` for toast notifications.
- `date-fns` for date formatting.
- ESLint rules: `no-explicit-any` and `no-unused-vars` are **warnings**, not errors.
