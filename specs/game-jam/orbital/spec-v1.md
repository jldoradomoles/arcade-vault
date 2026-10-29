# SPEC 14 — Juego ORBITAL dentro de la plataforma (variante 1: oleadas sobre el núcleo)

> **Status:** borrador
> **Depends on:** SPEC 05, SPEC 06, SPEC 07
> **Date:** 2026-10-29
> **Objective:** Crear Orbital como motor TypeScript jugable en `/juegos/orbital/jugar`, con una paleta curva que gira alrededor de un núcleo y devuelve bolas en oleadas, el HUD, la pausa y el guardado de puntuación de la plataforma y su ficha en el leaderboard.

## Por qué existe esta spec

Orbital sale del tema «Pong»: toma la idea de devolver una bola con una paleta y la lleva a un campo circular donde la paleta orbita un núcleo que hay que proteger. Aporta al catálogo el arquetipo de defensa por oleadas, que ninguno de los juegos actuales usa, en la categoría `ARCADE` con color `magenta`. No hay código de referencia: el motor y el dibujo son nuevos.

Esta variante es la clásica por oleadas: cada oleada trae un número fijo de bolas, el jugador controla el arco con el teclado y hay un respiro entre oleadas.

El registro genérico ya existe desde SPEC 07. Esta spec solo añade el juego al registro; no hay refactor.

## Alcance

**Dentro:**

- Fila `orbital` en `games` (migración + `supabase/seed.sql`) y portada `.cover-orbital` en `app/globals.css`.
- Motor en `lib/orbital/` (`constants.ts`, `entities.ts`, `engine.ts`) que implementa `GameEngine`.
- Entrada `orbital` en `GAME_REGISTRY` con canvas cuadrado de 600×600 y sus controles.
- Núcleo fijo en el centro con 3 vidas de integridad.
- Arco de 60° que orbita a radio constante (140 px) y se mueve con `←` `→` o `A` `D`.
- Bolas hostiles que entran desde un punto aleatorio del borde del canvas y viajan en línea recta hacia el núcleo.
- Devolución: al tocar el arco la bola se refleja respecto a la normal radial en el punto de impacto y sale del canvas; devolverla suma puntos.
- Si una bola alcanza el núcleo, se pierde 1 vida y la bola desaparece.
- Oleadas: la oleada `n` lanza `3 + 2n` bolas, una cada `max(0,5; 1,4 − 0,1n)` s, a una velocidad de `140 + 12n` px/s.
- Entre oleadas hay 2 s de respiro con el rótulo «OLEADA n» dibujado en el canvas.
- Puntuación: 10 por bola devuelta y 100 por oleada completada, multiplicados por la racha de devoluciones sin fallo (tope ×4).
- Controles: `←` `→` o `A` `D`.

**Fuera de alcance (para futuras specs):**

- Control con ratón y habilidades activas.
- Más de un arco, varios núcleos y jefes.
- Controles táctiles específicos (se aplica la derivación automática de SPEC 10) y gamepad.
- Sonido y música.
- Récord local: el récord es el leaderboard.
- Anti-trampas real (ver SPEC 06).
- Tests automatizados.

## Modelo de datos

Fila del catálogo (`supabase/migrations/20261029000100_juego_orbital.sql` y el mismo `insert` en `supabase/seed.sql`):

```sql
insert into public.games (id, title, short, long, category, cover, color, sort_order)
values ('orbital', 'ORBITAL', 'Gira tu escudo alrededor del núcleo y devuelve cada bola.',
        'Un núcleo, un escudo curvo y oleadas de bolas que vienen de todas partes. Gira alrededor del centro para devolverlas antes de que lo alcancen. Cada oleada trae más bolas y más rápidas; tres impactos y el núcleo se apaga.',
        'ARCADE', 'cover-orbital', 'magenta', 15)
on conflict (id) do nothing;
```

Constantes y tipos (`lib/orbital/constants.ts`):

```ts
export const W = 600,
  H = 600;
export const CX = W / 2,
  CY = H / 2;
export const CORE_RADIUS = 28,
  ARC_RADIUS = 140,
  ARC_SPAN = Math.PI / 3,
  ARC_THICKNESS = 12,
  ARC_SPEED = 3.4; // rad/s
export const BALL_RADIUS = 9,
  BALL_SPEED_BASE = 140,
  BALL_SPEED_PER_WAVE = 12;
export const LIVES_START = 3;
export const WAVE_BASE = 3,
  WAVE_PER_LEVEL = 2,
  SPAWN_INTERVAL_START = 1.4,
  SPAWN_INTERVAL_STEP = 0.1,
  SPAWN_INTERVAL_MIN = 0.5,
  WAVE_BREAK = 2;
export const RETURN_SCORE = 10,
  WAVE_SCORE = 100,
  STREAK_STEP = 5,
  MULTIPLIER_MAX = 4;
export const MAX_DT = 0.05;
export const MAX_SCORE = 10_000_000;
export const BG = "#11111f";
// + CORE_COLOR, ARC_COLOR, BALL_COLOR, RING_COLOR
export type Phase = "break" | "wave" | "gameover";
export interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  returned: boolean; // true tras rebotar en el arco: ya no daña al núcleo
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
    { keys: ["←", "→"], action: "Girar escudo" },
    { keys: ["A", "D"], action: "Girar escudo" },
  ],
},
```

Mapeo al HUD: `score` = puntos acumulados; `lives` = integridad del núcleo (3 al inicio); `level` = número de oleada.

Convenciones:

- Coordenadas con origen arriba a la izquierda; el ángulo del arco `θ` va en radianes, 0 apunta a la derecha y crece en sentido horario (eje `y` hacia abajo).
- `dt` en segundos tomado de `requestAnimationFrame`, acotado a `MAX_DT`; `lastTime` se reinicia al reanudar.
- Estado en campos privados de `OrbitalEngine`; `entities.ts` contiene funciones puras: `waveSize(n)`, `spawnInterval(n)`, `ballSpeed(n)`, `spawnBall(n, rand)`, `hitsArc(ball, theta)`, `reflect(ball, theta)` y `hitsCore(ball)`.
- Hay impacto con el arco cuando la distancia de la bola al centro está en `[ARC_RADIUS − ARC_THICKNESS / 2 − BALL_RADIUS, ARC_RADIUS + ARC_THICKNESS / 2 + BALL_RADIUS]` y el ángulo de la bola está a menos de `ARC_SPAN / 2` de `θ`; solo cuenta una bola con `returned = false` que se acerca al centro.
- La reflexión usa la normal radial `n = (bola − centro) / |bola − centro|` y `v' = v − 2(v·n)n`, con una componente tangencial añadida según la velocidad del arco para que el jugador pueda dirigir.
- Una bola con `returned = true` se elimina al salir del canvas; no colisiona con el núcleo ni con el arco.
- `onStats` se emite al cambiar `score`, `lives` o `level`, no en cada frame.

## Plan de implementación

Antes del paso 1, leer en `node_modules/next/dist/docs/01-app` la referencia de Client Components y la guía de `cacheComponents`. Usar `/frontend-design` para la portada `.cover-orbital` y la línea de controles. Los nombres de archivo son la propuesta de esta spec.

1. Crear la migración `20261029000100_juego_orbital.sql` y aplicarla con `apply_migration`; añadir la fila en `supabase/seed.sql` con 3 puntuaciones de `PLAYERTEST` en `orbital` y `.cover-orbital` en `app/globals.css`. Verificación: la ficha aparece en `/biblioteca` y en `/salon`; el seed repetido no duplica filas.
2. Crear `lib/orbital/constants.ts`. Verificación: `npx tsc --noEmit`.
3. Crear `lib/orbital/entities.ts` con las funciones puras. Verificación: `npx tsc --noEmit`.
4. Crear `lib/orbital/engine.ts` con el núcleo: estado, loop, teclado, giro del arco y dibujo de fondo, anillo, núcleo y arco. Verificación: `tsc` y `npm run lint`.
5. Añadir bolas: aparición en el borde, movimiento recto, impacto con el núcleo y pérdida de vida. Verificación: `tsc` y `npm run lint`.
6. Añadir la devolución con el arco (reflexión, `returned`, eliminación al salir) y la puntuación con racha. Verificación: `tsc` y `npm run lint`.
7. Añadir oleadas: tamaño, cadencia, velocidad, respiro y rótulo «OLEADA n». Verificación: `tsc` y `npm run lint`.
8. Añadir `onStats`, `onGameOver`, `setPaused`, `finish` y `destroy`. Verificación: `tsc` y `npm run lint`.
9. Registrar `orbital` en `GAME_REGISTRY` con 600×600 y sus controles. Verificación: se juega en `/juegos/orbital/jugar`.
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

Específicos de Orbital (variante 1):

- [ ] El canvas lógico mide 600×600 y muestra el núcleo en el centro, el anillo orbital y el arco.
- [ ] `←` `→` y `A` `D` giran el arco alrededor del núcleo; las flechas no desplazan la página.
- [ ] Las bolas aparecen en el borde del canvas y viajan en línea recta hacia el núcleo.
- [ ] Una bola que toca el arco se refleja, sale del canvas y no vuelve a dañar el núcleo.
- [ ] Devolver una bola suma 10 puntos multiplicados por la racha (×1 a ×4, +1 cada 5 devoluciones seguidas).
- [ ] Una bola que alcanza el núcleo resta 1 vida, desaparece y pone la racha a 1.
- [ ] La oleada 1 lanza 5 bolas, la oleada 2 lanza 7 y la velocidad de las bolas sube 12 px/s por oleada.
- [ ] Completar una oleada suma 100 puntos, sube el nivel del HUD en 1 y abre un respiro de 2 s con el rótulo «OLEADA n».
- [ ] Durante el respiro no aparecen bolas nuevas pero el arco sigue respondiendo.
- [ ] Perder la tercera vida abre «FIN DEL JUEGO» con la puntuación correcta.
- [ ] El HUD de la plataforma muestra PUNTOS, VIDAS y NIVEL.
- [ ] En pausa o con el modal abierto, las teclas no giran el arco.

## Decisiones

- **Sí:** ficha `orbital`, categoría `ARCADE`, color `magenta`, `sort_order` 15. Es defensa por oleadas, arquetipo ausente del catálogo; `magenta` se repite con Tetris, lo que es válido. El máximo actual es 13 (Frogger) y Pong ocupa el 14.
- **Sí:** campo circular 600×600. El juego es radial y un lienzo cuadrado evita desperdiciar espacio.
- **Sí:** oleadas con respiro. Dan ritmo, niveles para el HUD y un momento seguro entre pruebas.
- **No:** flujo continuo. Es la variante 2.
- **Sí:** teclado con velocidad angular constante. Basta para jugar y evita ambigüedades de entrada.
- **Sí:** reflexión radial con componente tangencial. Da control sobre el rebote sin simular física completa.
- **Sí:** 3 vidas de integridad del núcleo. Es la condición de fin clara y el HUD ya muestra VIDAS.
- **Sí:** HUD, pausa, modal y guardado de la plataforma; el canvas solo dibuja el juego y el rótulo de oleada.
- **No:** conservar HUD, game over o récord local del original. Duplicarían los de la plataforma.
- **No:** regenerar `database.types.ts`. Solo se inserta una fila; el esquema no cambia.

## Riesgos

| Riesgo                                                          | Mitigación                                                                                          |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Strict Mode duplica motor o listeners                           | `destroy()` cancela el loop y quita los listeners; hay criterio de aceptación                       |
| `dt` grande tras pausa o cambio de pestaña                      | `dt` acotado a `MAX_DT` y `lastTime` se reinicia al reanudar                                        |
| Una bola atraviesa el arco entre dos frames                     | Con velocidades ≤ 400 px/s y `MAX_DT` de 0,05 s avanza 20 px; el grosor efectivo del arco es mayor   |
| La reflexión envía la bola otra vez hacia el núcleo             | `returned = true` impide cualquier daño posterior y se elimina al salir                             |
| Las oleadas altas son imposibles de superar                     | La velocidad crece lineal y el intervalo tiene suelo `SPAWN_INTERVAL_MIN`; se ajusta tras prueba     |
| Manejo de ángulos en el salto de −π a π                         | La distancia angular se calcula con módulo 2π en una función pura                                   |
| Las flechas activan un botón enfocado de la plataforma          | `preventDefault` solo en `←` `→` durante el juego y el canvas no toma el foco de teclado            |

## Qué **no** está en esta spec

- Control con ratón y habilidades activas.
- Más de un arco, varios núcleos y jefes.
- Controles táctiles específicos y gamepad.
- Sonido y música.
- Anti-trampas real.
- Tests automatizados.

Cada uno, si llega, va en su propia spec.
