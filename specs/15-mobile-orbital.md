# SPEC 15 — Corrección móvil de ORBITAL

> **Status:** implementado
> **Depends on:** SPEC 10, SPEC 14
> **Date:** 2026-11-03
> **Objective:** Corregir el desbordamiento del canvas de Orbital en landscape mobile (667×375) y verificar la experiencia táctil en los cuatro viewports.

## Por qué existe esta spec

Orbital usa un canvas de 800×600 (relación 4:3). En el viewport landscape de 375 px de alto, el canvas escala al ancho disponible (667 px) y alcanza 500 px de alto, desbordando el viewport de 375 px cuando se suman el HUD (~56 px) y los controles táctiles (~80 px). El juego queda parcialmente oculto y los controles pueden quedar fuera de la pantalla.

Los demás viewports pasan limpios: portrait 375×812 cabe con ~417 px totales; tablet 768×1024 cabe con ~716 px totales; ≥1024 usa el canvas nativo sin controles táctiles.

La corrección es la misma que resolvió el mismo issue en Croak (SPEC 14-mobile-croak.md): limitar la altura del canvas en landscape para que el conjunto HUD + canvas + controles entre en el viewport.

## Auditoría de viewports

| Viewport | Escenario        | Canvas CSS        | Issue                                                            | Veredicto |
| -------- | ---------------- | ----------------- | ---------------------------------------------------------------- | --------- |
| 375×812  | Portrait mobile  | 375×281           | Ninguno — cabe junto con HUD y controles                         | ✅ OK     |
| 667×375  | Landscape mobile | 667×500 (sin fix) | Desbordamiento crítico — canvas + HUD + controles superan 375 px | ❌ Fix    |
| 768×1024 | Tablet portrait  | 768×576           | Ninguno — ~716 px totales caben en 1024 px                       | ✅ OK     |
| ≥1024    | Desktop          | 800×600 (nativo)  | Sin controles táctiles; sin issues                               | ✅ OK     |

## Controles táctiles derivados

Con la entrada de orbital en `GAME_REGISTRY`:

```ts
controls: [
  { keys: ["Ratón"], action: "Apuntar escudo" },
  { keys: ["Espacio"], action: "Pulso" },
],
touchStyle: "arcade",
```

`deriveTouchLayout` produce:

- `canvasDrag = true` (presencia de `"Ratón"`)
- `dpad = []` (sin flechas)
- `actions = [{ label: "Pulso", code: "Space", key: " " }]` → botón A
- `style = "arcade"`

El escudo se apunta arrastrando el dedo por el canvas (proxy `touchmove` → `mousemove`). El pulso se activa con el botón A táctil, que despacha `Space` → `onKeyDown` → `firePulse()`. El `onMouseDown` del engine comprueba `isTrusted` y no es activado por el proxy de arrastre, lo cual es correcto.

## Alcance

**Dentro:**

- Limitar la altura máxima del canvas en `game-player.tsx` para que en landscape el conjunto HUD + canvas + controles no supere el viewport.
- La corrección se aplica a todos los juegos con canvas 4:3 o más alto en landscape; no es específica de orbital.

**Fuera de alcance:**

- Cambios en el motor de orbital.
- Nuevos gestos táctiles.
- Vibración háptica.
- Tests automatizados.

## Modelo de datos

Ningún cambio de schema ni migración.

## Plan de implementación

1. **Corregir el overflow en landscape.** En `components/game-player.tsx`, añadir a la clase del contenedor del canvas la restricción `max-h-[calc(100dvh-var(--hud-h,56px)-var(--controls-h,80px))]` en landscape, o usar la misma regla CSS probada en SPEC 14-mobile-croak para limitar `max-height` del canvas a `calc(100dvh - 10rem)` en el breakpoint `landscape`. Verificación: `npx tsc --noEmit` y `npm run lint`.

2. **Verificación estática de los 4 viewports.** Confirmar que en los cuatro viewports de referencia (375×812, 667×375, 768×1024, ≥1024) el canvas, el HUD y los controles no producen scroll horizontal ni overflow vertical. Verificación: `npm run build`.

Cada paso deja la app funcionando.

## Criterios de aceptación

- [ ] `npm run build`, `npm run lint` y `npx tsc --noEmit` terminan sin errores.
- [ ] En 667×375 (landscape mobile) el canvas, el HUD y los controles táctiles son completamente visibles sin scroll.
- [ ] En 375×812 (portrait) el layout no presenta cambios respecto al estado actual.
- [ ] En ≥768 px el juego no presenta cambios respecto al estado actual.
- [ ] El arrastre táctil sobre el canvas apunta el escudo sin saltos bruscos.
- [ ] El botón A táctil activa el pulso correctamente.
- [ ] Los demás juegos del registro no presentan regresiones.

## Decisiones

- **Sí:** mismo fix que 14-mobile-croak. El problema es idéntico (canvas 4:3 en landscape) y la solución ya está probada.
- **No:** cambios en el motor de orbital. El proxy `touch→mouse` de SPEC 10 y la derivación de controles cubren el caso sin tocar el engine.

## Riesgos

| Riesgo                                                                                   | Mitigación                                                                                                                                                                                         |
| ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| El fix de landscape reduce demasiado el canvas en tablet portrait                        | La restricción solo aplica al breakpoint landscape (altura < anchura); tablet portrait no se ve afectada                                                                                           |
| El arrastre táctil para apuntar el escudo es impreciso con el canvas pequeño en portrait | El arc radius en CSS px es ~56 px a 375 px de ancho; usable con el dedo. Si la experiencia resulta muy difícil, una spec de seguimiento puede ajustar el arc radius lógico para pantallas pequeñas |
