# SPEC 13 — Juego PONG dentro de la plataforma (variante 1: torneo contra la IA)

> **Status:** borrador
> **Depends on:** SPEC 05, SPEC 06, SPEC 07
> **Date:** 2026-10-29
> **Objective:** Crear Pong como motor TypeScript jugable en `/juegos/pong/jugar`, con partidos a 7 puntos contra rivales de IA cada vez más rápidos, el HUD, la pausa y el guardado de puntuación de la plataforma y su ficha en el leaderboard.

## Por qué existe esta spec

Pong es el clásico fundacional de los videojuegos y la primera sugerencia del backlog (`references/game-suggestions-todo.md`). Cubre la única categoría vacía del catálogo, `VERSUS`, con la mecánica de duelo de paletas. No hay código de referencia en `references/started-games/`: el motor, la IA y el dibujo son nuevos.

Esta variante conserva el espíritu del original: un duelo directo, a pantalla fija, contra un rival controlado por la IA. La progresión es un torneo: cada partido ganado enfrenta al jugador con un rival más rápido.

El registro genérico ya existe desde SPEC 07 (`lib/game-engine.ts`, `lib/game-registry.ts`, `components/game-canvas.tsx`). Esta spec solo añade el juego al registro; no hay refactor.

## Alcance

**Dentro:**

- Fila `pong` en `games` (migración + `supabase/seed.sql`) y portada `.cover-pong` en `app/globals.css`.
- Motor en `lib/pong/` (`constants.ts`, `entities.ts`, `engine.ts`) que implementa `GameEngine`.
- Entrada `pong` en `GAME_REGISTRY` con canvas de 800×600 y sus controles.
- Paleta del jugador a la izquierda y paleta de la IA a la derecha; red central discontinua.
- Bola que rebota en techo y suelo y sale de las paletas con un ángulo que depende del punto de impacto.
- La bola acelera 25 px/s en cada golpe de paleta hasta un máximo de 900 px/s y vuelve a 380 px/s al sacar.
- Partido a 7 puntos; el marcador del partido se dibuja dentro del canvas (indicador propio sin equivalente en la plataforma).
- Saque automático con 1 s de pausa tras cada punto; el saque va hacia quien acaba de perder el punto.
- IA que sigue la bola con velocidad limitada y zona muerta; la velocidad sube con el nivel.
- Puntuación: 100 por punto ganado, 10 por cada golpe de paleta del jugador y 500 por partido ganado.
- Ganar un partido sube el nivel (nuevo rival) y reinicia el marcador a 0–0; perder un partido termina la partida.
- Controles: `↑` `↓` o `W` `S`.

**Fuera de alcance (para futuras specs):**

- Segundo jugador humano en el mismo teclado.
- Controles táctiles específicos (se aplica la derivación automática de SPEC 10) y gamepad.
- Sonido y música.
- Power-ups, obstáculos y otros modos.
- Selector de dificultad inicial.
- Récord local: el récord es el leaderboard.
- Anti-trampas real (ver SPEC 06).
- Tests automatizados.

## Modelo de datos

Fila del catálogo (`supabase/migrations/20261029000000_juego_pong.sql` y el mismo `insert` en `supabase/seed.sql`):

```sql
insert into public.games (id, title, short, long, category, cover, color, sort_order)
values ('pong', 'PONG', 'Gana el duelo de paletas a un rival que cada vez es más rápido.',
        'El clásico duelo de paletas contra la máquina. Devuelve la bola, juega con los ángulos y llega a siete puntos antes que tu rival. Cada partido ganado te enfrenta a una IA más veloz; cada golpe y cada punto suman al marcador.',
        'VERSUS', 'cover-pong', 'cyan', 14)
on conflict (id) do nothing;
```

Constantes y tipos (`lib/pong/constants.ts`):

```ts
export const W = 800,
  H = 600;
export const PADDLE_W = 14,
  PADDLE_H = 90,
  PADDLE_MARGIN = 30,
  PADDLE_SPEED = 480;
export const BALL_SIZE = 14,
  BALL_SPEED_START = 380,
  BALL_SPEED_STEP = 25,
  BALL_SPEED_MAX = 900;
export const MAX_BOUNCE_ANGLE = Math.PI / 3;
export const WIN_POINTS = 7,
  SERVE_DELAY = 1;
export const POINT_SCORE = 100,
  HIT_SCORE = 10,
  MATCH_BONUS = 500;
export const AI_SPEED_BASE = 220,
  AI_SPEED_STEP = 30,
  AI_SPEED_MAX = 460,
  AI_DEADZONE = 12;
export const MAX_DT = 0.05;
export const MAX_SCORE = 10_000_000;
export const BG = "#11111f";
// + FG_COLOR, NET_COLOR, PLAYER_COLOR, AI_COLOR
export type Side = "left" | "right";
export type Phase = "serve" | "playing" | "gameover";
export interface Paddle {
  y: number; // centro vertical
}
export interface Ball {
  x: number;
  y: number;
  vx: number; // px/s
  vy: number; // px/s
}
```

Motor y registro:

```ts
export class PongEngine implements GameEngine { /* start, setPaused, finish, destroy */ }

// lib/game-registry.ts
pong: {
  width: W, height: H,
  createEngine: (canvas, callbacks) => new PongEngine(canvas, callbacks),
  controls: [
    { keys: ["↑", "↓"], action: "Mover" },
    { keys: ["W", "S"], action: "Mover" },
  ],
},
```

Mapeo al HUD: `score` = puntos acumulados de la partida; `level` = número de rival (empieza en 1); `lives` = no se emite y el HUD oculta VIDAS.

Convenciones:

- Coordenadas con origen arriba a la izquierda; `y` de la paleta es su centro y se acota a `[PADDLE_H / 2, H − PADDLE_H / 2]`.
- `dt` en segundos tomado de `requestAnimationFrame`, acotado a `MAX_DT`; `lastTime` se reinicia al reanudar.
- Estado de partida en campos privados de `PongEngine`; `entities.ts` contiene funciones puras: `aiSpeed(level)`, `bounceVelocity(offset, speed, side)`, `stepBall(ball, dt)`, `hitsPaddle(ball, paddle, side)` y `clampPaddle(y)`.
- El ángulo de salida es `offset × MAX_BOUNCE_ANGLE`, con `offset ∈ [−1, 1]` según dónde toca la bola respecto al centro de la paleta.
- El movimiento se mueve con un conjunto de teclas pulsadas leídas de `keydown`/`keyup` en `window`; se ignoran eventos cuyo `target` sea un `input`.
- `onStats` se emite al cambiar `score` o `level`, no en cada frame. `onGameOver` se llama una sola vez.

## Plan de implementación

Antes del paso 1, leer en `node_modules/next/dist/docs/01-app` la referencia de Client Components y la guía de `cacheComponents`. Usar `/frontend-design` para la portada `.cover-pong` y la línea de controles. Los nombres de archivo son la propuesta de esta spec.

1. Crear la migración `20261029000000_juego_pong.sql` y aplicarla con `apply_migration`; añadir la fila en `supabase/seed.sql` con 3 puntuaciones de `PLAYERTEST` en `pong` (su mejor marca ni primera ni última) y `.cover-pong` en `app/globals.css`. Verificación: la ficha aparece en `/biblioteca` y como pestaña en `/salon`; `/juegos/pong/jugar` muestra el simulado; ejecutar el seed dos veces no duplica filas.
2. Crear `lib/pong/constants.ts`. Verificación: `npx tsc --noEmit`.
3. Crear `lib/pong/entities.ts` con las funciones puras de las convenciones. Verificación: `npx tsc --noEmit`.
4. Crear `lib/pong/engine.ts` con el núcleo: estado, loop con `requestAnimationFrame`, teclado, movimiento de la paleta del jugador y dibujo de fondo, red y paletas. Verificación: `tsc` y `npm run lint`.
5. Añadir la bola: saque, movimiento, rebote en techo y suelo, colisión con paletas y aceleración por golpe. Verificación: `tsc` y `npm run lint`.
6. Añadir la IA (seguimiento con zona muerta y velocidad por nivel), marcador, puntos, fin de partido y paso de nivel. Verificación: `tsc` y `npm run lint`.
7. Añadir `onStats`, `onGameOver`, `setPaused`, `finish` y `destroy` (quita listeners y cancela el loop). Verificación: `tsc` y `npm run lint`.
8. Registrar `pong` en `GAME_REGISTRY` con 800×600 y sus controles. Verificación: se juega en `/juegos/pong/jugar`.
9. Revisar el escalado a 1440 px y 375 px. Verificación: `npm run lint` y `npm run build`.

Cada paso deja la app funcionando.

## Criterios de aceptación

Base:

- [ ] `npm run build`, `npm run lint` y `npx tsc --noEmit` terminan sin errores.
- [ ] La ficha PONG aparece en `/biblioteca` con su portada propia y como pestaña en `/salon`.
- [ ] `/juegos/pong` y `/juegos/pong/jugar` cargan sin errores en consola ni de hidratación, ni el aviso «URL data outside of Suspense».
- [ ] PAUSA congela el juego y muestra «EN PAUSA»; REANUDAR continúa sin saltos.
- [ ] FIN abre «FIN DEL JUEGO» con la puntuación actual y deja de procesar entrada de juego.
- [ ] Se puede escribir (incluidos espacios y flechas) en el modal sin que el juego reaccione.
- [ ] Con sesión, «GUARDAR PUNTUACIÓN» crea una fila en `scores` con `game_id = 'pong'` y muestra «PUNTUACIÓN GUARDADA_»; aparece en `/salon`, y `best`/`plays` de la ficha se actualizan.
- [ ] Sin sesión, el modal muestra «INICIA SESIÓN PARA GUARDAR» con enlace a `/acceso` y no escribe en `scores`.
- [ ] «JUGAR DE NUEVO» reinicia con puntuación 0 y estado inicial.
- [ ] Al salir con SALIR o cambiar de ruta no quedan listeners de teclado ni loops activos.
- [ ] En desarrollo (Strict Mode) no hay dos motores a la vez ni teclas duplicadas.
- [ ] Con ancho de 375 px el canvas se escala sin scroll horizontal manteniendo su proporción.
- [ ] La puntuación guardada es un entero entre 0 y 10 000 000.
- [ ] Asteroids, Tetris, Arkanoid, Snake y los juegos sin entrada en `GAME_REGISTRY` se comportan como antes.

Específicos de Pong (variante 1):

- [ ] El canvas lógico mide 800×600 y muestra red central, paleta izquierda, paleta derecha y bola.
- [ ] `↑` `↓` y `W` `S` mueven la paleta del jugador sin salirse del canvas; las flechas no desplazan la página.
- [ ] La bola rebota en techo y suelo y sale de la paleta con ángulo mayor cuanto más lejos del centro golpee.
- [ ] La bola sale a 380 px/s, gana 25 px/s por golpe de paleta y nunca supera 900 px/s.
- [ ] Tras cada punto hay 1 s de pausa y la bola sale hacia quien perdió el punto con velocidad inicial.
- [ ] Marcar un punto suma 100 puntos y cada golpe de paleta del jugador suma 10.
- [ ] El marcador del canvas muestra el resultado del partido en curso.
- [ ] Llegar a 7 puntos suma 500, sube el nivel del HUD en 1 y reinicia el marcador a 0–0.
- [ ] Que el rival llegue a 7 puntos abre «FIN DEL JUEGO» con la puntuación correcta.
- [ ] La IA del nivel 2 se mueve más rápido que la del nivel 1 y nunca supera 460 px/s.
- [ ] El HUD de la plataforma oculta VIDAS en Pong y muestra PUNTOS y NIVEL.
- [ ] En pausa o con el modal abierto, las teclas no mueven la paleta.

## Decisiones

- **Sí:** ficha `pong`, categoría `VERSUS`, color `cyan`, `sort_order` 14. Es la única categoría vacía del catálogo; `cyan` está en el enum de `lib/game-types.ts` y se repite con Asteroids, que es válido. El máximo actual es 13 (Frogger, migración `20261028000000_juego_frogger.sql`).
- **Sí:** un único jugador humano contra IA. El reglamento de la plataforma exige un jugador local por partida y el ranking necesita una puntuación individual.
- **No:** segundo jugador en el mismo teclado. Rompe el sentido de la puntuación individual del leaderboard.
- **Sí:** torneo de partidos a 7 con IA creciente. Da contenido al HUD de NIVEL y una curva de dificultad sin vidas.
- **No:** partida única a 11 puntos. No genera progresión ni una puntuación comparable entre jugadores.
- **Sí:** puntuación por punto, por golpe y por partido ganado. Premia ganar puntos y también los intercambios largos.
- **Sí:** sin vidas; perder un partido termina la partida. Decisión de la variante; el HUD oculta VIDAS al no emitirse.
- **Sí:** el marcador del partido se dibuja en el canvas. No tiene equivalente en el HUD de la plataforma.
- **Sí:** canvas de 800×600. Mantiene el 4:3 de Asteroids, Arkanoid y Snake.
- **Sí:** HUD, pausa, modal y guardado de la plataforma; el canvas solo dibuja el juego.
- **No:** conservar HUD, game over o récord local del original. Duplicarían los de la plataforma.
- **No:** regenerar `database.types.ts`. Solo se inserta una fila; el esquema no cambia.

## Riesgos

| Riesgo                                                          | Mitigación                                                                                     |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Strict Mode duplica motor o listeners                           | `destroy()` cancela el loop y quita los listeners; hay criterio de aceptación                  |
| `dt` grande tras pausa o cambio de pestaña                      | `dt` acotado a `MAX_DT` y `lastTime` se reinicia al reanudar                                   |
| A 900 px/s la bola atraviesa la paleta entre dos frames         | Con `MAX_DT` = 0,05 s avanza 45 px; se hace colisión por barrido contra el borde de la paleta  |
| La IA es imbatible o trivial                                    | Velocidad acotada con `AI_SPEED_MAX` y zona muerta; se ajusta tras prueba manual               |
| Una bola casi horizontal produce intercambios eternos           | Se garantiza un ángulo mínimo de salida de 10° respecto a la horizontal                        |
| Las flechas o `Espacio` activan un botón enfocado de la plataforma | `preventDefault` solo en `↑` `↓` durante el juego y el canvas no toma el foco de teclado     |

## Qué **no** está en esta spec

- Segundo jugador humano en el mismo teclado.
- Controles táctiles específicos y gamepad.
- Sonido y música.
- Power-ups, obstáculos y otros modos.
- Selector de dificultad.
- Anti-trampas real.
- Tests automatizados.

Cada uno, si llega, va en su propia spec.
