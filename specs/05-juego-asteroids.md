# SPEC 05 — Juego Asteroids dentro de la plataforma

> **Status:** aprobado
> **Depends on:** SPEC 01
> **Date:** 2026-10-23
> **Objective:** Portar el juego Asteroids de `references/started-games/02-asteroids` (canvas + JS vanilla) a un motor en TypeScript y hacerlo jugable en `/juegos/asteroids/jugar`, con el HUD, la pausa y el guardado de puntuación de la plataforma.

## Por qué existe esta spec

Hasta ahora el reproductor (`components/game-player.tsx`) es una simulación: el puntaje sube solo y no hay juego. Asteroids es el primer juego real y fija el patrón para los siguientes: un **motor independiente de React** (clase con `start`/`setPaused`/`finish`/`destroy`) que dibuja en un `<canvas>` y avisa a la plataforma mediante callbacks. Así el HUD, la pausa, el modal de fin de partida y el guardado de puntuación siguen siendo los de la plataforma y no se duplican dentro de cada juego.

## Alcance

**Dentro:**

- Nueva ficha `asteroids` en `lib/games.ts` (título `ASTEROIDS`, categoría `SHOOTER`, color `cyan`) y portada CSS nueva `.cover-asteroids` en `app/globals.css`. ROCAS (`rocas`) no se toca.
- Motor del juego portado 1:1 desde `game.js` a TypeScript, en `lib/asteroids/`:
  - Nave con rotación, propulsión, inercia, fricción y envolvimiento de bordes (espacio toroidal).
  - Disparo con enfriamiento de 0,2 s y balas con vida de 1,1 s.
  - Asteroides de 3 tamaños que se parten en dos del tamaño inferior; puntos 20 / 50 / 100 (grande / mediano / pequeño).
  - 3 vidas, 3 s de invencibilidad con parpadeo al reaparecer y 2 s de espera tras morir.
  - Niveles: al vaciar la pantalla se genera el siguiente con `3 + nivel` asteroides grandes fuera de un radio seguro.
  - Partículas de explosión.
  - Los 3 power-ups: **Disparo Triple** (8 s, aparece una vez por partida en un nivel aleatorio 1–3), **Escudo Temporal** (8 s o hasta absorber un golpe) y **Bomba Nova** (rara, una carga, tecla `B`, destello blanco).
  - Controles de teclado: `←` `→` rotar, `↑` propulsar, `Espacio` disparar, `B` bomba.
- Aspecto vectorial original: líneas blancas sobre negro, canvas lógico de 800×600 escalado por CSS al ancho del `crt-screen` manteniendo 4:3.
- Dibujo en el canvas solo de lo que no tiene equivalente en la plataforma: entidades, destello de la bomba y los indicadores de power-ups activos (`TRIPLE 8s`, `ESCUDO 8s`, `BOMBA NOVA [B]`).
- Componente cliente `components/asteroids-canvas.tsx` que crea y destruye el motor y lo conecta a `GamePlayer`.
- Integración en `components/game-player.tsx`: para `asteroids`, puntos, vidas y nivel vienen del motor; PAUSA congela el juego; FIN y la pérdida de la última vida abren el modal «FIN DEL JUEGO»; «JUGAR DE NUEVO» reinicia el juego; «GUARDAR PUNTUACIÓN» usa el `saveScore` existente con `game: "asteroids"`.
- Línea de ayuda de controles bajo el marco CRT, solo para `asteroids`.
- Leer `params` dentro de `<Suspense>` en `app/juegos/[id]/page.tsx` y `app/juegos/[id]/jugar/page.tsx` (el componente de página pasa la promesa a un hijo asíncrono, con un fallback mínimo). Sin esto Next 16 registra en consola el aviso «URL data outside of Suspense» en todos los juegos y no se cumple el criterio de consola limpia. Añadido durante la implementación.
- Margen de gracia de 0,5 s tras absorber un golpe con el escudo (`SHIELD_GRACE`), para que los fragmentos del asteroide, que nacen pegados a la nave, no la maten en el acto. Añadido durante la implementación.
- Los otros 7 juegos siguen con el reproductor simulado, sin cambios de comportamiento.

**Fuera de alcance (para futuras specs):**

- Guardar puntuaciones en Supabase, ranking real y auth (el guardado sigue siendo `av_scores` en localStorage).
- Controles táctiles o gamepad; en móvil la página carga pero el juego no es jugable.
- Reestilizar el juego a colores neón de la plataforma.
- El asteroide «estrella fugaz» (el README del original lo menciona, pero el original no lo implementa) y los OVNIs.
- Sonido y música.
- Pausar automáticamente al cambiar de pestaña.
- Modificar o reemplazar la ficha ROCAS.
- Mostrar en el Salón de la Fama las puntuaciones guardadas (`av_scores`).
- Tests automatizados.

## Modelo de datos

No hay persistencia nueva: el guardado reutiliza `SavedScore` de `lib/session.ts` mediante `saveScore`. Lo nuevo son los tipos del motor, el contrato con la plataforma y la ficha del catálogo.

```ts
// lib/asteroids/constants.ts
export const W = 800;
export const H = 600;
export const RADII = [0, 16, 30, 50] as const; // por tamaño 1, 2, 3
export const SPEEDS = [0, 85, 55, 32] as const;
export const POINTS = [0, 100, 50, 20] as const;
// + BIG_SHAPE, BIG_SHAPE_CHANCE, TRIPLE_DURATION, SHIELD_DURATION, SHIELD_PAD,
//   POWERUP_TYPES, BOMB_CHANCE, BOMB_FLASH (mismos valores que game.js)
// + SHIELD_GRACE = 0.5 (nuevo: no existe en game.js, ver Decisiones)

export type AsteroidSize = 1 | 2 | 3;
export type PowerUpType = "triple" | "shield" | "bomb";
export type AsteroidsState = "playing" | "dead" | "gameover";
```

```ts
// lib/asteroids/engine.ts
export interface AsteroidsStats {
  score: number;
  lives: number;
  level: number;
}

export interface AsteroidsCallbacks {
  onStats: (stats: AsteroidsStats) => void; // solo cuando cambia algún valor
  onGameOver: (finalScore: number) => void; // una sola vez por partida
}

export class AsteroidsEngine {
  constructor(canvas: HTMLCanvasElement, callbacks: AsteroidsCallbacks);
  start(): void; // inicializa la partida, registra el teclado y arranca el loop
  setPaused(paused: boolean): void;
  finish(): void; // termina la partida con el puntaje actual (botón FIN)
  destroy(): void; // cancela el loop y quita los listeners
}
```

```ts
// components/asteroids-canvas.tsx
interface AsteroidsCanvasProps {
  paused: boolean;
  over: boolean; // true => el motor llama a finish()
  onStats: (stats: AsteroidsStats) => void;
  onGameOver: (finalScore: number) => void;
}
```

```ts
// lib/games.ts — entrada nueva al final de GAMES
{
  id: "asteroids",
  title: "ASTEROIDS",
  short: "Sobrevive en un campo de asteroides en gravedad cero.",
  long: "Pilota una nave en un espacio sin bordes: lo que sale por un lado entra por el otro. Dispara a las rocas para partirlas en fragmentos cada vez más pequeños y recoge power-ups: disparo triple, escudo temporal y la rara Bomba Nova. Tienes tres vidas y cada nivel llega más cargado.",
  cat: "SHOOTER",
  cover: "cover-asteroids",
  color: "cyan",
  best: 38600,
  plays: "8.7K",
}
```

Convenciones:

- Las entidades (`Bullet`, `Asteroid`, `Ship`, `Particle`, `PowerUp`) viven en `lib/asteroids/entities.ts`, mantienen `update(dt)`, `draw(ctx)` y el flag `dead`, y no usan globales: el `ctx`, el teclado y el estado del disparo triple se pasan por parámetro.
- El estado de partida (antes globales de `game.js`) pasa a ser campos privados de `AsteroidsEngine`.
- `dt` en segundos, acotado a 0,05, como en el original. Coordenadas con origen arriba a la izquierda.
- El motor no importa React ni nada de `next/*`; solo DOM y canvas.
- `onStats` se emite al cambiar `score`, `lives` o `level`, no en cada frame, para no re-renderizar React a 60 fps.
- Los listeners de teclado se registran en `window` en `start()` y se quitan en `destroy()` y al llegar a `gameover`. `preventDefault` solo para `Space` y flechas, y se ignoran los eventos cuyo `target` sea un `input`, para que se pueda escribir en el modal.
- Tras `gameover` el loop sigue dibujando (las partículas terminan de desvanecerse) pero ya no procesa entrada; ya no existe el reinicio con Espacio del original: reinicia el modal.

## Plan de implementación

Antes del paso 1, leer en `node_modules/next/dist/docs/01-app` la referencia de Client Components y la guía de `cacheComponents` (el canvas solo se toca dentro de `useEffect`, nunca en el render). Usar la skill `/frontend-design` para la portada `.cover-asteroids` y la línea de controles. Los nombres de archivo son la propuesta de esta spec.

1. Añadir la entrada `asteroids` a `lib/games.ts` y la regla `.cover-asteroids` en `app/globals.css`. Verificación: la ficha aparece en `/biblioteca`, `/juegos/asteroids` carga y `/juegos/asteroids/jugar` muestra el reproductor simulado de siempre.
2. Crear `lib/asteroids/constants.ts` con dimensiones, tablas, tipos y utilidades (`wrap`, `dist`, `rand`, `randInt`). Verificación: `npx tsc --noEmit` pasa.
3. Crear `lib/asteroids/entities.ts` con `Bullet`, `Asteroid`, `Particle` y `Ship` (incluido `tryShoot(triple: boolean)`). Verificación: `npx tsc --noEmit` pasa.
4. Añadir `PowerUp` a `entities.ts`. Verificación: `npx tsc --noEmit` pasa.
5. Crear `lib/asteroids/engine.ts` con el núcleo: estado, teclado (`keys` / `pressed`), `start()`/`destroy()`, loop con `requestAnimationFrame`, colisiones bala–asteroide y nave–asteroide, muerte/reaparición, niveles y dibujo de entidades. Verificación: `npx tsc --noEmit` y `npm run lint` pasan.
6. Añadir al motor los power-ups: temporizadores de aparición, recogida, disparo triple, escudo, `detonateBomb()`, destello e indicadores dibujados en el canvas. Verificación: `npx tsc --noEmit` y `npm run lint` pasan.
7. Añadir al motor `onStats`, `onGameOver`, `setPaused()` y `finish()`. Verificación: `npx tsc --noEmit` y `npm run lint` pasan.
8. Crear `components/asteroids-canvas.tsx`: `<canvas width={800} height={600}>` con CSS de ancho 100 % y proporción 4:3; un `useEffect` crea el motor, lo arranca y lo destruye al desmontar; otros efectos aplican `paused` y `over`. Montarlo temporalmente desde `GamePlayer` para `asteroids`. Verificación: en `/juegos/asteroids/jugar` la nave se mueve y dispara con el teclado.
9. Integrar en `components/game-player.tsx`: para `asteroids`, desactivar el `setInterval` simulado, sustituir `.game-arena` por `AsteroidsCanvas`, alimentar puntuación, vidas y nivel desde `onStats`, abrir el modal con `onGameOver` y reiniciar con `key` en «JUGAR DE NUEVO». Verificación: el flujo jugar → morir 3 veces → modal → guardar → jugar de nuevo funciona.
10. Añadir la línea de controles bajo el marco CRT solo para `asteroids` y revisar el escalado a 1440 px y 375 px. Verificación: `npm run lint` y `npm run build` pasan.

## Criterios de aceptación

- [ ] `npm run build` y `npm run lint` terminan sin errores.
- [ ] La ficha ASTEROIDS aparece en `/biblioteca`, con su portada propia distinta de la de ROCAS, y también está en las pestañas del Salón de la Fama; ROCAS sigue igual.
- [ ] `/juegos/asteroids` y `/juegos/asteroids/jugar` cargan sin errores en consola ni de hidratación.
- [ ] En `/juegos/asteroids/jugar` se ve el canvas en el marco CRT con la nave en el centro, parpadeando 3 s al empezar.
- [ ] `←` `→` rotan la nave, `↑` la propulsa con inercia y `Espacio` dispara; mantener `Espacio` pulsado no dispara en ráfaga.
- [ ] Los objetos que salen por un borde entran por el opuesto.
- [ ] Destruir un asteroide grande suma 20, uno mediano 50 y uno pequeño 100, y el HUD de la plataforma refleja el cambio de inmediato.
- [ ] Un asteroide grande se parte en dos medianos y un mediano en dos pequeños; un pequeño desaparece.
- [ ] Chocar con un asteroide resta una vida en el HUD (`♥`), espera 2 s y reaparece la nave en el centro con 3 s de invencibilidad.
- [ ] Al vaciar la pantalla el nivel del HUD sube en 1 y aparecen `3 + nivel` asteroides grandes.
- [ ] Al perder la tercera vida se abre el modal «FIN DEL JUEGO» con la puntuación final correcta.
- [ ] Recoger el power-up `3` activa el disparo triple (3 balas en abanico) durante 8 s, con `TRIPLE Ns` visible en el canvas.
- [ ] Recoger `E` activa un escudo visible que dura 8 s o hasta absorber un golpe (destruye ese asteroide y no resta vida).
- [ ] Tras absorber un golpe con el escudo, los fragmentos que nacen junto a la nave no la matan durante los siguientes 0,5 s; pasado ese margen, un choque vuelve a restar una vida.
- [ ] Recoger `B` muestra `BOMBA NOVA [B]`; pulsar `B` destruye todos los asteroides sin fragmentarlos, suma sus puntos y muestra el destello; sin bomba, `B` no hace nada.
- [ ] PAUSA congela nave, asteroides, temporizadores y power-ups y muestra «EN PAUSA»; REANUDAR continúa sin saltos bruscos.
- [ ] FIN abre el modal con el puntaje actual y deja de procesar entrada de juego.
- [ ] Se puede escribir (incluidos espacios y flechas) en el campo de iniciales del modal sin que la nave reaccione.
- [ ] «GUARDAR PUNTUACIÓN» persiste `{ game: "asteroids", score, name }` en `av_scores` y muestra «PUNTUACIÓN GUARDADA_».
- [ ] «JUGAR DE NUEVO» reinicia con 0 puntos, 3 vidas y nivel 1.
- [ ] Salir del juego con SALIR o cambiando de ruta no deja listeners de teclado ni loops activos (las flechas y `Espacio` vuelven a desplazar la página).
- [ ] En desarrollo (React Strict Mode) no hay dos motores corriendo a la vez ni teclas duplicadas.
- [ ] Con ancho de 375 px el canvas se escala sin scroll horizontal y mantiene 4:3.
- [ ] Los otros 7 juegos conservan el reproductor simulado idéntico al actual.

## Decisiones

- **Sí:** juego nuevo `asteroids` y no reemplazar `rocas`. Decisión del usuario; ROCAS queda como ficha del catálogo sin juego real por ahora.
- **No:** reutilizar `cover-rocas`. Con ficha propia la tarjeta se confundiría con ROCAS, así que se hace una portada nueva.
- **Sí:** motor como clase TypeScript independiente de React y `GamePlayer` como capa de plataforma. Es el patrón que reutilizarán los siguientes juegos y mantiene el loop de 60 fps fuera del ciclo de render.
- **No:** meter la lógica del juego dentro de un componente con `useState` por entidad. Re-renderizaría React en cada frame.
- **Sí:** HUD, pausa y modal de la plataforma; el canvas solo dibuja el juego y los indicadores de power-ups. Decisión del usuario; da guardado de puntuación y un aspecto coherente con el resto.
- **No:** conservar el HUD y el «GAME OVER / ESPACIO» dibujados en el canvas. Duplicarían los de la plataforma.
- **Sí:** portar todo el contenido, incluidos los 3 power-ups. Decisión del usuario; fidelidad 1:1 con la lógica original.
- **Sí:** aspecto vectorial blanco original, canvas lógico 800×600 escalado por CSS. Se evita tocar la lógica de coordenadas y se conserva el aspecto clásico.
- **No:** reestilizar a neón. Cambia el aspecto del juego sin aportar jugabilidad.
- **Sí:** PAUSA congela el loop y FIN abre el modal. Los botones del HUD ya existen y tienen que funcionar con el juego real.
- **Sí:** puntuación en `av_scores` mediante el `saveScore` actual. Decisión del usuario; Supabase solo está conectado (SPEC 04) y no hay esquema.
- **No:** Supabase, auth o ranking real en esta spec. Cada uno pide su propia spec.
- **Sí:** `onStats` solo ante cambios y no por frame.
- **Sí:** el reinicio lo hace el modal («JUGAR DE NUEVO»), no `Espacio`. Evita conflictos con el campo de iniciales.
- **Sí:** margen de gracia de 0,5 s (`SHIELD_GRACE`) tras absorber un golpe con el escudo. Cambio respecto a `game.js`, descubierto al probar el escudo: el asteroide se parte en el punto del impacto, así que los fragmentos nacen sobre la nave y, ya sin escudo, la mataban en el mismo frame, contradiciendo «no resta vida». No hay parpadeo de la nave durante el margen.
- **No:** expulsar los fragmentos fuera del radio del escudo. Habría tocado `Asteroid.split()`, que se mantiene 1:1 con el original.
- **Sí:** leer `params` dentro de `<Suspense>` en las páginas de detalle y de juego de `/juegos/[id]`. Es el arreglo que indica la guía de Next para el aviso «URL data outside of Suspense» (solo en desarrollo, no rompe el build) y, de paso, deja limpia la consola de los 8 juegos, no solo de Asteroids.
- **No:** `export const instant = false` para silenciar el aviso. Desactiva la validación de navegación instantánea en vez de resolverla.
- **Sí:** ignorar eventos de teclado cuyo `target` sea un `input`, y quitar los listeners al terminar la partida, para no bloquear la escritura en el modal.
- **No:** controles táctiles. Es una decisión de UX aparte que afecta a todos los juegos.

## Riesgos

| Riesgo                                                                                                                       | Mitigación                                                                                                        |
| ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| React Strict Mode monta el efecto dos veces en desarrollo y deja dos loops o listeners duplicados.                           | `destroy()` cancela el `requestAnimationFrame` y quita los listeners; hay un criterio de aceptación para ello.    |
| `preventDefault` en `Espacio` y flechas bloquea escribir en el campo de iniciales o desplazar la página.                     | Se ignoran eventos cuyo `target` es un `input` y los listeners se quitan al llegar a `gameover` y en `destroy()`. |
| Tras la pausa o el cambio de pestaña, `dt` grande hace que los objetos «salten».                                             | `dt` acotado a 0,05 s y `lastTime` se reinicia al reanudar.                                                       |
| El canvas escalado por CSS se ve borroso o rompe el 4:3 en móvil.                                                            | Proporción fija y ancho 100 %; revisión a 375 px y 1440 px en el último paso.                                     |
| Re-renders de React a 60 fps si se emiten estadísticas por frame.                                                            | `onStats` solo ante cambios de `score`, `lives` o `level`.                                                        |
| `cacheComponents` falla si se toca el DOM o `window` durante el render.                                                      | Toda la creación del motor ocurre dentro de `useEffect` del componente cliente.                                   |
| Divergencias al portar las globales de `game.js` a campos de clase (por ejemplo `tripleShotTimer` usado en `Ship.tryShoot`). | `tryShoot` recibe el estado como parámetro y los criterios de aceptación cubren cada power-up.                    |
| La fuente `monospace` del HUD del canvas varía entre sistemas.                                                               | Solo afecta a los indicadores de power-ups y se acepta; el resto del HUD es el de la plataforma.                  |

## Qué **no** está en esta spec

- Guardar puntuaciones en Supabase, ranking real y autenticación.
- Controles táctiles, gamepad y versión móvil jugable.
- Reestilizado neón del juego.
- Estrella fugaz, OVNIs, sonido y música.
- Cambios en la ficha o el reproductor de ROCAS y de los demás juegos.
- Mostrar `av_scores` en el Salón de la Fama.
- Tests automatizados.

Cada uno, si llega, va en su propia spec.
