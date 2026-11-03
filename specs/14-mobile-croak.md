# SPEC 14 — Ajustes móviles de CROAK

> **Status:** implementado
> **Depends on:** SPEC 10, spec-croak-v2
> **Date:** 2026-11-03
> **Objective:** Corregir el overflow del canvas en viewport landscape móvil (667×375) detectado en croak tras la auditoría de los cuatro viewports (375×812, 667×375, 768×1024, ≥1024).

## Por qué existe esta spec

CROAK usa un canvas 800×600 (landscape 4:3). La implementación actual de `game-player.tsx` aplica una restricción de `maxWidth` basada en la altura del viewport (`72vh × aspecto + 48px`) únicamente a juegos con canvas portrait (`height > width`). Los juegos landscape como croak no reciben esa restricción.

En viewport landscape móvil (667×375) el canvas escala al ancho del contenedor (≈619px) y, manteniendo la proporción 4:3, alcanza ≈464px de alto — superando los 375px del viewport. El gamepad táctil arcade queda fuera de la zona visible; el jugador debe desplazarse para poder disparar la lengua, haciendo el juego prácticamente injugable en una sola mano.

Los otros tres viewports pasan sin problemas:

- **375×812 (portrait):** canvas ≈327×245px, HUD no rebosa, gamepad visible sin scroll.
- **768×1024 (tablet):** canvas ≈720×540px, espacio suficiente, gamepad a tamaño completo (breakpoint ≤620px no dispara).
- **≥1024 (desktop):** sin pantalla táctil; el HUD, el canvas y la ayuda de teclado se muestran correctamente.

## Alcance

**Dentro:**

- Extender la restricción de `maxWidth` en `components/game-player.tsx` (línea ~145) para que aplique a **todos** los juegos de motor, no solo los portrait. Esto elimina el overflow de canvas en landscape móvil para croak y, como efecto colateral positivo, para los demás juegos landscape del registry (Asteroids, Frogger).

**Fuera de alcance:**

- Infraestructura táctil compartida (ya cubierta por SPEC 10).
- Cambios en reglas del juego, puntuación o balance.
- Tests automatizados.

## Convenciones reutilizadas de SPEC 10

- Detección táctil con `useTouchDevice` (`(pointer: coarse)`).
- Despacho de eventos sintéticos (`KeyboardEvent`) desde `TouchControls`.
- Breakpoints vigentes en `app/globals.css`.
- `touch-action: manipulation` y `user-select: none` en la zona de juego.

## Contrato visual del gamepad virtual

Los controles táctiles reproducen la apariencia del gamepad neón de `references/gamepad-assets/gamepad.html`:

- Paleta: fondo `#0a0a0f`, tinta `#e6e9ff`, cian `#00f5ff` para D-pad y botón B, magenta `#ff006e` para botón A, borde `rgba(0, 245, 255, 0.18)`.
- Fuentes: `Press Start 2P` para los letters de A/B, `JetBrains Mono` para el resto.
- Chasis `.gp`: `linear-gradient(180deg, #1c1c28 0%, #0c0c14 100%)`, `border-radius: 22px`, doble borde interno y textura de puntos radiales a 8 px.
- D-pad: `156×156` con botones `50×50` en cruz, hub central con gema cian pulsante.
- Botones A/B: círculos `74×74` con gradiente radial, aro dashed al hover, `box-shadow` de 6 px.
- Breakpoint `max-width: 620px`: chasis compacto, D-pad `144×144`, botones A/B `64×64`.

## Plan de implementación

### Paso 1 — Eliminar condición `height > width` en `game-player.tsx`

**Archivo:** `components/game-player.tsx` · línea ~145

Cambiar el bloque `style` del div `.crt`:

```tsx
// ANTES
style={
  entry && entry.height > entry.width
    ? { maxWidth: `calc(72vh * ${entry.width / entry.height} + 48px)` }
    : undefined
}

// DESPUÉS
style={
  entry
    ? { maxWidth: `calc(72vh * ${entry.width / entry.height} + 48px)` }
    : undefined
}
```

La fórmula es idéntica; solo se elimina el filtro `entry.height > entry.width`. En monitores de escritorio estándar (altura ≥ 768px), el resultado de la expresión CSS supera el ancho máximo del contenedor (1100px) y la restricción nunca aplica. En viewports landscape móvil (altura ≈375px), la restricción produce un ancho máximo de ≈408px para croak, lo que limita la altura del canvas a ≈270px — dentro del viewport.

**Verificación:** `npx tsc --noEmit` + `npm run lint`.

## Criterios de aceptación

Por viewport:

- [ ] **375×812:** canvas de croak ≈327×245px. Gamepad arcade visible sin scroll. HUD no rebosa.
- [ ] **667×375:** canvas de croak no supera la altura del viewport. El gamepad táctil es visible sin necesidad de desplazarse. Canvas esperado: ≈360×270px.
- [ ] **768×1024:** canvas normal (~720×540px). Gamepad visible. Sin regresos.
- [ ] **≥1024:** el canvas de todos los juegos landscape (croak, Asteroids, Frogger) mantiene el tamaño actual en monitores de altura ≥ 768px.

Por tipo de problema:

- [ ] **Layout 667×375:** el canvas de croak no genera scroll vertical para alcanzar el gamepad.
- [ ] **Sin regresos:** Tetris, Arkanoid, Snake, Frogger y Asteroids mantienen su comportamiento en los cuatro viewports tras el cambio.
- [ ] **Build limpio:** `npm run build`, `npm run lint` y `npx tsc --noEmit` terminan sin errores.

## Decisiones

- **Sí:** extender la restricción a todos los juegos en lugar de añadir un caso especial para croak. La fórmula es correcta para todos los aspectos; la condición `height > width` nunca debería haberse introducido.
- **No:** añadir un breakpoint CSS específico para croak en `app/globals.css`. El cambio JSX en `game-player.tsx` es más limpio y se mantiene solo al añadir nuevos juegos.
- **No:** cambiar los motores de juego ni la lógica de puntuación.

## Riesgos

| Riesgo                                                                                | Mitigación                                                                                                                                 |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| La restricción limita el canvas en monitores ultraanchos pero bajos (p. ej. 2560×900) | A 900px de altura, `72vh × 1.333 + 48 = 912px > 1052px container` → no aplica en la práctica                                               |
| Regresión en juegos portrait (Tetris, Arkanoid) ya funcionales                        | Para estos juegos `72vh × (W/H) ≥ contenedor` en escritorio: la restricción no aplica. En móvil ya estaba activa con la condición anterior |

## Qué **no** está en esta spec

- Cambios en `useTouchDevice`, `deriveTouchLayout`, `TouchControls` ni en los breakpoints globales de `app/globals.css`.
- Ajustes de hitbox o velocidad del motor de croak para táctil.
- Soporte de gestos swipe, vibración háptica o bloqueo de orientación.
- Cobertura de otros juegos que puedan tener problemas móviles propios.
