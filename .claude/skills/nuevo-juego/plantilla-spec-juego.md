# Plantilla de spec de juego

Esqueleto para `specs/NN-juego-<slug>.md`. No es texto para copiar tal cual: respeta la forma, rellena con datos reales del juego y borra lo que no aplique. Idioma, estados y encabezados deben coincidir con las specs existentes (SPEC 05/06).

---

```markdown
# SPEC NN — Juego <TÍTULO> dentro de la plataforma

> **Status:** borrador
> **Depends on:** SPEC 05, SPEC 06[, SPEC XX (registro de juegos)]
> **Date:** <fecha del contexto de sesión>
> **Objective:** Portar/crear <juego> como motor TypeScript jugable en `/juegos/<id>/jugar`, con el HUD, la pausa y el guardado de puntuación de la plataforma y su ficha en el leaderboard.

## Por qué existe esta spec

<Origen (carpeta de referencia o idea nueva), qué aporta al catálogo y, si es la primera tras SPEC 05, por qué incluye el refactor al registro genérico.>

## Alcance

**Dentro:**

- [Si no existe el registro] Refactor al registro genérico: `lib/game-engine.ts`, `components/game-canvas.tsx`, `lib/game-registry.ts`; Asteroids migra sin cambios de comportamiento.
- Fila en `games` (migración + `supabase/seed.sql`) y portada `.cover-<id>` en `app/globals.css`.
- Motor en `lib/<id>/` (`constants.ts`, `entities.ts`, `engine.ts`) que implementa `GameEngine`.
- Entrada en `GAME_REGISTRY` con tamaño de canvas y controles.
- <Mecánicas concretas del juego, una por línea.>
- <Assets en `public/games/<id>/`, si los hay.>

**Fuera de alcance (para futuras specs):**

- Controles táctiles o gamepad.
- <Sonido/música si no entra.>
- <Lo que el original tiene y no se porta.>
- Anti-trampas real (ver SPEC 06).
- Tests automatizados.

## Modelo de datos

Fila del catálogo:

\`\`\`sql
insert into public.games (id, title, short, long, category, cover, color, sort_order)
values ('<id>', '<TÍTULO>', '<short>', '<long>', '<CAT>', 'cover-<id>', '<color>', <n>)
on conflict (id) do nothing;
\`\`\`

Tipos y constantes del juego (`lib/<id>/constants.ts`): <dimensiones, tablas, tipos reales>.

Motor y registro:

\`\`\`ts
export class <Nombre>Engine implements GameEngine { /* start, setPaused, finish, destroy */ }

// lib/game-registry.ts
<id>: { width: <W>, height: <H>, createEngine: (c, cb) => new <Nombre>Engine(c, cb), controls: [ /* teclas y acción */ ] },
\`\`\`

Mapeo al HUD: `score` = <…>; `lives` = <…/no aplica>; `level` = <…/no aplica>.

Convenciones: <coordenadas, unidades, `dt`, etc.>

## Plan de implementación

Antes del paso 1, leer en `node_modules/next/dist/docs/01-app` la referencia de Client Components y la guía de `cacheComponents`. Usar `/frontend-design` para la portada `.cover-<id>` y la línea de controles. Los nombres de archivo son la propuesta de esta spec.

1. [Si falta] Refactor al registro genérico. Verificación: Asteroids se juega igual; el resto conserva el simulado.
2. Migración de `games` + seed + `.cover-<id>`. Verificación: la ficha aparece en `/biblioteca` y en el Salón; `/juegos/<id>/jugar` muestra el simulado.
3. `lib/<id>/constants.ts`. Verificación: `npx tsc --noEmit`.
4. `lib/<id>/entities.ts`. Verificación: `npx tsc --noEmit`.
5. `lib/<id>/engine.ts` núcleo (loop, entrada, reglas básicas). Verificación: `tsc` y `npm run lint`.
6. <Mecánicas adicionales, un paso por bloque de ≤50 líneas.>
7. `onStats`, `onGameOver`, `setPaused`, `finish`. Verificación: `tsc` y `lint`.
8. Registrar el juego en `GAME_REGISTRY` con sus controles. Verificación: se juega en `/juegos/<id>/jugar`.
9. Revisar escalado a 1440 px y 375 px. Verificación: `npm run lint` y `npm run build`.

Cada paso deja la app funcionando.

## Criterios de aceptación

Base (obligatorios en toda spec de juego):

- [ ] `npm run build`, `npm run lint` y `npx tsc --noEmit` terminan sin errores.
- [ ] La ficha <TÍTULO> aparece en `/biblioteca` con su portada propia y como pestaña en `/salon`.
- [ ] `/juegos/<id>` y `/juegos/<id>/jugar` cargan sin errores en consola ni de hidratación, ni el aviso «URL data outside of Suspense».
- [ ] PAUSA congela el juego y muestra «EN PAUSA»; REANUDAR continúa sin saltos.
- [ ] FIN abre «FIN DEL JUEGO» con la puntuación actual y deja de procesar entrada de juego.
- [ ] Se puede escribir (incluidos espacios y flechas) en el modal sin que el juego reaccione.
- [ ] Con sesión, «GUARDAR PUNTUACIÓN» crea una fila en `scores` con `game_id = '<id>'` y muestra «PUNTUACIÓN GUARDADA_»; aparece en `/salon`, y `best`/`plays` de la ficha se actualizan.
- [ ] Sin sesión, el modal muestra «INICIA SESIÓN PARA GUARDAR» con enlace a `/acceso` y no escribe en `scores`.
- [ ] «JUGAR DE NUEVO» reinicia con puntuación 0 y estado inicial.
- [ ] Al salir con SALIR o cambiar de ruta no quedan listeners de teclado ni loops activos.
- [ ] En desarrollo (Strict Mode) no hay dos motores a la vez ni teclas duplicadas.
- [ ] Con ancho de 375 px el canvas se escala sin scroll horizontal manteniendo su proporción.
- [ ] La puntuación guardada es un entero entre 0 y 10 000 000.
- [ ] Asteroids y los juegos no portados se comportan como antes.

Específicos del juego:

- [ ] <Una comprobación sí/no por mecánica: puntos, vidas, niveles, controles, fin de partida…>

## Decisiones

- **Sí:** <decisión confirmada por el usuario>. <Razón.>
- **No:** <alternativa descartada>. <Razón.>
- **Sí:** HUD, pausa, modal y guardado de la plataforma; el canvas solo dibuja el juego.
- **No:** conservar HUD, game over o récord local del original. Duplicarían los de la plataforma.

## Riesgos

| Riesgo                                     | Mitigación                                                                    |
| ------------------------------------------ | ----------------------------------------------------------------------------- |
| Strict Mode duplica motor o listeners      | `destroy()` cancela el loop y quita los listeners; hay criterio de aceptación |
| `dt` grande tras pausa o cambio de pestaña | `dt` acotado a 0,05 s y `lastTime` se reinicia al reanudar                    |
| <Riesgo propio del juego>                  | <Mitigación>                                                                  |

## Qué **no** está en esta spec

- <Lista explícita, repitiendo el «fuera de alcance».>

Cada uno, si llega, va en su propia spec.
```

---

## Reglas al rellenar

- Una frase por idea; nombres concretos de archivo y cadenas exactas.
- Sin TODOs: o se decide o se anota como decisión pendiente con motivo.
- Sin funciones completas de código; solo fragmentos que ilustren estructuras.
- Cada paso del plan debe poder commitearse solo y dejar la app funcionando.
- Los criterios son booleanos; nada de «funciona bien».
