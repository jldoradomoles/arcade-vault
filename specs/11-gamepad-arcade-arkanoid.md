# SPEC 11 — Gamepad arcade para Arkanoid

> **Status:** implementado
> **Depends on:** SPEC 08, SPEC 10
> **Date:** 2026-10-27
> **Objective:** Rediseñar los controles táctiles de Arkanoid con la carcasa de gamepad arcade del template `references/templates/home-about/styles.css`, exponiendo el estilo como opción activable por juego.

## Por qué existe esta spec

SPEC 10 añadió un gamepad táctil mínimo (`.tc-wrap` + `.tc-dpad` + `.tc-btn`) con botones cuadrados cian/magenta. El template de `references/templates/home-about/styles.css` (líneas 1151-1617) define una carcasa de gamepad arcade (`.gp`) mucho más expresiva, con D-pad de 4 teclas rodeando un hub central con gema cian y botones A/B circulares. El usuario quiere que Arkanoid luzca ese gamepad en lugar del actual, pero sin perder la infraestructura de SPEC 10 ni romper el resto de juegos.

## Alcance

**Dentro:**

- Nuevo estilo visual `arcade` para el gamepad táctil, activable por juego vía `GAME_REGISTRY`.
- Arkanoid es el primer (y único en esta spec) juego que lo activa.
- El gamepad `arcade` se renderiza con la carcasa `.gp`, el D-pad con hub central y gema, y botones A/B circulares con anillo dashed al pulsar.
- Para Arkanoid solo se dibujan las flechas `←` y `→` del D-pad (hub vacío, sin ▲/▼) y un único botón A circular magenta que dispara `Space` (lanzar bola). El botón B no se dibuja.
- El gamepad `arcade` usa siempre la variante cromática fija `.gp-neon` (cian), independiente de la skin seleccionada por `GameSkinPicker`.
- El breakpoint y la lógica de visibilidad son los mismos que la SPEC 10 (`useTouchDevice` + CSS existente): no se cambia cuándo aparece el gamepad, solo cómo luce cuando aparece en Arkanoid.
- CSS nuevo integrado en `app/globals.css` (`.gp`, `.gp-body`, `.gp-col`, `.gp-dpad`, `.dp`, `.dp-hub`, `.dp-hub-gem`, `.gp-actions`, `.ab`, `.ab-letter`, `.ab-ring`) adaptado al tema del proyecto (variables `--cyan`, `--magenta`, `--pixel`, `--line`).

**Fuera de alcance (para futuras specs):**

- Reestilar los gamepads de Asteroids, Tetris y Snake (quedan con `.tc-*` actual).
- Pills START/SELECT, LEDs superiores, brand, screws, rivets, serial inferior y leyenda de controles del template (no se renderizan).
- Variantes de tema `.gp-vapor` y `.gp-cabinet` (el código las deja fuera; esta spec solo escribe `.gp-neon`).
- Fila `.gp-themer` para elegir variante desde el gamepad.
- Botón B y acciones secundarias en Arkanoid.
- Cambios en el motor de Arkanoid (`lib/arkanoid/engine.ts`) o en los eventos que escucha.

## Modelo de datos

No hay modelo de datos nuevo. No se tocan tablas, migraciones ni `database.types.ts`.

Cambia un contrato de TypeScript:

- `lib/game-registry.ts` → cada entrada acepta un campo opcional `touchStyle?: "default" | "arcade"`. Si falta, equivale a `"default"`.
- Arkanoid pasa a declarar `touchStyle: "arcade"`.
- `lib/touch-controls.ts` → `TouchLayout` gana un campo `style: "default" | "arcade"` derivado de `touchStyle` en `deriveTouchLayout`.

## Plan de implementación

Cada paso deja el proyecto compilando y jugable.

1. **Añadir el campo `touchStyle` al contrato del registry.** Extiende `GameRegistryEntry` en `lib/game-registry.ts` con `touchStyle?: "default" | "arcade"`. No se setea en ningún juego todavía; `deriveTouchLayout` lo propaga como `style: "default"`.
2. **Propagar el estilo a `TouchLayout`.** En `lib/touch-controls.ts`, `deriveTouchLayout` lee `entry.touchStyle ?? "default"` y lo expone en `TouchLayout.style`. El resto de juegos sigue con `style: "default"` sin cambios visuales.
3. **Branch de render en `TouchControls`.** `components/touch-controls.tsx` recibe `layout.style` y, cuando vale `"arcade"`, delega en un sub-renderer nuevo (función interna `ArcadeGamepad` en el mismo archivo). Para `"default"` sigue el render actual intacto.
4. **Markup del gamepad `arcade`.** `ArcadeGamepad` emite:
   - `<div class="gp gp-neon">` como carcasa.
   - `<div class="gp-body"><div class="gp-col gp-col-left">…</div><div class="gp-col gp-col-right">…</div></div>`.
   - Columna izquierda: `<div class="gp-dpad">` con botones `.dp.dp-left` y `.dp.dp-right` (solo si existen en `layout.dpad`), más `<div class="dp-hub"><div class="dp-hub-gem"></div></div>` y, si faltan `up`/`down`, slots vacíos (`<div class="dp dp-up dp-empty">` sin `<button>`) para preservar la cuadrícula sin disparar teclas.
   - Columna derecha: `<div class="gp-actions">` con botones `.ab.a` por cada entrada de `layout.actions`. Si solo hay una acción se centra; si hay dos se renderizan `.ab.a` y `.ab.b`.
   - Cada botón mantiene `data-code` y `data-keyval` y usa los mismos handlers `handleTouchStart`/`handleTouchEnd` que el renderer actual (reutilizar `useTouchButton`).
5. **CSS en `app/globals.css`.** Portar del template `references/templates/home-about/styles.css` solo las reglas elegidas:
   - `.gp`, `.gp::before`, `.gp::after`, `.gp-body`, `.gp-col`, `.gp-col-left`, `.gp-col-right` (sin `.gp-top`, `.gp-brand`, `.gp-leds`, `.gp-mid-frame`, `.gp-pill`, `.gp-screws`, `.gp-bottom`, `.rivet`, `.gp-sn`, `.gp-legend*`).
   - `.gp-dpad`, `.dp`, `.dp.dp-empty` (sin fondo ni sombra, sin cursor), `.dp-up/.dp-down/.dp-left/.dp-right`, `.dp-hub`, `.dp-hub-gem`.
   - `.gp-actions`, `.ab`, `.ab.a`, `.ab.b`, `.ab-letter`, `.ab-ring`, estados `:hover`, `:active` y `.on`.
   - Variante fija `.gp-neon` como alias de los valores base (es la que ya usa el template como neutra); no se portan `.gp-vapor` ni `.gp-cabinet`.
   - Ajustes del `@media (max-width: 620px)` que afectan a `.gp`, `.gp-body`, `.gp-dpad`, `.dp`, `.dp-hub`, `.ab` y `.gp-actions`.
   - Sustituir referencias de color por las variables ya existentes del proyecto (`--cyan`, `--magenta`, `--line`, `--pixel`).
6. **Activar en Arkanoid.** En `lib/game-registry.ts` setear `touchStyle: "arcade"` en la entrada `arkanoid`. El layout de Arkanoid ya expone en SPEC 10 un `dpad` con `left`/`right` y un `actions` con una entrada para `Space`; `ArcadeGamepad` lo pintará con el nuevo estilo sin otras ediciones.
7. **Verificación manual.** Abrir `/juegos/arkanoid/jugar` en viewport móvil (`≤620 px`) y en desktop con el DevTools emulando móvil. Comprobar: carcasa visible, hub con gema pulsante, solo flechas `←/→` activas, botón A circular magenta pulsa `Space`, el resto de juegos siguen con los controles clásicos.

## Criterios de aceptación

- [x] `GAME_REGISTRY["arkanoid"].touchStyle === "arcade"`; ninguna otra entrada declara `touchStyle`.
- [x] En viewport móvil, Arkanoid muestra `<div class="av-gp av-gp-neon">` con `.av-gp-body` que contiene `.av-gp-dpad` y `.av-gp-actions`. (Las clases llevan el prefijo `av-` para evitar colisiones CSS, tal como señalaba la sección de riesgos.)
- [x] El D-pad renderiza botones solo para `.av-dp-left` y `.av-dp-right`; `.av-dp-up` y `.av-dp-down` existen en el DOM solo como `<div av-dp-empty aria-hidden>` decorativo y nunca disparan `KeyboardEvent`.
- [x] El hub central `.av-dp-hub` incluye `.av-dp-hub-gem` con la animación `pulse-led`.
- [x] Hay un único botón `.av-ab.av-ab-a` (magenta) etiquetado como la acción de lanzar bola; pulsarlo dispara `KeyboardEvent` con `code === "Space"`.
- [x] En desktop con viewport `>620 px` (o cuando `useTouchDevice` devuelve `false`), el gamepad `arcade` no se muestra, igual que SPEC 10 oculta hoy `.tc-wrap`.
- [x] Asteroids, Tetris y Snake renderizan en móvil el gamepad clásico (`.tc-wrap`) sin cambios visuales ni funcionales.
- [x] La skin elegida por `GameSkinPicker` no altera los colores del gamepad `arcade` (sigue cian cualquiera que sea `classic`/`neon`/`retro`).
- [x] El motor `lib/arkanoid/engine.ts` no se modifica y responde a los eventos como hasta ahora.

## Decisiones tomadas y descartadas

- **Infra compartida con flag por juego, no componente separado.** `TouchControls` sigue siendo el único punto de entrada y expone el estilo `arcade` como variante; se evita mantener dos componentes casi iguales.
- **Variante cromática fija `.gp-neon`.** Se descarta mapear la skin del juego (`classic`/`neon`/`retro`) a `.gp-neon`/`.gp-vapor`/`.gp-cabinet` y también se descarta ofrecer un selector `.gp-themer` propio del gamepad. Prima la simplicidad y evitar dos selectores conviviendo con `GameSkinPicker`.
- **Solo flechas horizontales activas en Arkanoid.** El D-pad no dibuja `▲` ni `▼` como botones. Se eligió sobre la alternativa de pintarlos deshabilitados porque Arkanoid no tiene semántica vertical y botones apagados confunden.
- **Descartados pills START/SELECT, LEDs, brand, rivets, leyenda, serial.** El template los trae pero no aportan funcionalidad y ocupan vertical valioso en móvil.
- **Reutilizar el breakpoint de SPEC 10.** No se añade un media query propio al estilo `max-width: 760px` del template; se reusa la detección y los breakpoints ya existentes para no fragmentar la visibilidad del gamepad.
- **Sin persistencia.** El estilo del gamepad vive 100% en código; no se guarda nada en `localStorage` ni Supabase.

## Riesgos identificados

- **Divergencia visual entre juegos.** Con esta spec solo Arkanoid lleva gamepad arcade; el resto sigue con `.tc-*`. Es intencional, pero puede resultar incoherente hasta que otras specs porten también Asteroids/Tetris/Snake.
- **Colisiones de clases CSS.** Las clases `.gp`, `.dp`, `.ab` son cortas y podrían chocar con utilidades existentes. Antes de portarlas conviene buscarlas en `app/globals.css` y en componentes para confirmar que están libres.
- **Área táctil del hub.** `.dp-hub` ocupa el centro del D-pad; hay que asegurarse de que no capture pulsaciones ni consuma eventos destinados a los botones (`pointer-events: none` si fuera necesario).
