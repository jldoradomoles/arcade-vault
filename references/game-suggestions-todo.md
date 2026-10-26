# Backlog de sugerencias de juegos

Memoria del agente `game-planner`. Cada juego vive en una de las cuatro tablas según su estado. Cuando el estado cambia, la fila se **mueve** de tabla (no se duplica).

Estados: `sugerido` → `aceptado` → `implementado`, o `descartado` en cualquier momento.

Columnas: fecha de entrada en la tabla, juego, origen (`started-games/<carpeta>` o "diseño desde cero"), categoría (`ARCADE|PUZZLE|SHOOTER|VERSUS`), color (`cyan|magenta|yellow|green`), complejidad (`baja|media|alta`) y notas.

## Sugeridos

Propuestas del agente pendientes de decisión del usuario.

| Fecha      | Juego           | Origen            | Categoría | Color   | Complejidad | Notas                                                                                                                                                                                                                                                             |
| ---------- | --------------- | ----------------- | --------- | ------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-26 | PONG            | diseño desde cero | VERSUS    | cyan    | baja        | Cubre la unica categoria vacia (VERSUS). Clasico de 2 jugadores en teclado local (WASD + flechas). Se puede añadir IA para modo 1 jugador. Repite cyan con Asteroids                                                                                              |
| 2026-10-26 | SPACE INVADERS  | diseño desde cero | SHOOTER   | magenta | media       | Segundo shooter; estilo fijo complementa el roaming de Asteroids. Controles simples (flechas + disparo). Repite magenta con Tetris                                                                                                                                |
| 2026-10-26 | 2048            | diseño desde cero | PUZZLE    | green   | baja        | Segundo puzzle; encaja perfecto con flechas de teclado. Logica sencilla, sin fisicas. Repite green con Snake                                                                                                                                                      |
| 2026-10-26 | PAC-MAN         | diseño desde cero | ARCADE    | yellow  | media       | El clasico de laberintos por excelencia. IA de fantasmas con personalidades distintas. Mecanica de persecucion/huida unica en el catalogo. Repite yellow con Arkanoid                                                                                             |
| 2026-10-26 | FROGGER         | diseño desde cero | ARCADE    | green   | media       | Mecanica unica de cruce: esquivar coches y saltar sobre troncos/tortugas. Controles simples (flechas). Ritmo distinto a los demas ARCADE. Repite green con Snake                                                                                                  |
| 2026-10-26 | GALAGA          | diseño desde cero | SHOOTER   | cyan    | media       | Shooter fijo con formaciones de enemigos y captura de nave. Complementa Asteroids (libre) y Space Invaders (sugerido, oleadas). Repite cyan con Asteroids                                                                                                         |
| 2026-10-26 | MINESWEEPER     | diseño desde cero | PUZZLE    | yellow  | baja        | Puzzle logico de deduccion, muy distinto a Tetris (reflejos) y 2048 (deslizar). Adaptable a teclado (flechas + espacio/F para flag). Repite yellow con Arkanoid                                                                                                   |
| 2026-10-26 | BOMBERMAN       | diseño desde cero | VERSUS    | magenta | alta        | 2 jugadores local (WASD + flechas). Mapa destruible y power-ups. Segundo VERSUS tras Pong. IA para modo 1J. Riesgo: complejidad de mapas y colisiones con bombas                                                                                                  |
| 2026-10-26 | SOKOBAN         | diseño desde cero | PUZZLE    | yellow  | media       | Puzzle espacial de empujar cajas a sus posiciones. Controles puros de flechas. Ningun PUZZLE usa yellow; cubre ese hueco. Puntuacion por niveles superados + bonus de movimientos minimos. Niveles procedurales posibles                                          |
| 2026-10-26 | SIMON           | diseño desde cero | PUZZLE    | magenta | baja        | Juego de memoria de patrones (secuencia de colores/sonidos creciente). Puntuacion natural = longitud de secuencia; ideal para leaderboard. Estetica muy arcade retro. Controles: 4 teclas para 4 colores. Repite magenta con Tetris                               |
| 2026-10-26 | LIGHTS OUT      | diseño desde cero | PUZZLE    | green   | baja        | Puzzle de alternar luces en cuadricula 5x5. Logica simple de toggle con propagacion a vecinos. Ideal para teclado (flechas + espacio). Niveles progresivos con puntuacion por velocidad. Repite green con Snake                                                   |
| 2026-10-26 | NONOGRAM        | diseño desde cero | PUZZLE    | cyan    | media       | Puzzle logico tipo Picross: revelar imagenes pixel-art rellenando celdas segun pistas numericas. Estetica pixel encaja perfecto con la identidad retro. Puntuacion por puzzles resueltos + velocidad. Repite cyan con Asteroids                                   |
| 2026-10-26 | 15-PUZZLE       | diseño desde cero | PUZZLE    | cyan    | baja        | Clasico puzzle deslizante de 15 fichas numeradas en cuadricula 4x4. Controles: flechas para mover fichas al hueco. Puntuacion por tiempo + numero de movimientos. Implementacion sencilla, mecanica universalmente conocida. Repite cyan con Asteroids            |
| 2026-10-26 | CENTIPEDE       | diseño desde cero | SHOOTER   | green   | media       | Clasico de Atari con ciempies segmentado y campo de setas. Shooter en cuadricula con mecanica unica de fragmentacion de enemigos. Controles: flechas + disparo. Repite green con Snake                                                                            |
| 2026-10-26 | MISSILE COMMAND | diseño desde cero | SHOOTER   | cyan    | media       | Shooter defensivo: proteger ciudades de lluvia de misiles con contraataques desde 3 bases. Subgenero de defensa unico en el catalogo. Controles: flechas para cursor + teclas para bases. Riesgo: adaptar trackball original a teclado. Repite cyan con Asteroids |
| 2026-10-26 | 1942            | diseño desde cero | SHOOTER   | magenta | media       | Shooter vertical WWII con scroll, oleadas de enemigos aereos y power-ups. Maniobra de esquiva (roll). Controles: flechas + disparo + roll. Riesgo: scroll vertical y diseno de patrones de enemigos. Repite magenta con Tetris                                    |
| 2026-10-26 | ROBOTRON 2084   | diseño desde cero | SHOOTER   | yellow  | alta        | Twin-stick shooter de supervivencia en arena cerrada. Oleadas infinitas de robots con IA variada. Controles: WASD mover + flechas disparar. Riesgo: rendimiento con muchas entidades simultaneas, equilibrio de dificultad. Repite yellow con Arkanoid            |
| 2026-10-26 | TEMPEST         | diseño desde cero | SHOOTER   | magenta | alta        | Shooter en tubo pseudo-3D wireframe. Patrullar el borde de figuras geometricas y disparar hacia el interior. Controles: flechas + disparo + superzapper. Riesgo: renderizado de tubo en perspectiva, multiples formas de nivel. Repite magenta con Tetris         |

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
