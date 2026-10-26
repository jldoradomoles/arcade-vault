# SPEC 12 — Juego PANTANO dentro de la plataforma (variante 2: planificacion por oleadas)

> **Status:** borrador
> **Depends on:** SPEC 05, SPEC 06, SPEC 07
> **Date:** 2026-10-26
> **Objective:** Crear Pantano como motor TypeScript jugable en `/juegos/pantano/jugar`, un puzzle por oleadas donde el jugador tiene una fase de planificacion para colocar piezas y luego observa como las ranas cruzan el pantano, sin vidas sino con un minimo de ranas a salvar por oleada, usando el HUD, la pausa y el guardado de puntuacion de la plataforma y su ficha en el leaderboard.

## Por que existe esta spec

Pantano es un puzzle de planificacion inspirado en la tematica Frogger. Esta variante se diferencia de la v1 en que separa la fase de construccion de la fase de cruce: primero el jugador coloca todas las piezas con tiempo limitado, luego las ranas cruzan automaticamente. No hay vidas; la partida termina si no se salvan suficientes ranas en una oleada. El resultado es un puzzle mas reflexivo y menos frenetico.

El registro generico ya existe desde SPEC 07. Esta spec solo anade el juego al registro; no hay refactor.

## Alcance

**Dentro:**

- Fila `pantano` en `games` (migracion + `supabase/seed.sql`) y portada `.cover-pantano` en `app/globals.css`.
- Motor en `lib/pantano/` (`constants.ts`, `entities.ts`, `engine.ts`) que implementa `GameEngine`.
- Entrada `pantano` en `GAME_REGISTRY` con canvas de 800x600 y sus controles.
- Vista cenital. Cuadricula de 20 columnas x 15 filas de 40 px (todo el canvas).
- Fila 14 = orilla inferior (las ranas salen aqui), filas 1-13 = agua con corrientes alternas, fila 0 = orilla superior (destino).
- Dos fases por oleada:
  1. **Fase de colocacion** (temporizador decreciente, empieza en 20 s y baja 1 s por oleada hasta un minimo de 8 s): el jugador mueve un cursor con las flechas y coloca piezas con `Espacio`. Se ve el pantano vacio con las corrientes indicadas por flechas. El jugador tiene un inventario fijo para la oleada (ej. oleada 1: 4 nenufares, 2 troncos, 1 tortuga). El inventario se muestra en la parte inferior.
  2. **Fase de cruce** (automatica): las ranas salen de la orilla inferior con intervalo fijo y avanzan una fila por paso. El jugador no puede colocar piezas. Las piezas con corriente se desplazan. Las ranas buscan el mejor camino hacia arriba. Al terminar todas las ranas, se evalua el resultado.
- Tipos de pieza (mismos que v1): nenufar (1x1 fijo), tronco (3x1 con corriente), tortuga (1x1, se hunde tras 10 s).
- Cada oleada trae N ranas (empieza en 3, sube 1 por oleada hasta 8). El minimo a salvar es `ceil(N * 0.6)`.
- Si se salvan menos del minimo, la partida termina.
- Puntuacion: 50 puntos por rana salvada + 20 puntos por pieza no usada (bonus de eficiencia) + 100 puntos de bonus si se salvan todas las ranas de la oleada.
- Nivel = numero de oleada actual.
- Las corrientes son mas rapidas en oleadas avanzadas. A partir de la oleada 4, aparecen corrientes cruzadas (diagonales).
- `R` rota el tronco antes de colocarlo. `D` descarta la pieza actual (se pierde, no da bonus).
- Aspecto vectorial: agua azul con flechas de corriente semitransparentes, orillas verdes, cursor amarillo, piezas con colores, ranas verdes, indicador de fase prominente.
- Controles: flechas para cursor, `Espacio` para colocar, `R` para rotar, `D` para descartar.

**Fuera de alcance (para futuras specs):**

- Cocodrilos u obstaculos moviles.
- Piezas especiales (puente, roca, corriente inversa).
- Editor de niveles o niveles disenados a mano.
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
export const CELL = 40,
  COLS = 20,
  ROWS = 15;
export const SHORE_TOP = 0,
  SHORE_BOTTOM = 14;
export const PLACE_TIME_BASE_MS = 20_000;
export const PLACE_TIME_DECREASE_MS = 1_000;
export const PLACE_TIME_MIN_MS = 8_000;
export const FROG_STEP_MS = 1_200;
export const FROGS_BASE = 3,
  FROGS_INCREMENT = 1,
  FROGS_MAX = 8;
export const SAVE_RATIO = 0.6; // minimo para no perder
export const LOG_LENGTH = 3;
export const TURTLE_SINK_MS = 10_000;
export const CURRENT_BASE_SPEED = 25;
export const CURRENT_PER_WAVE = 5;
export const FROG_SAVED_POINTS = 50;
export const UNUSED_PIECE_POINTS = 20;
export const ALL_SAVED_BONUS = 100;
export const MAX_DT_MS = 50;
export const MAX_SCORE = 10_000_000;
export const BG_WATER = "#0d2137",
  BG_SHORE = "#2d5a1e";
export type GamePhase = "placing" | "crossing" | "result" | "gameover";
export type PieceKind = "lilypad" | "log" | "turtle";
export type Orientation = "horizontal" | "vertical";
export interface Piece {
  kind: PieceKind;
  orientation: Orientation;
}
export interface PlacedPiece extends Piece {
  col: number;
  row: number;
  x: number;
  sinkTimer?: number;
}
export interface Frog {
  col: number;
  row: number;
  x: number;
  stepTimer: number;
  alive: boolean;
  saved: boolean;
}
export interface WaveInventory {
  lilypads: number;
  logs: number;
  turtles: number;
}
export interface CurrentRow {
  row: number;
  speed: number;
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
    { keys: ['D'], action: 'Descartar pieza' },
  ],
},
```

Mapeo al HUD: `score` = puntos acumulados; `level` = oleada actual; `lives` = no se emite y el HUD oculta VIDAS.

Convenciones:

- Coordenadas con origen arriba a la izquierda; la cuadricula ocupa todo el canvas (20x15, 800x600).
- `dt` en milisegundos tomado de `requestAnimationFrame`, acotado a `MAX_DT_MS`; `lastTime` se reinicia al reanudar.
- Durante la fase de colocacion, el temporizador se muestra como barra en la parte superior del canvas. Las flechas de corriente se dibujan semitransparentes en cada fila de agua. El inventario de piezas se muestra en la parte inferior.
- Durante la fase de cruce, las ranas avanzan automaticamente, los troncos se desplazan con la corriente y las tortugas cuentan atras. El jugador no puede interactuar.
- Tras la fase de cruce, se muestra un resumen de 3 s: ranas salvadas / total, puntos obtenidos. Si no se alcanzo el minimo, se pasa a game over.
- `entities.ts` contiene funciones puras: `generateInventory(wave)`, `generateCurrents(wave)`, `canPlace(grid, piece, col, row)`, `placePiece(grid, piece, col, row)`, `movePieces(pieces, currents, dt)`, `stepFrog(frog, pieces)`, `frogReachedShore(frog)`, `sinkTurtles(pieces, dt)`, `evaluateWave(saved, total)`.
- `onStats` se emite al cambiar `score` o `level`, no en cada frame.
- La puntuacion se satura en `MAX_SCORE` por contrato.

## Plan de implementacion

Antes del paso 1, leer en `node_modules/next/dist/docs/01-app` la referencia de Client Components y la guia de `cacheComponents`. Usar `/frontend-design` para la portada `.cover-pantano` y la linea de controles. Los nombres de archivo son la propuesta de esta spec.

1. Crear la migracion `20261026160000_juego_pantano.sql` y aplicarla con `apply_migration`; anadir la fila en `supabase/seed.sql` con 3 puntuaciones de `PLAYERTEST` en `pantano` y `.cover-pantano` en `app/globals.css`. Verificacion: la ficha aparece en `/biblioteca` y como pestana en `/salon`; `/juegos/pantano/jugar` muestra el simulado.
2. Crear `lib/pantano/constants.ts`. Verificacion: `npx tsc --noEmit`.
3. Crear `lib/pantano/entities.ts` con `generateInventory`, `generateCurrents`, `canPlace`, `placePiece`, `movePieces`, `stepFrog`, `frogReachedShore`, `sinkTurtles` y `evaluateWave`. Verificacion: `npx tsc --noEmit`.
4. Crear `lib/pantano/engine.ts` con el nucleo: estado, loop con `requestAnimationFrame`, fases `placing`/`crossing`/`result`/`gameover`, teclado para cursor, y dibujo de fondo (agua con flechas de corriente, orillas, cuadricula). Verificacion: `tsc` y `npm run lint`.
5. Anadir al motor la fase de colocacion: temporizador, cursor, inventario en la parte inferior, colocacion de piezas con validacion, rotacion con `R` y descarte con `D`. Verificacion: `tsc` y `npm run lint`.
6. Anadir al motor la fase de cruce: ranas automaticas, corrientes que mueven troncos, hundimiento de tortugas, deteccion de caida y llegada a destino. Verificacion: `tsc` y `npm run lint`.
7. Anadir al motor la pantalla de resultado (3 s), la evaluacion de oleada (minimo 60%), el bonus por eficiencia y la transicion a la siguiente oleada o game over. Verificacion: `tsc` y `npm run lint`.
8. Anadir al motor la dificultad creciente (menos tiempo, mas ranas, corrientes mas rapidas) y las corrientes diagonales desde la oleada 4. Verificacion: `tsc` y `npm run lint`.
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

Especificos de Pantano v2:

- [ ] El canvas logico mide 800x600 con cuadricula de 20x15 de 40 px.
- [ ] Cada oleada empieza con una fase de colocacion con temporizador visible en la parte superior.
- [ ] Durante la fase de colocacion, las flechas mueven un cursor y `Espacio` coloca la pieza seleccionada del inventario.
- [ ] `R` rota el tronco entre horizontal y vertical antes de colocarlo.
- [ ] `D` descarta la pieza actual del inventario sin colocarla y no da bonus de eficiencia.
- [ ] Las flechas, `Espacio`, `R` y `D` no desplazan la pagina mientras se juega.
- [ ] El inventario de piezas se muestra en la parte inferior del canvas con la cantidad restante de cada tipo.
- [ ] Las flechas de corriente se ven semitransparentes en cada fila de agua durante la colocacion.
- [ ] Al terminar el temporizador de colocacion (o al colocar todas las piezas), empieza la fase de cruce.
- [ ] Durante la fase de cruce, las ranas avanzan automaticamente y el jugador no puede interactuar.
- [ ] Los troncos se desplazan con la corriente; los nenufares no.
- [ ] Las tortugas se hunden 10 s despues de colocarlas; parpadean los ultimos 2 s.
- [ ] Una rana que cae al agua no cuenta como salvada pero no resta vidas.
- [ ] Al terminar la oleada, se muestra un resumen de 3 s con ranas salvadas y puntos.
- [ ] Cada rana salvada suma 50 puntos; cada pieza no usada suma 20 puntos; salvar todas las ranas da 100 puntos extra.
- [ ] Si se salvan menos del 60% de las ranas, se abre «FIN DEL JUEGO».
- [ ] La oleada 1 tiene 3 ranas; cada oleada anade 1 hasta un maximo de 8.
- [ ] El tiempo de colocacion empieza en 20 s y baja 1 s por oleada hasta un minimo de 8 s.
- [ ] A partir de la oleada 4, las corrientes tienen componente diagonal.
- [ ] El nivel del HUD coincide con el numero de oleada.
- [ ] «JUGAR DE NUEVO» reinicia con oleada 1, cuadricula vacia y puntuacion 0.
- [ ] El HUD de la plataforma muestra PUNTOS y NIVEL; oculta VIDAS.

## Decisiones

- **Si:** ficha `pantano`, categoria `PUZZLE`, color `magenta`, `sort_order` 15. Misma ficha que la v1; la variante no cambia la identidad del juego en el catalogo.
- **Si:** dos fases separadas (colocacion + cruce). Da tiempo para pensar y convierte el juego en un puzzle mas puro, diferenciandolo claramente de la v1 en tiempo real.
- **No:** tiempo real continuo. La v1 cubre ese enfoque.
- **Si:** sin vidas; fin de partida por no salvar suficientes ranas (60%). El jugador siempre tiene oportunidad de mejorar; el umbral es justo.
- **No:** 3 vidas como en la v1. Las fases separadas no generan la urgencia que justifica las vidas.
- **Si:** inventario fijo por oleada con bonus por piezas no usadas. Premia la eficiencia y la planificacion.
- **Si:** descarte con `D`. Permite descartar piezas inutiles, pero a costa de perder el bonus.
- **Si:** corrientes diagonales desde la oleada 4. Aumenta la complejidad de forma progresiva.
- **Si:** cuadricula de 20x15 sin panel lateral. Toda la pantalla es zona de juego; el inventario y el temporizador se superponen.
- **Si:** HUD, pausa, modal y guardado de la plataforma; el canvas solo dibuja el juego, el temporizador, el inventario y el resumen.
- **No:** conservar HUD, game over o record local del original. Duplicarian los de la plataforma.
- **No:** regenerar `database.types.ts`. Solo se inserta una fila; el esquema no cambia.

## Riesgos

| Riesgo                                                                          | Mitigacion                                                                                      |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Strict Mode duplica motor o listeners                                           | `destroy()` cancela el loop y quita los listeners; hay criterio de aceptacion                   |
| `dt` grande tras pausa o cambio de pestana                                      | `dt` acotado a `MAX_DT_MS` y `lastTime` se reinicia al reanudar                                 |
| Las ranas eligen caminos suboptimos y la oleada es injusta                      | El algoritmo es deterministico y visible; el jugador puede aprender el patron de busqueda       |
| El temporizador de colocacion sigue corriendo durante la pausa                  | `setPaused` congela el temporizador; no usa `Date.now()` sino acumulador de `dt`                |
| Las corrientes diagonales hacen que los troncos salgan del canvas en ambos ejes | Los troncos se ciñen a su fila; la componente diagonal solo afecta al desplazamiento horizontal |
| 8 ranas simultaneas en la fase de cruce saturan el canvas de 40 px por celda    | Las ranas se dibujan mas pequenas (28 px) y se espacian con intervalo de 1,2 s                  |
| El jugador no entiende la fase de cruce al principio                            | Se muestra un rotulo «LAS RANAS CRUZAN» y las flechas del cursor desaparecen                    |
| `Espacio` activa un boton de la plataforma al reanudar                          | `preventDefault` en `Espacio`; ignorar entrada con el juego pausado                             |

## Que **no** esta en esta spec

- Cocodrilos u obstaculos moviles.
- Piezas especiales (puente, roca, corriente inversa).
- Editor de niveles o niveles disenados a mano.
- Sonido y musica.
- Controles tactiles, raton o gamepad.
- Sprites o animaciones elaboradas.
- Anti-trampas real.
- Tests automatizados.

Cada uno, si llega, va en su propia spec.
