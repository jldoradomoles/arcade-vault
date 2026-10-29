---
name: arcade-gamepad
description: Activa el gamepad arcade visual (carcasa .av-gp, D-pad con hub y gema, botones A/B circulares) para un juego concreto del GAME_REGISTRY, añadiendo touchStyle:"arcade" a su entrada. El componente ArcadeGamepad ya existe desde SPEC 11; esta skill solo configura el juego destino.
argument-hint: <game-id>
allowed-tools: Read, Glob, Grep, Edit, Bash(git status:*), Bash(git diff:*)
---

# /arcade-gamepad — Activa el gamepad arcade para un juego

Activa el estilo visual `arcade` del gamepad táctil para el juego indicado.
La infraestructura ya está implementada (SPEC 11): `ArcadeGamepad` en
`components/touch-controls.tsx`, clases `.av-gp*` en `app/globals.css`.
Esta skill solo añade `touchStyle: "arcade"` a la entrada del juego en
`lib/game-registry.ts` y verifica que los controles del juego son compatibles.

Responde siempre en español.

## Contexto de sesión

Estado del repo:
!`git status --short`

Entradas actuales en el registry:
!`grep -n "touchStyle\|^  [a-z]" lib/game-registry.ts`

---

## Fase 1 — Identificar el juego

El argumento recibido es: `$ARGUMENTS`

1. Si `$ARGUMENTS` está vacío, muestra las entradas del registry y pide el
   `game-id`. Espera la respuesta.
2. Busca la clave `$ARGUMENTS` en `lib/game-registry.ts`:
   - Si no existe: lista las claves disponibles y detente con el error:
     `❌ No existe «$ARGUMENTS» en GAME_REGISTRY. Claves disponibles: <lista>.`
3. Lee el bloque completo de la entrada (campo `controls` incluido).
4. Si la entrada ya tiene `touchStyle: "arcade"`: detente con:
   `ℹ️ «$ARGUMENTS» ya tiene touchStyle:"arcade". No hay nada que hacer.`

---

## Fase 2 — Analizar compatibilidad de controles

Con los `controls` del juego, simula mentalmente lo que haría
`deriveTouchLayout` (`lib/touch-controls.ts`):

- **D-pad:** cada grupo de `keys` formado solo por `←`, `→`, `↑` y/o `↓`
  mapea a botones del D-pad (`left`, `right`, `up`, `down`).
- **Botones de acción:** grupos con al menos una tecla que no sea una flecha
  (p. ej. `Espacio`, `X`, `B`) mapean al botón A (primero) y al botón B
  (segundo). Solo se muestran hasta 2 acciones.
- **Teclas de ratón / drag:** no generan botones en el gamepad arcade
  (el gamepad arcade no admite `canvasDrag`).

Clasifica el resultado en uno de estos tres estados:

| Estado          | Descripción                                                                                                             |
| --------------- | ----------------------------------------------------------------------------------------------------------------------- |
| ✅ Compatible   | Hay al menos 1 botón de D-pad o 1 botón de acción.                                                                      |
| ⚠️ Parcial      | Solo D-pad sin acciones, o solo acciones sin D-pad. El gamepad arcade sigue funcionando pero puede resultar asimétrico. |
| ❌ Incompatible | El único input es `Ratón` / drag y no hay flechas ni teclas extra. El gamepad arcade quedaría vacío.                    |

Si el estado es **❌ Incompatible**, detente y explica al usuario por qué el
gamepad arcade no tiene sentido para ese juego.

Si el estado es **⚠️ Parcial**, informa brevemente y pregunta al usuario si
quiere continuar de todas formas. Espera la respuesta antes de avanzar.

---

## Fase 3 — Mostrar preview del layout

Antes de editar, muestra un resumen visual del gamepad resultante para que el
usuario lo confirme:

```
Gamepad arcade para «<game-id>»:

  D-pad activo:
    ← ArrowLeft   ✅ / ❌ ausente
    → ArrowRight  ✅ / ❌ ausente
    ↑ ArrowUp     ✅ / ❌ ausente
    ↓ ArrowDown   ✅ / ❌ ausente
    (Hub central con gema siempre visible)

  Botones de acción:
    A (<acción>) — code: <code>   ← primer grupo no-flecha
    B (<acción>) — code: <code>   ← segundo grupo no-flecha (si existe)
    (o: sin botones de acción)

¿Aplicar este layout? (si / no)
```

Si el usuario dice no, detente sin hacer cambios.

---

## Fase 4 — Aplicar el cambio

Añade `touchStyle: "arcade"` a la entrada del juego en `lib/game-registry.ts`.

Colócalo como el último campo del objeto, antes del cierre `}`, siguiendo el
mismo estilo que la entrada `arkanoid` (que ya lo tiene como referencia):

```ts
// ejemplo de resultado (no copies literalmente, adapta a la indentación real)
  <game-id>: {
    width: ...,
    height: ...,
    createEngine: ...,
    controls: [...],
    touchStyle: "arcade",
  },
```

Usa la herramienta `Edit` para hacer el cambio mínimo. No toques ninguna otra
entrada del registry ni ningún otro archivo.

---

## Fase 5 — Verificación

1. Muestra el diff del archivo con `git diff lib/game-registry.ts`.
2. Confirma que solo aparece la línea `touchStyle: "arcade"` añadida en la
   entrada correcta y que ninguna otra entrada fue modificada.
3. Lee de nuevo el bloque de la entrada en el archivo para confirmar que la
   sintaxis es válida (cierre `}` correcto, coma al final de la línea).
4. Informa al resultado:

```
✅ touchStyle:"arcade" activado para «<game-id>».

Verifica en el navegador (viewport ≤ 620 px o DevTools modo móvil):
  • Abre /juegos/<game-id>/jugar
  • Comprueba que aparece la carcasa av-gp con el hub central y la gema
  • Comprueba que los botones del D-pad activos responden (←/→/↑/↓ según el juego)
  • Comprueba que el/los botón/es de acción circular/es disparan la tecla correcta
  • Comprueba que el resto de juegos siguen mostrando el gamepad clásico (.tc-wrap)
```

---

## Reglas duras

- No edites ningún archivo distinto de `lib/game-registry.ts`.
- No añadas ni cambies ninguna entrada del registry excepto la del juego destino.
- No modifiques `components/touch-controls.tsx` ni `app/globals.css`; la
  infraestructura del gamepad arcade está completa y no necesita cambios.
- No hagas commit; deja eso al usuario.
- Si el juego no existe en el registry, detente con el mensaje de error de la
  Fase 1 sin intentar crearlo.
- Si el argumento lleva espacios o mayúsculas, normaliza a minúsculas y sin
  espacios antes de buscarlo.
