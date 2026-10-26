# SPEC 02 — Página de Inicio (landing) y acceso "Inicio" en el header

> **Status:** implemnetado
> **Depends on:** SPEC 01
> **Date:** 2026-10-15
> **Objective:** Crear la página Home (landing) del template en `/`, añadir el acceso "Inicio" al header y mover la Biblioteca a `/biblioteca`.

## Por qué existe esta spec

La spec 01 dejó la Biblioteca como pantalla raíz (`/`). El template de `references/templates/home-about/` define además una landing (`home.jsx`) con hero, razones, vista previa de juegos, estadísticas, actividad, precios y CTA final, y un `Nav` con el enlace "Inicio" (`nav.jsx`). Esta spec porta solo la Home; la página "Acerca de" queda fuera.

## Alcance

**Dentro:**

- Nueva Home en `/` con las siete secciones de `home.jsx`:
  - Hero (siluetas pixel flotantes, eyebrow, título de 3 líneas, subtítulo, 2 CTAs, indicador "DESLIZA").
  - `// 01 ¿POR QUÉ ARCADE VAULT?` — 4 tarjetas de características con icono SVG pixel.
  - `// 02 JUEGOS DISPONIBLES AHORA` — 6 mini-tarjetas (los 6 primeros de `GAMES`) y botón "VER TODOS LOS JUEGOS →".
  - Franja de estadísticas (3 bloques).
  - `// 03 ACTIVIDAD EN VIVO` — "Últimas puntuaciones" (7 filas) y "Top jugadores · hoy" (5 filas, enlace "VER SALÓN →").
  - `// 04 PRECIOS` — tarjeta del plan único y 3 preguntas frecuentes.
  - CTA final "¿LISTO PARA JUGAR?".
- Animación "reveal" al entrar en viewport (IntersectionObserver), como `useReveal` del template.
- Mover la Biblioteca actual de `/` a `/biblioteca` (mismo componente `Library`, sin cambios visuales).
- Nav (escritorio y panel móvil): nuevo enlace "Inicio" → `/` como primer elemento, y "Biblioteca" → `/biblioteca`. El logo sigue apuntando a `/`.
- Actualizar los enlaces internos que hoy apuntan a la Biblioteca con `/` para que apunten a `/biblioteca`: "VOLVER A LA BIBLIOTECA" (Salón) y "VOLVER AL VAULT" (Detalle, Reproductor y 404).
- Integrar en `app/globals.css` solo las clases CSS de la Home que faltan (bloque `HOME PAGE` y las reglas de actividad, ticker, top-list, precios y CTA final de `references/templates/home-about/styles.css`).
- Contenido de las secciones como datos simulados tipados en `lib/home.ts`.

**Fuera de alcance (para futuras specs):**

- La página "Acerca de" (`about.jsx`), su ruta y su enlace en el Nav; tampoco sus clases CSS (`highlight-row`, `contact-grid`, etc.).
- Datos reales de actividad, ranking o estadísticas; todo es contenido fijo.
- Adaptar la Home a la sesión (los CTAs "CREAR CUENTA" y "EMPEZAR GRATIS" siempre van a `/acceso`).
- Cambiar el redirect tras iniciar sesión en `/acceso` (sigue yendo a `/`, que ahora es la Home).
- Rediseñar secciones del template o cambiar sus textos.
- Tests automatizados e internacionalización.

## Modelo de datos

Solo contenido estático; no hay persistencia ni backend.

```ts
// lib/home.ts
import type { GameColor } from "@/lib/games";

export interface Feature { icon: "GAMEPAD" | "FREE" | "TROPHY" | "ROCKET"; title: string; desc: string; color: GameColor }
export interface RecentScore { player: string; game: string; score: number; ago: string; color: GameColor }
export interface TopPlayer { rank: number; player: string; score: number }
export interface HomeStat { n: string; unit: string; sub: string }
export interface FaqItem { q: string; a: string }

export const FEATURES: Feature[];       // 4
export const RECENT_SCORES: RecentScore[]; // 7
export const TOP_PLAYERS: TopPlayer[];  // 5
export const HOME_STATS: HomeStat[];    // 3
export const PRICING_PERKS: string[];   // 6 ventajas del plan
export const FAQ: FaqItem[];            // 3
```

Los valores salen literalmente de `home.jsx`. Las mini-tarjetas usan `GAMES.slice(0, 6)` de `lib/games.ts` (sin datos nuevos). Los números se formatean con `toLocaleString("es-ES")`.

## Plan de implementación

Antes del paso 1, leer la guía relevante en `node_modules/next/dist/docs/01-app` (Server/Client Components, `Link`, `cacheComponents`). Y usar la skill `/frontend-design` si hace falta decidir detalles visuales. Los nombres de archivo son la propuesta de esta spec.

1. Mover la Biblioteca: crear `app/biblioteca/page.tsx` que renderiza `<Library />` y actualizar los enlaces internos (`components/hall-of-fame.tsx`, `components/game-player.tsx`, `app/not-found.tsx`, `app/juegos/[id]/page.tsx`) de `/` a `/biblioteca`. `app/page.tsx` queda temporalmente con un placeholder mínimo. Verificación: `/biblioteca` muestra la Biblioteca y los enlaces de vuelta llegan a ella.
2. Actualizar `components/nav.tsx`: enlace "Inicio" (`/`, activo solo con `pathname === "/"`), "Biblioteca" (`/biblioteca`, activo en `/biblioteca` y `/juegos/*`), en la barra y en el panel móvil. Verificación: el enlace correcto se marca como activo en `/`, `/biblioteca`, `/juegos/caida` y `/salon`.
3. Copiar a `app/globals.css` las clases de la Home desde `references/templates/home-about/styles.css` (bloque `HOME PAGE` y las reglas de `.activity-*`, `.ticker`, `.tick-row`, `.top-*`, `.lb-link`, `.pricing-*`, `.price-card`, `.faq-*`, `.home-final`, `.reveal`, con sus `@media` y `@keyframes`/variables que necesiten), sin copiar nada de About. Verificación: `npm run build` pasa y las clases existen una sola vez.
4. Crear `lib/home.ts` con los tipos y datos de arriba. Verificación: `npx tsc --noEmit` pasa.
5. Crear los componentes de la Home en `components/home/`: `floating-silhouettes.tsx`, `feature-icon.tsx`, `mini-game-card.tsx` (`Link` a `/juegos/<id>`), `reveal.tsx` (cliente, IntersectionObserver que añade la clase `in`) y `home-page.tsx` que compone las secciones. Todos son Server Components salvo `reveal.tsx`. Verificación: render sin errores en servidor.
6. Sustituir el placeholder de `app/page.tsx` por la Home. Enlaces: "EXPLORAR JUEGOS", "VER TODOS LOS JUEGOS →" e "INSERTAR MONEDA →" → `/biblioteca`; "CREAR CUENTA" y "EMPEZAR GRATIS →" → `/acceso`; "VER SALÓN →" → `/salon`; mini-tarjetas → `/juegos/<id>`. Verificación: cada enlace navega a su destino.
7. Revisión visual contra `references/templates/home-about/arcade-vault-standalone.html` en escritorio y móvil (375 px); ajustar `globals.css` solo si falta alguna clase. Verificación: `npm run lint` y `npm run build` pasan.

## Criterios de aceptación

- [ ] `npm run build` y `npm run lint` terminan sin errores.
- [ ] `/` renderiza la Home con sus 7 secciones (hero, 01, 02, estadísticas, 03, 04, CTA final) sin errores en la consola ni de hidratación.
- [ ] `/biblioteca` muestra la Biblioteca con el mismo comportamiento que tenía en `/` (8 juegos, buscador, chips).
- [ ] El Nav muestra, en este orden, "Inicio", "Biblioteca", "Salón de la Fama"; el panel móvil muestra los mismos más la cuenta; no aparece "Acerca de".
- [ ] "Inicio" aparece activo solo en `/`; "Biblioteca" en `/biblioteca` y `/juegos/*`; "Salón de la Fama" en `/salon`.
- [ ] El logo lleva a `/`.
- [ ] La sección 01 muestra 4 tarjetas con icono; la 02 muestra 6 mini-tarjetas que navegan a `/juegos/<id>`.
- [ ] La sección 03 muestra 7 filas de últimas puntuaciones y 5 de top jugadores, con las tres primeras del top destacadas.
- [ ] La sección 04 muestra el plan "JUGADOR VAULT" con 6 ventajas y 3 preguntas frecuentes.
- [ ] "EXPLORAR JUEGOS", "VER TODOS LOS JUEGOS →" e "INSERTAR MONEDA →" llevan a `/biblioteca`; "CREAR CUENTA" y "EMPEZAR GRATIS →" a `/acceso`; "VER SALÓN →" a `/salon`.
- [ ] Los bloques con clase `reveal` se hacen visibles al hacer scroll y, con JavaScript lento o desactivado, el contenido no queda permanentemente oculto.
- [ ] Todos los enlaces "VOLVER AL VAULT" / "VOLVER A LA BIBLIOTECA" llevan a `/biblioteca`.
- [ ] Tras iniciar sesión o entrar como invitado en `/acceso`, se redirige a `/` y se ve la Home.
- [ ] Con ancho de 375 px no hay scroll horizontal y las grillas colapsan (4→2→1 columnas en características, 6→3→2 en mini-tarjetas, 1 columna en actividad y precios).
- [ ] No existe ruta `/about` ni código de la página About en el repo (`globals.css` incluido).

## Decisiones

- **Sí:** Home en `/` y Biblioteca en `/biblioteca`. Es la estructura del template (landing + biblioteca) y la landing es lo que debe ver quien llega al sitio.
- **No:** Home en `/inicio` dejando la Biblioteca en `/`. No toca nada existente, pero la landing no sería la raíz.
- **Sí:** copiar a `globals.css` solo las clases de la Home, como en la spec 01. Mantiene un único archivo de estilos y evita arrastrar CSS de About.
- **No:** un `home.css` separado ni importar el `styles.css` completo del template.
- **Sí:** contenido simulado fijo en `lib/home.ts`, idéntico al template. Coherente con el MVP simulado de la spec 01.
- **No:** derivar actividad y top jugadores de `GAMES`/`seededScores`; acopla la Home a datos que cambian el diseño.
- **Sí:** CTAs siempre a `/acceso`, sin leer la sesión. La Home queda como Server Component sin parpadeo de hidratación.
- **No:** ocultar o cambiar los CTAs con sesión iniciada; se deja para una spec de auth real.
- **Sí:** Home como Server Components, con un único componente cliente (`reveal`). Es contenido estático; no necesita JS salvo la animación.
- **Sí:** `Link` de Next en lugar de los `onClick` + `navigate` del template, incluidas las mini-tarjetas.
- **Sí:** el redirect de `/acceso` sigue yendo a `/`. Aceptado el cambio de destino (ahora Home) por no ampliar el alcance.

## Riesgos

| Riesgo | Mitigación |
| ------ | ---------- |
| Dejar algún enlace a `/` pensado como "Biblioteca" y llevar a la Home. | Paso 1 lista los enlaces afectados; criterio de aceptación comprueba "VOLVER…". |
| Con `.reveal` en opacidad 0 y sin JS (o fallo de hidratación), las secciones quedan invisibles. | `reveal.tsx` añade la clase `in`; revisar la regla CSS para que el contenido sea visible si el observer no actúa. |
| Copiar CSS de About por error al mezclar rangos del `styles.css` (las reglas de actividad y precios están al final del archivo, después de About). | Copiar por nombre de clase, no por rango de líneas; criterio "no existe código de About". |
| Las siluetas absolutas del hero provocan scroll horizontal en móvil. | Revisar a 375 px en el paso 7 (`overflow` en `.home-hero` si hace falta). |
| Las mini-tarjetas del template eran `div` con `onClick`; accesibilidad perdida al pasar a `Link`. | Usar `Link` como contenedor de la tarjeta. |

## Qué **no** está en esta spec

- La página "Acerca de" y su enlace en el Nav.
- Datos reales de actividad, ranking y estadísticas.
- Home adaptada a la sesión del usuario.
- Cambios en el flujo de redirección de `/acceso`.
- Tests automatizados e internacionalización.

Cada uno, si llega, va en su propia spec.
