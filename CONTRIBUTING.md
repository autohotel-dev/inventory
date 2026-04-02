# Guía de Contribución - Equipo Antigravity

¡Bienvenido al equipo! Sigue estas convenciones para mantener el código limpio y mantenible.

## Naming Conventions y Estilo de Código

- **Componentes React:** Usar `PascalCase` para nombres de archivos y funciones (ej. `RoomTypesTable.tsx`).
- **Hooks y Utilidades:** Usar `kebab-case` para nombres de archivos (ej. `use-room-actions.ts`, `error-handler.ts`).
- **Variables y Funciones JS/TS:** Usar `camelCase`.
- **Tipado:** Tipar todo estrictamente usando TypeScript o Zod. Evitar el uso de `any` a toda costa.

## Estructura de Carpetas (frontend)

- `/app`: Rutas de la aplicación (App Router) y Endpoints API.
- `/components`: Componentes reutilizables UI (Shadcn) y específicos del dominio (ej. `/room-types`, `/sales`).
- `/lib`: Configuración de Supabase, clientes HTTP, utilidades globales, y lógica de negocio/servicios (ej. `room-service.ts`, `permissions.ts`).
- `/hooks`: Custom hooks de React para abstraer lógica compleja (ej. `use-valet-actions.ts`).

## Flujo de Trabajo (Git Flow)

1. Crea una rama para tu feature: `git checkout -b feature/nombre-de-la-feature`
2. Realiza tus cambios y verifica con `npm run lint` y `npm run type-check`.
3. Haz commit con mensajes claros y descriptivos en formato Conventional Commits (`feat: ...`, `fix: ...`, `refactor: ...`).
4. Sube la rama y abre un Pull Request (PR) hacia la rama principal.

## Pruebas y Pre-Commits

Siempre asegúrate de correr los validadores antes de hacer push:
```bash
npm run type-check
npm run lint
```
