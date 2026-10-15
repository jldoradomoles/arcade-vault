# SPEC 01 — MVP visual de Arcade Vault (pantallas del template)

> **Status:** implementado
> **Depends on:** ninguna
> **Date:** 2026-10-15
> **Objective:** Portar a Next.js (App Router, Tailwind v4) las cinco pantallas de `references/templates/` con datos simulados, sin implementar ningún juego.

## Por qué existe esta spec

`references/templates/` contiene un prototipo en React + Babel (SPA con la ruta en el hash de la URL, datos en `data.jsx`, sesión falsa en `localStorage`). Esta spec lo convierte en la base real de la app: rutas reales, componentes tipados y la misma apariencia. Todo lo que no es visual (auth real, ranking real, juegos) queda fuera.

## Alcance

**Dentro:**

- Cinco pantallas con rutas reales del App Router:
  - `/` — Biblioteca (hero, buscador, chips de categoría, grilla de tarjetas con tilt).
  - `/juegos/[id]` — Detalle del juego (portada, tags, estadísticas, ranking top 10).
  - `/juegos/[id]/jugar` — Reproductor simulado (HUD, marco CRT, pausa, fin de juego, modal de guardar puntuación).
  - `/acceso` — Iniciar sesión / Crear cuenta / Jugar como invitado.
  - `/salon` — Salón de la Fama (pestañas por juego, podio, tabla, "tu mejor marca").
- Layout global: fondo (`av-bg`, `av-noise`), `Nav` (con panel móvil), `Footer`.
- `app/not-found.tsx` con estilo neón; `notFound()` para `id` de juego inexistente.
- Datos simulados tipados: los 8 juegos de `data.jsx`, `CATS` y el generador determinista `seededScores`.
- Sesión simulada en `localStorage` (`av_user`) compartida por Nav, Reproductor y Salón.
- Guardado de puntuaciones del reproductor en `localStorage` (`av_scores`), sin leerlas en ninguna pantalla.
- Responsive tal como lo define el template (nav con hamburguesa, grillas adaptables).

**Fuera de alcance (para futuras specs):**

- Cualquier juego jugable (el "juego" del reproductor es una arena decorativa con puntaje falso).
- Autenticación real (OAuth Google/GitHub, validación, contraseñas, backend). Los botones sociales son decorativos.
- Base de datos, API o Server Actions para puntuaciones y usuarios.
- Mezclar `av_scores` en el detalle o en el Salón; ranking real y "tu mejor marca" calculada.
- Contador de créditos funcional (`CRÉDITOS · 03` es texto fijo).
- Tests automatizados (el proyecto no tiene framework configurado).
- Internacionalización (la UI queda en español).

## Modelo de datos

Solo datos simulados y estado de cliente; no hay backend.

```ts
// lib/games.ts
export type GameCategory = "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";
export type GameColor = "cyan" | "magenta" | "yellow" | "green";

export interface Game {
  id: string;          // slug de la URL: "bloque-buster", "caida", ...
  title: string;
  short: string;
  long: string;
  cat: GameCategory;
  cover: string;       // clase CSS existente en globals.css: "cover-bricks", ...
  color: GameColor;
  best: number;        // mejor puntuación global (simulada)
  plays: string;       // "12.4K"
}

export const CATS = ["TODOS", "ARCADE", "PUZZLE", "SHOOTER", "VERSUS"] as const;
export const GAMES: Game[]; // los 8 juegos de references/templates/data.jsx

// lib/scores.ts
export interface ScoreRow {
  rank: number;
  name: string;
  score: number;
  date: string;        // "dd/mm/2026"
}
export function seededScores(seed: number, count?: number): ScoreRow[]; // determinista

// lib/session.ts (cliente)
export interface SessionUser { name: string } // MAYÚSCULAS, máx. 10 caracteres
export interface SavedScore { game: string; score: number; name: string; at: number }
```

Claves de `localStorage`: `av_user` (`SessionUser | null`) y `av_scores` (`SavedScore[]`), idénticas al template.

Convenciones:

- Números con `toLocaleString("es-ES")`.
- `seededScores` debe dar el mismo resultado en servidor y cliente para el mismo `seed` (sin `Math.random` ni `Date.now`).
- Semillas como en el template: detalle `id.length * 17 + 3` (10 filas); Salón `id.length * 23 + 7` (12 filas).

## Plan de implementación

Antes del paso 1, leer la guía relevante en `node_modules/next/dist/docs/01-app` (params asíncronos, `cacheComponents`, `notFound`, `generateStaticParams`). Los nombres de archivo son la propuesta de esta spec.

1. Crear `lib/games.ts` y `lib/scores.ts` con los tipos y datos de arriba. Verificación: `npx tsc --noEmit` pasa.
2. Crear `lib/session.ts` + `components/session-provider.tsx` (contexto cliente con `user`, `login`, `signOut`, `saveScore`, leyendo `av_user` tras montar). Envolver `app/layout.tsx` con el provider. Verificación: la app sigue arrancando.
3. Crear `components/nav.tsx` (con panel móvil) y `components/footer.tsx`; montarlos en `app/layout.tsx`. Verificación: Nav y footer visibles en `/`, enlaces a `/` y `/salon`.
4. Implementar la Biblioteca: `components/game-card.tsx` (cliente, tilt) y `components/library.tsx` (cliente, búsqueda + chips), servida desde `app/page.tsx`. Verificación: filtrar por texto y categoría, y ver el estado "NO HAY RESULTADOS".
5. Implementar el Detalle en `app/juegos/[id]/page.tsx` (+ `generateStaticParams`, `notFound()`) y crear `app/not-found.tsx`. Verificación: `/juegos/caida` renderiza; `/juegos/xyz` muestra el 404.
6. Implementar el Salón en `app/salon/page.tsx` con un componente cliente `components/hall-of-fame.tsx` (pestañas, podio, tabla, "tu mejor marca" si hay sesión). Verificación: cambiar de pestaña cambia los datos.
7. Implementar Acceso en `app/acceso/page.tsx` con `components/auth-form.tsx` (pestañas in/up, invitado, botones sociales decorativos). Verificación: tras entrar, el Nav muestra el nombre en mayúsculas y se redirige a `/`.
8. Implementar el Reproductor en `app/juegos/[id]/jugar/page.tsx` con `components/game-player.tsx` (puntaje simulado, pausa, FIN, modal, guardar en `av_scores`, jugar de nuevo). Verificación: el flujo completo funciona y `av_scores` crece en `localStorage`.
9. Revisión visual contra `references/templates/Arcade Vault.html` en escritorio y móvil; ajustar `globals.css` solo si falta alguna clase del template. Verificación: `npm run lint` y `npm run build` pasan.

Todas las pantallas usan utilidades Tailwind para layout y espaciado, y las clases de `globals.css` para efectos complejos (CRT, neón, fondos, animaciones, tilt). La apariencia sale del template; no se rediseña nada.

## Criterios de aceptación

- [ ] `npm run build` y `npm run lint` terminan sin errores.
- [ ] Existen las rutas `/`, `/juegos/[id]`, `/juegos/[id]/jugar`, `/acceso` y `/salon`, y cada una renderiza sin errores en la consola del navegador.
- [ ] La Biblioteca muestra los 8 juegos; escribir "caí" deja solo CAÍDA; el chip SHOOTER deja 2 juegos; una búsqueda sin coincidencias muestra "NO HAY RESULTADOS".
- [ ] Pulsar una tarjeta o su botón JUGAR navega a `/juegos/<id>`.
- [ ] El Detalle muestra título, descripción, 4 tags, tira de estadísticas y 10 filas de ranking, con las tres primeras destacadas.
- [ ] "JUGAR AHORA" lleva a `/juegos/<id>/jugar` y "VOLVER AL VAULT" a `/`.
- [ ] `/juegos/inexistente` y `/juegos/inexistente/jugar` muestran el 404 de `app/not-found.tsx`.
- [ ] El Reproductor incrementa el puntaje solo mientras no está en pausa ni terminado; PAUSA/REANUDAR alterna el overlay "EN PAUSA".
- [ ] Pulsar FIN abre el modal con la puntuación final; "GUARDAR PUNTUACIÓN" añade una entrada a `av_scores` y muestra "PUNTUACIÓN GUARDADA_".
- [ ] "JUGAR DE NUEVO" reinicia puntaje, vidas y nivel; "SALIR" vuelve al detalle.
- [ ] En `/acceso`, la pestaña "CREAR CUENTA" añade el campo de correo; enviar el formulario guarda `av_user` con el nombre en mayúsculas (máx. 10 caracteres) y redirige a `/`.
- [ ] "JUGAR COMO INVITADO" redirige a `/` sin `av_user`.
- [ ] Con sesión, el Nav muestra el nombre del usuario; al pulsarlo se borra `av_user` y vuelve "Iniciar Sesión". Recargar mantiene la sesión.
- [ ] El Salón tiene una pestaña por juego (8), muestra podio con los 3 primeros y 12 filas; con sesión muestra además la fila "TU MEJOR MARCA".
- [ ] Con ancho de 375 px el Nav muestra la hamburguesa y el panel lateral abre y cierra; no hay scroll horizontal.
- [ ] Recargar cualquier ruta muestra los mismos rankings (datos deterministas) y no produce errores de hidratación en consola.
- [ ] No existe ningún archivo de lógica de juego (colisiones, bucle de juego, input de teclado del juego).

## Decisiones

- **Sí:** rutas reales del App Router en lugar del hash SPA del template. URLs compartibles y aprovecha Next 16.
- **No:** replicar la navegación por hash. Desaprovecha Next y no sirve para SEO ni enlaces directos.
- **Sí:** reutilizar el CSS ya migrado en `app/globals.css` (fuentes y tokens ya conectados en `app/layout.tsx`) y usar Tailwind para layout. Evita reescribir ~950 líneas de efectos con riesgo de divergencia visual.
- **No:** reescribir todo en Tailwind puro ni borrar las clases migradas. Mucho trabajo y riesgo visual sin beneficio para el MVP.
- **Sí:** sesión simulada en `localStorage` (`av_user`), igual que el template. Es mock explícito; la auth real tendrá su propia spec.
- **No:** validar credenciales ni implementar OAuth. Es lógica de backend fuera de la parte visual.
- **Sí:** el reproductor es una pantalla simulada con puntaje falso y guardado en `av_scores`. Cubre el flujo visual completo (HUD, pausa, fin, modal).
- **No:** leer `av_scores` en detalle ni Salón. "Tu mejor marca" sigue siendo un valor simulado; el ranking real es lógica de producto.
- **Sí:** `notFound()` y `app/not-found.tsx` para ids inexistentes. Comportamiento estándar de Next, con la estética del proyecto.
- **No:** redirigir a la biblioteca ante un id inválido; oculta el error.
- **Sí:** datos simulados en `lib/` con tipos TypeScript y `seededScores` determinista. Evita desajustes de hidratación entre servidor y cliente.
- **Sí:** estado de pestañas, filtros y buscador como estado local de cliente, no en la URL. Es lo que hace el template y mantiene el MVP simple.

## Riesgos

| Riesgo | Mitigación |
| ------ | ---------- |
| `cacheComponents: true` y params dinámicos pueden dar errores de build (acceso a datos o params sin `Suspense`/`generateStaticParams`). | Leer las guías de `node_modules/next/dist/docs` antes de empezar; usar `generateStaticParams` con los ids de `GAMES`. |
| Leer `localStorage` en el render provoca error de hidratación (servidor sin sesión, cliente con sesión). | El provider arranca con `user = null` y lee `av_user` en un efecto tras montar; `localStorage` envuelto en `try/catch`. |
| Alguna clase del template no esté en `globals.css` y la pantalla se vea distinta. | Paso 9 compara contra `Arcade Vault.html` y se completa solo lo que falte. |
| El `Math.random` del reproductor rompe el render en servidor. | Solo se usa dentro de un `useEffect` en un componente cliente. |

## Qué **no** está en esta spec

- Ningún juego jugable.
- Autenticación o usuarios reales.
- Backend, base de datos o API de puntuaciones.
- Ranking real ni uso de `av_scores` para mostrar datos.
- Créditos funcionales.
- Tests automatizados e internacionalización.

Cada uno, si llega, va en su propia spec.
