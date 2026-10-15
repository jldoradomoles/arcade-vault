# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Proyecto

Arcade Vault: plataforma para jugar online y competir por la mayor cantidad de puntos. Se desarrolla con Spec Driven Design (comandos `/spec` y `/spec-impl`, skills de `Klerith/fernando-skills`, instaladas con `npx skills@latest add Klerith/fernando-skills`). Actualmente es el scaffold de Create Next App (solo `app/layout.tsx`, `app/page.tsx`, `app/globals.css`); no hay tests ni directorio `spec/` todavía.

## Skills
Usa siempre /frontend-design cuando requieres hacer un Diseño de una Interfaz de usuario 

No hay framework de tests configurado.

## Next.js

Next 16.4.1 / React 19.3 con App Router. Esta versión tiene cambios incompatibles respecto a lo que conoces: antes de escribir código lee la guía relevante en `node_modules/next/dist/docs/` (`01-app` es la del App Router). `AGENTS.md` es regenerado por `next dev`.

Configuración no estándar en `next.config.ts`: `cacheComponents: true`, `partialPrefetching: true`, `experimental.agentFeedback`, y Tailwind v4 cargado vía regla de Turbopack (`@tailwindcss/turbopack`) para `*.css`. `cacheComponents` afecta cómo se hace el data fetching y el caching en componentes.

## Convenciones

- Alias de imports: `@/*` apunta a la raíz del repo.
- TypeScript estricto; los layouts usan los tipos globales generados (`LayoutProps<"/">`) en lugar de tipar `children` a mano.
- Estilos con Tailwind v4 (`@import "tailwindcss"` y `@theme inline` en `app/globals.css`); tema claro/oscuro mediante variables CSS `--background`/`--foreground`.
- Fuentes Geist vía `next/font/google`, expuestas como `--font-geist-sans` / `--font-geist-mono`.
