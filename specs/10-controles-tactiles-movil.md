# SPEC 10 — Controles táctiles y layout móvil

> **Status:** implementado
> **Depends on:** SPEC 05, SPEC 07
> **Date:** 2026-10-27
> **Objective:** Añadir controles táctiles virtuales y corregir el layout móvil para que los 4 juegos (Asteroids, Tetris, Arkanoid, Snake) sean jugables en dispositivos con pantalla táctil.

## Por qué existe esta spec

La plataforma funciona en móvil (el canvas se escala a 375 px sin scroll) pero no se puede jugar: todos los motores escuchan teclado y ratón, no hay entrada táctil. Además el header, el canvas y el HUD no aprovechan el viewport en móvil. Esta spec añade botones virtuales bajo el canvas, traduce toques a los mismos eventos que los motores ya escuchan y corrige el layout responsive.

## Alcance

**Dentro:**

- Componente `TouchControls` (`components/touch-controls.tsx`) con botones virtuales bajo el canvas, visible solo en dispositivos táctiles.
- Derivación automática de los botones desde el array `controls` de cada entrada en `GAME_REGISTRY`.
- Traducción de toques en botones a eventos de teclado (`KeyboardEvent`) en `window`, que los motores ya escuchan.
- Traducción de arrastre táctil en el canvas a eventos de ratón (`MouseEvent`) para Arkanoid, que ya escucha `mousemove`/`mousedown`.
- Hook `useTouchDevice` (`lib/use-touch-device.ts`) para detectar dispositivos táctiles.
- Función `deriveTouchLayout` (`lib/touch-controls.ts`) con las reglas de derivación y los tipos exportados.
- Ocultar la línea de controles de teclado (`<kbd>`) en dispositivos táctiles.
- Correcciones de layout responsive: header, HUD, canvas y contenedores deben llenar el viewport en móvil.
- `touch-action: manipulation` y `user-select: none` en la zona de juego para evitar zoom y selección.
- Funciona en ambas orientaciones (portrait y landscape) sin avisos ni bloqueos.

**Fuera de alcance (para futuras specs):**

- Gestos de deslizar (swipe) como entrada.
- Soporte de gamepad/mando.
- Aviso o bloqueo de orientación.
- Vibración háptica.
- Cambios en los motores de juego existentes (los motores no se modifican).
- Tests automatizados.

## Modelo de datos

No hay modelo de datos nuevo. No se tocan tablas ni migraciones.

## Convenciones

**Detección de dispositivo táctil:**

`matchMedia('(pointer: coarse)').matches` como señal primaria; `'ontouchstart' in window` como fallback. La detección se evalúa una vez al montar el componente. En un portátil con trackpad como input primario, `pointer: coarse` es `false` y los botones no aparecen (el usuario tiene teclado).

**Derivación automática de botones desde `controls`:**

Reglas aplicadas en orden por la función `deriveTouchLayout`:

1. Si alguna entrada tiene `Ratón` en `keys` → activar arrastre táctil en el canvas (proxy touch→mouse); suprimir esa entrada y todas las entradas cuyas `keys` sean solo flechas (la dirección va por arrastre, no por d-pad).
2. Las entradas cuyas `keys` son TODAS flechas (←, →, ↑, ↓) → botones de d-pad.
3. Las entradas que mezclan flechas con teclas no-flecha (como `["↑", "X"]` en Tetris para «Rotar») → botón de acción; se despacha la primera tecla de la lista.
4. Las entradas con solo teclas no-flecha y no-`Ratón` (Espacio, B) → botón de acción con la etiqueta del campo `action`.
5. Se ignoran entradas duplicadas: si dos entradas tienen el mismo `action` (como `A`/`W`/`D`/`S` y las flechas en Snake), la segunda se descarta.

**Resultado por juego con las entradas actuales del registro:**

| Juego     | D-pad   | Acciones                      | Canvas drag |
| --------- | ------- | ----------------------------- | ----------- |
| Asteroids | ← → ↑   | Disparar (Espacio), Bomba (B) | No          |
| Tetris    | ← → ↓   | Rotar (↑), Caída (Espacio)    | No          |
| Arkanoid  | —       | Lanzar (Espacio)              | Sí          |
| Snake     | ← ↑ → ↓ | —                             | No          |

**Despacho de eventos:**

- **Botón d-pad o acción:** `touchstart` → `new KeyboardEvent('keydown', { key, code, bubbles: true })` en `window`; `touchend` / `touchcancel` → `keyup` equivalente. No se despacha `keydown` repetido mientras el dedo siga pulsado; un solo `keydown` al tocar y un solo `keyup` al soltar.
- **Canvas drag (Arkanoid):** `touchmove` → `new MouseEvent('mousemove', { clientX, clientY, bubbles: true })` en el `<canvas>`. No se despacha `mousedown` desde el canvas: el lanzamiento de la bola va solo por el botón Lanzar que despacha Espacio.
- `preventDefault()` en todos los `touchstart` y `touchmove` del área de juego para evitar scroll.

**Layout de los botones:**

- Debajo del CRT, nunca encima del canvas.
- D-pad a la izquierda, botones de acción a la derecha.
- Tamaño mínimo de cada botón: 48×48 CSS px (requisito de accesibilidad táctil, WCAG 2.5.5).
- Estilo semitransparente, coherente con la paleta de la plataforma (`--foreground`, `--background`).
- Usar `/frontend-design` para el diseño visual definitivo.

**Correcciones responsive (móvil):**

- Auditar y corregir `game-player.tsx`, `nav.tsx`, `footer.tsx` y `globals.css` para que el header, el HUD, el canvas y los contenedores llenen el viewport en móvil.
- El HUD debe reorganizarse para anchos < 640 px (posible apilado vertical o reducción de tamaño de fuente).
- `touch-action: manipulation` en `.av-player` y `user-select: none` en la zona de canvas + controles.
- Los controles de teclado (`<ul>` con `<kbd>`) se ocultan en dispositivos táctiles.

**Prop nueva en `GameCanvas`:**

- `enableTouchDrag?: boolean` — cuando es `true`, el componente añade listeners de `touchmove`/`touchstart`/`touchend` al canvas que despachan `MouseEvent` sintéticos con las coordenadas del toque y llaman a `preventDefault`. Los listeners se limpian en el cleanup del `useEffect`.

## Plan de implementación

Antes del paso 1, leer la guía de Client Components en `node_modules/next/dist/docs/01-app`. Usar `/frontend-design` para el diseño visual de los botones táctiles y el layout responsive.

1. **Utilidad de detección táctil.** Crear `lib/use-touch-device.ts` con un hook `useTouchDevice(): boolean` que evalúa `(pointer: coarse)` con fallback a `ontouchstart`. Verificación: `npx tsc --noEmit`.

2. **Derivación de controles táctiles.** Crear `lib/touch-controls.ts` con la función `deriveTouchLayout(controls): TouchLayout` que aplica las 5 reglas de derivación. Exporta los tipos `TouchLayout`, `DpadButton`, `ActionButton`. Verificación: `npx tsc --noEmit`.

3. **Componente `TouchControls`.** Crear `components/touch-controls.tsx` (`"use client"`). Recibe `layout: TouchLayout` y `disabled: boolean` (pausa/game over). Renderiza d-pad a la izquierda y botones de acción a la derecha. Cada botón despacha `keydown`/`keyup` en `window` en `touchstart`/`touchend`. Los botones no reaccionan cuando `disabled` es `true`. Verificación: `npx tsc --noEmit` y `npm run lint`.

4. **Proxy touch→mouse en el canvas.** Modificar `components/game-canvas.tsx`: nueva prop `enableTouchDrag?: boolean`. Cuando es `true`, añade listeners de `touchmove`/`touchstart`/`touchend` en el canvas que despachan `MouseEvent` sintéticos con `clientX`/`clientY` del toque y llaman a `preventDefault`. Los listeners se limpian en el cleanup del `useEffect`. Verificación: `npx tsc --noEmit`.

5. **Integrar en `game-player.tsx`.** Renderizar `<TouchControls>` debajo del CRT solo si `useTouchDevice()` es `true`. Pasar `enableTouchDrag` al `GameCanvas` cuando las `controls` del juego incluyen una entrada con `Ratón`. Ocultar la línea de controles de teclado (`<ul>` de `<kbd>`) en dispositivos táctiles. Pasar `disabled={paused || over}` a `TouchControls`. Verificación: se ven los botones táctiles en Chrome DevTools con emulación táctil y funcionan los 4 juegos.

6. **Correcciones responsive.** Auditar el layout en viewports de 375 px (portrait) y 667×375 px (landscape). Corregir header, HUD, canvas y contenedores para que llenen el viewport. Añadir `touch-action: manipulation` y `user-select: none`. Verificación: `npm run lint` y revisión visual en emulación móvil.

7. **Verificación final.** Comprobar los 4 juegos en emulación táctil: d-pad, acciones, canvas drag (Arkanoid), pausa, fin, guardado. Verificar que en escritorio no aparecen los botones y todo sigue como antes. Verificación: `npm run build`.

Cada paso deja la app funcionando.

## Criterios de aceptación

Base:

- [ ] `npm run build`, `npm run lint` y `npx tsc --noEmit` terminan sin errores.
- [ ] Los 4 juegos (Asteroids, Tetris, Arkanoid, Snake) siguen jugables con teclado y ratón como antes.
- [ ] En un viewport con `pointer: coarse` (emulación táctil de DevTools o dispositivo real) aparecen botones virtuales debajo del canvas.
- [ ] En escritorio con ratón y teclado no aparecen botones virtuales.
- [ ] Los botones tienen al menos 48×48 CSS px de área táctil.
- [ ] `touch-action: manipulation` está activo en la zona de juego: no hay zoom por doble tap ni scroll durante el juego.
- [ ] La línea de controles de teclado (`<kbd>`) no se muestra en dispositivos táctiles.
- [ ] El header, el HUD, el canvas y los contenedores llenan el viewport en un móvil de 375 px (portrait) y 667×375 px (landscape).
- [ ] El juego funciona en ambas orientaciones sin avisos ni bloqueos.
- [ ] No hay scroll horizontal en ningún viewport ≥ 320 px.
- [ ] PAUSA y FIN siguen funcionando desde los botones del HUD.
- [ ] El modal de fin de juego es usable en móvil (los botones se alcanzan sin scroll).
- [ ] En desarrollo (Strict Mode) no hay listeners de touch duplicados ni fugas.
- [ ] Los botones táctiles no reaccionan mientras el juego está pausado o terminado.

Específicos por juego:

- [ ] **Asteroids:** d-pad ← → (girar) + ↑ (propulsar), botones Disparar y Bomba. La nave gira, avanza, dispara y lanza bomba con los botones táctiles.
- [ ] **Tetris:** d-pad ← → (mover) + ↓ (bajar), botones Rotar y Caída. Las piezas se mueven, rotan, bajan y caen con los botones táctiles.
- [ ] **Arkanoid:** arrastre del dedo en el canvas mueve la paleta, botón Lanzar lanza la bola. La paleta sigue el dedo sin saltos y la bola se lanza al pulsar el botón.
- [ ] **Snake:** d-pad ← ↑ → ↓. La serpiente gira en la dirección pulsada.
- [ ] Mantener pulsado un botón de d-pad mantiene la acción continua (girar en Asteroids, mover en Tetris) sin repetir `keydown`.
- [ ] Soltar el botón detiene la acción (`keyup`).
- [ ] En Arkanoid, tocar el canvas no lanza la bola; solo el botón Lanzar lo hace.

## Decisiones

- **Sí:** los 4 juegos en una sola spec. Decisión del usuario; la infraestructura es compartida y los motores no cambian.
- **Sí:** botones virtuales debajo del canvas, no encima. Decisión del usuario; el canvas permanece libre y los botones siempre son visibles.
- **Sí:** funciona en ambas orientaciones sin forzar ni avisar. Decisión del usuario; no bloquea al usuario.
- **Sí:** arquitectura en la plataforma (despacho de eventos sintéticos), no en los motores. Decisión del usuario; evita duplicar código en cada engine y los motores no se tocan.
- **Sí:** derivación automática desde `controls` del registro. Decisión del usuario; no requiere configuración extra por juego ni cambios en `GameEntry`.
- **Sí:** Arkanoid con arrastre en canvas + botón Lanzar. Decisión del usuario; el motor ya escucha `mousemove` y el proxy touch→mouse lo resuelve sin cambiar el engine. El botón Lanzar despacha Espacio.
- **No:** gestos de deslizar (swipe). No se pidieron; la precisión es menor que los botones para juegos arcade.
- **No:** forzar orientación landscape. Decisión del usuario; funciona en ambas orientaciones.
- **No:** vibración háptica. No se pidió y el soporte varía entre navegadores.
- **Sí:** ocultar controles de teclado en táctil. Los botones virtuales son autoexplicativos y la línea de `<kbd>` ocupa espacio vertical que en móvil es escaso.
- **Sí:** detección con `(pointer: coarse)`. Es la media query recomendada por MDN para pantallas táctiles; `ontouchstart` como fallback para navegadores antiguos.
- **Sí:** correcciones de layout móvil en la misma spec. Decisión del usuario; ambas cosas son necesarias para que el juego sea usable en móvil.
- **No:** cambios en los motores de juego. Los eventos sintéticos son indistinguibles de los reales para los handlers existentes.

## Riesgos

| Riesgo                                                                                           | Mitigación                                                                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `KeyboardEvent` sintético no dispara el handler de un motor                                      | Los motores escuchan `keydown`/`keyup` en `window` con `event.key`; los eventos sintéticos con `key` y `bubbles: true` los activan. Si algún motor comprueba `isTrusted`, se refactoriza ese check como excepción documentada |
| `MouseEvent` sintético no coincide con las coordenadas del canvas                                | Se leen `clientX`/`clientY` del `Touch` y se pasan directamente; el motor calcula la posición con `getBoundingClientRect`, que funciona igual con eventos sintéticos                                                          |
| El proxy touch→mouse dispara `mousedown` al arrastrar y lanza la bola prematuramente en Arkanoid | El proxy NO despacha `mousedown` desde el canvas; el lanzamiento va solo por el botón Lanzar (Espacio)                                                                                                                        |
| Scroll de la página al tocar los botones o el canvas                                             | `preventDefault` en `touchstart` y `touchmove` dentro de la zona de juego; `touch-action: manipulation` en CSS                                                                                                                |
| Doble tap hace zoom en iOS Safari                                                                | `touch-action: manipulation` lo desactiva; si persiste, añadir `maximum-scale=1` al viewport meta como último recurso                                                                                                         |
| Un portátil con pantalla táctil muestra los botones y oculta la línea de teclado                 | `(pointer: coarse)` distingue el input primario; en un portátil el primario suele ser el trackpad (`fine`) y los botones no aparecen                                                                                          |
| Los botones táctiles compiten por espacio vertical con el canvas en portrait                     | El canvas se encoge proporcionalmente; los botones y el HUD tienen prioridad para ser alcanzables. `/frontend-design` ajustará los tamaños                                                                                    |
| Strict Mode duplica listeners de touch                                                           | Los listeners se añaden en `useEffect` y se limpian en su cleanup; hay criterio de aceptación                                                                                                                                 |
| `300ms` de delay en tap en navegadores móviles antiguos                                          | `touch-action: manipulation` elimina el delay de 300 ms en todos los navegadores modernos                                                                                                                                     |

## Qué **no** está en esta spec

- Gestos de deslizar (swipe) como entrada.
- Soporte de gamepad/mando.
- Aviso o bloqueo de orientación.
- Vibración háptica.
- Tests automatizados.

Cada uno, si llega, va en su propia spec.
