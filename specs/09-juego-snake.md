# SPEC 09 — Juego Snake dentro de la plataforma

> **Status:** implementado
> **Depends on:** SPEC 05, SPEC 06, SPEC 07
> **Date:** 2026-10-26
> **Objective:** Crear Snake como motor TypeScript jugable en `/juegos/snake/jugar`, con los sprites de frutas de `references/resource-assets`, el HUD, la pausa y el guardado de puntuación de la plataforma y su ficha en el leaderboard.

## Por qué existe esta spec

Snake es el cuarto juego real tras Asteroids (SPEC 05), Tetris (SPEC 07) y Arkanoid (SPEC 08). No hay código de referencia: solo `references/resource-assets/fruits.png` (hoja de 3790×442 px con fondo transparente) y `sprites.js`, que describe el recorte de cada fruta de la fila central. Las reglas, el motor y el dibujo de la serpiente son nuevos.

El registro genérico ya existe desde SPEC 07 (`lib/game-engine.ts`, `lib/game-registry.ts`, `components/game-canvas.tsx`). Esta spec solo añade el juego al registro; no hay refactor.

## Alcance

**Dentro:**

- Fila `snake` en `games` (migración + `supabase/seed.sql`) y portada `.cover-snake` en `app/globals.css`.
- Motor en `lib/snake/` (`constants.ts`, `entities.ts`, `engine.ts`) que implementa `GameEngine`.
- Entrada `snake` en `GAME_REGISTRY` con canvas de 800×600 y sus controles.
- Asset copiado a `public/games/snake/fruits.png`.
- Tablero de 20 columnas × 15 filas con celdas de 40 px. Los bordes son muros: chocar con uno termina la partida.
- Serpiente de 3 segmentos que avanza una celda por paso, empieza en el centro-izquierda mirando a la derecha y crece un segmento por fruta.
- Una única fruta en el tablero, en una celda libre al azar. El sprite sale al azar de las 22 frutas de `sprites.js` y se dibuja escalado para caber en la celda, centrado y sin deformarse.
- Cada fruta vale 10 puntos. Cada 5 frutas comidas sube el nivel en 1.
- Velocidad: un paso cada `max(70, 140 − (nivel − 1) × 10)` ms.
- La serpiente espera quieta hasta la primera tecla de dirección válida (`↑`, `↓` o `→`); mientras espera, el canvas muestra el rótulo «PULSA UNA FLECHA».
- Cola de entrada de hasta 2 giros pendientes, para que dos pulsaciones rápidas dentro de un mismo paso no se pierdan ni permitan girar 180°.
- Fin de partida al chocar con un muro, con el propio cuerpo o al llenar las 300 celdas; en el último caso también se llama a `onGameOver`.
- Aspecto vectorial en el canvas: tablero en cuadrícula oscura, cabeza y cuerpo con los colores de la plataforma y frutas con sprite.
- Controles: `←` `↑` `→` `↓` o `A` `W` `D` `S`.

**Fuera de alcance (para futuras specs):**

- Sonido y música.
- Controles táctiles o gestos de deslizar, y gamepad.
- Frutas especiales (bonus, doble puntuación) y más de una fruta a la vez.
- Vidas: la partida termina al primer choque.
- Bordes envolventes, obstáculos y otros modos.
- Selector de velocidad o dificultad inicial.
- Récord local: el récord es el leaderboard.
- Anti-trampas real (ver SPEC 06).
- Tests automatizados.

## Modelo de datos

Fila del catálogo (`supabase/migrations/20261026130000_juego_snake.sql` y el mismo `insert` en `supabase/seed.sql`):

```sql
insert into public.games (id, title, short, long, category, cover, color, sort_order)
values ('snake', 'SNAKE', 'Come fruta, crece y no choques contigo ni con el muro.',
        'Guía a la serpiente por un tablero cerrado y cómete las frutas que aparecen. Cada una te da 10 puntos y alarga tu cuerpo; cada cinco frutas sube el nivel y la serpiente se mueve más rápido. Si tocas un muro o tu propia cola, se acaba la partida.',
        'ARCADE', 'cover-snake', 'green', 12)
on conflict (id) do nothing;
```

Constantes y tipos (`lib/snake/constants.ts`):

```ts
export const W = 800,
  H = 600;
export const CELL = 40,
  COLS = 20,
  ROWS = 15;
export const START_LENGTH = 3,
  FRUIT_POINTS = 10,
  FRUITS_PER_LEVEL = 5;
export const STEP_BASE_MS = 140,
  STEP_DECREASE_MS = 10,
  STEP_MIN_MS = 70;
export const MAX_DT_MS = 50;
export const MAX_QUEUED_TURNS = 2;
export const MAX_SCORE = 10_000_000;
export const BG = "#11111f";
// + GRID_LINE, HEAD_COLOR, BODY_COLOR, FRUIT_FALLBACK_COLOR
// + FRUIT_SPRITES: las 22 entradas de sprites.js ({ x, y, w, h } sobre fruits.png)
// + FRUITS_SRC = "/games/snake/fruits.png"
export type Dir = "up" | "down" | "left" | "right";
export type Phase = "ready" | "playing" | "gameover";
export interface Cell {
  x: number; // columna 0..19
  y: number; // fila 0..14
}
export interface Fruit extends Cell {
  sprite: number; // índice en FRUIT_SPRITES
}
```

Motor y registro:

```ts
export class SnakeEngine implements GameEngine { /* start, setPaused, finish, destroy */ }

// lib/game-registry.ts
snake: {
  width: W, height: H,
  createEngine: (canvas, callbacks) => new SnakeEngine(canvas, callbacks),
  controls: [
    { keys: ["←", "↑", "→", "↓"], action: "Mover" },
    { keys: ["A", "W", "D", "S"], action: "Mover" },
  ],
},
```

Mapeo al HUD: `score` = 10 × frutas comidas; `level` = `1 + floor(frutas / 5)`; `lives` = no se emite y el HUD oculta VIDAS.

Convenciones:

- Coordenadas con origen arriba a la izquierda; una celda `(x, y)` ocupa los píxeles `[x·40, x·40+40) × [y·40, y·40+40)`.
- `dt` en milisegundos tomado de `requestAnimationFrame`, acotado a `MAX_DT_MS`; `lastTime` se reinicia al reanudar. Un acumulador avanza la serpiente un paso cada vez que supera el intervalo del nivel.
- La serpiente es un arreglo de `Cell` con la cabeza en el índice 0. La cola se libera al avanzar, así que mover la cabeza a la celda que acaba de dejar la cola no cuenta como choque.
- El estado de partida pasa a campos privados de `SnakeEngine`; `entities.ts` contiene funciones puras que reciben el estado por parámetro: `stepInterval(level)`, `isOpposite(a, b)`, `nextHead(head, dir)`, `hitsWall(cell)`, `hitsBody(snake, cell)`, `pickFruitCell(snake, rand)` (devuelve `null` si no hay celda libre) y `drawFruitSprite`.
- La imagen se carga con `new Image()` dentro de `start()` y se pinta con `drawImage` escalando por `min(CELL / w, CELL / h)` (con un pequeño margen) y centrando. Mientras no esté cargada, la fruta se dibuja como un círculo de `FRUIT_FALLBACK_COLOR` y el juego no se detiene.
- Los giros se leen de `keydown` en `window`: se descartan los que repiten la dirección actual, los opuestos a la última dirección encolada y los que superan `MAX_QUEUED_TURNS`.
- `onStats` se emite al cambiar `score` o `level`, no en cada frame. La puntuación máxima posible es de 2 970 puntos; el motor la satura en `MAX_SCORE` por contrato.

## Plan de implementación

Antes del paso 1, leer en `node_modules/next/dist/docs/01-app` la referencia de Client Components y la guía de `cacheComponents`. Usar `/frontend-design` para la portada `.cover-snake` y la línea de controles. Los nombres de archivo son la propuesta de esta spec.

1. Copiar `references/resource-assets/fruits.png` a `public/games/snake/fruits.png`, crear la migración `20261026130000_juego_snake.sql` y aplicarla con `apply_migration`; añadir la fila en `supabase/seed.sql` con 3 puntuaciones de `PLAYERTEST` en `snake` (su mejor marca ni primera ni última) y `.cover-snake` en `app/globals.css`. Verificación: la ficha aparece en `/biblioteca` y como pestaña en `/salon`; `/juegos/snake/jugar` muestra el simulado; ejecutar el seed dos veces no duplica filas.
2. Crear `lib/snake/constants.ts`, incluidas las 22 entradas de `FRUIT_SPRITES` con las coordenadas de `sprites.js`. Verificación: `npx tsc --noEmit`.
3. Crear `lib/snake/entities.ts` con las funciones puras listadas en las convenciones. Verificación: `npx tsc --noEmit`.
4. Crear `lib/snake/engine.ts` con el núcleo: estado, loop con `requestAnimationFrame`, acumulador de pasos, teclado con cola de giros, fase `ready` y dibujo de fondo, cuadrícula y serpiente. Verificación: `tsc` y `npm run lint`.
5. Añadir al motor la fruta (carga del sprite, aparición en celda libre, dibujo escalado y círculo de respaldo), el crecimiento, la puntuación y los niveles con la velocidad. Verificación: `tsc` y `npm run lint`.
6. Añadir al motor las colisiones con muro y cuerpo, el tablero lleno y el rótulo «PULSA UNA FLECHA». Verificación: `tsc` y `npm run lint`.
7. Añadir `onStats`, `onGameOver`, `setPaused`, `finish` y `destroy` (quita listeners y cancela el loop). Verificación: `tsc` y `npm run lint`.
8. Registrar `snake` en `GAME_REGISTRY` con 800×600 y sus controles. Verificación: se juega en `/juegos/snake/jugar`.
9. Revisar el escalado a 1440 px y 375 px. Verificación: `npm run lint` y `npm run build`.

Cada paso deja la app funcionando.

## Criterios de aceptación

Base:

- [ ] `npm run build`, `npm run lint` y `npx tsc --noEmit` terminan sin errores.
- [ ] La ficha SNAKE aparece en `/biblioteca` con su portada propia y como pestaña en `/salon`.
- [ ] `/juegos/snake` y `/juegos/snake/jugar` cargan sin errores en consola ni de hidratación, ni el aviso «URL data outside of Suspense».
- [ ] PAUSA congela el juego y muestra «EN PAUSA»; REANUDAR continúa sin saltos.
- [ ] FIN abre «FIN DEL JUEGO» con la puntuación actual y deja de procesar entrada de juego.
- [ ] Se puede escribir (incluidos espacios y flechas) en el modal sin que el juego reaccione.
- [ ] Con sesión, «GUARDAR PUNTUACIÓN» crea una fila en `scores` con `game_id = 'snake'` y muestra «PUNTUACIÓN GUARDADA_»; aparece en `/salon`, y `best`/`plays` de la ficha se actualizan.
- [ ] Sin sesión, el modal muestra «INICIA SESIÓN PARA GUARDAR» con enlace a `/acceso` y no escribe en `scores`.
- [ ] «JUGAR DE NUEVO» reinicia con puntuación 0, nivel 1, serpiente de 3 segmentos y una fruta nueva.
- [ ] Al salir con SALIR o cambiar de ruta no quedan listeners de teclado ni loops activos.
- [ ] En desarrollo (Strict Mode) no hay dos motores a la vez ni teclas duplicadas.
- [ ] Con ancho de 375 px el canvas se escala sin scroll horizontal manteniendo 4:3.
- [ ] La puntuación guardada es un entero entre 0 y 10 000 000.
- [ ] Asteroids, Tetris, Arkanoid y los juegos sin entrada en `GAME_REGISTRY` se comportan como antes.

Específicos de Snake:

- [ ] El canvas lógico mide 800×600 y el tablero tiene 20 columnas × 15 filas de 40 px.
- [ ] Al empezar hay una serpiente de 3 segmentos mirando a la derecha, una sola fruta con sprite y el rótulo «PULSA UNA FLECHA»; la serpiente no se mueve hasta pulsar `↑`, `↓` o `→`.
- [ ] Pulsar `←` con la serpiente mirando a la derecha no hace nada y no mata a la serpiente.
- [ ] `←` `↑` `→` `↓` y `A` `W` `D` `S` giran la serpiente.
- [ ] Pulsar dos giros seguidos dentro de un mismo paso aplica ambos en pasos consecutivos y nunca permite girar 180° sobre sí misma.
- [ ] Las flechas no desplazan la página mientras se juega.
- [ ] Comer la fruta suma exactamente 10 puntos, alarga la serpiente en 1 segmento y el HUD de la plataforma lo refleja de inmediato.
- [ ] Tras comer una fruta aparece otra en una celda que no está ocupada por la serpiente.
- [ ] El sprite de la fruta cambia al azar entre las 22 frutas, se ve completo dentro de su celda y sin deformarse.
- [ ] El nivel del HUD sube en 1 cada 5 frutas y, desde ese momento, la serpiente se mueve más rápido.
- [ ] En el nivel 1 la serpiente avanza una celda cada 140 ms, en el nivel 5 cada 100 ms y nunca más rápido que cada 70 ms.
- [ ] Chocar con cualquiera de los 4 bordes abre «FIN DEL JUEGO» con la puntuación correcta.
- [ ] Chocar con el propio cuerpo abre «FIN DEL JUEGO», pero mover la cabeza a la celda que deja libre la cola no es un choque.
- [ ] Si la serpiente llena las 300 celdas se abre «FIN DEL JUEGO» sin errores en consola.
- [ ] El HUD de la plataforma oculta VIDAS en Snake y muestra PUNTOS y NIVEL.
- [ ] Con la imagen de frutas sin cargar, el juego sigue funcionando y la fruta se ve como un círculo.
- [ ] En pausa o con el modal abierto, las teclas no giran la serpiente.

## Decisiones

- **Sí:** ficha `snake`, categoría `ARCADE`, color `green`, `sort_order` 12. Decisión del usuario; `cyan`, `magenta` y `yellow` ya están ocupados y los valores son los permitidos por el `check` de BD y `lib/game-types.ts`, así que no cambia el esquema.
- **Sí:** muros mortales. Decisión del usuario; es el Snake clásico y el de los sprites originales.
- **No:** bordes envolventes. Cambian la dificultad y no se pidieron.
- **Sí:** 10 puntos por fruta y nivel cada 5 frutas con velocidad creciente. Decisión del usuario; da contenido al HUD de NIVEL y una curva de dificultad.
- **No:** velocidad constante ni puntos crecientes con la longitud. Descartados por el usuario.
- **Sí:** sin vidas; el primer choque termina la partida. Decisión del usuario; el HUD oculta VIDAS al no emitirse.
- **Sí:** frutas con sprite y serpiente vectorial con colores de la plataforma. Decisión del usuario; solo hay sprites de frutas, no de serpiente.
- **No:** serpiente verde estilo Google. Descartada por el usuario.
- **Sí:** canvas lógico de 800×600 con rejilla de 20×15 celdas de 40 px. Decisión del usuario; mantiene el 4:3 de Asteroids y Arkanoid.
- **Sí:** una fruta a la vez, elegida al azar entre las 22 del atlas. Decisión del usuario; todas valen lo mismo y solo cambia el aspecto. El atlas tiene 22 entradas, no 25; algunas (ajo, seta, brócoli, zanahoria) no son frutas, pero se mantienen por ser parte del recurso entregado.
- **Sí:** sprites escalados con `min(CELL / w, CELL / h)` y centrados. Los recortes miden entre 110 y 170 px de ancho por 160 de alto; así ninguno se deforma ni invade celdas vecinas.
- **Sí:** la serpiente espera quieta con el rótulo «PULSA UNA FLECHA» hasta la primera dirección válida. Decisión de diseño de la spec, no confirmada con el usuario: evita morir sin haber tenido tiempo de reaccionar al reanudar o al entrar.
- **Sí:** cola de hasta 2 giros pendientes. Evita perder giros rápidos y girar 180° dentro del mismo paso.
- **Sí:** al llenar las 300 celdas se llama a `onGameOver`. La plataforma no tiene pantalla de victoria y su modal ya guarda la puntuación.
- **Sí:** sonido, táctil y frutas especiales fuera de alcance. Decisión del usuario.
- **Sí:** HUD, pausa, modal y guardado de la plataforma; el canvas solo dibuja el juego y el rótulo de inicio.
- **No:** conservar HUD, game over o récord local. Duplicarían los de la plataforma.
- **No:** regenerar `database.types.ts`. Solo se inserta una fila; el esquema no cambia.

## Riesgos

| Riesgo                                                                      | Mitigación                                                                                           |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Strict Mode duplica motor o listeners                                       | `destroy()` cancela el loop y quita los listeners; hay criterio de aceptación                        |
| `dt` grande tras pausa o cambio de pestaña                                  | `dt` acotado a `MAX_DT_MS` y `lastTime` se reinicia al reanudar                                      |
| La imagen carga después de `destroy()` y pinta o dispara callbacks          | Bandera `destroyed` comprobada en `onload`; el loop no arranca si el motor ya se destruyó            |
| Dos pulsaciones rápidas en un mismo paso permiten girar 180° sobre sí       | Cola de giros: cada giro se valida contra el último encolado, no contra la dirección ya aplicada     |
| Mover la cabeza a la celda que libera la cola se detecta como choque        | `hitsBody` se evalúa contra el cuerpo sin el último segmento cuando la serpiente no crece en el paso |
| Buscar celda libre con bucle aleatorio no termina con el tablero casi lleno | `pickFruitCell` filtra las celdas libres y elige entre ellas; devuelve `null` si no hay ninguna      |
| El PNG de 3790 px de ancho pesa y retrasa el primer dibujo                  | Se muestra la fruta como círculo hasta que carga; si pesa demasiado, se recorta la hoja en el paso 1 |
| Los sprites se ven borrosos al reducirse a 40 px                            | `imageSmoothingQuality = "high"` y revisión visual a 1440 px y 375 px en el último paso              |
| `Espacio` o las flechas activan un botón enfocado de la plataforma          | `preventDefault` solo en flechas durante el juego y el canvas no toma el foco de teclado             |

## Qué **no** está en esta spec

- Sonido y música.
- Controles táctiles, gestos de deslizar y gamepad.
- Frutas especiales y más de una fruta a la vez.
- Vidas, bordes envolventes, obstáculos y otros modos.
- Selector de velocidad o dificultad.
- Anti-trampas real.
- Tests automatizados.

Cada uno, si llega, va en su propia spec.
