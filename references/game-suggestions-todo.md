# Backlog de sugerencias de juegos

Memoria del agente `game-planner`. Cada juego vive en una de las cuatro tablas según su estado. Cuando el estado cambia, la fila se **mueve** de tabla (no se duplica).

Estados: `sugerido` → `aceptado` → `implementado`, o `descartado` en cualquier momento.

Columnas: fecha de entrada en la tabla, juego, origen (`started-games/<carpeta>` o "diseño desde cero"), categoría (`ARCADE|PUZZLE|SHOOTER|VERSUS`), color (`cyan|magenta|yellow|green`), complejidad (`baja|media|alta`) y notas.

## Sugeridos

Propuestas del agente pendientes de decisión del usuario.

| Fecha | Juego | Origen | Categoría | Color | Complejidad | Notas |
| ----- | ----- | ------ | --------- | ----- | ----------- | ----- |

## Aceptados

Juegos que el usuario ha dado luz verde pero aún no están implementados. El siguiente paso para cada uno es `/nuevo-juego`.

| Fecha | Juego | Origen | Categoría | Color | Complejidad | Notas |
| ----- | ----- | ------ | --------- | ----- | ----------- | ----- |

## Implementados

Juegos que ya están jugables en la plataforma. Se mantienen aquí para que el agente no vuelva a proponerlos. La fuente de verdad del catálogo sigue siendo `references/implemented-games.md`.

| Fecha      | Juego     | Origen                       | Categoría | Color   | Complejidad | Notas                                            |
| ---------- | --------- | ---------------------------- | --------- | ------- | ----------- | ------------------------------------------------ |
| 2026-10-26 | ASTEROIDS | `started-games/02-asteroids` | SHOOTER   | cyan    | media       | SPEC 05. `sort_order=9`. Mejor puntuación 26500  |
| 2026-10-26 | TETRIS    | `started-games/03-tetris`    | PUZZLE    | magenta | media       | SPEC 07. `sort_order=10`. Mejor puntuación 18400 |
| 2026-10-26 | ARKANOID  | `started-games/04-arkanoid`  | ARCADE    | yellow  | media       | SPEC 08. `sort_order=11`. Mejor puntuación 3200  |
| 2026-10-26 | SNAKE     | diseño desde cero            | ARCADE    | green   | baja        | SPEC 09. `sort_order=12`. Mejor puntuación 320   |

## Descartados

Juegos rechazados. No volver a proponer salvo petición explícita del usuario.

| Fecha | Juego | Origen | Categoría | Color | Complejidad | Notas |
| ----- | ----- | ------ | --------- | ----- | ----------- | ----- |
