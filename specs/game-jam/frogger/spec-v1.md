# SPEC 10 — Juego FROGGER dentro de la plataforma (variante 1: cuadricula clasica)

> **Status:** borrador
> **Depends on:** SPEC 05, SPEC 06, SPEC 07
> **Date:** 2026-10-26
> **Objective:** Crear Frogger como motor TypeScript jugable en `/juegos/frogger/jugar`, con movimiento discreto por celdas, 5 casillas de destino, 3 vidas y niveles progresivos, usando el HUD, la pausa y el guardado de puntuacion de la plataforma y su ficha en el leaderboard.

## Por que existe esta spec

Frogger es un clasico de los arcades que aporta al catalogo un arquetipo de movimiento/esquivar que no tienen los 4 juegos actuales (shooter, puzzle, rebote, crecimiento). La rana cruza una carretera con vehiculos y un rio con troncos y tortugas para llegar a las casillas de destino. Esta variante sigue el diseno original: cuadricula discreta, 5 destinos y rondas.

El registro generico ya existe desde SPEC 07 (`lib/game-engine.ts`, `lib/game-registry.ts`, `components/game-canvas.tsx`). Esta spec solo anade el juego al registro; no hay refactor.

## Alcance

**Dentro:**

- Fila `frogger` en `games` (migracion + `supabase/seed.sql`) y portada `.cover-frogger` en `app/globals.css`.
- Motor en `lib/frogger/` (`constants.ts`, `entities.ts`, `engine.ts`) que implementa `GameEngine`.
- Entrada `frogger` en `GAME_REGISTRY` con canvas de 800x600 y sus controles.
- Cuadricula de 20 columnas x 15 filas de 40 px. La rana se mueve una celda por pulsacion.
- Zona segura inferior (fila 14): acera de partida.
- Zona de carretera (filas 8-13): 5 carriles con coches y camiones en ambas direcciones a velocidades distintas. Un vehiculo toca la rana = pierde vida.
- Zona segura media (fila 7): mediana de descanso.
- Zona de rio (filas 2-6): 5 carriles con troncos de 2-4 celdas y tortugas de 2-3 celdas. La rana debe saltar sobre ellos; caer al agua = pierde vida. La rana se desplaza con el tronco o tortuga en la que esta.
- Zona de destino (fila 1): 5 casillas separadas por setos. Llegar a una vacia = 50 puntos + bonus por tiempo restante. Llenar las 5 = siguiente nivel.
- Temporizador de 30 s por cruce; al llegar a 0 pierde vida.
- 3 vidas. Mosca bonus aleatoria en un destino: +200 puntos si la rana llega alli.
- Avanzar una fila = 10 puntos (solo si es la fila mas alta alcanzada en ese cruce).
- Nivel sube al llenar los 5 destinos; vehiculos y troncos van mas rapido.
- Aspecto vectorial: rana como cuadrado verde con ojos, vehiculos como rectangulos de colores, troncos marrones, tortugas verdes oscuro, agua azul, carretera gris.
- Controles: flechas `<-` `->` `^` `v` o `A` `W` `D` `S`.

**Fuera de alcance (para futuras specs):**

- Tortugas que se hunden periodicamente.
- Cocodrilos, serpientes u otros enemigos en el rio.
- Sonido y musica.
- Controles tactiles o gamepad.
- Sprites o animaciones elaboradas.
- Anti-trampas real (ver SPEC 06).
- Tests automatizados.

## Modelo de datos

Fila del catalogo (`supabase/migrations/20261026140000_juego_frogger.sql` y el mismo `insert` en `supabase/seed.sql`):

```sql
insert into public.games (id, title, short, long, category, cover, color, sort_order)
values ('frogger', 'FROGGER', 'Cruza la carretera y el rio sin ser aplastado ni caer al agua.',
        'Guia a la rana a traves de una carretera llena de coches y camiones, y luego un rio con troncos y tortugas. Llega a las cinco casillas de destino en la parte superior para completar el nivel. Cada nivel es mas rapido y peligroso. Tienes tres vidas y cada cruce exitoso suma puntos.',
        'ARCADE', 'cover-frogger', 'green', 13)
on conflict (id) do nothing;
```

Constantes y tipos (`lib/frogger/constants.ts`):

```ts
export const W = 800,
  H = 600;
export const CELL = 40,
  COLS = 20,
  ROWS = 15;
export const FROG_START_COL = 10,
  FROG_START_ROW = 14;
export const ROAD_TOP = 8,
  ROAD_BOTTOM = 13;
export const MEDIAN_ROW = 7;
export const RIVER_TOP = 2,
  RIVER_BOTTOM = 6;
export const DEST_ROW = 1;
export const NUM_HOMES = 5;
export const HOME_COLS = [2, 6, 10, 14, 18] as const;
export const TIMER_MS = 30_000;
export const STEP_POINTS = 10,
  HOME_POINTS = 50,
  FLY_POINTS = 200;
export const LIVES = 3;
export const MAX_DT_MS = 50;
export const MAX_SCORE = 10_000_000;
export const BG_ROAD = "#333333",
  BG_WATER = "#1a3a5c",
  BG_GRASS = "#2d5a1e",
  BG_MEDIAN = "#4a4a2a";
export type Phase = "ready" | "playing" | "gameover";
export type Dir = "up" | "down" | "left" | "right";
export interface Lane {
  row: number;
  speed: number; // px/s, negativo = izquierda
  items: LaneItem[];
  type: "car" | "truck" | "log" | "turtle";
}
export interface LaneItem {
  x: number; // px, esquina izquierda
  w: number; // px
  color: string;
}
```

Motor y registro:

```ts
export class FroggerEngine implements GameEngine { /* start, setPaused, finish, destroy */ }

// lib/game-registry.ts
frogger: {
  width: W, height: H,
  createEngine: (canvas, callbacks) => new FroggerEngine(canvas, callbacks),
  controls: [
    { keys: ['<-', '^', '->', 'v'], action: 'Mover' },
    { keys: ['A', 'W', 'D', 'S'], action: 'Mover' },
  ],
},
```

Mapeo al HUD: `score` = puntos acumulados; `lives` = vidas restantes (empieza en 3); `level` = nivel actual.

Convenciones:

- Coordenadas con origen arriba a la izquierda; una celda `(col, row)` ocupa `[col*40, col*40+40) x [row*40, row*40+40)`.
- `dt` en milisegundos tomado de `requestAnimationFrame`, acotado a `MAX_DT_MS`; `lastTime` se reinicia al reanudar.
- La rana se mueve una celda por pulsacion, no de forma continua; el movimiento es instantaneo.
- Los vehiculos y objetos del rio se mueven de forma continua en `px/s` y hacen wrap al salir del canvas.
- La rana sobre un tronco o tortuga se desplaza con el objeto; si sale del canvas, cae al agua.
- El estado de partida pasa a campos privados de `FroggerEngine`; `entities.ts` contiene funciones puras: `createLanes(level)`, `moveLaneItems(lanes, dt)`, `frogOnPlatform(frog, lanes)`, `frogHitsVehicle(frog, lanes)`, `frogInWater(frog, lanes)`, `frogReachedHome(frog, homes)`.
- `onStats` se emite al cambiar `score`, `lives` o `level`, no en cada frame.
- La puntuacion se satura en `MAX_SCORE` por contrato.
- El temporizador se dibuja en el canvas como una barra en la parte inferior; no tiene equivalente en el HUD de la plataforma.

## Plan de implementacion

Antes del paso 1, leer en `node_modules/next/dist/docs/01-app` la referencia de Client Components y la guia de `cacheComponents`. Usar `/frontend-design` para la portada `.cover-frogger` y la linea de controles. Los nombres de archivo son la propuesta de esta spec.

1. Crear la migracion `20261026140000_juego_frogger.sql` y aplicarla con `apply_migration`; anadir la fila en `supabase/seed.sql` con 3 puntuaciones de `PLAYERTEST` en `frogger` y `.cover-frogger` en `app/globals.css`. Verificacion: la ficha aparece en `/biblioteca` y como pestana en `/salon`; `/juegos/frogger/jugar` muestra el simulado; ejecutar el seed dos veces no duplica filas.
2. Crear `lib/frogger/constants.ts`. Verificacion: `npx tsc --noEmit`.
3. Crear `lib/frogger/entities.ts` con `createLanes`, `moveLaneItems`, `frogOnPlatform`, `frogHitsVehicle`, `frogInWater`, `frogReachedHome` y `spawnFly`. Verificacion: `npx tsc --noEmit`.
4. Crear `lib/frogger/engine.ts` con el nucleo: estado, loop con `requestAnimationFrame`, teclado con movimiento discreto, fases `ready`/`playing`/`gameover`, y dibujo de fondo (carretera, agua, hierba, mediana). Verificacion: `tsc` y `npm run lint`.
5. Anadir al motor los carriles de vehiculos (coches y camiones) con movimiento continuo y wrap, y la deteccion de colision rana-vehiculo. Verificacion: `tsc` y `npm run lint`.
6. Anadir al motor los carriles del rio (troncos y tortugas), el desplazamiento de la rana sobre plataformas y la deteccion de caida al agua. Verificacion: `tsc` y `npm run lint`.
7. Anadir al motor las 5 casillas de destino, la mosca bonus, el temporizador, la puntuacion por avance y la logica de completar nivel. Verificacion: `tsc` y `npm run lint`.
8. Anadir `onStats`, `onGameOver`, `setPaused`, `finish` y `destroy` (quita listeners y cancela el loop). Verificacion: `tsc` y `npm run lint`.
9. Registrar `frogger` en `GAME_REGISTRY` con 800x600 y sus controles. Verificacion: se juega en `/juegos/frogger/jugar`.
10. Revisar el escalado a 1440 px y 375 px. Verificacion: `npm run lint` y `npm run build`.

Cada paso deja la app funcionando.

## Criterios de aceptacion

Base:

- [ ] `npm run build`, `npm run lint` y `npx tsc --noEmit` terminan sin errores.
- [ ] La ficha FROGGER aparece en `/biblioteca` con su portada propia y como pestana en `/salon`.
- [ ] `/juegos/frogger` y `/juegos/frogger/jugar` cargan sin errores en consola ni de hidratacion, ni el aviso «URL data outside of Suspense».
- [ ] PAUSA congela el juego y muestra «EN PAUSA»; REANUDAR continua sin saltos.
- [ ] FIN abre «FIN DEL JUEGO» con la puntuacion actual y deja de procesar entrada de juego.
- [ ] Se puede escribir (incluidos espacios y flechas) en el modal sin que el juego reaccione.
- [ ] Con sesion, «GUARDAR PUNTUACION» crea una fila en `scores` con `game_id = 'frogger'` y muestra «PUNTUACION GUARDADA_»; aparece en `/salon`, y `best`/`plays` de la ficha se actualizan.
- [ ] Sin sesion, el modal muestra «INICIA SESION PARA GUARDAR» con enlace a `/acceso` y no escribe en `scores`.
- [ ] «JUGAR DE NUEVO» reinicia con puntuacion 0 y estado inicial.
- [ ] Al salir con SALIR o cambiar de ruta no quedan listeners de teclado ni loops activos.
- [ ] En desarrollo (Strict Mode) no hay dos motores a la vez ni teclas duplicadas.
- [ ] Con ancho de 375 px el canvas se escala sin scroll horizontal manteniendo su proporcion.
- [ ] La puntuacion guardada es un entero entre 0 y 10 000 000.
- [ ] Asteroids, Tetris, Arkanoid, Snake y los juegos sin entrada en `GAME_REGISTRY` se comportan como antes.

Especificos de Frogger v1:

- [ ] El canvas logico mide 800x600 y el tablero tiene 20 columnas x 15 filas de 40 px.
- [ ] Las flechas y `A` `W` `D` `S` mueven la rana exactamente una celda por pulsacion.
- [ ] Las flechas no desplazan la pagina mientras se juega.
- [ ] La rana no puede salir de los limites del canvas.
- [ ] Los vehiculos se mueven de forma continua por sus carriles y reaparecen por el lado opuesto al salir.
- [ ] Tocar un vehiculo resta una vida y devuelve la rana a la posicion de inicio.
- [ ] Los troncos y tortugas se mueven por los carriles del rio y la rana se desplaza con ellos.
- [ ] Saltar al agua sin pisar un tronco o tortuga resta una vida.
- [ ] Si la rana sale del canvas montada en un tronco, pierde una vida.
- [ ] Hay 5 casillas de destino en la fila superior; llegar a una vacia suma 50 puntos.
- [ ] Llenar las 5 casillas sube el nivel, vacia los destinos, aumenta la velocidad de los carriles y devuelve la rana al inicio.
- [ ] Avanzar una fila suma 10 puntos solo si es la fila mas alta alcanzada en ese cruce.
- [ ] El temporizador de 30 s se muestra como barra en el canvas; al llegar a 0 pierde una vida.
- [ ] La mosca bonus aparece aleatoriamente en un destino y vale 200 puntos.
- [ ] Con 0 vidas se abre «FIN DEL JUEGO» con la puntuacion correcta.
- [ ] «JUGAR DE NUEVO» reinicia con 3 vidas, nivel 1, puntuacion 0 y destinos vacios.
- [ ] El HUD de la plataforma muestra PUNTOS, VIDAS y NIVEL.
- [ ] En la mediana (fila 7) la rana esta segura.

## Decisiones

- **Si:** ficha `frogger`, categoria `ARCADE`, color `green`, `sort_order` 13. El arquetipo movimiento/esquivar no existe en el catalogo; `green` encaja con la rana y los valores estan permitidos por el `check` de BD y `lib/game-types.ts`.
- **Si:** cuadricula discreta de 20x15 con movimiento de una celda por pulsacion. Es el diseno clasico de Frogger y simplifica la deteccion de colisiones.
- **No:** movimiento libre con fisicas continuas. Complicaria las colisiones y se alejaria del clasico.
- **Si:** 5 casillas de destino y niveles al completarlas. Fiel al original y da estructura a la progresion.
- **Si:** temporizador de 30 s por cruce dibujado en el canvas. La plataforma no tiene temporizador en el HUD.
- **Si:** 3 vidas, `score`, `lives` y `level` al HUD. Los tres existen en el juego.
- **No:** tortugas que se hunden. Anade complejidad que se puede dejar para una futura spec.
- **Si:** HUD, pausa, modal y guardado de la plataforma; el canvas solo dibuja el juego, la barra de tiempo y los destinos.
- **No:** conservar HUD, game over o record local del original. Duplicarian los de la plataforma.
- **No:** regenerar `database.types.ts`. Solo se inserta una fila; el esquema no cambia.

## Riesgos

| Riesgo                                                                                 | Mitigacion                                                                                      |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Strict Mode duplica motor o listeners                                                  | `destroy()` cancela el loop y quita los listeners; hay criterio de aceptacion                   |
| `dt` grande tras pausa o cambio de pestana                                             | `dt` acotado a `MAX_DT_MS` y `lastTime` se reinicia al reanudar                                 |
| La rana se queda atrapada entre vehiculos sin poder moverse                            | Los carriles se disenan con huecos suficientes para cruzar; el temporizador fuerza el avance    |
| Deteccion de colision imprecisa con objetos del rio que se mueven a distinta velocidad | La colision se calcula en coordenadas de pixel, no de celda, para los objetos moviles           |
| El temporizador sigue corriendo durante la pausa                                       | `setPaused` guarda el tiempo restante y lo reanuda; no usa `Date.now()` sino acumulador de `dt` |
| Los objetos del rio se desalinean con la cuadricula al moverse continuamente           | La rana se posiciona en el centro del objeto mas cercano, no en la celda exacta                 |

## Que **no** esta en esta spec

- Tortugas que se hunden periodicamente.
- Cocodrilos, serpientes u otros enemigos en el rio.
- Sonido y musica.
- Controles tactiles o gamepad.
- Sprites o animaciones elaboradas.
- Anti-trampas real.
- Tests automatizados.

Cada uno, si llega, va en su propia spec.
