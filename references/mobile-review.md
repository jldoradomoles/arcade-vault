# Auditoría móvil de juegos

Memoria del agente `mobile-porter`. Cada fila indica el estado de la auditoría móvil de un juego del `lib/game-registry.ts` frente a los cuatro viewports (375×812, 667×375, 768×1024, ≥1024).

## Pendientes

Juegos del registry sin auditar.

| game-id   | notas |
| --------- | ----- |
| asteroids | —     |
| tetris    | —     |
| arkanoid  | —     |
| snake     | —     |
| frogger   | —     |

## Auditados sin issues

Los cuatro viewports pasaron limpios; no hace falta spec.

| game-id | fecha | notas |
| ------- | ----- | ----- |

## Spec abierta

Spec generada en `specs/NN-mobile-<game-id>.md`, pendiente de `/spec-impl`.

| game-id | spec | fecha | notas |
| ------- | ---- | ----- | ----- |

## Portados

Spec implementada y verificada en los cuatro viewports.

| game-id | spec                       | fecha      | notas                                                                             |
| ------- | -------------------------- | ---------- | --------------------------------------------------------------------------------- |
| croak   | specs/14-mobile-croak.md   | 2026-11-03 | canvas landscape overflow en 667×375; fix 1 línea en game-player.tsx              |
| orbital | specs/15-mobile-orbital.md | 2026-11-03 | landscape overflow cubierto por el fix de croak (72vh maxWidth, sin código nuevo) |
