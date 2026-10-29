# SPEC 15 — Juego RICOCHET dentro de la plataforma (variante 1: niveles de bloques con tiros limitados)

> **Status:** borrador
> **Depends on:** SPEC 05, SPEC 06, SPEC 07
> **Date:** 2026-10-29
> **Objective:** Crear Ricochet como motor TypeScript jugable en `/juegos/ricochet/jugar`, con un cañón que dispara una bola que rebota por niveles de bloques con puntos de golpe y tiros limitados, el HUD, la pausa y el guardado de puntuación de la plataforma y su ficha en el leaderboard.

## Por qué existe esta spec

Ricochet sale del tema «Pong»: toma el rebote de la bola y lo convierte en un puzle de puntería, donde la gracia está en calcular el ángulo para que la bola rebote en las paredes y limpie los bloques con los tiros disponibles. Aporta el arquetipo de disparo y apuntar al catálogo, en la categoría `PUZZLE` con color `yellow` (ningún puzle usa amarillo todavía). No hay código de referencia: el motor, la física y los niveles son nuevos.

Esta variante es la de niveles cerrados: cada nivel es un diseño fijo de bloques, el jugador tiene un número limitado de tiros y una guía punteada le ayuda a apuntar. Es una experiencia de planificación, sin prisas.

El registro genérico ya existe desde SPEC 07. Esta spec solo añade el juego al registro; no hay refactor.

## Alcance

**Dentro:**

- Fila `ricochet` en `games` (migración + `supabase/seed.sql`) y portada `.cover-ricochet` en `app/globals.css`.
- Motor en `lib/ricochet/` (`constants.ts`, `entities.ts`, `levels.ts`, `engine.ts`) que implementa `GameEngine`.
- Entrada `ricochet` en `GAME_REGISTRY` con canvas de 800×600 y sus controles.
- Cañón fijo en el centro de la parte inferior; `←` `→` o `A` `D` ajustan el ángulo entre 15° y 165° de forma continua a 50°/s mientras se mantiene la tecla.
- Guía punteada de la trayectoria con hasta 2 rebotes de previsión.
- `Espacio` dispara una bola; mientras la bola está en juego no se puede disparar otra.
- La bola rebota en las paredes laterales y el techo; al caer por el borde inferior termina el tiro y se descuenta.
- Bloques en una cuadrícula de 12 columnas × 8 filas (celdas de 60×30 px) con puntos de golpe (1 a 5) dibujados como número; cada impacto resta 1.
- 10 niveles fijos definidos en `lib/ricochet/levels.ts` como cadenas de texto por fila; tras el nivel 10 se repite el último con +1 punto de golpe en todos los bloques.
- Cada nivel da 8 tiros; los tiros sobrantes al limpiar el nivel dan bonus.
- Puntuación: 50 por cada punto de golpe retirado y 200 por cada tiro sobrante al limpiar el nivel.
- Fin de partida al quedarse sin tiros con bloques en pantalla.
- Controles: `←` `→` o `A` `D` para apuntar y `Espacio` para disparar.

**Fuera de alcance (para futuras specs):**

- Apuntar con el ratón y volea de varias bolas (variante 2).
- Bloques especiales, bombas y power-ups.
- Editor de niveles y niveles generados.
- Controles táctiles específicos (se aplica la derivación automática de SPEC 10) y gamepad.
- Sonido y música.
- Récord local: el récord es el leaderboard.
- Anti-trampas real (ver SPEC 06).
- Tests automatizados.

## Modelo de datos

Fila del catálogo (`supabase/migrations/20261029000200_juego_ricochet.sql` y el mismo `insert` en `supabase/seed.sql`):

```sql
insert into public.games (id, title, short, long, category, cover, color, sort_order)
values ('ricochet', 'RICOCHET', 'Calcula el ángulo y limpia los bloques con un tiro tras otro.',
        'Un cañón, una bola y un muro de bloques numerados. Apunta con la guía punteada, aprovecha los rebotes en las paredes y rompe todos los bloques antes de quedarte sin tiros. Los tiros que te sobren suman puntos extra.',
        'PUZZLE', 'cover-ricochet', 'yellow', 16)
on conflict (id) do nothing;
```

Constantes y tipos (`lib/ricochet/constants.ts`):

```ts
export const W = 800,
  H = 600;
export const COLS = 12,
  ROWS = 8,
  BLOCK_W = 60,
  BLOCK_H = 30,
  BOARD_X = 40,
  BOARD_Y = 40;
export const CANNON_X = W / 2,
  CANNON_Y = H - 24,
  ANGLE_MIN = (15 * Math.PI) / 180,
  ANGLE_MAX = (165 * Math.PI) / 180,
  ANGLE_SPEED = (50 * Math.PI) / 180; // rad/s
export const BALL_RADIUS = 7,
  BALL_SPEED = 620,
  MAX_STEP = 6; // px por subpaso
export const SHOTS_PER_LEVEL = 8,
  GUIDE_BOUNCES = 2;
export const HIT_SCORE = 50,
  SPARE_SHOT_SCORE = 200;
export const MAX_DT = 0.05;
export const MAX_SCORE = 10_000_000;
export const BG = "#11111f";
// + BLOCK_COLORS (por puntos de golpe), GUIDE_COLOR, BALL_COLOR, CANNON_COLOR
export type Phase = "aim" | "flying" | "gameover";
export interface Block {
  col: number; // 0..11
  row: number; // 0..7
  hp: number; // 1..5 (o más tras repetir el último nivel)
}
```

Formato de nivel (`lib/ricochet/levels.ts`): un arreglo de 10 niveles; cada nivel es un arreglo de 8 cadenas de 12 caracteres con `.` para vacío y `1`–`5` para los puntos de golpe del bloque.

Motor y registro:

```ts
export class RicochetEngine implements GameEngine { /* start, setPaused, finish, destroy */ }

// lib/game-registry.ts
ricochet: {
  width: W, height: H,
  createEngine: (canvas, callbacks) => new RicochetEngine(canvas, callbacks),
  controls: [
    { keys: ["←", "→"], action: "Apuntar" },
    { keys: ["A", "D"], action: "Apuntar" },
    { keys: ["Espacio"], action: "Disparar" },
  ],
},
```

Mapeo al HUD: `score` = puntos acumulados; `lives` = tiros restantes del nivel (8 al empezar cada nivel); `level` = número de nivel.

Convenciones:

- Coordenadas con origen arriba a la izquierda; el ángulo `α` va en radianes medido desde el eje +x y crece hacia la izquierda (90° es vertical); el vector de disparo es `(cos α, −sin α)`.
- `dt` en segundos tomado de `requestAnimationFrame`, acotado a `MAX_DT`; `lastTime` se reinicia al reanudar. Cada frame subdivide el movimiento de la bola en pasos de como máximo `MAX_STEP` px para no atravesar bloques.
- Estado en campos privados de `RicochetEngine`; `entities.ts` contiene funciones puras: `parseLevel(rows)`, `blockRect(block)`, `reflectOnBlock(ball, rect)` (decide el eje de rebote por la menor penetración), `trace(origin, angle, blocks, bounces)` para la guía y `spareBonus(shotsLeft)`.
- Cuando la bola golpea una esquina de bloque, se refleja en un solo eje (el de menor penetración) y consume un solo punto de golpe.
- Si la bola queda atrapada rebotando más de 40 veces en un tiro, se da por terminado el tiro para evitar bucles.
- `onStats` se emite al cambiar `score`, `lives` o `level`, no en cada frame.

## Plan de implementación

Antes del paso 1, leer en `node_modules/next/dist/docs/01-app` la referencia de Client Components y la guía de `cacheComponents`. Usar `/frontend-design` para la portada `.cover-ricochet` y la línea de controles. Los nombres de archivo son la propuesta de esta spec.

1. Crear la migración `20261029000200_juego_ricochet.sql` y aplicarla con `apply_migration`; añadir la fila en `supabase/seed.sql` con 3 puntuaciones de `PLAYERTEST` en `ricochet` y `.cover-ricochet` en `app/globals.css`. Verificación: la ficha aparece en `/biblioteca` y en `/salon`; el seed repetido no duplica filas.
2. Crear `lib/ricochet/constants.ts`. Verificación: `npx tsc --noEmit`.
3. Crear `lib/ricochet/levels.ts` con los 10 niveles. Verificación: `npx tsc --noEmit` y cada nivel tiene 8 filas de 12 caracteres.
4. Crear `lib/ricochet/entities.ts` con las funciones puras. Verificación: `npx tsc --noEmit`.
5. Crear `lib/ricochet/engine.ts` con el núcleo: estado, loop, teclado, giro del cañón y dibujo de fondo, bloques y cañón. Verificación: `tsc` y `npm run lint`.
6. Añadir la guía punteada con previsión de 2 rebotes. Verificación: `tsc` y `npm run lint`.
7. Añadir el disparo, la bola en vuelo, los rebotes en paredes y techo, y la caída por el borde inferior. Verificación: `tsc` y `npm run lint`.
8. Añadir impactos en bloques, puntos de golpe, puntuación y el límite de rebotes. Verificación: `tsc` y `npm run lint`.
9. Añadir niveles: carga, tiros por nivel, bonus por tiros sobrantes, repetición del último nivel y fin de partida. Verificación: `tsc` y `npm run lint`.
10. Añadir `onStats`, `onGameOver`, `setPaused`, `finish` y `destroy`; registrar `ricochet` en `GAME_REGISTRY` con 800×600. Verificación: se juega en `/juegos/ricochet/jugar`.
11. Revisar escalado a 1440 px y 375 px. Verificación: `npm run lint` y `npm run build`.

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

Específicos de Ricochet (variante 1):

- [ ] El canvas lógico mide 800×600 y muestra el cañón abajo en el centro y una cuadrícula de bloques arriba.
- [ ] `←` `→` y `A` `D` giran el cañón entre 15° y 165° sin salir de ese rango; las flechas y `Espacio` no desplazan la página.
- [ ] La guía punteada muestra la trayectoria con hasta 2 rebotes y se actualiza al girar el cañón.
- [ ] `Espacio` dispara una bola y no se puede disparar otra hasta que la primera cae por el borde inferior.
- [ ] La bola rebota en las paredes laterales y el techo sin perder velocidad.
- [ ] Cada impacto resta 1 punto de golpe al bloque, el número se actualiza y el bloque desaparece al llegar a 0.
- [ ] Cada punto de golpe retirado suma 50 puntos.
- [ ] El HUD muestra 8 tiros al empezar el nivel y resta 1 al disparar.
- [ ] Limpiar todos los bloques suma 200 por cada tiro sobrante, sube el nivel y carga el siguiente diseño con 8 tiros.
- [ ] Tras el nivel 10 se repite el último con +1 punto de golpe en todos los bloques.
- [ ] Quedarse sin tiros con bloques en pantalla abre «FIN DEL JUEGO» con la puntuación correcta.
- [ ] La bola nunca atraviesa un bloque a velocidad normal.
- [ ] Un tiro que supera 40 rebotes se da por terminado sin colgar el juego.
- [ ] El HUD de la plataforma muestra PUNTOS, VIDAS (tiros restantes) y NIVEL.
- [ ] En pausa o con el modal abierto, las teclas no giran el cañón ni disparan.

## Decisiones

- **Sí:** ficha `ricochet`, categoría `PUZZLE`, color `yellow`, `sort_order` 16. Es disparo y puntería con planificación, y ningún puzle usa amarillo todavía. El máximo actual es 13 (Frogger); Pong ocupa 14 y Orbital 15.
- **Sí:** niveles fijos con tiros limitados. Convierten el rebote en un puzle con solución planificable.
- **No:** niveles generados al azar. Hacen imposible garantizar que el nivel tenga solución con los tiros dados.
- **Sí:** guía punteada con 2 rebotes. Hace el puzle justo y legible sin regalar la solución completa.
- **Sí:** teclado para apuntar. Mantiene la variante autosuficiente sin ratón; el ratón es la variante 2.
- **Sí:** `lives` = tiros restantes. Reutiliza el campo del HUD que más se acerca y evita un contador propio en el canvas.
- **Sí:** bonus por tiros sobrantes. Recompensa la eficiencia, que es el núcleo del puzle.
- **Sí:** repetir el último nivel con +1 punto de golpe. Evita un fin artificial y da una puntuación sin techo práctico.
- **Sí:** canvas de 800×600. Mantiene el 4:3 de Asteroids, Arkanoid y Snake.
- **Sí:** HUD, pausa, modal y guardado de la plataforma; el canvas solo dibuja el juego.
- **No:** conservar HUD, game over o récord local del original. Duplicarían los de la plataforma.
- **No:** regenerar `database.types.ts`. Solo se inserta una fila; el esquema no cambia.

## Riesgos

| Riesgo                                                          | Mitigación                                                                                          |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Strict Mode duplica motor o listeners                           | `destroy()` cancela el loop y quita los listeners; hay criterio de aceptación                       |
| `dt` grande tras pausa o cambio de pestaña                      | `dt` acotado a `MAX_DT` y `lastTime` se reinicia al reanudar                                        |
| La bola atraviesa un bloque a 620 px/s                          | Subpasos de como máximo `MAX_STEP` = 6 px por actualización de posición                             |
| Rebote incorrecto en esquinas de bloque                         | Se elige el eje de menor penetración y se consume un solo punto de golpe                            |
| Un nivel sin solución con 8 tiros                              | Cada nivel se prueba a mano antes de cerrar el paso 3 y se ajustan puntos de golpe si hace falta    |
| Tiro casi horizontal que no baja nunca                          | El ángulo mínimo de 15° y el límite de 40 rebotes terminan el tiro                                  |
| `Espacio` o las flechas activan un botón enfocado               | `preventDefault` solo en `←` `→` y `Espacio` durante el juego y el canvas no toma el foco           |

## Qué **no** está en esta spec

- Apuntar con el ratón y volea de varias bolas.
- Bloques especiales, bombas y power-ups.
- Editor de niveles y niveles generados.
- Controles táctiles específicos y gamepad.
- Sonido y música.
- Anti-trampas real.
- Tests automatizados.

Cada uno, si llega, va en su propia spec.
