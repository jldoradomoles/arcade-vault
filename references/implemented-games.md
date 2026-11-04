# Juegos implementados en Arcade Vault

Inventario actual de juegos jugables en la plataforma. Datos tomados de la tabla `public.games` y la vista `public.game_stats` de Supabase a fecha **2026-11-04**.

| #   | ID          | Título    | Categoría | Color   | Ruta de juego             | Partidas | Mejor puntuación |
| --- | ----------- | --------- | --------- | ------- | ------------------------- | -------: | ---------------: |
| 9   | `asteroids` | ASTEROIDS | SHOOTER   | cyan    | `/juegos/asteroids/jugar` |        4 |           26 500 |
| 10  | `tetris`    | TETRIS    | PUZZLE    | magenta | `/juegos/tetris/jugar`    |        4 |           18 400 |
| 11  | `arkanoid`  | ARKANOID  | ARCADE    | yellow  | `/juegos/arkanoid/jugar`  |        4 |            3 200 |
| 12  | `snake`     | SNAKE     | ARCADE    | green   | `/juegos/snake/jugar`     |        6 |              320 |
| 13  | `frogger`   | FROGGER   | ARCADE    | green   | `/juegos/frogger/jugar`   |        — |                — |
| 14  | `croak`     | CROAK     | SHOOTER   | cyan    | `/juegos/croak/jugar`     |        — |                — |
| 15  | `orbital`   | ORBITAL   | ARCADE    | magenta | `/juegos/orbital/jugar`   |        — |                — |
| 15  | `pantano`   | PANTANO   | PUZZLE    | magenta | `/juegos/pantano/jugar`   |        — |                — |

> El número `#` corresponde al campo `sort_order` en la tabla `games`, que define el orden en la biblioteca.
