# SPEC 13 — Juego PONG dentro de la plataforma (variante 2: squash contra la pared)

> **Status:** borrador
> **Depends on:** SPEC 05, SPEC 06, SPEC 07
> **Date:** 2026-10-29
> **Objective:** Crear Pong como motor TypeScript jugable en `/juegos/pong/jugar`, en formato de un solo jugador contra una pared, con ratón o teclado, vidas, multiplicador de racha y cápsulas de poder, el HUD, la pausa y el guardado de puntuación de la plataforma y su ficha en el leaderboard.

## Por qué existe esta spec

Pong es el clásico fundacional de los videojuegos y la primera sugerencia del backlog (`references/game-suggestions-todo.md`). Cubre la única categoría vacía del catálogo, `VERSUS`. No hay código de referencia: el motor y el dibujo son nuevos.

Esta variante reinterpreta Pong como el «Pong de un jugador» de las recreativas: la paleta se enfrenta a una pared que devuelve la bola. No hay rival, sino una carrera por mantener la racha más larga sin perder las 3 vidas. Es una experiencia de reflejos y precisión muy distinta del duelo de la variante 1.

El registro genérico ya existe desde SPEC 07. Esta spec solo añade el juego al registro; no hay refactor.

## Alcance

**Dentro:**

- Fila `pong` en `games` (migración + `supabase/seed.sql`) y portada `.cover-pong` en `app/globals.css`.
- Motor en `lib/pong/` (`constants.ts`, `entities.ts`, `engine.ts`) que implementa `GameEngine`.
- Entrada `pong` en `GAME_REGISTRY` con canvas de 640×480 y sus controles.
- Paleta vertical a la izquierda y pared maciza a la derecha; la bola rebota en techo, suelo y pared.
- Control con ratón (la paleta sigue la `y` del cursor) y con teclado (`↑` `↓` o `W` `S`).
- 3 vidas: dejar pasar la bola por el lado izquierdo resta una vida y la bola vuelve a sacar tras 1 s.
- Puntuación: 10 por cada devolución multiplicados por el multiplicador de racha, que vale `1 + floor(racha / 5)` con tope 5.
- La racha cuenta devoluciones seguidas y vuelve a 0 al perder una vida.
- Nivel: `1 + floor(devoluciones / 15)`; cada nivel sube la velocidad base de la bola 30 px/s hasta 720 px/s.
- Cápsulas de poder: cada 8 devoluciones aparece una en la mitad derecha del campo durante 6 s; al tocarla con la bola activa un efecto: `ANCHA` (paleta ×1,5 durante 8 s), `LENTA` (bola −30 % durante 6 s) o `VIDA` (+1 vida, máximo 5).
- Aspecto vectorial: campo oscuro, paleta y bola con colores de la plataforma, cápsulas con letra identificativa.

**Fuera de alcance (para futuras specs):**

- Rival de IA y segundo jugador.
- Controles táctiles específicos (se aplica la derivación automática de SPEC 10, que ya traduce el arrastre en el canvas cuando `controls` incluye `Ratón`) y gamepad.
- Sonido y música.
- Más tipos de cápsula y obstáculos.
- Récord local: el récord es el leaderboard.
- Anti-trampas real (ver SPEC 06).
- Tests automatizados.

## Modelo de datos

Fila del catálogo (`supabase/migrations/20261029000000_juego_pong.sql` y el mismo `insert` en `supabase/seed.sql`):

```sql
insert into public.games (id, title, short, long, category, cover, color, sort_order)
values ('pong', 'PONG', 'Devuelve la bola contra la pared y encadena la racha más larga.',
        'El Pong de las recreativas en solitario: una paleta, una pared y una bola cada vez más rápida. Encadena devoluciones para subir el multiplicador, atrapa las cápsulas de poder y no pierdas tus tres vidas.',
        'VERSUS', 'cover-pong', 'cyan', 14)
on conflict (id) do nothing;
```

Constantes y tipos (`lib/pong/constants.ts`):

```ts
export const W = 640,
  H = 480;
export const PADDLE_W = 12,
  PADDLE_H = 80,
  PADDLE_X = 24,
  PADDLE_SPEED = 460;
export const BALL_SIZE = 12,
  BALL_SPEED_BASE = 360,
  BALL_SPEED_PER_LEVEL = 30,
  BALL_SPEED_MAX = 720;
export const MAX_BOUNCE_ANGLE = Math.PI / 3;
export const LIVES_START = 3,
  LIVES_MAX = 5,
  SERVE_DELAY = 1;
export const HIT_SCORE = 10,
  STREAK_STEP = 5,
  MULTIPLIER_MAX = 5,
  HITS_PER_LEVEL = 15;
export const CAPSULE_EVERY_HITS = 8,
  CAPSULE_LIFETIME = 6,
  WIDE_FACTOR = 1.5,
  WIDE_DURATION = 8,
  SLOW_FACTOR = 0.7,
  SLOW_DURATION = 6;
export const MAX_DT = 0.05;
export const MAX_SCORE = 10_000_000;
export const BG = "#11111f";
// + WALL_COLOR, PADDLE_COLOR, BALL_COLOR, CAPSULE_COLORS
export type Phase = "serve" | "playing" | "gameover";
export type CapsuleKind = "wide" | "slow" | "life";
export interface Capsule {
  kind: CapsuleKind;
  x: number;
  y: number;
  ttl: number; // segundos restantes
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
    { keys: ["Ratón"], action: "Mover paleta" },
    { keys: ["↑", "↓"], action: "Mover" },
    { keys: ["W", "S"], action: "Mover" },
  ],
},
```

Mapeo al HUD: `score` = puntos acumulados; `lives` = vidas restantes (3 al inicio, máximo 5); `level` = `1 + floor(devoluciones / 15)`.

Convenciones:

- Coordenadas con origen arriba a la izquierda; la pared ocupa `x ≥ W − BALL_SIZE`.
- `dt` en segundos tomado de `requestAnimationFrame`, acotado a `MAX_DT`; `lastTime` se reinicia al reanudar.
- Estado en campos privados de `PongEngine`; `entities.ts` contiene funciones puras: `ballSpeed(level, slowActive)`, `multiplier(streak)`, `bounceVelocity(offset, speed)`, `pickCapsuleKind(rand)` y `clampPaddle(y, height)`.
- El ratón se lee de `mousemove` sobre el canvas convirtiendo `clientY` a coordenadas lógicas con `getBoundingClientRect`; el teclado, de `keydown`/`keyup` en `window`. La última entrada usada manda; los eventos de un `input` se ignoran.
- Un único efecto de cada tipo puede estar activo; recoger otro igual reinicia su temporizador.
- `onStats` se emite al cambiar `score`, `lives` o `level`, no en cada frame.

## Plan de implementación

Antes del paso 1, leer en `node_modules/next/dist/docs/01-app` la referencia de Client Components y la guía de `cacheComponents`. Usar `/frontend-design` para la portada `.cover-pong` y la línea de controles. Los nombres de archivo son la propuesta de esta spec.

1. Crear la migración `20261029000000_juego_pong.sql` y aplicarla con `apply_migration`; añadir la fila en `supabase/seed.sql` con 3 puntuaciones de `PLAYERTEST` en `pong` y `.cover-pong` en `app/globals.css`. Verificación: la ficha aparece en `/biblioteca` y en `/salon`; ejecutar el seed dos veces no duplica filas.
2. Crear `lib/pong/constants.ts`. Verificación: `npx tsc --noEmit`.
3. Crear `lib/pong/entities.ts` con las funciones puras. Verificación: `npx tsc --noEmit`.
4. Crear `lib/pong/engine.ts` con el núcleo: estado, loop, entrada de ratón y teclado y dibujo de campo, pared y paleta. Verificación: `tsc` y `npm run lint`.
5. Añadir bola, saque, rebotes, devolución con ángulo, pérdida de vida y fase `gameover`. Verificación: `tsc` y `npm run lint`.
6. Añadir racha, multiplicador, puntuación y niveles con velocidad creciente. Verificación: `tsc` y `npm run lint`.
7. Añadir cápsulas: aparición cada 8 devoluciones, caducidad, recogida y efectos con temporizadores. Verificación: `tsc` y `npm run lint`.
8. Añadir `onStats`, `onGameOver`, `setPaused`, `finish` y `destroy` (quita listeners y cancela el loop). Verificación: `tsc` y `npm run lint`.
9. Registrar `pong` en `GAME_REGISTRY` con 640×480 y sus controles. Verificación: se juega en `/juegos/pong/jugar`.
10. Revisar escalado a 1440 px y 375 px. Verificación: `npm run lint` y `npm run build`.

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

Específicos de Pong (variante 2):

- [ ] El canvas lógico mide 640×480 y muestra paleta a la izquierda y pared maciza a la derecha.
- [ ] La paleta sigue la altura del cursor dentro del canvas sin salirse de él.
- [ ] `↑` `↓` y `W` `S` mueven la paleta y las flechas no desplazan la página.
- [ ] La bola rebota en techo, suelo y pared, y sale de la paleta con ángulo según el punto de impacto.
- [ ] Empieza con 3 vidas y dejar pasar la bola resta una y saca de nuevo tras 1 s.
- [ ] Cada devolución suma 10 puntos multiplicados por `1 + floor(racha / 5)`, con tope ×5.
- [ ] Perder una vida pone la racha y el multiplicador a 1.
- [ ] El nivel del HUD sube en 1 cada 15 devoluciones y la bola base gana 30 px/s sin superar 720 px/s.
- [ ] Cada 8 devoluciones aparece una cápsula que desaparece a los 6 s si nadie la toca.
- [ ] La cápsula `ANCHA` agranda la paleta ×1,5 durante 8 s; `LENTA` reduce la bola un 30 % durante 6 s; `VIDA` suma 1 vida sin pasar de 5.
- [ ] Perder la última vida abre «FIN DEL JUEGO» con la puntuación correcta.
- [ ] El HUD de la plataforma muestra PUNTOS, VIDAS y NIVEL.
- [ ] En pausa o con el modal abierto, el ratón y las teclas no mueven la paleta.

## Decisiones

- **Sí:** ficha `pong`, categoría `VERSUS`, color `cyan`, `sort_order` 14. Es la única categoría vacía; el enfrentamiento es contra la pared (modo «solitario» de las recreativas) y se mantiene en `VERSUS` por ser Pong. El máximo actual es 13 (Frogger).
- **Sí:** pared en lugar de rival. Elimina la IA y convierte la puntuación en una medida directa de habilidad.
- **No:** rival de IA. Es la variante 1 y esta debe ser una experiencia distinta.
- **Sí:** ratón y teclado. El ratón da precisión y el teclado mantiene la jugabilidad en escritorio sin ratón; `Ratón` en `controls` activa el arrastre táctil de SPEC 10 en móvil.
- **Sí:** 3 vidas y multiplicador de racha. Da contenido a los tres campos del HUD y premia la regularidad.
- **Sí:** cápsulas de poder con tres efectos. Rompe la monotonía sin ampliar demasiado el alcance.
- **No:** más tipos de cápsula. Aumentan la superficie de pruebas sin cambiar el concepto.
- **Sí:** canvas de 640×480. Cambia el formato frente a la variante 1 y reduce la distancia que recorre la bola, lo que acelera el ritmo.
- **Sí:** HUD, pausa, modal y guardado de la plataforma; el canvas solo dibuja el juego.
- **No:** conservar HUD, game over o récord local del original. Duplicarían los de la plataforma.
- **No:** regenerar `database.types.ts`. Solo se inserta una fila; el esquema no cambia.

## Riesgos

| Riesgo                                                       | Mitigación                                                                                   |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| Strict Mode duplica motor o listeners                        | `destroy()` cancela el loop y quita los listeners; hay criterio de aceptación                |
| `dt` grande tras pausa o cambio de pestaña                   | `dt` acotado a `MAX_DT` y `lastTime` se reinicia al reanudar                                 |
| El cursor sale del canvas y la paleta queda congelada        | La paleta conserva la última `y` válida; el teclado sigue funcionando                        |
| Mezclar ratón y teclado produce saltos de la paleta          | La última entrada usada manda y el teclado parte de la `y` actual de la paleta               |
| Los temporizadores de efectos siguen contando en pausa       | Los temporizadores se descuentan con `dt` del loop, que no avanza en pausa                   |
| La bola atraviesa la paleta a velocidad alta                 | Colisión por barrido contra el borde de la paleta y velocidad máxima de 720 px/s             |
| `Espacio` o las flechas activan un botón enfocado            | `preventDefault` solo en `↑` `↓` durante el juego y el canvas no toma el foco de teclado     |

## Qué **no** está en esta spec

- Rival de IA y segundo jugador.
- Controles táctiles específicos y gamepad.
- Sonido y música.
- Más tipos de cápsula y obstáculos.
- Anti-trampas real.
- Tests automatizados.

Cada uno, si llega, va en su propia spec.
