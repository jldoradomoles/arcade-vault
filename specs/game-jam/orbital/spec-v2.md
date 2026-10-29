# SPEC 14 — Juego ORBITAL dentro de la plataforma (variante 2: reactor con combos y pulso)

> **Status:** borrador
> **Depends on:** SPEC 05, SPEC 06, SPEC 07
> **Date:** 2026-10-29
> **Objective:** Crear Orbital como motor TypeScript jugable en `/juegos/orbital/jugar`, con un escudo controlado con el ratón, flujo continuo de bolas, combos por choques entre bolas y un pulso repulsor, el HUD, la pausa y el guardado de puntuación de la plataforma y su ficha en el leaderboard.

## Por qué existe esta spec

Orbital sale del tema «Pong»: devolver bolas con una paleta, ahora en un campo circular alrededor de un núcleo. Aporta el arquetipo de defensa al catálogo en la categoría `ARCADE` con color `magenta`. No hay código de referencia: el motor y el dibujo son nuevos.

Esta variante abandona las oleadas por un flujo continuo y un sistema de combos: las bolas devueltas pueden chocar con las que aún vienen y destruirlas en cadena. Se juega con el ratón y una habilidad activa. Es una experiencia de reacción y puntería distinta del ritmo por oleadas de la variante 1.

El registro genérico ya existe desde SPEC 07. Esta spec solo añade el juego al registro; no hay refactor.

## Alcance

**Dentro:**

- Fila `orbital` en `games` (migración + `supabase/seed.sql`) y portada `.cover-orbital` en `app/globals.css`.
- Motor en `lib/orbital/` (`constants.ts`, `entities.ts`, `engine.ts`) que implementa `GameEngine`.
- Entrada `orbital` en `GAME_REGISTRY` con canvas de 800×600 y sus controles.
- Núcleo fijo en el centro con 5 vidas de energía.
- Escudo en arco de 50° que apunta siempre hacia el cursor (el ángulo es el de la recta núcleo–cursor) con un giro máximo de 9 rad/s para evitar saltos instantáneos.
- Flujo continuo: aparece una bola cada `max(0,35; 1,6 − t / 40)` s, con `t` los segundos jugados.
- Una bola devuelta sigue activa como proyectil (`returned = true`): si choca con una bola hostil, ambas explotan y suman puntos.
- Combo: cada explosión dentro de 1,5 s de la anterior aumenta el multiplicador en 1 (tope ×6); pasados 1,5 s sin explosión vuelve a ×1.
- Pulso repulsor con `Espacio` o clic: onda que empuja todas las bolas hostiles en 200 px de radio; recarga de 8 s indicada en el canvas con un anillo.
- Puntuación: 10 por devolver una bola, 50 por cada bola hostil destruida por un choque, ambas multiplicadas por el combo.
- Nivel: `1 + floor(t / 30)`; cada nivel acelera las bolas 10 px/s.
- Controles: `Ratón` apunta el escudo; `Espacio` o clic izquierdo lanza el pulso.

**Fuera de alcance (para futuras specs):**

- Oleadas con respiro y jefes.
- Más de un escudo y varios núcleos.
- Controles táctiles específicos (se aplica la derivación automática de SPEC 10, que ya traduce el arrastre del canvas en `mousemove` cuando `controls` incluye `Ratón`) y gamepad.
- Sonido y música.
- Récord local: el récord es el leaderboard.
- Anti-trampas real (ver SPEC 06).
- Tests automatizados.

## Modelo de datos

Fila del catálogo (`supabase/migrations/20261029000100_juego_orbital.sql` y el mismo `insert` en `supabase/seed.sql`):

```sql
insert into public.games (id, title, short, long, category, cover, color, sort_order)
values ('orbital', 'ORBITAL', 'Apunta tu escudo, encadena choques y protege el reactor.',
        'Un reactor en el centro, un escudo que sigue a tu ratón y un flujo sin fin de bolas hostiles. Devuélvelas contra las demás para encadenar explosiones y subir el combo; usa el pulso cuando te rodeen. Cinco impactos y se acabó.',
        'ARCADE', 'cover-orbital', 'magenta', 15)
on conflict (id) do nothing;
```

Constantes y tipos (`lib/orbital/constants.ts`):

```ts
export const W = 800,
  H = 600;
export const CX = W / 2,
  CY = H / 2;
export const CORE_RADIUS = 30,
  ARC_RADIUS = 120,
  ARC_SPAN = (50 * Math.PI) / 180,
  ARC_THICKNESS = 12,
  ARC_MAX_TURN = 9; // rad/s
export const BALL_RADIUS = 8,
  BALL_SPEED_BASE = 150,
  BALL_SPEED_PER_LEVEL = 10,
  RETURNED_SPEED_FACTOR = 1.6;
export const LIVES_START = 5;
export const SPAWN_START = 1.6,
  SPAWN_DECAY_PER_S = 1 / 40,
  SPAWN_MIN = 0.35,
  SECONDS_PER_LEVEL = 30;
export const COMBO_WINDOW = 1.5,
  COMBO_MAX = 6;
export const RETURN_SCORE = 10,
  KILL_SCORE = 50;
export const PULSE_RADIUS = 200,
  PULSE_PUSH = 260,
  PULSE_COOLDOWN = 8;
export const MAX_DT = 0.05;
export const MAX_SCORE = 10_000_000;
export const BG = "#11111f";
// + CORE_COLOR, ARC_COLOR, BALL_COLOR, RETURNED_COLOR, PULSE_COLOR
export type Phase = "playing" | "gameover";
export interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  returned: boolean; // true: proyectil del jugador, no daña al núcleo
}
```

Motor y registro:

```ts
export class OrbitalEngine implements GameEngine { /* start, setPaused, finish, destroy */ }

// lib/game-registry.ts
orbital: {
  width: W, height: H,
  createEngine: (canvas, callbacks) => new OrbitalEngine(canvas, callbacks),
  controls: [
    { keys: ["Ratón"], action: "Apuntar escudo" },
    { keys: ["Espacio"], action: "Pulso" },
  ],
},
```

Mapeo al HUD: `score` = puntos acumulados; `lives` = energía del núcleo (5 al inicio); `level` = `1 + floor(t / 30)`.

Convenciones:

- Coordenadas con origen arriba a la izquierda; el ángulo del escudo `θ` va en radianes, 0 a la derecha y creciente en sentido horario.
- `dt` en segundos tomado de `requestAnimationFrame`, acotado a `MAX_DT`; `lastTime` se reinicia al reanudar y `t` solo avanza con `dt` del loop.
- Estado en campos privados de `OrbitalEngine`; `entities.ts` contiene funciones puras: `spawnInterval(t)`, `ballSpeed(level)`, `turnToward(theta, target, maxStep)`, `hitsArc(ball, theta)`, `reflect(ball, theta)`, `ballsCollide(a, b)` y `applyPulse(balls, dt)`.
- El cursor se lee de `mousemove` en el canvas convirtiendo `clientX`/`clientY` a coordenadas lógicas con `getBoundingClientRect`; `Espacio` se lee de `keydown` en `window` y el clic de `mousedown` en el canvas. Se ignoran eventos de un `input`.
- Una bola devuelta sale con velocidad `RETURNED_SPEED_FACTOR` veces la original y sigue activa hasta chocar con otra bola o salir del canvas.
- Una explosión elimina las dos bolas implicadas y dibuja un destello de 0,2 s.
- `onStats` se emite al cambiar `score`, `lives` o `level`, no en cada frame.

## Plan de implementación

Antes del paso 1, leer en `node_modules/next/dist/docs/01-app` la referencia de Client Components y la guía de `cacheComponents`. Usar `/frontend-design` para la portada `.cover-orbital` y la línea de controles. Los nombres de archivo son la propuesta de esta spec.

1. Crear la migración `20261029000100_juego_orbital.sql` y aplicarla con `apply_migration`; añadir la fila en `supabase/seed.sql` con 3 puntuaciones de `PLAYERTEST` en `orbital` y `.cover-orbital` en `app/globals.css`. Verificación: la ficha aparece en `/biblioteca` y en `/salon`; el seed repetido no duplica filas.
2. Crear `lib/orbital/constants.ts`. Verificación: `npx tsc --noEmit`.
3. Crear `lib/orbital/entities.ts` con las funciones puras. Verificación: `npx tsc --noEmit`.
4. Crear `lib/orbital/engine.ts` con el núcleo: estado, loop, lectura de ratón, giro limitado del escudo y dibujo de fondo, núcleo y escudo. Verificación: `tsc` y `npm run lint`.
5. Añadir bolas hostiles: cadencia decreciente, movimiento recto, daño al núcleo y vidas. Verificación: `tsc` y `npm run lint`.
6. Añadir la devolución (`returned`), la colisión entre bolas, las explosiones, el combo y la puntuación. Verificación: `tsc` y `npm run lint`.
7. Añadir el pulso repulsor con recarga y su anillo indicador, y el nivel por tiempo. Verificación: `tsc` y `npm run lint`.
8. Añadir `onStats`, `onGameOver`, `setPaused`, `finish` y `destroy`. Verificación: `tsc` y `npm run lint`.
9. Registrar `orbital` en `GAME_REGISTRY` con 800×600 y sus controles. Verificación: se juega en `/juegos/orbital/jugar`.
10. Revisar escalado a 1440 px y 375 px. Verificación: `npm run lint` y `npm run build`.

Cada paso deja la app funcionando.

## Criterios de aceptación

Base:

- [ ] `npm run build`, `npm run lint` y `npx tsc --noEmit` terminan sin errores.
- [ ] La ficha ORBITAL aparece en `/biblioteca` con su portada propia y como pestaña en `/salon`.
- [ ] `/juegos/orbital` y `/juegos/orbital/jugar` cargan sin errores en consola ni de hidratación, ni el aviso «URL data outside of Suspense».
- [ ] PAUSA congela el juego y muestra «EN PAUSA»; REANUDAR continúa sin saltos.
- [ ] FIN abre «FIN DEL JUEGO» con la puntuación actual y deja de procesar entrada de juego.
- [ ] Se puede escribir (incluidos espacios y flechas) en el modal sin que el juego reaccione.
- [ ] Con sesión, «GUARDAR PUNTUACIÓN» crea una fila en `scores` con `game_id = 'orbital'` y muestra «PUNTUACIÓN GUARDADA_»; aparece en `/salon`, y `best`/`plays` de la ficha se actualizan.
- [ ] Sin sesión, el modal muestra «INICIA SESIÓN PARA GUARDAR» con enlace a `/acceso` y no escribe en `scores`.
- [ ] «JUGAR DE NUEVO» reinicia con puntuación 0 y estado inicial.
- [ ] Al salir con SALIR o cambiar de ruta no quedan listeners de teclado ni loops activos.
- [ ] En desarrollo (Strict Mode) no hay dos motores a la vez ni teclas duplicadas.
- [ ] Con ancho de 375 px el canvas se escala sin scroll horizontal manteniendo su proporción.
- [ ] La puntuación guardada es un entero entre 0 y 10 000 000.
- [ ] Asteroids, Tetris, Arkanoid, Snake y los juegos sin entrada en `GAME_REGISTRY` se comportan como antes.

Específicos de Orbital (variante 2):

- [ ] El canvas lógico mide 800×600 y muestra el núcleo en el centro y el escudo a 120 px.
- [ ] El escudo apunta hacia el cursor y no gira más de 9 rad/s aunque el cursor salte de lado.
- [ ] Las bolas hostiles aparecen en el borde sin pausa ni oleadas y su cadencia nunca baja de 0,35 s.
- [ ] Una bola hostil que alcanza el núcleo resta 1 vida y desaparece.
- [ ] Una bola devuelta con el escudo suma 10 puntos y sale más rápida que la original.
- [ ] Una bola devuelta que choca con una hostil elimina ambas, muestra un destello y suma 50 puntos.
- [ ] Dos explosiones separadas menos de 1,5 s elevan el multiplicador en 1 hasta ×6; pasado ese tiempo vuelve a ×1.
- [ ] `Espacio` y el clic izquierdo lanzan el pulso, que empuja las bolas hostiles dentro de 200 px.
- [ ] Tras un pulso no se puede lanzar otro durante 8 s y el anillo del canvas muestra la recarga.
- [ ] El nivel del HUD sube en 1 cada 30 s jugados y las bolas ganan 10 px/s por nivel.
- [ ] El tiempo en pausa no cuenta para el nivel ni para la recarga del pulso.
- [ ] Perder la quinta vida abre «FIN DEL JUEGO» con la puntuación correcta.
- [ ] El HUD de la plataforma muestra PUNTOS, VIDAS y NIVEL.
- [ ] En pausa o con el modal abierto, el ratón y `Espacio` no mueven el escudo ni lanzan el pulso.

## Decisiones

- **Sí:** ficha `orbital`, categoría `ARCADE`, color `magenta`, `sort_order` 15. Es defensa con puntería y combos; `magenta` se repite con Tetris, lo que es válido. El máximo actual es 13 (Frogger) y Pong ocupa el 14.
- **Sí:** escudo apuntado con el ratón. Es más inmediato que girar con teclas y encaja con el flujo continuo.
- **No:** teclado como entrada principal. Es la variante 1.
- **Sí:** giro máximo de 9 rad/s. Evita que el escudo teletransporte al cursor y mantiene el reto.
- **Sí:** flujo continuo con cadencia decreciente. Hace que la presión crezca sin pausas.
- **Sí:** choque entre bolas y combo. Es la mecánica distintiva que premia la planificación.
- **Sí:** pulso repulsor con recarga de 8 s. Da una salida de emergencia sin romper el equilibrio.
- **Sí:** 5 vidas. El flujo continuo es más exigente y necesita más margen.
- **Sí:** canvas de 800×600. Diferencia el formato frente a la variante 1 y da más margen al arco.
- **Sí:** HUD, pausa, modal y guardado de la plataforma; el canvas solo dibuja el juego y el anillo de recarga.
- **No:** conservar HUD, game over o récord local del original. Duplicarían los de la plataforma.
- **No:** regenerar `database.types.ts`. Solo se inserta una fila; el esquema no cambia.

## Riesgos

| Riesgo                                                          | Mitigación                                                                                       |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Strict Mode duplica motor o listeners                           | `destroy()` cancela el loop y quita los listeners; hay criterio de aceptación                    |
| `dt` grande tras pausa o cambio de pestaña                      | `dt` acotado a `MAX_DT` y `lastTime` se reinicia al reanudar                                     |
| Con muchas bolas, la comprobación entre pares es costosa        | Pocas bolas simultáneas (decenas); se compara solo `returned` contra hostiles                    |
| El pulso empuja bolas fuera de control o las hace atravesar el escudo | El empuje se aplica como velocidad radial acotada, no como teletransporte                  |
| El clic para el pulso conflictúa con el arrastre táctil         | El pulso táctil va por el botón Espacio de SPEC 10; el clic del canvas se ignora si es sintético |
| El cursor fuera del canvas deja el escudo sin objetivo          | Se conserva el último ángulo válido                                                              |
| `Espacio` activa un botón enfocado de la plataforma             | `preventDefault` solo en `Espacio` durante el juego y el canvas no toma el foco de teclado       |

## Qué **no** está en esta spec

- Oleadas con respiro y jefes.
- Más de un escudo y varios núcleos.
- Controles táctiles específicos y gamepad.
- Sonido y música.
- Anti-trampas real.
- Tests automatizados.

Cada uno, si llega, va en su propia spec.
