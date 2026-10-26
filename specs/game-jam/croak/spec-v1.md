# SPEC 11 — Juego CROAK dentro de la plataforma (variante 1: torreta fija)

> **Status:** borrador
> **Depends on:** SPEC 05, SPEC 06, SPEC 07
> **Date:** 2026-10-26
> **Objective:** Crear Croak como motor TypeScript jugable en `/juegos/croak/jugar`, con una rana fija en la parte inferior que apunta y dispara su lengua para atrapar insectos, con oleadas, 5 vidas y niveles, usando el HUD, la pausa y el guardado de puntuacion de la plataforma y su ficha en el leaderboard.

## Por que existe esta spec

Croak aporta al catalogo un shooter con tematica de pantano que no existe entre los 4 juegos actuales. En lugar de una nave disparando en el espacio (Asteroids), el jugador es una rana en un nenufar que atrapa insectos con su lengua. El arquetipo disparo/apuntar complementa los existentes. Esta variante situa a la rana fija en el centro inferior como una torreta: el jugador rota el angulo de la lengua y dispara.

El registro generico ya existe desde SPEC 07. Esta spec solo anade el juego al registro; no hay refactor.

## Alcance

**Dentro:**

- Fila `croak` en `games` (migracion + `supabase/seed.sql`) y portada `.cover-croak` en `app/globals.css`.
- Motor en `lib/croak/` (`constants.ts`, `entities.ts`, `engine.ts`) que implementa `GameEngine`.
- Entrada `croak` en `GAME_REGISTRY` con canvas de 800x600 y sus controles.
- La rana ocupa la parte inferior central del canvas, sentada en un nenufar. No se mueve.
- El jugador rota el angulo de apuntado con `<-` y `->` (de 10 grados a 170 grados respecto a la horizontal). Una linea de apuntado semitransparente muestra la direccion.
- `Espacio` dispara la lengua: una linea rosa que se extiende a 600 px/s desde la boca de la rana hasta golpear un insecto o alcanzar el borde del canvas. Solo una lengua a la vez; hay que esperar a que vuelva.
- La lengua atrapa al primer insecto que toca (hitbox circular) y se retrae con el insecto hasta la rana, sumando los puntos.
- Tres tipos de insecto: mosca (10 puntos, velocidad baja, tamano medio), libelula (30 puntos, velocidad media, tamano pequeno) y luciernaga (50 puntos, velocidad alta, tamano pequeno, parpadea).
- Los insectos entran desde los bordes laterales y superior del canvas y vuelan en lineas rectas o arcos suaves hacia el lado opuesto.
- Si un insecto sale del canvas sin ser atrapado, se pierde 1 vida.
- 5 vidas. Con 0 vidas termina la partida.
- Oleadas: cada oleada dura 20 s y trae un numero creciente de insectos. Entre oleadas hay 3 s de pausa visual con el rotulo «OLEADA N».
- El nivel sube cada 3 oleadas. Cada nivel aumenta la velocidad base de los insectos y la proporcion de libelulas y luciernagas.
- Aspecto vectorial: rana verde con ojos grandes, nenufar circular, lengua rosa, moscas negras con alas, libelulas azules, luciernagas amarillas parpadeantes, fondo de pantano oscuro con agua.
- Controles: `<-` `->` para apuntar, `Espacio` para disparar.

**Fuera de alcance (para futuras specs):**

- Insectos venenosos que restan puntos si se atrapan.
- Power-ups (lengua mas rapida, lengua doble, escudo).
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
export const FROG_X = 400,
  FROG_Y = 560,
  FROG_R = 30;
export const TONGUE_SPEED = 600; // px/s
export const AIM_SPEED = 120; // grados/s
export const AIM_MIN = 10,
  AIM_MAX = 170; // grados desde horizontal derecha
export const AIM_START = 90;
export const FLY_POINTS = 10,
  DRAGONFLY_POINTS = 30,
  FIREFLY_POINTS = 50;
export const FLY_SPEED = 80,
  DRAGONFLY_SPEED = 130,
  FIREFLY_SPEED = 180; // px/s base
export const FLY_R = 12,
  DRAGONFLY_R = 8,
  FIREFLY_R = 8;
export const LIVES = 5;
export const WAVE_DURATION_MS = 20_000;
export const WAVE_PAUSE_MS = 3_000;
export const WAVES_PER_LEVEL = 3;
export const SPEED_PER_LEVEL = 20; // px/s extra por nivel
export const MAX_DT_MS = 50;
export const MAX_SCORE = 10_000_000;
export const BG = "#0a1a0a";
export type Phase = "ready" | "playing" | "wave_pause" | "gameover";
export type BugKind = "fly" | "dragonfly" | "firefly";
export interface Bug {
  x: number;
  y: number;
  vx: number;
  vy: number;
  kind: BugKind;
  r: number;
  points: number;
  alive: boolean;
  blink: number; // solo luciernagas: temporizador de parpadeo
}
export interface Tongue {
  x: number;
  y: number;
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
    { keys: ['<-', '->'], action: 'Apuntar' },
    { keys: ['Espacio'], action: 'Disparar lengua' },
  ],
},
```

Mapeo al HUD: `score` = puntos de insectos atrapados; `lives` = vidas restantes (empieza en 5); `level` = nivel actual.

Convenciones:

- Coordenadas con origen arriba a la izquierda; la rana esta centrada en `(400, 560)`.
- `dt` en milisegundos tomado de `requestAnimationFrame`, acotado a `MAX_DT_MS`; `lastTime` se reinicia al reanudar.
- El angulo de apuntado esta en grados (10-170) respecto a la horizontal derecha; se convierte a radianes para los calculos.
- La lengua es un segmento que parte de la boca de la rana y se extiende a `TONGUE_SPEED` px/s. Si alcanza un insecto, lo atrapa y se retrae. Si llega al borde del canvas, se retrae vacia.
- La colision lengua-insecto es circulo-punto: la punta de la lengua contra el radio del insecto.
- `entities.ts` contiene funciones puras: `spawnBug(wave, level)`, `moveBugs(bugs, dt)`, `extendTongue(tongue, dt)`, `retractTongue(tongue, dt)`, `tonguHitsBug(tongue, bugs)`, `bugEscaped(bug)`.
- Los insectos se generan con intervalos aleatorios durante la oleada; la frecuencia aumenta con el nivel.
- `onStats` se emite al cambiar `score`, `lives` o `level`, no en cada frame.
- La puntuacion se satura en `MAX_SCORE` por contrato.

## Plan de implementacion

Antes del paso 1, leer en `node_modules/next/dist/docs/01-app` la referencia de Client Components y la guia de `cacheComponents`. Usar `/frontend-design` para la portada `.cover-croak` y la linea de controles. Los nombres de archivo son la propuesta de esta spec.

1. Crear la migracion `20261026150000_juego_croak.sql` y aplicarla con `apply_migration`; anadir la fila en `supabase/seed.sql` con 3 puntuaciones de `PLAYERTEST` en `croak` y `.cover-croak` en `app/globals.css`. Verificacion: la ficha aparece en `/biblioteca` y como pestana en `/salon`; `/juegos/croak/jugar` muestra el simulado.
2. Crear `lib/croak/constants.ts`. Verificacion: `npx tsc --noEmit`.
3. Crear `lib/croak/entities.ts` con `spawnBug`, `moveBugs`, `extendTongue`, `retractTongue`, `tongueHitsBug` y `bugEscaped`. Verificacion: `npx tsc --noEmit`.
4. Crear `lib/croak/engine.ts` con el nucleo: estado, loop con `requestAnimationFrame`, teclado para apuntar y disparar, fases `ready`/`playing`/`wave_pause`/`gameover`, y dibujo de fondo, rana y nenufar. Verificacion: `tsc` y `npm run lint`.
5. Anadir al motor la lengua (extension, retraccion, linea de apuntado) y el dibujo de la lengua. Verificacion: `tsc` y `npm run lint`.
6. Anadir al motor los insectos (generacion por oleada, movimiento, dibujo con colores y parpadeo de luciernagas) y la colision lengua-insecto. Verificacion: `tsc` y `npm run lint`.
7. Anadir al motor las vidas (insecto escapa = -1 vida), las oleadas con pausa entre ellas, los niveles y la dificultad creciente. Verificacion: `tsc` y `npm run lint`.
8. Anadir `onStats`, `onGameOver`, `setPaused`, `finish` y `destroy` (quita listeners y cancela el loop). Verificacion: `tsc` y `npm run lint`.
9. Registrar `croak` en `GAME_REGISTRY` con 800x600 y sus controles. Verificacion: se juega en `/juegos/croak/jugar`.
10. Revisar el escalado a 1440 px y 375 px. Verificacion: `npm run lint` y `npm run build`.

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

Especificos de Croak v1:

- [ ] El canvas logico mide 800x600 con la rana centrada en la parte inferior.
- [ ] `<-` y `->` rotan el angulo de apuntado entre 10 y 170 grados; una linea semitransparente muestra la direccion.
- [ ] `Espacio` dispara la lengua; no se puede disparar otra mientras una esta en vuelo.
- [ ] Las flechas y `Espacio` no desplazan la pagina mientras se juega.
- [ ] La lengua se extiende en linea recta a 600 px/s y se retrae al golpear un insecto o al alcanzar el borde.
- [ ] Atrapar una mosca suma exactamente 10 puntos y el HUD lo refleja de inmediato.
- [ ] Atrapar una libelula suma exactamente 30 puntos.
- [ ] Atrapar una luciernaga suma exactamente 50 puntos; la luciernaga parpadea visualmente.
- [ ] Los insectos entran desde los bordes laterales y superior y vuelan hacia el lado opuesto.
- [ ] Un insecto que sale del canvas sin ser atrapado resta una vida.
- [ ] Con 0 vidas se abre «FIN DEL JUEGO» con la puntuacion correcta.
- [ ] Cada oleada dura 20 s y entre oleadas hay 3 s de pausa con el rotulo «OLEADA N».
- [ ] El nivel sube cada 3 oleadas; los insectos se mueven mas rapido y hay mas libelulas y luciernagas.
- [ ] «JUGAR DE NUEVO» reinicia con 5 vidas, oleada 1, nivel 1 y puntuacion 0.
- [ ] El HUD de la plataforma muestra PUNTOS, VIDAS y NIVEL.
- [ ] La rana no se mueve de su posicion fija.
- [ ] Al empezar, el canvas muestra «PULSA ESPACIO PARA EMPEZAR» y la rana con la linea de apuntado.

## Decisiones

- **Si:** ficha `croak`, categoria `SHOOTER`, color `cyan`, `sort_order` 14. `SHOOTER` solo tiene Asteroids; un segundo shooter con estetica de pantano diversifica la categoria. `cyan` evoca el agua del pantano.
- **Si:** rana fija como torreta. Simplifica la mecanica a apuntar y disparar; la complejidad es baja y el juego es accesible.
- **No:** rana movil entre nenufares. La variante 2 cubre ese enfoque.
- **Si:** 3 tipos de insecto con puntos y velocidades distintas. Da variedad sin complicar demasiado.
- **No:** insectos venenosos que resten puntos. Anade complejidad innecesaria para la variante basica.
- **Si:** oleadas de 20 s con pausa de 3 s. Estructura las partidas y da momentos de respiro.
- **Si:** 5 vidas; perder una por insecto que escape. Es un castigo claro y evita partidas infinitas.
- **Si:** HUD, pausa, modal y guardado de la plataforma; el canvas solo dibuja el juego.
- **No:** conservar HUD, game over o record local del original. Duplicarian los de la plataforma.
- **No:** regenerar `database.types.ts`. Solo se inserta una fila; el esquema no cambia.

## Riesgos

| Riesgo                                                 | Mitigacion                                                                                           |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| Strict Mode duplica motor o listeners                  | `destroy()` cancela el loop y quita los listeners; hay criterio de aceptacion                        |
| `dt` grande tras pausa o cambio de pestana             | `dt` acotado a `MAX_DT_MS` y `lastTime` se reinicia al reanudar                                      |
| La lengua atraviesa un insecto en un frame largo       | La colision se comprueba por interpolacion a lo largo del segmento de la lengua, no solo en la punta |
| Muchos insectos a la vez ralentizan el renderizado     | Se limita el maximo de insectos simultaneos a 15; los que excedan esperan su turno                   |
| El angulo de apuntado no cubre la parte inferior       | El rango 10-170 cubre todo el semicirculo superior; los insectos solo entran por arriba y los lados  |
| `Espacio` activa un boton de la plataforma al reanudar | `preventDefault` en `Espacio`; ignorar entrada con el juego pausado                                  |

## Que **no** esta en esta spec

- Insectos venenosos.
- Power-ups (lengua rapida, lengua doble, escudo).
- Sonido y musica.
- Controles tactiles, raton o gamepad.
- Sprites o animaciones elaboradas.
- Anti-trampas real.
- Tests automatizados.

Cada uno, si llega, va en su propia spec.
