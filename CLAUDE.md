# CLAUDE.md

Guía para Claude Code (claude.ai/code) al trabajar en este repositorio.

## Proyecto

Arcade Vault: plataforma para jugar online y competir por la mayor cantidad de puntos. Se desarrolla con Spec Driven Design (`/spec` y `/spec-impl` del paquete `Klerith/fernando-skills`, instalado con `npx skills@latest add Klerith/fernando-skills`). Las specs viven en `specs/NN-*.md`. Hay 9 specs entregadas: pantallas MVP, home/landing, acerca/contacto con Resend, conexión Supabase, Asteroids, leaderboard + tabla `games`, Tetris, Arkanoid y Snake.

Responde siempre en español.

## Estructura

- `app/`: App Router. Rutas `/` (home), `/acerca-de`, `/biblioteca`, `/salon`, `/acceso`, `/juegos/[id]` (ficha) y `/juegos/[id]/jugar` (reproductor). `actions.ts` por ruta para Server Actions.
- `components/`: UI compartida. `nav.tsx`, `footer.tsx`, `session-provider.tsx`, `auth-form.tsx`, `game-canvas.tsx`, `game-player.tsx`, `game-card.tsx`, `hall-of-fame.tsx`, `library.tsx`, y subcarpetas `home/` y `about/`.
- `lib/`: lógica de negocio. `game-engine.ts` (contrato de motor), `game-registry.ts` (mapa `id → motor + controles`), `game-types.ts`, `games.ts`, `scores.ts`, `home.ts`, `contact.ts`. Cada juego tiene su carpeta (`asteroids/`, `tetris/`, `arkanoid/`, `snake/`) con `constants.ts`, `engine.ts` y `entities.ts`. Cliente Supabase en `lib/supabase/`.
- `supabase/`: `seed.sql` y `migrations/` con el histórico de la BD (perfiles, scores, games y filas por juego nuevo).
- `specs/`: specs numeradas en Spec Driven Design.
- `references/`: material de apoyo (`started-games/`, `templates/`, `resource-assets/`).
- `proxy.ts` (raíz): middleware de Next que refresca la sesión Supabase vía `getClaims()`.

## Skills del proyecto

- `/frontend-design`: úsalo siempre que diseñes una interfaz de usuario.
- `/nuevo-juego` (en `.claude/skills/nuevo-juego/`): genera la spec de un juego nuevo (motor + leaderboard + HUD de plataforma) a partir de una carpeta de `references/started-games/` o de una descripción. **Solo escribe la spec**; la implementación la hace después `/spec-impl`.

## Subagentes del proyecto

- `game-planner` (en `.claude/agents/game-planner.md`): decide qué juego encaja a continuación en la plataforma. Analiza el catálogo actual, los huecos de categoría/color y las carpetas de `references/started-games/`, y mantiene un backlog persistente en `references/game-suggestions-todo.md` con cuatro tablas (Sugeridos, Aceptados, Implementados, Descartados). **No escribe código ni specs**: su salida es la actualización del backlog y una recomendación razonada. El siguiente paso tras aceptar un candidato es `/nuevo-juego`.
- `game-jam` (en `.claude/agents/game-jam.md`): genera 3 specs de juegos a partir de un tema, cada una con dos variantes de implementación (`spec-v1.md` y `spec-v2.md`) para que el usuario elija. Cada juego queda en `specs/game-jam/<game-id>/`. Es autónomo: no hace preguntas, solo necesita el tema. Las specs salen en estado `borrador`; para implementar un juego elegido, mover su spec a `specs/NN-juego-<id>.md` y usar `/spec-impl`.
- `skin-designer` (en `.claude/agents/skin-designer.md`): añade tres skins (`classic`, `neon`, `retro`) a un único juego y un selector dentro del propio juego para alternarlas. Requiere un `<game-id>` del `lib/game-registry.ts` como argumento. La primera vez introduce la infraestructura compartida (tipo `SkinId`, parámetro `skin` en `CreateEngine`, componente `GameSkinPicker`); después solo refactoriza el juego objetivo. No persiste la selección y mantiene el seguimiento en `references/games-with-themes.md`.

No hay framework de tests configurado.

## Hooks

`PostToolUse` en `.claude/settings.json` ejecuta `.claude/hooks/format-lint.mjs` tras cada `Write`/`Edit` (Prettier + ESLint). No lo deshabilites.

## MCP

`.mcp.json` registra el servidor MCP de Supabase (features: docs, account, database, debugging, development, functions, branching). Úsalo para inspeccionar esquema, migraciones y advisors antes de tocar la BD.

## Next.js

Next 16.4.1 / React 19.3 con App Router. Esta versión tiene cambios incompatibles respecto a lo que conoces: antes de escribir código lee la guía relevante en `node_modules/next/dist/docs/` (`01-app` es la del App Router). `AGENTS.md` es regenerado por `next dev`.

Configuración no estándar en `next.config.ts`: `cacheComponents: true`, `partialPrefetching: true`, `experimental.agentFeedback`, y Tailwind v4 cargado vía regla de Turbopack (`@tailwindcss/turbopack`) para `*.css`. `cacheComponents` afecta cómo se hace el data fetching y el caching en componentes.

Middleware fuera de lo habitual: el archivo se llama `proxy.ts` (no `middleware.ts`) y exporta `proxy` + `config`; respeta ese nombre.

## Supabase

- Cliente navegador en `lib/supabase/client.ts` (`createBrowserClient`); cliente servidor en `lib/supabase/server.ts`. Tipos generados en `lib/supabase/database.types.ts` (regenera cuando cambie el esquema).
- Autenticación por email/username (regex `^[A-Za-z0-9_]{3,10}$`). Trigger `handle_new_user` crea el perfil al registrarse.
- Tablas: `games`, `profiles`, `scores`. Vista `game_stats` con `security_invoker = true`.
- Variables en `.env.local`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_DB_PASSWORD`. Resend: `RESEND_API_KEY`, `CONTACT_TO_EMAIL`, `CONTACT_FROM_EMAIL`.
- Nueva migración por cada juego añadido (`YYYYMMDDHHMMSS_juego_<slug>.sql`) con el insert en `games`.

## Juegos

Contrato en `lib/game-engine.ts`; cada juego implementa su `Engine` (`init`, `start`, `pause`, `resume`, `reset`, `dispose`) y se registra en `lib/game-registry.ts` con `width`, `height`, `createEngine` y la línea de ayuda de controles. HUD, pausa, game over, reinicio y guardado de puntuación los pone la plataforma (`components/game-player.tsx`), no el juego. Para añadir uno nuevo: usa `/nuevo-juego` para la spec y luego `/spec-impl`.

- Juegos implementados (ver `references/implemented-games.md`): Asteroids, Tetris, Arkanoid, Snake.

## Convenciones

- Alias de imports: `@/*` apunta a la raíz del repo.
- TypeScript estricto; los layouts usan los tipos globales generados (`LayoutProps<"/">`) en lugar de tipar `children` a mano.
- Estilos con Tailwind v4 (`@import "tailwindcss"` y `@theme inline` en `app/globals.css`); tema claro/oscuro mediante variables CSS `--background`/`--foreground`.
- Fuentes del layout: `Press_Start_2P`, `JetBrains_Mono`, `Courier_Prime` vía `next/font/google`, expuestas como `--font-press-start`, `--font-jetbrains-mono`, `--font-courier-prime`.
- Server Actions co-localizadas en `actions.ts` dentro de cada ruta que las use.
