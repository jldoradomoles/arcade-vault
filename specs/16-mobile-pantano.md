# SPEC 16 — Ajustes móviles de Pantano

> **Status:** implementado
> **Depends on:** SPEC 10, specs/game-jam/pantano/spec-v2.md
> **Date:** 2026-11-03
> **Objective:** Corregir los problemas móviles detectados en pantano tras la auditoría de los cuatro viewports (375×812, 667×375, 768×1024, ≥1024): concretamente, hacer accesible la acción "Cambiar tipo de pieza" desde el gamepad táctil arcade.

## Por qué existe esta spec

Pantano tiene cuatro controles en la fase de colocación: mover cursor (D-pad ←↑→↓), colocar pieza (Espacio → botón A), rotar (R → botón B) y descartar/ciclar tipo (D). El `ArcadeGamepad` muestra como máximo dos botones de acción; la cuarta entrada (`D`) queda fuera de la derivación táctil.

En la práctica, el motor auto-cicla al tipo siguiente cuando el inventario del tipo actual se agota (`nextAvailableKind`), por lo que el juego es jugable en táctil. Sin embargo, el jugador pierde la capacidad de cambiar de tipo de pieza proactivamente: no puede pasar de lilypad a log mientras aún tiene lilypads disponibles, lo que elimina buena parte de la planificación estratégica del puzzle.

La solución es hacer el botón B contextual: si el tipo seleccionado es `log`, el botón rota (comportamiento actual); si es `lilypad` o `turtle` (que no tienen orientación), el botón cicla al siguiente tipo disponible, replicando el comportamiento de la tecla D.

El layout en landscape (667×375) presenta el mismo overflow conocido de otros juegos (gamepad accesible con scroll) — ya cubierto por el fix `72vh` de SPEC 14 — y no requiere cambios.

## Alcance

**Dentro:**

- `lib/pantano/engine.ts`: modificar el handler de `KeyR` en la fase de colocación para que, cuando `selectedKind !== "log"`, ejecute el mismo bloque lógico que `KeyD` (ciclar al siguiente tipo con inventario disponible).
- `lib/game-registry.ts`: unificar las entradas de R y D en la línea de controles para que el HUD muestre `["R", "D"]` — `Rotar / Cambiar tipo` — dejando claro el comportamiento dual del botón B.

**Fuera de alcance:**

- Infraestructura táctil compartida (ya cubierta por SPEC 10).
- Cambios en `components/touch-controls.tsx` o `app/globals.css`.
- Overflow en landscape 667×375 (comportamiento compartido con todos los juegos, ya cubierto por SPEC 14).
- Reglas del juego, puntuación o balance.
- Otros juegos del registry.
- Tests automatizados.

## Convenciones reutilizadas de SPEC 10

- Detección táctil con `useTouchDevice` (`(pointer: coarse)`).
- Despacho de eventos sintéticos (`KeyboardEvent`) desde `ArcadeGamepad` → el botón B despacha `KeyR`, que el motor ya escucha.
- Breakpoints vigentes en `app/globals.css`.
- `touch-action: manipulation` y `user-select: none` en la zona de juego.

## Contrato visual del gamepad virtual

Los controles táctiles reproducen la apariencia del gamepad neón de `references/gamepad-assets/gamepad.html`:

- Paleta: fondo `#0a0a0f`, tinta `#e6e9ff`, cian `#00f5ff` para D-pad y botón B, magenta `#ff006e` para botón A, borde `rgba(0, 245, 255, 0.18)`.
- Fuentes: `Press Start 2P` para las letras A/B, `JetBrains Mono` para el resto.
- Chasis `.av-gp`: `linear-gradient(180deg, #1c1c28 0%, #0c0c14 100%)`, `border-radius: 22px`, doble borde interno y textura de puntos radiales.
- D-pad: `156×156` con botones `50×50` en cruz, hub central con gema cian pulsante.
- Botones A/B: círculos `74×74`, `box-shadow` que colapsa al pulsar.
- Breakpoint en `max-width: 620px`: D-pad `144×144`, botones A/B `64×64`.

## Plan de implementación

### Paso 1 — Comportamiento contextual del botón B en el motor

**Archivo:** `lib/pantano/engine.ts`

En el handler `onKeyDown`, localiza el bloque `case "KeyR"` dentro de la guarda `if (this.phase !== "placing") return`:

```ts
case "KeyR":
  // lógica actual: toggle orientación del cursor
```

Modifica para que, si `selectedKind !== "log"`, en lugar de rotar ejecute el mismo bloque que `case "KeyD"` (ciclar al siguiente tipo con inventario disponible). Si `selectedKind === "log"`, el comportamiento actual (toggle orientación) se mantiene.

Pseudocódigo:

```ts
case "KeyR":
  if (this.selectedKind !== "log") {
    // mismo bloque que KeyD: ciclar tipo
    this.selectedKind = this.nextAvailableKind(this.selectedKind);
    this.selectedOrientation = "horizontal";
  } else {
    // rotar log (comportamiento original)
    this.selectedOrientation = this.selectedOrientation === "horizontal" ? "vertical" : "horizontal";
  }
  break;
```

Verificación: `npx tsc --noEmit`, `npm run lint`.

### Paso 2 — Actualizar la línea de controles en el registry

**Archivo:** `lib/game-registry.ts`

Fusionar las entradas de R y D en una sola con label `Rotar / Cambiar tipo`:

```ts
controls: [
  { keys: ["←", "↑", "→", "↓"], action: "Mover cursor" },
  { keys: ["Espacio"], action: "Colocar pieza" },
  { keys: ["R", "D"], action: "Rotar / Cambiar tipo" },
],
```

`deriveTouchLayout` mapea la primera tecla no-flecha del grupo → `KeyR` → botón B ✅. En escritorio, R y D siguen siendo teclas independientes con el mismo comportamiento.

Verificación: `npx tsc --noEmit`, `npm run lint`.

### Paso 3 — Verificación visual en emulación móvil

En Chrome DevTools con emulación 375×812 (portrait):

1. Abrir `/juegos/pantano/jugar` con táctil activado.
2. En la fase de colocación con `selectedKind = "lilypad"`:
   - Pulsar botón B → debe ciclar a `log` (si hay logs) o a `turtle` (si no quedan logs).
3. Con `selectedKind = "log"`:
   - Pulsar botón B → debe cambiar la orientación del cursor (H→V→H).
4. Con `selectedKind = "turtle"`:
   - Pulsar botón B → debe ciclar al siguiente tipo disponible.
5. Confirmar que botón A (Espacio) sigue colocando piezas correctamente.
6. Confirmar que teclado físico sigue funcionando: R rota/cicla, D cicla, Espacio coloca.

## Criterios de aceptación

Por viewport:

- [ ] **375×812:** En la fase de colocación, el botón B (R) cicla el tipo de pieza cuando el tipo actual es `lilypad` o `turtle`. Cuando el tipo actual es `log`, el botón B rota (H↔V). El botón A (Espacio) coloca la pieza seleccionada.
- [ ] **375×812:** El juego completa una oleada completa en táctil sin recurrir al teclado.
- [ ] **667×375:** El gamepad es accesible con scroll (no bloqueado). Nada nuevo respecto al comportamiento existente de otros juegos.
- [ ] **768×1024:** Nada regresa respecto al estado previo.
- [ ] **≥1024:** En escritorio, R y D siguen funcionando como teclas independientes; R rota o cicla según el tipo, D siempre cicla.

Por tipo de problema:

- [ ] Controles derivados: `KeyR` (botón B) es suficiente para cambiar de tipo de pieza en táctil sin necesitar `KeyD`.
- [ ] La línea de controles del registry muestra `["R", "D"]` en la ayuda de teclado y `Rotar / Cambiar tipo` como etiqueta.

## Decisiones

- **Sí:** Botón B contextual (rota para logs, cicla para el resto). Evita cambios en la infraestructura táctil compartida y es coherente con la lógica de que solo los logs tienen orientación.
- **No:** Añadir un tercer botón de acción al ArcadeGamepad. Requeriría cambios en `components/touch-controls.tsx` y `app/globals.css` que afectan a todos los juegos; fuera del alcance de una spec de ajuste de un juego concreto.
- **No:** Reordenar para que D sea el botón B y R sea keyboard-only. Privar de la rotación en táctil es peor que privar del cambio proactivo de tipo (la rotación es necesaria para colocar logs en vertical).
- **No:** Fix del overflow en landscape 667×375. Es el mismo comportamiento que croak/orbital; el gamepad es alcanzable con scroll y no hay bloqueo.

## Riesgos

| Riesgo                                                                                                        | Mitigación                                                                                                |
| ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| El cambio del handler de R en el motor rompe el comportamiento en escritorio para usuarios que usan R en logs | El comportamiento para logs no cambia: R sigue rotando cuando `selectedKind === "log"`                    |
| `nextAvailableKind` cicla a un tipo con inventario 0                                                          | La función ya implementada filtra por inventario > 0 (lógica existente de tecla D) — sin cambio necesario |
| El nuevo comportamiento de R confunde a usuarios de teclado que pulsaban R para rotar lilypads                | La rotación en lilypad/turtle era ya un no-op silencioso; el nuevo comportamiento (ciclar) es más útil    |

## Qué **no** está en esta spec

- Cambios en la infraestructura táctil de SPEC 10 (`TouchControls`, `deriveTouchLayout`, `GameCanvas`).
- Fix del landscape overflow (comportamiento conocido compartido con todos los juegos).
- Skins ni GameSkinPicker.
- Supabase, migraciones ni rutas de Next.js.
- Otros juegos del registry.
