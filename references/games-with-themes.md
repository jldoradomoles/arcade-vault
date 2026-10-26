# Juegos con skin selector

Memoria del agente `skin-designer`. Cada fila indica si un juego ya tiene las tres skins (`classic`, `neon`, `retro`) y su selector dentro del propio juego.

| game-id   | classic | neon | retro | notas                                                      |
| --------- | :-----: | :--: | :---: | ---------------------------------------------------------- |
| asteroids |   ✅    |  ✅  |  ✅   | vectorial puro: paleta aplicada a stroke/fill, sin sprites |
| tetris    |   ⬜    |  ⬜  |  ⬜   | pendiente                                                  |
| arkanoid  |   ✅    |  ✅  |  ✅   | tiñe spritesheet con ctx.filter (hue-rotate / sepia)       |
| snake     |   ✅    |  ✅  |  ✅   | spritesheet de frutas teñido con ctx.filter por skin       |
