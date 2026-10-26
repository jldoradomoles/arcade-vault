# SPEC 07 — Juego Tetris dentro de la plataforma

> **Status:** implementado
> **Depends on:** SPEC 05, SPEC 06
> **Date:** 2026-10-25
> **Objective:** Portar Tetris de `references/started-games/03-tetris` a un motor TypeScript jugable en `/juegos/tetris/jugar`, con el HUD, la pausa y el guardado de puntuación de la plataforma y su ficha en el leaderboard.

## Por qué existe esta spec

Tetris es el segundo juego real tras Asteroids (SPEC 05). La referencia es un juego en JS vanilla con estado global en `game.js`, HUD, pausa, game over y récords locales dibujados en el DOM del propio juego. La plataforma ya ofrece todo eso, así que el port se queda con las reglas y el dibujo del tablero.

Como Asteroids es el único juego conectado y el reproductor tiene `isAsteroids` fijo en `components/game-player.tsx`, esta spec incluye el refactor al registro genérico (`lib/game-engine.ts`, `lib/game-registry.ts`, `components/game-canvas.tsx`). Desde aquí, añadir un juego es registrarlo.

## Alcance

**Dentro:**

- Refactor al registro genérico: `lib/game-engine.ts`, `components/game-canvas.tsx` y `lib/game-registry.ts`; Asteroids migra sin cambios de comportamiento y se borra `components/asteroids-canvas.tsx`.
- Fila `tetris` en `games` (migración + `supabase/seed.sql`) y portada `.cover-tetris` en `app/globals.css`.
- Motor en `lib/tetris/` (`constants.ts`, `entities.ts`, `engine.ts`) que implementa `GameEngine`.
- Entrada `tetris` en `GAME_REGISTRY` con canvas de 480×600 y sus controles.
- Tablero de 10×20, las 7 piezas (I, O, T, S, Z, J, L) con colores de la skin retro, rotación horaria con _wall kicks_ `[0, -1, 1, -2, 2]` y pieza fantasma (alpha 0,2).
- Caída por acumulador de tiempo: `dropInterval = max(100, 1000 − (nivel − 1) × 90)` ms.
- Soft drop (+1 punto por fila) y hard drop (+2 puntos por celda recorrida).
- Limpieza de líneas con puntos `[0, 100, 300, 500, 800] × nivel`; el nivel sube cada 10 líneas.
- Bloque comodín (índice 9): una fila se completa si sus huecos no superan sus comodines.
- Power-ups: cada 5 líneas la siguiente pieza es un bloque único de poder aleatorio: **Bomba** (3×3, +10 por celda), **Rayo** (fila o columna, +10 por celda), **Tinte** (un color pasa a comodín), **Gravedad** (compacta cada columna) y **Congelar** (5 s sin caída).
- Retardo de 250 ms que ignora teclas justo tras reanudar (`RESUME_LOCK_MS`).
- Dibujo en el canvas de lo que la plataforma no tiene: panel lateral con SIGUIENTE (rejilla 4×4), LÍNEAS y el estado de power-up («❄ Congelado Ns» o el aviso del último poder, 2 s).

**Fuera de alcance (para futuras specs):**

- Las 4 skins (solo retro), el tema claro/oscuro y el selector de skin.
- Selector de nivel inicial: la partida siempre empieza en nivel 1.
- Pantalla de inicio, menú de pausa propio, «Ver controles» y récords locales (`tetris-records`): son de la plataforma.
- Pieza reto «torre» 3×3: en el original está comentada en `PIECES` y por tanto no sale nunca; no se porta.
- Controles táctiles o gamepad.
- Sonido y música.
- Anti-trampas real (ver SPEC 06).
- Tests automatizados.

## Modelo de datos

Fila del catálogo (`supabase/migrations/20261025120000_juego_tetris.sql` y el mismo `insert` en `supabase/seed.sql`):

```sql
insert into public.games (id, title, short, long, category, cover, color, sort_order)
values ('tetris', 'TETRIS', 'Encaja las piezas y limpia líneas antes de que el tablero se llene.',
        'Ordena las piezas que caen en un tablero de 10×20 y completa líneas para puntuar. Cada diez líneas sube el nivel y la caída se acelera. Cada cinco líneas llega un power-up: bomba, rayo, tinte, gravedad o congelar el tiempo. La partida termina cuando una pieza nueva ya no cabe.',
        'PUZZLE', 'cover-tetris', 'magenta', 10)
on conflict (id) do nothing;
```

Contrato genérico (`lib/game-engine.ts`):

```ts
export interface GameStats {
  score: number;
  lives?: number;
  level?: number;
}
export interface GameCallbacks {
  onStats: (s: GameStats) => void; // solo cuando cambia algún valor
  onGameOver: (finalScore: number) => void; // una sola vez por partida
}
export interface GameEngine {
  start(): void;
  setPaused(paused: boolean): void;
  finish(): void; // botón FIN
  destroy(): void;
}
export type CreateEngine = (
  canvas: HTMLCanvasElement,
  cb: GameCallbacks,
) => GameEngine;
```

Registro (`lib/game-registry.ts`, sin `next/headers`):

```ts
export interface GameEntry {
  width: number;
  height: number;
  createEngine: CreateEngine;
  controls: { keys: string[]; action: string }[];
}
export const GAME_REGISTRY: Record<string, GameEntry> = {
  asteroids: {
    width: 800,
    height: 600,
    createEngine: (c, cb) => new AsteroidsEngine(c, cb),
    controls: [/* los actuales */],
  },
  tetris: {
    width: 480,
    height: 600,
    createEngine: (c, cb) => new TetrisEngine(c, cb),
    controls: [
      { keys: ["←", "→"], action: "mover" },
      { keys: ["↑", "X"], action: "rotar" },
      { keys: ["↓"], action: "bajar" },
      { keys: ["Espacio"], action: "caída" },
    ],
  },
};
```

Constantes y tipos de `lib/tetris/constants.ts`:

```ts
export const COLS = 10,
  ROWS = 20,
  BLOCK = 30;
export const W = 480,
  H = 600; // tablero 300×600 + panel 180×600
export const LINE_SCORES = [0, 100, 300, 500, 800] as const;
export const WILD = 9,
  POWER_EVERY = 5,
  FREEZE_MS = 5000,
  RESUME_LOCK_MS = 250,
  CELL_POINTS = 10;
// + COLORS (skin retro, mismos índices 1–14 que game.js), PIECES (7 formas), POWERS (10–14)
export type Cell = number; // 0 vacío, 1–7 pieza, 9 comodín
export interface Piece {
  type: number;
  shape: number[][];
  x: number;
  y: number;
  power?: boolean;
}
```

Mapeo al HUD: `score` = puntos del juego; `level` = nivel actual; `lives` = no se emite y el HUD oculta VIDAS. Las líneas no tienen casilla en el HUD y se dibujan en el panel del canvas.

Convenciones:

- Coordenadas con origen arriba a la izquierda; el tablero ocupa `x ∈ [0, 300)` y el panel `x ∈ [300, 480)`.
- `dt` en milisegundos tomado de `requestAnimationFrame`, acotado a 50 ms; `lastTime` se reinicia al reanudar.
- El estado global de `game.js` pasa a campos privados de `TetrisEngine`; la lógica de tablero (`collide`, `rotateCW`, `compactColumn`, `applyPower`) vive en `entities.ts` como funciones que reciben el tablero por parámetro.
- Los power-ups usan `Math.random()` igual que el original.
- `onStats` se emite al cambiar `score` o `level`, no en cada frame.
- La puntuación no puede superar 10 000 000 (límite de `submitScore`); el motor la satura en ese valor.

## Plan de implementación

Antes del paso 1, leer en `node_modules/next/dist/docs/01-app` la referencia de Client Components y la guía de `cacheComponents`. Usar `/frontend-design` para la portada `.cover-tetris` y la línea de controles. Los nombres de archivo son la propuesta de esta spec.

1. Refactor al registro: crear `lib/game-engine.ts`; hacer que `AsteroidsEngine` implemente `GameEngine` (su `AsteroidsStats` pasa a `GameStats`). Verificación: `npx tsc --noEmit`.
2. Crear `components/game-canvas.tsx` (generaliza `asteroids-canvas.tsx`: props `createEngine`, `width`, `height`, `paused`, `over`, `onStats`, `onGameOver`; `aspect-ratio` según `width/height`) y `lib/game-registry.ts` con solo `asteroids`. Verificación: `npx tsc --noEmit`.
3. Adaptar `components/game-player.tsx` a `GAME_REGISTRY[game.id]` (desaparece `isAsteroids`; los controles salen del registro) y borrar `components/asteroids-canvas.tsx`. Verificación: Asteroids se juega igual (puntos, vidas, nivel, pausa, modal, guardado) y los demás juegos conservan el simulado.
4. Migración `20261025120000_juego_tetris.sql` aplicada con `apply_migration`, la fila en `supabase/seed.sql` con 3 puntuaciones de `PLAYERTEST` en `tetris` (su mejor marca ni primera ni última) y `.cover-tetris` en `app/globals.css`. Verificación: la ficha aparece en `/biblioteca` y como pestaña en `/salon`; `/juegos/tetris/jugar` muestra el simulado; ejecutar el seed dos veces no duplica filas.
5. Crear `lib/tetris/constants.ts`. Verificación: `npx tsc --noEmit`.
6. Crear `lib/tetris/entities.ts` con `createBoard`, `randomPiece`, `collide`, `rotateCW`, `tryRotate`, `merge`, `ghostY`. Verificación: `npx tsc --noEmit`.
7. Añadir a `entities.ts` `clearLines` (con comodín), `compactColumn` y `applyPower` para los 5 poderes. Verificación: `npx tsc --noEmit`.
8. Crear `lib/tetris/engine.ts` con el núcleo: estado, loop con `requestAnimationFrame`, caída por acumulador, teclado (`←` `→` `↓` `↑`/`X` `Espacio`), `lockPiece`, `spawn` y puntuación. Verificación: `tsc` y `npm run lint`.
9. Añadir al motor el dibujo: rejilla, tablero, fantasma, pieza actual, iconos de poder y comodín, y panel lateral con SIGUIENTE, LÍNEAS y estado de power-up. Verificación: `tsc` y `npm run lint`.
10. Añadir al motor niveles y velocidad, el ciclo de power-ups (`powerAt`, `powerPending`, congelación y aviso de 2 s) y el bloqueo de 250 ms tras reanudar. Verificación: `tsc` y `npm run lint`.
11. Añadir `onStats`, `onGameOver`, `setPaused`, `finish` y `destroy` (quita listeners y cancela el loop). Verificación: `tsc` y `npm run lint`.
12. Registrar `tetris` en `GAME_REGISTRY` con 480×600 y sus controles. Verificación: se juega en `/juegos/tetris/jugar`.
13. Revisar el escalado a 1440 px y 375 px. Verificación: `npm run lint` y `npm run build`.

Cada paso deja la app funcionando.

## Criterios de aceptación

Base:

- [ ] `npm run build`, `npm run lint` y `npx tsc --noEmit` terminan sin errores.
- [ ] La ficha TETRIS aparece en `/biblioteca` con su portada propia y como pestaña en `/salon`.
- [ ] `/juegos/tetris` y `/juegos/tetris/jugar` cargan sin errores en consola ni de hidratación, ni el aviso «URL data outside of Suspense».
- [ ] PAUSA congela el juego y muestra «EN PAUSA»; REANUDAR continúa sin saltos.
- [ ] FIN abre «FIN DEL JUEGO» con la puntuación actual y deja de procesar entrada de juego.
- [ ] Se puede escribir (incluidos espacios y flechas) en el modal sin que el juego reaccione.
- [ ] Con sesión, «GUARDAR PUNTUACIÓN» crea una fila en `scores` con `game_id = 'tetris'` y muestra «PUNTUACIÓN GUARDADA_»; aparece en `/salon`, y `best`/`plays` de la ficha se actualizan.
- [ ] Sin sesión, el modal muestra «INICIA SESIÓN PARA GUARDAR» con enlace a `/acceso` y no escribe en `scores`.
- [ ] «JUGAR DE NUEVO» reinicia con puntuación 0, nivel 1, tablero vacío y 0 líneas.
- [ ] Al salir con SALIR o cambiar de ruta no quedan listeners de teclado ni loops activos.
- [ ] En desarrollo (Strict Mode) no hay dos motores a la vez ni teclas duplicadas.
- [ ] Con ancho de 375 px el canvas se escala sin scroll horizontal manteniendo 480:600.
- [ ] La puntuación guardada es un entero entre 0 y 10 000 000.
- [ ] Asteroids se comporta igual que antes del refactor (puntos, vidas, nivel, power-ups, pausa, modal y guardado).
- [ ] Los otros juegos del catálogo sin entrada en `GAME_REGISTRY` conservan el reproductor simulado.
- [ ] `rg "isAsteroids|asteroids-canvas"` no devuelve resultados.

Específicos de Tetris:

- [ ] El tablero tiene 10 columnas × 20 filas y el canvas lógico mide 480×600.
- [ ] `←` y `→` mueven la pieza una columna y no la sacan del tablero ni la meten en bloques fijados.
- [ ] `↑` y `X` rotan la pieza en sentido horario; pegada a una pared la rotación se desplaza hasta 2 columnas en lugar de fallar.
- [ ] `↓` baja una fila y suma 1 punto; `Espacio` deja la pieza en la posición del fantasma y suma 2 puntos por celda recorrida.
- [ ] `Espacio` y las flechas no desplazan la página mientras se juega.
- [ ] El fantasma se dibuja con transparencia en la posición donde caerá la pieza.
- [ ] El panel muestra la siguiente pieza, y esa pieza es la que aparece al fijarse la actual.
- [ ] Limpiar 1, 2, 3 y 4 líneas a la vez suma 100, 300, 500 y 800 multiplicado por el nivel.
- [ ] El nivel del HUD sube en 1 cada 10 líneas y el panel muestra el total de líneas.
- [ ] En nivel 1 la pieza cae cada 1000 ms y en nivel 5 cada 640 ms; nunca cae más rápido que cada 100 ms.
- [ ] Una fila con tantos comodines como huecos se limpia.
- [ ] Cada 5 líneas totales la siguiente pieza es un bloque único de poder.
- [ ] Bomba vacía el área 3×3 alrededor del bloque, compacta esas columnas y suma 10 puntos por celda eliminada.
- [ ] Rayo vacía la fila o la columna del bloque y suma 10 puntos por celda eliminada.
- [ ] Tinte convierte en comodín todas las celdas del color bajo el bloque (o del color más frecuente si no hay).
- [ ] Gravedad hace que no quede ningún hueco bajo un bloque en ninguna columna.
- [ ] Congelar detiene la caída 5 s, muestra «❄ Congelado Ns» en el panel y tiñe el tablero; el teclado sigue activo.
- [ ] Tras usar un poder el panel muestra su nombre durante 2 s.
- [ ] Si la pieza nueva colisiona al aparecer, se abre «FIN DEL JUEGO» con la puntuación final.
- [ ] Tras reanudar, las teclas se ignoran durante 250 ms.
- [ ] El HUD de la plataforma oculta VIDAS en Tetris y muestra PUNTOS y NIVEL.
- [ ] La torre 3×3 no aparece nunca.

## Decisiones

- **Sí:** refactor al registro genérico dentro de esta spec. Es el primer juego tras Asteroids y `isAsteroids` no escala; separarlo en otra spec dejaría un paso sin juego nuevo.
- **No:** copiar `asteroids-canvas.tsx` a `tetris-canvas.tsx`. Duplicaría el patrón de ciclo de vida del motor.
- **Sí:** portar todo el contenido de la referencia salvo skins y la torre: reglas clásicas, comodín y los 5 power-ups. Decisión del usuario; fidelidad 1:1 con la lógica activa del original.
- **No:** portar la pieza reto «torre». El original la tiene comentada (`PIECES[8]`), así que su `CHALLENGE_CHANCE` nunca se activa; portarla sería añadir una mecánica nueva.
- **Sí:** canvas lógico de 480×600 con tablero 300×600 y panel lateral de 180 px dibujado por el motor. Decisión del usuario; la plataforma no tiene vista de siguiente pieza ni indicador de power-up.
- **Sí:** ficha `tetris`, categoría `PUZZLE`, color `magenta`, `sort_order` 10. Decisión del usuario; `cyan` ya es de Asteroids y los valores están permitidos por el `check` de BD y `lib/game-types.ts`, así que no cambia el esquema.
- **Sí:** `score` y `level` al HUD, sin `lives`. Decisión del usuario; Tetris no tiene vidas y el HUD las oculta si no se emiten.
- **Sí:** solo skin retro y nivel inicial fijo en 1. Decisión del usuario; skins y selector exigirían UI de plataforma que no existe.
- **Sí:** HUD, pausa, modal y guardado de la plataforma; el canvas solo dibuja el juego y el panel lateral.
- **No:** conservar la pantalla de inicio, el menú de pausa, el game over ni los récords locales del original. Duplicarían los de la plataforma; el récord es el leaderboard.
- **No:** teclas `P`/`Esc` dentro del motor. La pausa es el botón de la plataforma.
- **Sí:** la puntuación se satura en 10 000 000. Es el límite de `submitScore` (SPEC 06) y evita que una partida larga no se pueda guardar.
- **No:** regenerar `database.types.ts`. Solo se inserta una fila; el esquema no cambia.

## Riesgos

| Riesgo                                                                        | Mitigación                                                                                      |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Strict Mode duplica motor o listeners                                         | `destroy()` cancela el loop y quita los listeners; hay criterio de aceptación                   |
| `dt` grande tras pausa o cambio de pestaña                                    | `dt` acotado a 50 ms y `lastTime` se reinicia al reanudar                                       |
| El refactor del registro rompe Asteroids                                      | Pasos 1–3 se verifican jugando Asteroids antes de añadir nada de Tetris; criterio de aceptación |
| Divergencias al pasar las globales de `game.js` a campos de clase             | La lógica de tablero se aísla en funciones puras de `entities.ts` y cada poder tiene criterio   |
| `Espacio` activa un botón enfocado de la plataforma al reanudar tras la pausa | `RESUME_LOCK_MS` ignora teclas 250 ms y el canvas no toma el foco de teclado                    |
| Los iconos emoji de los poderes se ven distinto según el sistema              | Solo afecta al aspecto; se aceptan                                                              |
| Canvas 480×600 muy alto en pantallas bajas dentro del marco CRT               | Ancho 100 % con `aspect-ratio`; revisión a 1440 px y 375 px en el último paso                   |
| El nuevo `sort_order` 10 choca con otro juego                                 | Se comprobó que el catálogo solo contiene `asteroids` (9) tras la migración de limpieza         |

## Qué **no** está en esta spec

- Skins, tema claro/oscuro y selector de nivel inicial.
- Pieza reto «torre» 3×3.
- Pantalla de inicio, menú de pausa y récords locales del original.
- Controles táctiles o gamepad.
- Sonido y música.
- Anti-trampas real.
- Tests automatizados.

Cada uno, si llega, va en su propia spec.
