# SPEC 12 — Juego PANTANO dentro de la plataforma (variante 1: constructor en tiempo real)

> **Status:** borrador
> **Depends on:** SPEC 05, SPEC 06, SPEC 07
> **Date:** 2026-10-26
> **Objective:** Crear Pantano como motor TypeScript jugable en `/juegos/pantano/jugar`, un puzzle en tiempo real donde el jugador coloca troncos, nenufares y tortugas para crear caminos seguros por los que las ranas cruzan un pantano automaticamente, con 3 vidas y niveles, usando el HUD, la pausa y el guardado de puntuacion de la plataforma y su ficha en el leaderboard.

## Por que existe esta spec

Pantano es un puzzle de planificacion y reflejos inspirado en la tematica Frogger pero con un giro: en lugar de controlar a la rana directamente, el jugador construye el camino. El arquetipo defensa/oleadas no existe en el catalogo (Asteroids es shooter, Tetris es puzzle de apilado, Arkanoid es rebote, Snake es crecimiento). Esta variante es en tiempo real: las ranas avanzan mientras el jugador coloca piezas.

El registro generico ya existe desde SPEC 07. Esta spec solo anade el juego al registro; no hay refactor.

## Alcance

**Dentro:**

- Fila `pantano` en `games` (migracion + `supabase/seed.sql`) y portada `.cover-pantano` en `app/globals.css`.
- Motor en `lib/pantano/` (`constants.ts`, `entities.ts`, `engine.ts`) que implementa `GameEngine`.
- Entrada `pantano` en `GAME_REGISTRY` con canvas de 800x600 y sus controles.
- Vista cenital. El pantano es una cuadricula de 20 columnas x 15 filas de 40 px.
- Filas: fila 14 = orilla inferior (las ranas aparecen aqui), filas 1-13 = agua con corrientes alternas, fila 0 = orilla superior (destino).
- Las ranas aparecen periodicamente en la orilla inferior y avanzan automaticamente una fila cada 1,5 s. Si pisan una pieza (tronco, nenufar, tortuga), avanzan a la siguiente fila. Si pisan agua sin pieza, caen y se pierde 1 vida.
- La rana intenta avanzar recto hacia arriba; si la celda de arriba es agua, intenta una adyacente lateral con pieza. Si no hay opciones, cae al agua.
- El jugador controla un cursor (cuadrado parpadeante) con las flechas y coloca la pieza actual con `Espacio`.
- Cola de piezas: el panel derecho muestra la pieza actual y las 2 siguientes. Tipos de pieza:
  - Nenufar (1x1, estatico, no se mueve con la corriente, dura indefinidamente).
  - Tronco (3x1 horizontal, se desplaza con la corriente de su fila a 20 px/s; la rana viaja con el).
  - Tortuga (1x1, se hunde 8 s despues de ser colocada y desaparece).
- No se puede colocar una pieza sobre otra pieza, sobre la orilla o sobre una rana.
- Cada rana que llega a la orilla superior = 50 puntos + 10 puntos por vida restante (bonus).
- Cada rana que cae al agua = -1 vida. 3 vidas.
- Nivel sube cada 5 ranas salvadas. Cada nivel: las ranas aparecen mas frecuentemente, las corrientes son mas rapidas, mas tortugas y menos nenufares en la cola.
- Aspecto vectorial: agua azul oscuro con ondulacion sutil, orillas verdes, cursor amarillo parpadeante, nenufares verdes, troncos marrones, tortugas verde oscuro, ranas pequenas verdes con ojos.
- Panel derecho (160 px): muestra pieza actual, 2 siguientes y el texto «RANAS SALVADAS: N».
- Controles: flechas `<-` `->` `^` `v` para mover cursor, `Espacio` para colocar pieza, `R` para rotar tronco (horizontal/vertical).

**Fuera de alcance (para futuras specs):**

- Cocodrilos u obstaculos moviles que maten ranas.
- Piezas especiales (puente, corriente inversa).
- Modo campaña con niveles disenados a mano.
- Sonido y musica.
- Controles tactiles, raton o gamepad.
- Sprites o animaciones elaboradas.
- Anti-trampas real (ver SPEC 06).
- Tests automatizados.

## Modelo de datos

Fila del catalogo (`supabase/migrations/20261026160000_juego_pantano.sql` y el mismo `insert` en `supabase/seed.sql`):

```sql
insert into public.games (id, title, short, long, category, cover, color, sort_order)
values ('pantano', 'PANTANO', 'Coloca troncos y nenufares para guiar a las ranas hasta la otra orilla.',
        'Las ranas avanzan solas por un pantano peligroso y necesitan plataformas para no caer al agua. Coloca nenufares, troncos y tortugas en las casillas de agua para crear caminos seguros. Los troncos se desplazan con la corriente y las tortugas se hunden. Cada nivel trae mas ranas y corrientes mas rapidas.',
        'PUZZLE', 'cover-pantano', 'magenta', 15)
on conflict (id) do nothing;
```

Constantes y tipos (`lib/pantano/constants.ts`):

```ts
export const W = 800,
  H = 600;
export const GRID_W = 640,
  GRID_H = 600;
export const PANEL_X = 640,
  PANEL_W = 160;
export const CELL = 40,
  COLS = 16,
  ROWS = 15;
export const SHORE_TOP = 0,
  SHORE_BOTTOM = 14;
export const FROG_STEP_MS = 1500; // ms entre pasos de la rana
export const FROG_SPAWN_BASE_MS = 4000; // ms entre ranas en nivel 1
export const FROG_SPAWN_DECREASE = 300; // ms menos por nivel
export const FROG_SPAWN_MIN_MS = 1500;
export const LILYPAD_CHAR = "L",
  LOG_CHAR = "T",
  TURTLE_CHAR = "U";
export const LOG_LENGTH = 3;
export const TURTLE_SINK_MS = 8000;
export const CURRENT_BASE_SPEED = 20; // px/s
export const CURRENT_PER_LEVEL = 5; // px/s extra
export const FROG_SAVED_POINTS = 50;
export const LIFE_BONUS = 10;
export const FROGS_PER_LEVEL = 5;
export const LIVES = 3;
export const MAX_DT_MS = 50;
export const MAX_SCORE = 10_000_000;
export const BG_WATER = "#0d2137",
  BG_SHORE = "#2d5a1e";
export type Phase = "playing" | "gameover";
export type PieceKind = "lilypad" | "log" | "turtle";
export type Orientation = "horizontal" | "vertical";
export interface Piece {
  kind: PieceKind;
  orientation: Orientation; // solo relevante para log
}
export interface PlacedPiece extends Piece {
  col: number;
  row: number;
  x: number; // px, puede desplazarse con la corriente
  sinkTimer?: number; // solo tortugas: ms restantes
}
export interface Frog {
  col: number;
  row: number;
  x: number; // px, puede desplazarse con la pieza
  stepTimer: number;
  alive: boolean;
  saved: boolean;
}
export interface CurrentRow {
  row: number;
  speed: number; // px/s, positivo = derecha, negativo = izquierda
}
```

Motor y registro:

```ts
export class PantanoEngine implements GameEngine { /* start, setPaused, finish, destroy */ }

// lib/game-registry.ts
pantano: {
  width: W, height: H,
  createEngine: (canvas, callbacks) => new PantanoEngine(canvas, callbacks),
  controls: [
    { keys: ['<-', '^', '->', 'v'], action: 'Mover cursor' },
    { keys: ['Espacio'], action: 'Colocar pieza' },
    { keys: ['R'], action: 'Rotar tronco' },
  ],
},
```

Mapeo al HUD: `score` = puntos de ranas salvadas; `lives` = vidas restantes (empieza en 3); `level` = nivel actual.

Convenciones:

- Coordenadas con origen arriba a la izquierda; la cuadricula de juego ocupa `x in [0, 640)` y el panel `x in [640, 800)`.
- `dt` en milisegundos tomado de `requestAnimationFrame`, acotado a `MAX_DT_MS`; `lastTime` se reinicia al reanudar.
- Las corrientes alternan direccion por fila (fila impar = derecha, fila par = izquierda). Los troncos colocados se desplazan con la corriente; los nenufares no.
- Las ranas avanzan por un acumulador de tiempo (`stepTimer`). Al avanzar, buscan la mejor celda (arriba, arriba-izquierda, arriba-derecha) con pieza; si no hay, caen al agua.
- Una rana sobre un tronco se desplaza con el; si sale del canvas, cae al agua.
- `entities.ts` contiene funciones puras: `generatePieceQueue()`, `canPlace(grid, piece, col, row)`, `placePiece(grid, piece, col, row)`, `movePieces(pieces, currents, dt)`, `stepFrog(frog, pieces)`, `frogReachedShore(frog)`, `sinkTurtles(pieces, dt)`.
- `onStats` se emite al cambiar `score`, `lives` o `level`, no en cada frame.
- El panel derecho dibuja la pieza actual (con borde), las 2 siguientes y el contador de ranas salvadas.
- La puntuacion se satura en `MAX_SCORE` por contrato.

## Plan de implementacion

Antes del paso 1, leer en `node_modules/next/dist/docs/01-app` la referencia de Client Components y la guia de `cacheComponents`. Usar `/frontend-design` para la portada `.cover-pantano` y la linea de controles. Los nombres de archivo son la propuesta de esta spec.

1. Crear la migracion `20261026160000_juego_pantano.sql` y aplicarla con `apply_migration`; anadir la fila en `supabase/seed.sql` con 3 puntuaciones de `PLAYERTEST` en `pantano` y `.cover-pantano` en `app/globals.css`. Verificacion: la ficha aparece en `/biblioteca` y como pestana en `/salon`; `/juegos/pantano/jugar` muestra el simulado.
2. Crear `lib/pantano/constants.ts`. Verificacion: `npx tsc --noEmit`.
3. Crear `lib/pantano/entities.ts` con `generatePieceQueue`, `canPlace`, `placePiece`, `movePieces`, `stepFrog`, `frogReachedShore` y `sinkTurtles`. Verificacion: `npx tsc --noEmit`.
4. Crear `lib/pantano/engine.ts` con el nucleo: estado, loop con `requestAnimationFrame`, teclado para cursor y colocacion, y dibujo de fondo (agua, orillas, cuadricula). Verificacion: `tsc` y `npm run lint`.
5. Anadir al motor la cola de piezas, el cursor parpadeante, la colocacion con validacion y el dibujo de piezas colocadas (nenufares, troncos, tortugas). Verificacion: `tsc` y `npm run lint`.
6. Anadir al motor las corrientes (desplazamiento de troncos), el hundimiento de tortugas y la rotacion de troncos con `R`. Verificacion: `tsc` y `npm run lint`.
7. Anadir al motor las ranas (aparicion periodica, avance automatico, busqueda de camino, caida al agua, llegada a destino) y la puntuacion. Verificacion: `tsc` y `npm run lint`.
8. Anadir al motor vidas, niveles (cada 5 ranas salvadas), dificultad creciente y el panel lateral. Verificacion: `tsc` y `npm run lint`.
9. Anadir `onStats`, `onGameOver`, `setPaused`, `finish` y `destroy` (quita listeners y cancela el loop). Verificacion: `tsc` y `npm run lint`.
10. Registrar `pantano` en `GAME_REGISTRY` con 800x600 y sus controles. Verificacion: se juega en `/juegos/pantano/jugar`.
11. Revisar el escalado a 1440 px y 375 px. Verificacion: `npm run lint` y `npm run build`.

Cada paso deja la app funcionando.

## Criterios de aceptacion

Base:

- [ ] `npm run build`, `npm run lint` y `npx tsc --noEmit` terminan sin errores.
- [ ] La ficha PANTANO aparece en `/biblioteca` con su portada propia y como pestana en `/salon`.
- [ ] `/juegos/pantano` y `/juegos/pantano/jugar` cargan sin errores en consola ni de hidratacion, ni el aviso «URL data outside of Suspense».
- [ ] PAUSA congela el juego y muestra «EN PAUSA»; REANUDAR continua sin saltos.
- [ ] FIN abre «FIN DEL JUEGO» con la puntuacion actual y deja de procesar entrada de juego.
- [ ] Se puede escribir (incluidos espacios y flechas) en el modal sin que el juego reaccione.
- [ ] Con sesion, «GUARDAR PUNTUACION» crea una fila en `scores` con `game_id = 'pantano'` y muestra «PUNTUACION GUARDADA_»; aparece en `/salon`, y `best`/`plays` de la ficha se actualizan.
- [ ] Sin sesion, el modal muestra «INICIA SESION PARA GUARDAR» con enlace a `/acceso` y no escribe en `scores`.
- [ ] «JUGAR DE NUEVO» reinicia con puntuacion 0 y estado inicial.
- [ ] Al salir con SALIR o cambiar de ruta no quedan listeners de teclado ni loops activos.
- [ ] En desarrollo (Strict Mode) no hay dos motores a la vez ni teclas duplicadas.
- [ ] Con ancho de 375 px el canvas se escala sin scroll horizontal manteniendo su proporcion.
- [ ] La puntuacion guardada es un entero entre 0 y 10 000 000.
- [ ] Asteroids, Tetris, Arkanoid, Snake y los juegos sin entrada en `GAME_REGISTRY` se comportan como antes.

Especificos de Pantano v1:

- [ ] El canvas logico mide 800x600 con cuadricula de 16x15 a la izquierda y panel de 160 px a la derecha.
- [ ] Las flechas mueven un cursor parpadeante por la cuadricula de agua; el cursor no se mueve a las orillas.
- [ ] `Espacio` coloca la pieza actual en la celda del cursor si esta libre y es agua.
- [ ] `R` rota el tronco entre horizontal y vertical antes de colocarlo.
- [ ] Las flechas, `Espacio` y `R` no desplazan la pagina mientras se juega.
- [ ] No se puede colocar una pieza sobre otra pieza ni sobre una rana.
- [ ] Los nenufares permanecen fijos en su celda.
- [ ] Los troncos (3x1) se desplazan con la corriente de su fila y salen por un borde reapareciendo por el opuesto.
- [ ] Las tortugas se hunden 8 s despues de ser colocadas y desaparecen de la cuadricula.
- [ ] Las ranas aparecen periodicamente en la orilla inferior y avanzan una fila cada 1,5 s.
- [ ] Una rana avanza a la celda de arriba si tiene pieza; si no, intenta las diagonales; si no hay opcion, cae al agua y se pierde 1 vida.
- [ ] Una rana sobre un tronco se desplaza con el; si sale del canvas, pierde 1 vida.
- [ ] Cada rana que llega a la orilla superior suma 50 puntos.
- [ ] Con 0 vidas se abre «FIN DEL JUEGO» con la puntuacion correcta.
- [ ] El nivel sube cada 5 ranas salvadas; las ranas aparecen mas rapido y las corrientes son mas fuertes.
- [ ] El panel muestra la pieza actual, las 2 siguientes y «RANAS SALVADAS: N».
- [ ] «JUGAR DE NUEVO» reinicia con 3 vidas, nivel 1, cuadricula vacia y puntuacion 0.
- [ ] El HUD de la plataforma muestra PUNTOS, VIDAS y NIVEL.

## Decisiones

- **Si:** ficha `pantano`, categoria `PUZZLE`, color `magenta`, `sort_order` 15. El arquetipo defensa/oleadas no existe en el catalogo; `PUZZLE` solo tiene Tetris y este puzzle es de planificacion, no de apilado. `magenta` esta en los valores permitidos.
- **Si:** cuadricula de 16x15 con panel lateral de 160 px. Permite mostrar la cola de piezas sin reducir la zona de juego demasiado; misma proporcion 4:3 del canvas.
- **No:** cuadricula completa de 20x15 sin panel. La cola de piezas necesita espacio visual.
- **Si:** 3 tipos de pieza (nenufar, tronco, tortuga) con comportamientos distintos. Da profundidad estrategica: nenufares seguros pero de 1 celda, troncos moviles pero de 3, tortugas temporales.
- **No:** mas tipos de pieza (puente, roca, corriente inversa). Anade complejidad para una futura spec.
- **Si:** las ranas avanzan automaticamente y buscan camino. El jugador no controla las ranas, solo construye el camino; esta es la mecanica core que lo diferencia de Frogger clasico.
- **Si:** 3 vidas, pierde una por rana caida. Permite errores sin terminar de inmediato.
- **Si:** HUD, pausa, modal y guardado de la plataforma; el canvas solo dibuja el juego y el panel lateral.
- **No:** conservar HUD, game over o record local del original. Duplicarian los de la plataforma.
- **No:** regenerar `database.types.ts`. Solo se inserta una fila; el esquema no cambia.

## Riesgos

| Riesgo                                                             | Mitigacion                                                                                                  |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| Strict Mode duplica motor o listeners                              | `destroy()` cancela el loop y quita los listeners; hay criterio de aceptacion                               |
| `dt` grande tras pausa o cambio de pestana                         | `dt` acotado a `MAX_DT_MS` y `lastTime` se reinicia al reanudar                                             |
| Las ranas eligen caminos suboptimos y caen al agua injustamente    | El algoritmo de busqueda prioriza recto > izquierda > derecha; el jugador puede anticipar el patron         |
| Colocar troncos de 3 celdas fuera de los limites                   | `canPlace` valida que todas las celdas del tronco esten dentro de la cuadricula y sean agua                 |
| Muchas piezas y ranas a la vez ralentizan el renderizado           | Se limita el maximo de ranas simultaneas a 8 y piezas colocadas a 40                                        |
| Los troncos que se mueven con la corriente desalinean las ranas    | La rana se mueve en `px` con el tronco; al avanzar de fila se reposiciona en la celda mas cercana con pieza |
| El hundimiento de una tortuga debajo de una rana la mata sin aviso | La tortuga parpadea los ultimos 2 s antes de hundirse como aviso visual                                     |
| `Espacio` activa un boton de la plataforma al reanudar             | `preventDefault` en `Espacio`; ignorar entrada con el juego pausado                                         |

## Que **no** esta en esta spec

- Cocodrilos u obstaculos moviles.
- Piezas especiales (puente, corriente inversa).
- Modo campana con niveles disenados a mano.
- Sonido y musica.
- Controles tactiles, raton o gamepad.
- Sprites o animaciones elaboradas.
- Anti-trampas real.
- Tests automatizados.

Cada uno, si llega, va en su propia spec.
