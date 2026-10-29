---
name: spec-impl-game
description: Implementa una spec de juego (igual que /spec-impl) y, al terminar, lanza secuencialmente los agentes skin-designer (skins), la skill arcade-gamepad (gamepad visual) y mobile-porter + implementación directa de controles móviles.
disable-model-invocation: true
argument-hint: <NN-spec-name>
allowed-tools: Read, Glob, Grep, Edit, Write, AskUserQuestion, Agent, Skill, Bash(git status:*), Bash(git branch:*), Bash(git checkout:*), Bash(git log:*), Bash(git diff:*), Bash(git stash:*), Bash(cat:*), Bash(ls:*)
---

# /spec-impl-game — Pipeline completo para un juego nuevo

Este skill extiende `/spec-impl`: ejecuta exactamente las mismas fases de implementación y, cuando el usuario confirma que la implementación está terminada, lanza en secuencia `skin-designer`, la skill `arcade-gamepad` y `mobile-porter` (este último seguido de implementación directa), sin salir del flujo.

Responde siempre en español.

## Contexto de sesión

Estado actual del repositorio:
!`git status --short`

Rama activa:
!`git branch --show-current`

Specs disponibles:
!`ls specs/ 2>/dev/null || echo "No existe la carpeta specs/"`

Config de creación de rama:
!`cat specs/.spec-config.yml 2>/dev/null || echo "AutoCreateBranch: true (por defecto, sin archivo de config)"`

---

## Instrucciones

Sigue estas fases en orden estricto. **No avances a la siguiente fase si la anterior no completó correctamente.**

---

### Fase 1 — Leer /spec-impl y preparar el contexto

1. Lee el archivo `~/.claude/skills/spec-impl/SKILL.md`. Si no existe en esa ruta, prueba `~/.agents/skills/spec-impl/SKILL.md`. Si no está en ninguna, detente y avisa al usuario: no puedes continuar sin esa referencia.
2. Carga en memoria sus instrucciones completas. Las Fases 2–5 de este skill las ejecutas siguiendo esas instrucciones al pie de la letra.

El argumento recibido es: `$ARGUMENTS`

---

### Fases 2–5 — Implementación con /spec-impl

Sigue exactamente las instrucciones del `SKILL.md` de `/spec-impl` que leíste en la Fase 1:

- **Fase 2** de spec-impl → Identificar la spec (buscar el archivo en `specs/` por nombre completo, número o slug).
- **Fase 3** de spec-impl → Validar que el estado significa "Aprobado". Si no lo es, detente con el mensaje de error estándar de spec-impl.
- **Fase 4** de spec-impl → Crear la rama git y mostrar el resumen de la spec.
- **Fase 5** de spec-impl → Implementar paso a paso con pausas para revisar diffs.

No omitas ninguna regla de spec-impl: pausas tras cada paso, no commits automáticos, bloques por estado incorrecto, gestión de ambigüedades, etc.

**Criterio de avance a la Fase 6 de este skill:** el usuario ha confirmado explícitamente que:

1. La implementación está completa y funciona.
2. Los criterios de aceptación de la spec están verificados.
3. El estado de la spec fue actualizado a "Implementado" y el commit final fue hecho.

No avances si alguno de esos tres puntos no está confirmado.

---

### Fase 6 — Extraer el game-id

Del nombre del archivo de spec implementado (p. ej. `09-juego-arkanoid.md`), extrae el slug final como candidato a `game-id` (p. ej. `arkanoid`).

Verifica que esa clave existe como entrada en `lib/game-registry.ts`:

- Si hay coincidencia exacta: úsala sin preguntar.
- Si no coincide exactamente: lee el archivo, muestra las claves disponibles y pregunta al usuario cuál es el `game-id` correcto. Espera la respuesta antes de continuar.

Guarda el `game-id` confirmado: lo usarás en las Fases 7 y 8.

---

### Fase 7 — Agente skin-designer

Informa al usuario:

```
🎨 Iniciando skin-designer para «<game-id>»…
   Este agente añadirá las skins classic, neon y retro al juego.
```

Lanza el agente `skin-designer` pasándole el `game-id` como argumento. Usa `subagent_type: "skin-designer"` y **no uses `run_in_background`**: espera a que complete su ejecución antes de continuar.

Si el agente termina con error, informa al usuario y pregunta si desea reintentar o continuar sin skins. No avances a la Fase 8 hasta resolver esto.

---

### Fase 8 — Skill arcade-gamepad

Informa al usuario:

```
🕹️ Iniciando arcade-gamepad para «<game-id>»…
   Esta skill activará el gamepad arcade visual (carcasa av-gp, D-pad con hub y gema, botones A/B circulares).
```

Invoca la skill `arcade-gamepad` pasándole el `game-id` como argumento usando la herramienta `Skill`:

```
Skill({ skill: "arcade-gamepad", args: "<game-id>" })
```

La skill es interactiva: mostrará un preview del layout y pedirá confirmación al usuario antes de aplicar el cambio. Espera a que el usuario complete esa interacción.

- Si el usuario confirma y la skill aplica el cambio: anota que el gamepad arcade quedó activado.
- Si el usuario rechaza el layout o la skill detecta incompatibilidad (❌ Incompatible): informa al usuario y continúa a la Fase 9 sin activar el gamepad arcade. No lo consideres un error bloqueante.
- Si la skill termina con error inesperado: informa al usuario y pregunta si desea reintentar o continuar sin gamepad arcade.

No avances a la Fase 9 hasta resolver la interacción.

---

### Fase 9 — Agente mobile-porter e implementación directa

Esta fase tiene tres sub-fases encadenadas. Ejecuta cada una antes de pasar a la siguiente.

#### 9a. Auditoría móvil

Informa al usuario:

```
📱 Iniciando mobile-porter para «<game-id>»…
   Este agente auditará la experiencia móvil y generará la spec correctiva.
```

Lanza el agente `mobile-porter` con el mismo `game-id`. Usa `subagent_type: "mobile-porter"` sin `run_in_background`. Espera a que complete.

Al terminar, localiza la spec generada: busca en `specs/` el archivo más reciente que coincida con el patrón `*-mobile-<game-id>.md`. Guarda su ruta completa.

#### 9b. Aprobación automática de la spec móvil

Lee la spec móvil generada y localiza la línea de estado (normalmente `**Estado:**` o `**Status:**`). Cámbiala de `borrador` (o el valor que tenga) a `Aprobado`.

Informa al usuario:

```
✅ Spec móvil aprobada automáticamente: <ruta-de-la-spec>
   (Aprobación automática exclusiva de este pipeline)
```

#### 9c. Implementación de la spec móvil

Lanza `/spec-impl` sobre la spec móvil aprobada. Carga de nuevo el `SKILL.md` de spec-impl y ejecuta sus fases con el nombre de la spec móvil como argumento.

Sigue el mismo flujo interactivo: pausa tras cada paso, espera confirmación del usuario. Cuando el usuario confirme que los criterios de aceptación de la spec móvil están verificados y el commit final hecho, continúa a la Fase 10.

---

### Fase 10 — Resumen de pipeline

Muestra el resumen completo:

```
🏆 Pipeline completo para «<game-id>».

  ✅ Spec del juego implementada y verificada
  ✅ Skins añadidas (classic / neon / retro) → references/games-with-themes.md actualizado
  ✅ Gamepad arcade activado (touchStyle:"arcade") → lib/game-registry.ts actualizado
     (o: ⚠️ Gamepad arcade omitido — incompatible o rechazado por el usuario)
  ✅ Controles móviles implementados → spec generada, aprobada e implementada

Próximos pasos:
  • Merge de la rama de implementación a main.
  • Si la spec móvil tiene criterios pendientes, ábrela y revísalos.
  • Verifica el gamepad arcade en el navegador (viewport ≤ 620 px o DevTools modo móvil).
```

---

## Reglas duras

- No avanzar a la Fase 6 sin confirmación explícita del usuario de que la implementación principal está terminada.
- No lanzar `skin-designer` antes de tener el `game-id` confirmado.
- No lanzar `arcade-gamepad` (Fase 8) antes de que `skin-designer` complete (Fase 7).
- No lanzar `mobile-porter` (Fase 9) antes de que `arcade-gamepad` complete o sea descartado (Fase 8).
- No implementar la spec móvil antes de que `mobile-porter` la haya creado y el estado haya sido cambiado a `Aprobado`.
- No lanzar ningún agente ni skill si el `game-id` no está confirmado.
- La incompatibilidad o el rechazo del usuario en `arcade-gamepad` no es error bloqueante: continúa a la Fase 9 documentando que fue omitido.
- Si spec-impl no se encuentra en `~/.claude/skills/spec-impl/SKILL.md`, detente y avisa: el pipeline completo depende de él.
