# SPEC 10 — Juego FROGGER dentro de la plataforma (variante 2: carrera infinita)

> **Status:** borrador
> **Depends on:** SPEC 05, SPEC 06, SPEC 07
> **Date:** 2026-10-26
> **Objective:** Crear Frogger como motor TypeScript jugable en `/juegos/frogger/jugar`, con scroll vertical infinito, movimiento discreto, un solo golpe mortal, puntuacion por distancia y dificultad continua, usando el HUD, la pausa y el guardado de puntuacion de la plataforma y su ficha en el leaderboard.

## Por que existe esta spec

Frogger es un clasico de los arcades que aporta al catalogo un arquetipo de movimiento/esquivar que no tienen los 4 juegos actuales (shooter, puzzle, rebote, crecimiento). Esta variante reinterpreta Frogger como una carrera infinita hacia arriba: no hay casillas de destino ni rondas; la rana avanza por filas procedurales de carretera y rio, y la puntuacion crece con la distancia. Un solo golpe termina la partida.

El registro generico ya existe desde SPEC 07. Esta spec solo anade el juego al registro; no hay refactor.

## Alcance

**Dentro:**

- Fila `frogger` en `games` (migracion + `supabase/seed.sql`) y portada `.cover-frogger` en `app/globals.css`.
- Motor en `lib/frogger/` (`constants.ts`, `entities.ts`, `engine.ts`) que implementa `GameEngine`.
- Entrada `frogger` en `GAME_REGISTRY` con canvas de 800x600 y sus controles.
- Cuadricula de 20 columnas; las filas se generan proceduralmente y se desplazan hacia abajo cuando la rana sube.
- La rana se mueve una celda por pulsacion (arriba, abajo, izquierda, derecha).
- Tipos de fila: acera (segura), carretera (vehiculos), rio (troncos/tortugas), hierba con arbusto (obstaculo fijo).
- Sin casillas de destino: la meta es avanzar lo mas lejos posible.
- Sin vidas: un unico golpe (vehiculo, agua, arbusto) termina la partida.
- Cada fila cruzada hacia arriba que sea la mas lejana suma 10 puntos.
- Mosca bonus: aparece aleatoriamente en una celda segura cada 10-20 filas; recogerla suma 100 puntos.
- La dificultad aumenta de forma continua: vehiculos mas rapidos, menos troncos, mas carriles de rio consecutivos.
- El nivel del HUD sube cada 50 filas avanzadas, como indicador de progreso.
- Aspecto vectorial: rana como cuadrado verde con ojos, vehiculos como rectangulos, troncos marrones, tortugas verde oscuro, agua azul, carretera gris.
- Controles: flechas `<-` `->` `^` `v` o `A` `W` `D` `S`.

**Fuera de alcance (para futuras specs):**

- Power-ups (escudo, velocidad, salto doble).
- Tortugas que se hunden.
- Cocodrilos u otros enemigos.
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
  VISIBLE_ROWS = 15;
export const FROG_START_COL = 10;
export const FROG_VISIBLE_ROW = 10; // la rana se mantiene en la fila 10 del canvas; el mundo se desplaza
export const STEP_POINTS = 10,
  FLY_POINTS = 100;
export const FLY_MIN_INTERVAL = 10,
  FLY_MAX_INTERVAL = 20; // filas entre moscas
export const LEVEL_EVERY = 50; // filas por nivel
export const BASE_SPEED = 80; // px/s para vehiculos en nivel 1
export const SPEED_INCREMENT = 15; // px/s extra por nivel
export const MAX_DT_MS = 50;
export const MAX_SCORE = 10_000_000;
export const BG_ROAD = "#333333",
  BG_WATER = "#1a3a5c",
  BG_GRASS = "#2d5a1e";
export type Phase = "ready" | "playing" | "gameover";
export type Dir = "up" | "down" | "left" | "right";
export type RowType = "grass" | "road" | "river" | "bush";
export interface WorldRow {
  type: RowType;
  items: RowItem[];
  speed: number; // px/s, 0 para grass/bush
}
export interface RowItem {
  x: number;
  w: number;
  color: string;
  kind: "car" | "truck" | "log" | "turtle" | "bush";
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

Mapeo al HUD: `score` = puntos por distancia + moscas; `level` = `1 + floor(maxRow / 50)`; `lives` = no se emite y el HUD oculta VIDAS.

Convenciones:

- Coordenadas con origen arriba a la izquierda; el mundo es un arreglo creciente de filas que se genera proceduralmente.
- La camara sigue a la rana: cuando avanza, las filas del mundo se desplazan hacia abajo en el canvas.
- `dt` en milisegundos tomado de `requestAnimationFrame`, acotado a `MAX_DT_MS`; `lastTime` se reinicia al reanudar.
- La rana se mueve una celda por pulsacion, igual que la v1; el mundo se genera hacia arriba bajo demanda.
- Los vehiculos y objetos del rio se mueven de forma continua en `px/s` y hacen wrap al salir del canvas.
- La rana sobre un tronco o tortuga se desplaza con el objeto; si sale del canvas, cae al agua y muere.
- `entities.ts` contiene funciones puras: `generateRow(index, difficulty)`, `moveRowItems(row, dt)`, `frogOnPlatform(frog, rows)`, `frogHitsObstacle(frog, rows)`, `frogInWater(frog, rows)`.
- `onStats` se emite al cambiar `score` o `level`, no en cada frame.
- La puntuacion se satura en `MAX_SCORE` por contrato.

## Plan de implementacion

Antes del paso 1, leer en `node_modules/next/dist/docs/01-app` la referencia de Client Components y la guia de `cacheComponents`. Usar `/frontend-design` para la portada `.cover-frogger` y la linea de controles. Los nombres de archivo son la propuesta de esta spec.

1. Crear la migracion `20261026140000_juego_frogger.sql` y aplicarla con `apply_migration`; anadir la fila en `supabase/seed.sql` con 3 puntuaciones de `PLAYERTEST` en `frogger` y `.cover-frogger` en `app/globals.css`. Verificacion: la ficha aparece en `/biblioteca` y como pestana en `/salon`; `/juegos/frogger/jugar` muestra el simulado.
2. Crear `lib/frogger/constants.ts`. Verificacion: `npx tsc --noEmit`.
3. Crear `lib/frogger/entities.ts` con `generateRow`, `moveRowItems`, `frogOnPlatform`, `frogHitsObstacle`, `frogInWater` y `spawnFly`. Verificacion: `npx tsc --noEmit`.
4. Crear `lib/frogger/engine.ts` con el nucleo: estado, loop con `requestAnimationFrame`, teclado con movimiento discreto, generacion procedural de filas, camara que sigue a la rana, y dibujo de fondo. Verificacion: `tsc` y `npm run lint`.
5. Anadir al motor los carriles de vehiculos y la deteccion de colision mortal. Verificacion: `tsc` y `npm run lint`.
6. Anadir al motor los carriles de rio (troncos, tortugas), el desplazamiento de la rana sobre plataformas y la deteccion de caida al agua. Verificacion: `tsc` y `npm run lint`.
7. Anadir al motor la puntuacion por avance, la mosca bonus, los niveles por distancia y la dificultad creciente. Verificacion: `tsc` y `npm run lint`.
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

Especificos de Frogger v2:

- [ ] El canvas logico mide 800x600 y las celdas son de 40 px.
- [ ] Las flechas y `A` `W` `D` `S` mueven la rana exactamente una celda por pulsacion.
- [ ] Las flechas no desplazan la pagina mientras se juega.
- [ ] La rana no puede salir de los limites laterales del canvas.
- [ ] El mundo se desplaza hacia abajo cuando la rana avanza, generando filas nuevas por encima.
- [ ] No hay casillas de destino: la partida continua hasta morir.
- [ ] Tocar un vehiculo termina la partida inmediatamente (sin vidas).
- [ ] Caer al agua termina la partida inmediatamente.
- [ ] Saltar a un arbusto termina la partida inmediatamente.
- [ ] Cada fila nueva alcanzada hacia arriba suma exactamente 10 puntos; retroceder no resta.
- [ ] La mosca bonus aparece cada 10-20 filas y vale 100 puntos.
- [ ] Los vehiculos se mueven mas rapido a medida que la rana avanza.
- [ ] Los troncos se hacen menos frecuentes y mas cortos con la distancia.
- [ ] El nivel del HUD sube cada 50 filas y refleja la dificultad actual.
- [ ] Los troncos y tortugas se mueven y la rana viaja con ellos.
- [ ] Si la rana montada en un tronco sale del canvas, la partida termina.
- [ ] «JUGAR DE NUEVO» reinicia con puntuacion 0, nivel 1 y el mundo regenerado.
- [ ] El HUD de la plataforma muestra PUNTOS y NIVEL; oculta VIDAS.
- [ ] Al empezar, la rana esta en una fila de hierba y el canvas muestra «PULSA UNA FLECHA».

## Decisiones

- **Si:** ficha `frogger`, categoria `ARCADE`, color `green`, `sort_order` 13. El arquetipo movimiento/esquivar no existe en el catalogo; `green` encaja con la rana.
- **Si:** scroll infinito sin casillas de destino. Da una experiencia endless runner mas adictiva y puntuaciones mas variadas para el leaderboard.
- **No:** casillas de destino y rondas. La variante 1 cubre ese enfoque clasico.
- **Si:** sin vidas, un golpe = fin. Simplifica el sistema y genera tension; cada paso cuenta.
- **No:** 3 vidas como el clasico. Con scroll infinito las vidas alargarian demasiado las partidas.
- **Si:** generacion procedural de filas con dificultad creciente. Garantiza variedad y rejugabilidad infinita.
- **Si:** nivel = indicador de progreso cada 50 filas, sin efecto mecanico discreto. La dificultad sube de forma continua.
- **Si:** HUD, pausa, modal y guardado de la plataforma; el canvas solo dibuja el juego y el rotulo de inicio.
- **No:** conservar HUD, game over o record local del original. Duplicarian los de la plataforma.
- **No:** regenerar `database.types.ts`. Solo se inserta una fila; el esquema no cambia.

## Riesgos

| Riesgo                                                                | Mitigacion                                                                                                          |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Strict Mode duplica motor o listeners                                 | `destroy()` cancela el loop y quita los listeners; hay criterio de aceptacion                                       |
| `dt` grande tras pausa o cambio de pestana                            | `dt` acotado a `MAX_DT_MS` y `lastTime` se reinicia al reanudar                                                     |
| La generacion procedural crea filas imposibles de cruzar              | Cada fila de rio garantiza al menos un tronco accesible; nunca hay mas de 3 filas de rio consecutivas sin una acera |
| El arreglo de filas del mundo crece indefinidamente y consume memoria | Se mantienen solo las filas visibles mas un margen; las filas pasadas se descartan                                  |
| La dificultad escala demasiado rapido y la partida se vuelve injusta  | La velocidad de vehiculos y la escasez de troncos tienen un tope maximo                                             |
| La camara produce saltos visuales al avanzar una celda                | El desplazamiento del canvas interpola suavemente entre posiciones                                                  |

## Que **no** esta en esta spec

- Power-ups (escudo, velocidad, salto doble).
- Tortugas que se hunden.
- Cocodrilos u otros enemigos.
- Sonido y musica.
- Controles tactiles o gamepad.
- Sprites o animaciones elaboradas.
- Anti-trampas real.
- Tests automatizados.

Cada uno, si llega, va en su propia spec.
