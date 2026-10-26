# SPEC 08 — Juego Arkanoid dentro de la plataforma

> **Status:** aprobado
> **Depends on:** SPEC 05, SPEC 06, SPEC 07
> **Date:** 2026-10-26
> **Objective:** Portar Arkanoid de `references/started-games/04-arkanoid` a un motor TypeScript jugable en `/juegos/arkanoid/jugar`, con el HUD, la pausa y el guardado de puntuación de la plataforma y su ficha en el leaderboard.

## Por qué existe esta spec

Arkanoid es el tercer juego real tras Asteroids (SPEC 05) y Tetris (SPEC 07). La referencia es JS vanilla con estado global en `js/game.js`, un spritesheet de pixel-art, dos sonidos y un HUD, un menú de pausa, un «Game over» y una «Victoria» dibujados en el propio canvas. La plataforma ya ofrece HUD, pausa y fin de partida, así que el port se queda con las reglas, los sprites y los sonidos.

El registro genérico ya existe desde SPEC 07 (`lib/game-engine.ts`, `lib/game-registry.ts`, `components/game-canvas.tsx`). Esta spec solo añade el juego al registro; no hay refactor.

## Alcance

**Dentro:**

- Fila `arkanoid` en `games` (migración + `supabase/seed.sql`) y portada `.cover-arkanoid` en `app/globals.css`.
- Motor en `lib/arkanoid/` (`constants.ts`, `entities.ts`, `engine.ts`) que implementa `GameEngine`.
- Entrada `arkanoid` en `GAME_REGISTRY` con canvas de 800×600 y sus controles.
- Assets copiados a `public/games/arkanoid/`: `spritesheet-breakout.png`, `ball-bounce.mp3` y `break-sound.mp3`.
- 3 niveles. Cada uno es un mapa aleatorio de 6 filas × 10 columnas, con huecos y simétrico respecto al eje vertical; mínimo 20 bloques vivos por mapa.
- Bloques de color: 1 golpe, 10 puntos. Bloques grises (desde el nivel 2): 2 golpes, 30 puntos; tras el primer golpe se dibujan con alpha 0,6.
- Velocidad de la bola por nivel: 380 / 420 / 460 px/s. Probabilidad de hueco: 0,10 / 0,20 / 0,25. Probabilidad de bloque gris: 0 / 0,15 / 0,30.
- Paleta de 120×14 px a 600 px/s. El rebote depende del punto de impacto, hasta 60° respecto a la vertical.
- Bola pegada a la paleta al empezar y tras perder una vida; se lanza con `Espacio` o clic con una desviación aleatoria de hasta 15°.
- 3 vidas. Al caer la bola por debajo del canvas se pierde una; con 0 vidas termina la partida.
- Al vaciar un nivel se carga el siguiente conservando puntos y vidas. Vaciar el nivel 3 termina la partida («victoria»): el motor llama a `onGameOver` con la puntuación.
- Explosión de 4 frames y 150 ms al romper un bloque.
- Sonidos de rebote (paredes, techo, paleta y bloque gris que sobrevive) y de rotura, con tolerancia al bloqueo de audio del navegador.
- Controles: `←` `→` o `A` `D` mueven la paleta; el ratón sobre el canvas también; `Espacio` o clic lanzan la bola.
- Sobre el canvas solo se dibuja lo que la plataforma no tiene: el rótulo «Nivel N» mientras la bola está pegada.

**Fuera de alcance (para futuras specs):**

- Selector de nivel del menú de pausa (teclas `1`–`3` y botones): es un atajo de pruebas y permitiría saltar niveles en una partida que puntúa.
- Teclas `P` (pausa) y `Enter` (reinicio) del original: son de la plataforma.
- Pantallas «PAUSA», «Game over» y «¡Victoria!» y el HUD de puntos, nivel y vidas dibujados en el canvas.
- Nuevos niveles, power-ups, bolas múltiples o bloques indestructibles.
- Silenciar o regular el volumen desde la plataforma.
- Controles táctiles o gamepad.
- Anti-trampas real (ver SPEC 06).
- Tests automatizados.

## Modelo de datos

Fila del catálogo (`supabase/migrations/20261026120000_juego_arkanoid.sql` y el mismo `insert` en `supabase/seed.sql`):

```sql
insert into public.games (id, title, short, long, category, cover, color, sort_order)
values ('arkanoid', 'ARKANOID', 'Rompe todos los bloques con la bola sin dejarla caer.',
        'Mueve la paleta para devolver la bola y derribar los muros de bloques de colores. El rebote cambia según dónde golpees la paleta. Hay tres niveles cada vez más rápidos y, desde el segundo, bloques grises que aguantan dos golpes. Tienes tres vidas y ganas si vacías el último nivel.',
        'ARCADE', 'cover-arkanoid', 'yellow', 11)
on conflict (id) do nothing;
```

Constantes y tipos (`lib/arkanoid/constants.ts`):

```ts
export const W = 800,
  H = 600;
export const BLOCK_COLORS = [
  "red",
  "yellow",
  "cyan",
  "magenta",
  "hotpink",
  "green",
] as const; // fila 0..5
export const COLS = 10,
  BLOCK_W = 64,
  BLOCK_H = 32,
  BLOCK_GAP = 4,
  GRID_TOP = 80;
export const BLOCK_POINTS = 10,
  TOUGH_POINTS = 30,
  TOUGH_HITS = 2,
  DAMAGED_ALPHA = 0.6,
  MIN_BLOCKS = 20;
export const LEVELS = [
  { speed: 380, gapChance: 0.1, toughChance: 0 },
  { speed: 420, gapChance: 0.2, toughChance: 0.15 },
  { speed: 460, gapChance: 0.25, toughChance: 0.3 },
] as const;
export const MAX_DT = 1 / 30; // el original; es más estricto que el 0,05 de SPEC 05
export const LAUNCH_SPREAD = (15 * Math.PI) / 180;
export const MAX_BOUNCE_ANGLE = (60 * Math.PI) / 180;
export const EXPLOSION_DURATION = 150; // ms
export const BG = "#11111f";
// + SPRITES y EXPLOSION_FRAMES (mismas coordenadas que assets/spritesheet.js)
export type BlockColor = (typeof BLOCK_COLORS)[number] | "gray";
export type Phase = "ready" | "playing" | "gameover";
export interface Block {
  x: number;
  y: number;
  w: number;
  h: number;
  color: BlockColor;
  alive: boolean;
  hp: number;
  points: number;
}
```

Motor y registro:

```ts
export class ArkanoidEngine implements GameEngine { /* start, setPaused, finish, destroy */ }

// lib/game-registry.ts
arkanoid: {
  width: W, height: H,
  createEngine: (canvas, callbacks) => new ArkanoidEngine(canvas, callbacks),
  controls: [
    { keys: ["←", "→"], action: "Mover" },
    { keys: ["Espacio"], action: "Lanzar" },
    { keys: ["Ratón"], action: "Mover y lanzar (clic)" },
  ],
},
```

Mapeo al HUD: `score` = puntos de bloques rotos; `lives` = vidas restantes (empieza en 3); `level` = nivel actual (1–3).

Convenciones:

- Coordenadas con origen arriba a la izquierda; las posiciones de la bola y de la paleta son su esquina superior izquierda, como en el original.
- `dt` en segundos tomado de `requestAnimationFrame`, acotado a `MAX_DT`; `lastTime` se reinicia al reanudar.
- El estado global de `game.js` pasa a campos privados de `ArkanoidEngine`; `createBlocks(level)` y las colisiones bola–bloque y bola–paleta viven en `entities.ts` como funciones que reciben el estado por parámetro.
- El spritesheet se carga con `new Image()` dentro de `start()` y se pinta con `drawImage` sobre el contexto del canvas; `imageSmoothingEnabled = false`. Mientras no esté cargado el motor dibuja solo fondo y rótulo.
- Los `Audio` se crean en `start()` y se clonan para solaparse. Con el juego pausado o terminado no suena nada.
- El ratón se escucha en el `canvas` (`mousemove`, `mousedown`) y se traduce de píxeles CSS a coordenadas lógicas con `rect.width`. Se ignora mientras el juego está pausado o terminado.
- `onStats` se emite al cambiar `score`, `lives` o `level`, no en cada frame. La puntuación máxima posible no llega a 10 000, pero el motor la satura en 10 000 000 por contrato.

## Plan de implementación

Antes del paso 1, leer en `node_modules/next/dist/docs/01-app` la referencia de Client Components y la guía de `cacheComponents`. Usar `/frontend-design` para la portada `.cover-arkanoid` y la línea de controles. Los nombres de archivo son la propuesta de esta spec.

1. Copiar los 3 assets a `public/games/arkanoid/`, crear la migración `20261026120000_juego_arkanoid.sql` y aplicarla con `apply_migration`; añadir la fila en `supabase/seed.sql` con 3 puntuaciones de `PLAYERTEST` en `arkanoid` (su mejor marca ni primera ni última) y `.cover-arkanoid` en `app/globals.css`. Verificación: la ficha aparece en `/biblioteca` y como pestaña en `/salon`; `/juegos/arkanoid/jugar` muestra el simulado; ejecutar el seed dos veces no duplica filas.
2. Crear `lib/arkanoid/constants.ts`. Verificación: `npx tsc --noEmit`.
3. Crear `lib/arkanoid/entities.ts` con `createBlocks`, `collideBallWithPaddle` y `collideBallWithBlocks`. Verificación: `npx tsc --noEmit`.
4. Crear `lib/arkanoid/engine.ts` con el núcleo: estado, loop con `requestAnimationFrame`, carga del spritesheet, paleta con teclado y ratón, bola pegada y lanzamiento, rebotes en paredes y techo, y dibujo de fondo, bloques, paleta y bola. Verificación: `tsc` y `npm run lint`.
5. Añadir al motor las colisiones con paleta y bloques, la puntuación, el bloque gris de dos golpes con alpha 0,6 y las explosiones. Verificación: `tsc` y `npm run lint`.
6. Añadir al motor vidas, carga de nivel con `loadLevel`, victoria tras el nivel 3 y el rótulo «Nivel N» con la bola pegada. Verificación: `tsc` y `npm run lint`.
7. Añadir al motor el sonido (`playSound` con `Audio` clonado y `catch` del bloqueo). Verificación: `tsc` y `npm run lint`.
8. Añadir `onStats`, `onGameOver`, `setPaused`, `finish` y `destroy` (quita listeners del `window` y del canvas, cancela el loop y pausa los `Audio`). Verificación: `tsc` y `npm run lint`.
9. Registrar `arkanoid` en `GAME_REGISTRY` con 800×600 y sus controles. Verificación: se juega en `/juegos/arkanoid/jugar`.
10. Revisar el escalado a 1440 px y 375 px. Verificación: `npm run lint` y `npm run build`.

Cada paso deja la app funcionando.

## Criterios de aceptación

Base:

- [ ] `npm run build`, `npm run lint` y `npx tsc --noEmit` terminan sin errores.
- [ ] La ficha ARKANOID aparece en `/biblioteca` con su portada propia y como pestaña en `/salon`.
- [ ] `/juegos/arkanoid` y `/juegos/arkanoid/jugar` cargan sin errores en consola ni de hidratación, ni el aviso «URL data outside of Suspense».
- [ ] PAUSA congela el juego y muestra «EN PAUSA»; REANUDAR continúa sin saltos.
- [ ] FIN abre «FIN DEL JUEGO» con la puntuación actual y deja de procesar entrada de juego.
- [ ] Se puede escribir (incluidos espacios y flechas) en el modal sin que el juego reaccione.
- [ ] Con sesión, «GUARDAR PUNTUACIÓN» crea una fila en `scores` con `game_id = 'arkanoid'` y muestra «PUNTUACIÓN GUARDADA_»; aparece en `/salon`, y `best`/`plays` de la ficha se actualizan.
- [ ] Sin sesión, el modal muestra «INICIA SESIÓN PARA GUARDAR» con enlace a `/acceso` y no escribe en `scores`.
- [ ] «JUGAR DE NUEVO» reinicia con puntuación 0, 3 vidas, nivel 1 y un mapa nuevo.
- [ ] Al salir con SALIR o cambiar de ruta no quedan listeners de teclado ni de ratón, ni loops activos, ni sonidos en marcha.
- [ ] En desarrollo (Strict Mode) no hay dos motores a la vez ni teclas duplicadas.
- [ ] Con ancho de 375 px el canvas se escala sin scroll horizontal manteniendo 4:3.
- [ ] La puntuación guardada es un entero entre 0 y 10 000 000.
- [ ] Asteroids, Tetris y los juegos sin entrada en `GAME_REGISTRY` se comportan como antes.

Específicos de Arkanoid:

- [ ] El canvas lógico mide 800×600 y los sprites se ven nítidos, sin suavizado.
- [ ] Al empezar la bola está pegada a la paleta, se ve el rótulo «Nivel 1» y la bola no se mueve hasta pulsar `Espacio` o hacer clic.
- [ ] `←` `→` y `A` `D` mueven la paleta sin sacarla del canvas; el ratón sobre el canvas la sigue.
- [ ] `Espacio` y las flechas no desplazan la página mientras se juega.
- [ ] La bola rebota en las paredes y el techo, y un golpe en el centro de la paleta sale casi vertical mientras que uno en el borde sale hasta 60°.
- [ ] El mapa del nivel 1 tiene 6 filas × 10 columnas como máximo, es simétrico y tiene al menos 20 bloques.
- [ ] Romper un bloque de color suma exactamente 10 puntos y el HUD de la plataforma lo refleja de inmediato.
- [ ] En los niveles 2 y 3 hay bloques grises; el primer golpe no los rompe y los deja semitransparentes, y el segundo suma 30 puntos.
- [ ] Al romper un bloque se reproduce una explosión de 150 ms en su sitio.
- [ ] La bola cae por debajo del canvas: el HUD resta una vida (♥), la bola vuelve pegada a la paleta y el mapa se conserva.
- [ ] Al perder la tercera vida se abre «FIN DEL JUEGO» con la puntuación correcta.
- [ ] Al vaciar el nivel 1 el HUD pasa a nivel 2, puntos y vidas se conservan, y la bola queda pegada con el rótulo «Nivel 2»; la velocidad sube a 420 px/s.
- [ ] Al vaciar el nivel 3 se abre «FIN DEL JUEGO» con la puntuación final.
- [ ] Suena un rebote al golpear paredes, techo, paleta y bloque gris sin romperlo, y otro sonido al romper un bloque.
- [ ] Con el audio bloqueado por el navegador el juego sigue funcionando sin errores en consola.
- [ ] En pausa o con el modal abierto no suena nada, y las teclas y el ratón no mueven la paleta.
- [ ] Tras reanudar de la pausa, `Espacio` no lanza la bola dos veces ni activa un botón de la plataforma.
- [ ] El HUD de la plataforma muestra PUNTOS, VIDAS y NIVEL.
- [ ] Las teclas `P`, `Enter` y `1`–`3` no hacen nada en el juego.

## Decisiones

- **Sí:** ficha `arkanoid`, categoría `ARCADE`, color `yellow`, `sort_order` 11. Decisión del usuario; `cyan` y `magenta` ya están ocupados y los valores son los permitidos por el `check` de BD y `lib/game-types.ts`, así que no cambia el esquema.
- **Sí:** spritesheet original como aspecto, con fondo `#11111f`. Decisión del usuario; conserva el pixel-art y los 2 `png` y `mp3` ya existen.
- **No:** reestilizar a bloques vectoriales neón. Cambia el aspecto sin aportar jugabilidad.
- **Sí:** sonido dentro de alcance con los 2 mp3 en `public/games/arkanoid/`. Decisión del usuario.
- **No:** mute o volumen en la plataforma. Es una decisión de UX que afecta a todos los juegos.
- **Sí:** ratón (mover y clic) y teclado. Decisión del usuario; el ratón es el control natural del original.
- **No:** selector de nivel de la pausa. Decisión del usuario; era un atajo de desarrollo y rompería el sentido de la puntuación, y los botones dibujados en el canvas quedarían tapados por «EN PAUSA».
- **Sí:** vaciar el nivel 3 llama a `onGameOver`. Decisión del usuario; la plataforma no tiene pantalla de victoria y su modal ya guarda la puntuación.
- **No:** pantalla «¡Victoria!» propia ni reinicio con `Enter`. Duplicarían el modal; reinicia «JUGAR DE NUEVO».
- **Sí:** `MAX_DT = 1/30`, el valor del original. Es más estricto que el 0,05 de SPEC 05 y reduce el riesgo de que la bola atraviese un bloque a 460 px/s.
- **Sí:** `score`, `lives` y `level` al HUD. Los tres existen en el juego y el HUD los muestra.
- **Sí:** HUD, pausa, modal y guardado de la plataforma; el canvas solo dibuja el juego y el rótulo «Nivel N».
- **No:** conservar el HUD, el game over ni los textos dibujados del original. Duplicarían los de la plataforma.
- **No:** regenerar `database.types.ts`. Solo se inserta una fila; el esquema no cambia.

## Riesgos

| Riesgo                                                                       | Mitigación                                                                                     |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Strict Mode duplica motor o listeners                                        | `destroy()` cancela el loop y quita los listeners de `window` y del canvas; hay criterio       |
| `dt` grande tras pausa o cambio de pestaña                                   | `dt` acotado a `MAX_DT` y `lastTime` se reinicia al reanudar                                   |
| El spritesheet carga después de `destroy()` y pinta o dispara callbacks      | Bandera `destroyed` comprobada en `onload`; el loop no arranca si el motor ya se destruyó      |
| El `Audio` se reproduce tras destruir el motor o con el navegador bloqueando | `play()` dentro de `try` con `catch`, y `destroy()` pausa los clones en marcha                 |
| `Espacio` activa un botón enfocado de la plataforma al reanudar tras pausa   | `preventDefault` en `Espacio`, ignorar entrada con el juego pausado y no dar foco al canvas    |
| La bola atraviesa un bloque a 460 px/s en un frame largo                     | `MAX_DT = 1/30` limita el desplazamiento a unos 15 px, menos que el alto de la bola y del bloque |
| El clic del ratón dispara «JUGAR DE NUEVO» o los botones del modal           | Los listeners del ratón están en el `canvas`, no en `window`, y el modal queda fuera de él     |
| El PNG se ve borroso al escalar el canvas por CSS                            | `imageSmoothingEnabled = false` en el contexto y `image-rendering: pixelated` si hace falta    |
| Un mapa aleatorio sin bloques suficientes bloquea el bucle `do/while`        | Los huecos máximos (25 %) dan de media más de 40 bloques; el mínimo de 20 se cumple al repetir |

## Qué **no** está en esta spec

- Selector de nivel del menú de pausa y teclas `P`, `Enter` y `1`–`3`.
- Pantallas de pausa, game over y victoria propias, y HUD dibujado en el canvas.
- Nuevos niveles, power-ups, bolas múltiples y bloques indestructibles.
- Mute o volumen desde la plataforma.
- Controles táctiles o gamepad.
- Anti-trampas real.
- Tests automatizados.

Cada uno, si llega, va en su propia spec.
