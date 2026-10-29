# SPEC 15 — Juego RICOCHET dentro de la plataforma (variante 2: volea infinita con bloques que descienden)

> **Status:** borrador
> **Depends on:** SPEC 05, SPEC 06, SPEC 07
> **Date:** 2026-10-29
> **Objective:** Crear Ricochet como motor TypeScript jugable en `/juegos/ricochet/jugar`, con apuntado con el ratón, voleas de varias bolas y bloques que descienden una fila por turno hasta una línea límite, el HUD, la pausa y el guardado de puntuación de la plataforma y su ficha en el leaderboard.

## Por qué existe esta spec

Ricochet sale del tema «Pong»: toma el rebote de la bola y lo convierte en un juego de puntería y planificación. Aporta el arquetipo de disparo y apuntar al catálogo, en la categoría `PUZZLE` con color `yellow`. No hay código de referencia: el motor, la física y la generación de filas son nuevos.

Esta variante abandona los niveles cerrados por una partida infinita: cada turno el jugador lanza una volea de varias bolas y, al terminar, los bloques bajan una fila y aparece una nueva arriba. Dura mientras el jugador consiga frenar el descenso. Se juega con el ratón, en formato vertical, y es la versión más dinámica del concepto.

El registro genérico ya existe desde SPEC 07. Esta spec solo añade el juego al registro; no hay refactor.

## Alcance

**Dentro:**

- Fila `ricochet` en `games` (migración + `supabase/seed.sql`) y portada `.cover-ricochet` en `app/globals.css`.
- Motor en `lib/ricochet/` (`constants.ts`, `entities.ts`, `engine.ts`) que implementa `GameEngine`.
- Entrada `ricochet` en `GAME_REGISTRY` con canvas vertical de 480×640 y sus controles.
- Tablero de 8 columnas de bloques cuadrados de 56 px con 4 px de separación; la zona de bloques ocupa hasta la línea límite situada 80 px por encima del suelo.
- El cañón se sitúa en el suelo, en la `x` donde cayó la primera bola de la volea anterior (al inicio, en el centro).
- Se apunta con el ratón: la guía punteada sigue al cursor con un único rebote de previsión; `clic` o `Espacio` lanzan la volea.
- Una volea lanza `N` bolas una tras otra cada 80 ms, donde `N` es el número de bolas actual (empieza en 1).
- Cada bola rebota en paredes y techo, y se recoge al tocar el suelo.
- Los bloques tienen puntos de golpe iguales al número de turno en el que nacieron (con una variación de ±1); cada impacto resta 1.
- Cada fila nueva trae entre 2 y 5 bloques y, con un 60 % de probabilidad, una esfera `+1` que al tocarla añade una bola a la volea.
- Al terminar la volea los bloques bajan una fila; si algún bloque toca la línea límite, termina la partida.
- Puntuación: 10 por cada punto de golpe retirado y 100 por cada fila completa eliminada sin dejar bloques.
- Nivel: número de turno jugado.
- Controles: `Ratón` apunta, `clic` o `Espacio` lanzan.

**Fuera de alcance (para futuras specs):**

- Niveles fijos y tiros limitados (variante 1).
- Bloques especiales, bombas y rayos láser.
- Controles táctiles específicos (se aplica la derivación automática de SPEC 10, que ya traduce el arrastre del canvas en `mousemove`) y gamepad.
- Sonido y música.
- Récord local: el récord es el leaderboard.
- Anti-trampas real (ver SPEC 06).
- Tests automatizados.

## Modelo de datos

Fila del catálogo (`supabase/migrations/20261029000200_juego_ricochet.sql` y el mismo `insert` en `supabase/seed.sql`):

```sql
insert into public.games (id, title, short, long, category, cover, color, sort_order)
values ('ricochet', 'RICOCHET', 'Lanza voleas de bolas y frena el avance de los bloques.',
        'Apunta con el ratón y lanza una volea de bolas contra los bloques que bajan sin parar. Recoge esferas para sumar bolas y no dejes que ningún bloque toque la línea del suelo. Cuantos más turnos aguantes, más puntos.',
        'PUZZLE', 'cover-ricochet', 'yellow', 16)
on conflict (id) do nothing;
```

Constantes y tipos (`lib/ricochet/constants.ts`):

```ts
export const W = 480,
  H = 640;
export const COLS = 8,
  BLOCK_SIZE = 56,
  BLOCK_GAP = 4,
  BOARD_X = 4,
  BOARD_Y = 40,
  ROW_STEP = 60,
  LIMIT_Y = H - 80;
export const BALL_RADIUS = 6,
  BALL_SPEED = 720,
  MAX_STEP = 5, // px por subpaso
  LAUNCH_INTERVAL = 0.08,
  ANGLE_MIN_DEG = 8;
export const START_BALLS = 1,
  ROW_MIN_BLOCKS = 2,
  ROW_MAX_BLOCKS = 5,
  PICKUP_CHANCE = 0.6;
export const HIT_SCORE = 10,
  CLEAR_ROW_SCORE = 100;
export const MAX_DT = 0.05;
export const MAX_SCORE = 10_000_000;
export const BG = "#11111f";
// + BLOCK_COLORS (por tramos de hp), GUIDE_COLOR, BALL_COLOR, PICKUP_COLOR
export type Phase = "aim" | "firing" | "advance" | "gameover";
export interface Block {
  col: number; // 0..7
  row: number; // 0 es la fila superior; crece al descender
  hp: number;
}
export interface Pickup {
  col: number;
  row: number;
}
export interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
}
```

Motor y registro:

```ts
export class RicochetEngine implements GameEngine { /* start, setPaused, finish, destroy */ }

// lib/game-registry.ts
ricochet: {
  width: W, height: H,
  createEngine: (canvas, callbacks) => new RicochetEngine(canvas, callbacks),
  controls: [
    { keys: ["Ratón"], action: "Apuntar" },
    { keys: ["Espacio"], action: "Lanzar" },
  ],
},
```

Mapeo al HUD: `score` = puntos acumulados; `level` = número de turno; `lives` = no se emite y el HUD oculta VIDAS.

Convenciones:

- Coordenadas con origen arriba a la izquierda; el bloque `(col, row)` ocupa `x = BOARD_X + col·(BLOCK_SIZE + BLOCK_GAP)` y `y = BOARD_Y + row·ROW_STEP`.
- `dt` en segundos tomado de `requestAnimationFrame`, acotado a `MAX_DT`; `lastTime` se reinicia al reanudar. Cada frame subdivide el movimiento de cada bola en pasos de como máximo `MAX_STEP` px.
- Estado en campos privados de `RicochetEngine`; `entities.ts` contiene funciones puras: `newRow(turn, rand)`, `blockRect(block)`, `reflectOnBlock(ball, rect)`, `aimAngle(origin, cursor)` (acotado por `ANGLE_MIN_DEG` respecto a la horizontal), `trace(origin, angle, blocks, bounces)` y `reachedLimit(blocks)`.
- El cursor se lee de `mousemove` en el canvas convirtiendo `clientX`/`clientY` con `getBoundingClientRect`; el clic, de `mousedown` en el canvas; `Espacio`, de `keydown` en `window`. Se ignoran los eventos de un `input`.
- La volea acaba cuando todas las bolas han sido lanzadas y recogidas; entonces pasa a la fase `advance`, que baja los bloques una fila con una animación de 0,2 s antes de aceptar un nuevo disparo.
- Para evitar que una bola quede rebotando indefinidamente, tras 20 s de volea todas las bolas se recogen en el suelo.
- `onStats` se emite al cambiar `score` o `level`, no en cada frame.

## Plan de implementación

Antes del paso 1, leer en `node_modules/next/dist/docs/01-app` la referencia de Client Components y la guía de `cacheComponents`. Usar `/frontend-design` para la portada `.cover-ricochet` y la línea de controles. Los nombres de archivo son la propuesta de esta spec.

1. Crear la migración `20261029000200_juego_ricochet.sql` y aplicarla con `apply_migration`; añadir la fila en `supabase/seed.sql` con 3 puntuaciones de `PLAYERTEST` en `ricochet` y `.cover-ricochet` en `app/globals.css`. Verificación: la ficha aparece en `/biblioteca` y en `/salon`; el seed repetido no duplica filas.
2. Crear `lib/ricochet/constants.ts`. Verificación: `npx tsc --noEmit`.
3. Crear `lib/ricochet/entities.ts` con las funciones puras. Verificación: `npx tsc --noEmit`.
4. Crear `lib/ricochet/engine.ts` con el núcleo: estado, loop, lectura de ratón, cañón, dibujo de fondo, línea límite y bloques. Verificación: `tsc` y `npm run lint`.
5. Añadir la guía punteada con un rebote de previsión y el cálculo del ángulo mínimo. Verificación: `tsc` y `npm run lint`.
6. Añadir la volea: lanzamiento escalonado, rebotes en paredes y techo, recogida en el suelo y nueva posición del cañón. Verificación: `tsc` y `npm run lint`.
7. Añadir impactos en bloques, puntos de golpe, puntuación y subpasos de colisión. Verificación: `tsc` y `npm run lint`.
8. Añadir la fase `advance`: descenso de una fila, filas nuevas, esferas `+1` y fin de partida al tocar la línea límite. Verificación: `tsc` y `npm run lint`.
9. Añadir `onStats`, `onGameOver`, `setPaused`, `finish` y `destroy`. Verificación: `tsc` y `npm run lint`.
10. Registrar `ricochet` en `GAME_REGISTRY` con 480×640 y sus controles. Verificación: se juega en `/juegos/ricochet/jugar`.
11. Revisar escalado a 1440 px y 375 px, con atención al formato vertical. Verificación: `npm run lint` y `npm run build`.

Cada paso deja la app funcionando.

## Criterios de aceptación

Base:

- [ ] `npm run build`, `npm run lint` y `npx tsc --noEmit` terminan sin errores.
- [ ] La ficha RICOCHET aparece en `/biblioteca` con su portada propia y como pestaña en `/salon`.
- [ ] `/juegos/ricochet` y `/juegos/ricochet/jugar` cargan sin errores en consola ni de hidratación, ni el aviso «URL data outside of Suspense».
- [ ] PAUSA congela el juego y muestra «EN PAUSA»; REANUDAR continúa sin saltos.
- [ ] FIN abre «FIN DEL JUEGO» con la puntuación actual y deja de procesar entrada de juego.
- [ ] Se puede escribir (incluidos espacios y flechas) en el modal sin que el juego reaccione.
- [ ] Con sesión, «GUARDAR PUNTUACIÓN» crea una fila en `scores` con `game_id = 'ricochet'` y muestra «PUNTUACIÓN GUARDADA_»; aparece en `/salon`, y `best`/`plays` de la ficha se actualizan.
- [ ] Sin sesión, el modal muestra «INICIA SESIÓN PARA GUARDAR» con enlace a `/acceso` y no escribe en `scores`.
- [ ] «JUGAR DE NUEVO» reinicia con puntuación 0 y estado inicial.
- [ ] Al salir con SALIR o cambiar de ruta no quedan listeners de teclado ni loops activos.
- [ ] En desarrollo (Strict Mode) no hay dos motores a la vez ni teclas duplicadas.
- [ ] Con ancho de 375 px el canvas se escala sin scroll horizontal manteniendo su proporción.
- [ ] La puntuación guardada es un entero entre 0 y 10 000 000.
- [ ] Asteroids, Tetris, Arkanoid, Snake y los juegos sin entrada en `GAME_REGISTRY` se comportan como antes.

Específicos de Ricochet (variante 2):

- [ ] El canvas lógico mide 480×640 (proporción vertical) y muestra los bloques arriba, la línea límite y el cañón en el suelo.
- [ ] La guía punteada sigue al cursor, muestra un rebote y nunca apunta a menos de 8° de la horizontal.
- [ ] Clic y `Espacio` lanzan la volea; las flechas y `Espacio` no desplazan la página.
- [ ] Una volea lanza las bolas de una en una cada 80 ms.
- [ ] La primera volea tiene 1 bola y cada esfera `+1` recogida añade una bola a las siguientes.
- [ ] Las bolas rebotan en paredes y techo, y se recogen al tocar el suelo.
- [ ] El cañón se mueve a la `x` donde cayó la primera bola de la volea anterior.
- [ ] Cada impacto resta 1 punto de golpe y suma 10 puntos; el bloque desaparece al llegar a 0.
- [ ] Al terminar la volea los bloques bajan una fila y aparece una fila nueva con entre 2 y 5 bloques.
- [ ] Eliminar todos los bloques de una fila suma 100 puntos.
- [ ] Un bloque que toca la línea límite abre «FIN DEL JUEGO» con la puntuación correcta.
- [ ] El nivel del HUD aumenta en 1 con cada turno y no se puede lanzar mientras haya una volea o animación en curso.
- [ ] La bola nunca atraviesa un bloque y una volea que supera 20 s se recoge sola.
- [ ] El HUD de la plataforma oculta VIDAS en Ricochet y muestra PUNTOS y NIVEL.
- [ ] En pausa o con el modal abierto, el ratón y `Espacio` no lanzan la volea.

## Decisiones

- **Sí:** ficha `ricochet`, categoría `PUZZLE`, color `yellow`, `sort_order` 16. Es disparo y puntería con planificación y ningún puzle usa amarillo todavía. El máximo actual es 13 (Frogger); Pong ocupa 14 y Orbital 15.
- **Sí:** bloques que descienden con voleas. Crea una tensión constante y una partida sin fin natural, distinta de los niveles cerrados de la variante 1.
- **No:** niveles fijos y tiros limitados. Es la variante 1.
- **Sí:** ratón para apuntar y `Espacio` como alternativa. La precisión del ratón es clave en un juego de ángulos; `Ratón` en `controls` activa el arrastre táctil de SPEC 10 en móvil.
- **Sí:** canvas vertical de 480×640. Diferencia el formato frente a la variante 1 y casa con el descenso de bloques.
- **Sí:** esferas `+1` y voleas crecientes. Dan la progresión de poder del jugador contra la presión de las filas.
- **Sí:** sin vidas; la partida termina cuando los bloques tocan la línea. El HUD oculta VIDAS al no emitirse.
- **Sí:** tope de 20 s por volea. Evita que una bola atrapada deje el juego bloqueado.
- **Sí:** HUD, pausa, modal y guardado de la plataforma; el canvas solo dibuja el juego.
- **No:** conservar HUD, game over o récord local del original. Duplicarían los de la plataforma.
- **No:** regenerar `database.types.ts`. Solo se inserta una fila; el esquema no cambia.

## Riesgos

| Riesgo                                                          | Mitigación                                                                                          |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Strict Mode duplica motor o listeners                           | `destroy()` cancela el loop y quita los listeners; hay criterio de aceptación                       |
| `dt` grande tras pausa o cambio de pestaña                      | `dt` acotado a `MAX_DT` y `lastTime` se reinicia al reanudar                                        |
| Con muchas bolas, el coste de colisión por frame sube           | Se prueba solo contra los bloques de la celda y vecinas; el número de bolas crece despacio          |
| Una bola atrapada en un ciclo de rebotes bloquea la volea       | Ángulo mínimo de 8° y recogida automática tras 20 s                                                 |
| La bola atraviesa un bloque a 720 px/s                          | Subpasos de como máximo `MAX_STEP` = 5 px                                                           |
| La partida se vuelve imposible demasiado pronto                 | Los puntos de golpe crecen con el turno y las esferas +1 aparecen con 60 %; se ajusta tras prueba   |
| El clic del canvas se confunde con el arrastre táctil           | El lanzamiento táctil va por el botón Espacio de SPEC 10; el clic solo se acepta con ratón real     |
| `Espacio` activa un botón enfocado de la plataforma             | `preventDefault` solo en `Espacio` durante el juego y el canvas no toma el foco de teclado          |

## Qué **no** está en esta spec

- Niveles fijos y tiros limitados.
- Bloques especiales, bombas y rayos láser.
- Controles táctiles específicos y gamepad.
- Sonido y música.
- Anti-trampas real.
- Tests automatizados.

Cada uno, si llega, va en su propia spec.
