# SPEC 11 — Juego CROAK dentro de la plataforma (variante 2: rana saltarina con combos)

> **Status:** borrador
> **Depends on:** SPEC 05, SPEC 06, SPEC 07
> **Date:** 2026-10-26
> **Objective:** Crear Croak como motor TypeScript jugable en `/juegos/croak/jugar`, con una rana que salta entre nenufares, apunta con angulo libre y atrapa insectos encadenando combos, sin vidas sino con temporizador por ronda, usando el HUD, la pausa y el guardado de puntuacion de la plataforma y su ficha en el leaderboard.

## Por que existe esta spec

Croak aporta al catalogo un shooter con tematica de pantano. Esta variante se diferencia de la v1 en tres ejes: la rana se mueve saltando entre 5 nenufares, la puntuacion se multiplica por combos de capturas consecutivas, y en lugar de vidas hay un temporizador por ronda. El resultado es un juego mas dinamico y orientado a la habilidad.

El registro generico ya existe desde SPEC 07. Esta spec solo anade el juego al registro; no hay refactor.

## Alcance

**Dentro:**

- Fila `croak` en `games` (migracion + `supabase/seed.sql`) y portada `.cover-croak` en `app/globals.css`.
- Motor en `lib/croak/` (`constants.ts`, `entities.ts`, `engine.ts`) que implementa `GameEngine`.
- Entrada `croak` en `GAME_REGISTRY` con canvas de 800x600 y sus controles.
- 5 nenufares distribuidos en arco en la parte inferior del canvas. La rana ocupa uno a la vez.
- `<-` y `->` mueven la rana al nenufar adyacente (salto instantaneo con animacion de arco de 200 ms).
- `^` y `v` ajustan el angulo de disparo (rango 0-180 grados). Una linea punteada muestra la direccion.
- `Espacio` dispara la lengua. Mecanica identica a la v1 (extension a 600 px/s, retraccion, un disparo a la vez), pero el punto de origen es el nenufar activo.
- Mismos 3 tipos de insecto: mosca (10 pts base), libelula (30 pts base), luciernaga (50 pts base).
- Sistema de combos: cada captura consecutiva sin fallo incrementa el multiplicador (x1, x2, x3, hasta x5). Fallar un disparo (la lengua no atrapa nada) resetea el combo a x1.
- El combo se muestra en el canvas junto a la rana: «x2», «x3», etc.
- Sin vidas. Cada ronda tiene un temporizador de 45 s. Al terminar la ronda se suman los puntos y empieza la siguiente con mas insectos y mas rapidos.
- El jugador pierde si termina una ronda con 0 capturas (ningun insecto atrapado en 45 s).
- Nivel = numero de ronda actual.
- Aspecto vectorial: rana verde, nenufares circulares, lengua rosa, insectos con colores, fondo de pantano nocturno con reflejos.
- Controles: `<-` `->` para saltar entre nenufares, `^` `v` para apuntar, `Espacio` para disparar.

**Fuera de alcance (para futuras specs):**

- Insectos venenosos o jefe de oleada.
- Power-ups (lengua doble, iman, ralentizar tiempo).
- Sonido y musica.
- Controles tactiles, raton o gamepad.
- Sprites o animaciones elaboradas.
- Anti-trampas real (ver SPEC 06).
- Tests automatizados.

## Modelo de datos

Fila del catalogo (`supabase/migrations/20261026150000_juego_croak.sql` y el mismo `insert` en `supabase/seed.sql`):

```sql
insert into public.games (id, title, short, long, category, cover, color, sort_order)
values ('croak', 'CROAK', 'Atrapa moscas con tu lengua antes de que escapen del pantano.',
        'Eres una rana en un nenufar en el centro del pantano. Los insectos revolotean desde los bordes de la pantalla. Apunta con las flechas y dispara tu lengua para atraparlos antes de que crucen al otro lado. Moscas, libelulas y luciernagas valen distinto. Cada insecto que escape te cuesta una vida.',
        'SHOOTER', 'cover-croak', 'cyan', 14)
on conflict (id) do nothing;
```

Constantes y tipos (`lib/croak/constants.ts`):

```ts
export const W = 800,
  H = 600;
export const LILY_Y = 520;
export const LILY_POSITIONS = [100, 250, 400, 550, 700] as const; // x de cada nenufar
export const LILY_R = 35;
export const FROG_R = 25;
export const TONGUE_SPEED = 600; // px/s
export const AIM_SPEED = 120; // grados/s
export const AIM_START = 90;
export const JUMP_DURATION_MS = 200;
export const FLY_POINTS = 10,
  DRAGONFLY_POINTS = 30,
  FIREFLY_POINTS = 50;
export const FLY_SPEED = 90,
  DRAGONFLY_SPEED = 140,
  FIREFLY_SPEED = 190;
export const FLY_R = 12,
  DRAGONFLY_R = 8,
  FIREFLY_R = 8;
export const MAX_COMBO = 5;
export const ROUND_DURATION_MS = 45_000;
export const SPEED_PER_ROUND = 15; // px/s extra por ronda
export const MAX_DT_MS = 50;
export const MAX_SCORE = 10_000_000;
export const BG = "#061206";
export type Phase = "ready" | "playing" | "round_end" | "gameover";
export type BugKind = "fly" | "dragonfly" | "firefly";
export interface Bug {
  x: number;
  y: number;
  vx: number;
  vy: number;
  kind: BugKind;
  r: number;
  basePoints: number;
  alive: boolean;
  blink: number;
}
export interface Tongue {
  originX: number;
  originY: number;
  angle: number;
  extending: boolean;
  retracting: boolean;
  caught: Bug | null;
  length: number;
}
```

Motor y registro:

```ts
export class CroakEngine implements GameEngine { /* start, setPaused, finish, destroy */ }

// lib/game-registry.ts
croak: {
  width: W, height: H,
  createEngine: (canvas, callbacks) => new CroakEngine(canvas, callbacks),
  controls: [
    { keys: ['<-', '->'], action: 'Saltar nenufar' },
    { keys: ['^', 'v'], action: 'Apuntar' },
    { keys: ['Espacio'], action: 'Disparar lengua' },
  ],
},
```

Mapeo al HUD: `score` = puntos con combos aplicados; `level` = ronda actual; `lives` = no se emite y el HUD oculta VIDAS.

Convenciones:

- Coordenadas con origen arriba a la izquierda; los 5 nenufares estan en `y = 520` a las posiciones x definidas.
- `dt` en milisegundos tomado de `requestAnimationFrame`, acotado a `MAX_DT_MS`; `lastTime` se reinicia al reanudar.
- La rana salta entre nenufares con una animacion de arco parabolico de 200 ms; durante el salto no puede disparar.
- La lengua parte del centro de la rana en el nenufar activo. El angulo es libre (0-180 grados, siendo 90 vertical).
- El combo se resetea a x1 cuando la lengua se retrae sin haber atrapado nada.
- `entities.ts` contiene funciones puras: `spawnBug(round)`, `moveBugs(bugs, dt)`, `extendTongue(tongue, dt)`, `retractTongue(tongue, dt)`, `tongueHitsBug(tongue, bugs)`, `bugEscaped(bug)`, `jumpArc(from, to, progress)`.
- `onStats` se emite al cambiar `score` o `level`, no en cada frame.
- El temporizador de ronda se dibuja en el canvas como una barra superior; no tiene equivalente en el HUD.
- La puntuacion se satura en `MAX_SCORE` por contrato.

## Plan de implementacion

Antes del paso 1, leer en `node_modules/next/dist/docs/01-app` la referencia de Client Components y la guia de `cacheComponents`. Usar `/frontend-design` para la portada `.cover-croak` y la linea de controles. Los nombres de archivo son la propuesta de esta spec.

1. Crear la migracion `20261026150000_juego_croak.sql` y aplicarla con `apply_migration`; anadir la fila en `supabase/seed.sql` con 3 puntuaciones de `PLAYERTEST` en `croak` y `.cover-croak` en `app/globals.css`. Verificacion: la ficha aparece en `/biblioteca` y como pestana en `/salon`; `/juegos/croak/jugar` muestra el simulado.
2. Crear `lib/croak/constants.ts`. Verificacion: `npx tsc --noEmit`.
3. Crear `lib/croak/entities.ts` con `spawnBug`, `moveBugs`, `extendTongue`, `retractTongue`, `tongueHitsBug`, `bugEscaped` y `jumpArc`. Verificacion: `npx tsc --noEmit`.
4. Crear `lib/croak/engine.ts` con el nucleo: estado, loop con `requestAnimationFrame`, teclado para saltar y apuntar, fases, y dibujo de fondo, nenufares y rana. Verificacion: `tsc` y `npm run lint`.
5. Anadir al motor el salto entre nenufares con animacion de arco y el bloqueo de disparo durante el salto. Verificacion: `tsc` y `npm run lint`.
6. Anadir al motor la lengua (extension, retraccion, linea de apuntado punteada) y el dibujo. Verificacion: `tsc` y `npm run lint`.
7. Anadir al motor los insectos (generacion, movimiento, dibujo, parpadeo) y la colision lengua-insecto con combo. Verificacion: `tsc` y `npm run lint`.
8. Anadir al motor el temporizador de ronda, la condicion de fin (0 capturas en una ronda), la transicion entre rondas y la dificultad creciente. Verificacion: `tsc` y `npm run lint`.
9. Anadir `onStats`, `onGameOver`, `setPaused`, `finish` y `destroy` (quita listeners y cancela el loop). Verificacion: `tsc` y `npm run lint`.
10. Registrar `croak` en `GAME_REGISTRY` con 800x600 y sus controles. Verificacion: se juega en `/juegos/croak/jugar`.
11. Revisar el escalado a 1440 px y 375 px. Verificacion: `npm run lint` y `npm run build`.

Cada paso deja la app funcionando.

## Criterios de aceptacion

Base:

- [ ] `npm run build`, `npm run lint` y `npx tsc --noEmit` terminan sin errores.
- [ ] La ficha CROAK aparece en `/biblioteca` con su portada propia y como pestana en `/salon`.
- [ ] `/juegos/croak` y `/juegos/croak/jugar` cargan sin errores en consola ni de hidratacion, ni el aviso «URL data outside of Suspense».
- [ ] PAUSA congela el juego y muestra «EN PAUSA»; REANUDAR continua sin saltos.
- [ ] FIN abre «FIN DEL JUEGO» con la puntuacion actual y deja de procesar entrada de juego.
- [ ] Se puede escribir (incluidos espacios y flechas) en el modal sin que el juego reaccione.
- [ ] Con sesion, «GUARDAR PUNTUACION» crea una fila en `scores` con `game_id = 'croak'` y muestra «PUNTUACION GUARDADA_»; aparece en `/salon`, y `best`/`plays` de la ficha se actualizan.
- [ ] Sin sesion, el modal muestra «INICIA SESION PARA GUARDAR» con enlace a `/acceso` y no escribe en `scores`.
- [ ] «JUGAR DE NUEVO» reinicia con puntuacion 0 y estado inicial.
- [ ] Al salir con SALIR o cambiar de ruta no quedan listeners de teclado ni loops activos.
- [ ] En desarrollo (Strict Mode) no hay dos motores a la vez ni teclas duplicadas.
- [ ] Con ancho de 375 px el canvas se escala sin scroll horizontal manteniendo su proporcion.
- [ ] La puntuacion guardada es un entero entre 0 y 10 000 000.
- [ ] Asteroids, Tetris, Arkanoid, Snake y los juegos sin entrada en `GAME_REGISTRY` se comportan como antes.

Especificos de Croak v2:

- [ ] El canvas logico mide 800x600 con 5 nenufares en arco en la parte inferior.
- [ ] `<-` y `->` mueven la rana al nenufar adyacente con una animacion de arco de 200 ms.
- [ ] `^` y `v` rotan el angulo de apuntado; una linea punteada muestra la direccion.
- [ ] `Espacio` dispara la lengua; no se puede disparar durante un salto ni mientras otra lengua esta en vuelo.
- [ ] Las flechas y `Espacio` no desplazan la pagina mientras se juega.
- [ ] La lengua se extiende a 600 px/s desde la posicion actual de la rana.
- [ ] Atrapar una mosca con combo x1 suma 10 puntos; con x3 suma 30 puntos.
- [ ] Atrapar una libelula suma 30 puntos base multiplicados por el combo actual.
- [ ] Atrapar una luciernaga suma 50 puntos base multiplicados por el combo actual.
- [ ] Cada captura consecutiva incrementa el combo hasta x5; el combo se muestra en el canvas.
- [ ] Fallar un disparo (la lengua vuelve sin insecto) resetea el combo a x1.
- [ ] No hay vidas; el temporizador de 45 s se muestra como barra en la parte superior del canvas.
- [ ] Al terminar la ronda, si el jugador atrapo al menos 1 insecto, empieza la siguiente ronda con mas insectos y mas rapidos.
- [ ] Si el jugador no atrapo ningun insecto en una ronda, se abre «FIN DEL JUEGO».
- [ ] El nivel del HUD coincide con el numero de ronda actual.
- [ ] «JUGAR DE NUEVO» reinicia con ronda 1, combo x1 y puntuacion 0.
- [ ] El HUD de la plataforma muestra PUNTOS y NIVEL; oculta VIDAS.
- [ ] Al empezar, el canvas muestra «PULSA ESPACIO PARA EMPEZAR» con la rana en el nenufar central.

## Decisiones

- **Si:** ficha `croak`, categoria `SHOOTER`, color `cyan`, `sort_order` 14. Misma ficha que la v1; la variante no cambia la identidad del juego en el catalogo.
- **Si:** 5 nenufares y rana movil. Anade una dimension de posicionamiento estrategico que la v1 no tiene.
- **No:** rana fija. La v1 cubre ese enfoque de torreta simple.
- **Si:** sistema de combos hasta x5. Premia la precision y genera puntuaciones mas variadas para el leaderboard.
- **No:** multiplicador infinito. Con un tope de x5 el equilibrio es manejable.
- **Si:** temporizador por ronda en lugar de vidas. Cambia la tension de «no dejes escapar insectos» a «atrapa todos los que puedas en el tiempo».
- **Si:** fin de partida si 0 capturas en una ronda. Es un umbral justo: si no atrapas nada, no tiene sentido seguir.
- **No:** vidas como en la v1. La v2 busca un ritmo distinto; las rondas temporizadas dan estructura sin necesitar vidas.
- **Si:** HUD, pausa, modal y guardado de la plataforma; el canvas solo dibuja el juego, el combo y la barra de tiempo.
- **No:** conservar HUD, game over o record local del original. Duplicarian los de la plataforma.
- **No:** regenerar `database.types.ts`. Solo se inserta una fila; el esquema no cambia.

## Riesgos

| Riesgo                                                                          | Mitigacion                                                                                                       |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Strict Mode duplica motor o listeners                                           | `destroy()` cancela el loop y quita los listeners; hay criterio de aceptacion                                    |
| `dt` grande tras pausa o cambio de pestana                                      | `dt` acotado a `MAX_DT_MS` y `lastTime` se reinicia al reanudar                                                  |
| La lengua atraviesa un insecto en un frame largo                                | La colision se comprueba por interpolacion a lo largo del segmento, no solo en la punta                          |
| La animacion de salto desincroniza la posicion de la rana y el punto de disparo | Durante el salto se bloquea el disparo; la posicion de la lengua siempre parte del nenufar activo tras aterrizar |
| El combo x5 genera puntuaciones desproporcionadas                               | Los puntos base son bajos (10-50) y el combo se resetea facilmente; la puntuacion maxima por ronda esta acotada  |
| El temporizador sigue corriendo durante la pausa                                | `setPaused` guarda el tiempo restante y lo reanuda; no usa `Date.now()` sino acumulador de `dt`                  |
| `Espacio` activa un boton de la plataforma al reanudar                          | `preventDefault` en `Espacio`; ignorar entrada con el juego pausado                                              |

## Que **no** esta en esta spec

- Insectos venenosos o jefe de oleada.
- Power-ups (lengua doble, iman, ralentizar tiempo).
- Sonido y musica.
- Controles tactiles, raton o gamepad.
- Sprites o animaciones elaboradas.
- Anti-trampas real.
- Tests automatizados.

Cada uno, si llega, va en su propia spec.
