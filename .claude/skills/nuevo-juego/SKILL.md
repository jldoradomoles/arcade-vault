---
name: nuevo-juego
description: Genera la spec para añadir un juego jugable a Arcade Vault con su leaderboard, portado desde references/started-games/ o diseñado desde cero. Solo escribe la spec; la implementación se hace con /spec-impl.
disable-model-invocation: true
argument-hint: "carpeta de referencia (03-tetris) o descripción del juego"
allowed-tools: Read, Glob, Grep, Write, AskUserQuestion, Bash(ls:*), Bash(cat:*), Bash(date:*)
---

# /nuevo-juego — Spec de un juego nuevo con leaderboard

## Contexto de sesión

Fecha de hoy (úsala para la cabecera de la spec, nunca la adivines):
!`date +%F`

Specs existentes:
!`ls specs/ 2>/dev/null || echo "No existe specs/"`

Juegos de referencia disponibles:
!`ls references/started-games/ 2>/dev/null || echo "No existe references/started-games/"`

---

Este skill es una variante de `/spec` para juegos: sigue su método y su plantilla, y añade el contrato de la plataforma. Produce **una spec** en `specs/NN-juego-<slug>.md` para integrar un juego en la plataforma: motor TypeScript + canvas + HUD/pausa/modal de la plataforma + fila en `games` para que el leaderboard, el Salón y las fichas funcionen. **No escribes código aquí.** La implementación la hace después `/spec-impl`.

Responde siempre en español.

## Fase 1 — Contexto

1. Lee `CLAUDE.md`, `specs/05-juego-asteroids.md`, `specs/06-leaderboard-y-tabla-juegos.md` y las dos specs más recientes (para copiar el formato exacto, el idioma y los estados, p. ej. `borrador` / `aprobado`).
2. Lee el skill `/spec`, que es la referencia para redactar cualquier spec: su `SKILL.md` y su `template.md`. Búscalos en `~/.claude/skills/spec/` y, si no están, en `~/.agents/skills/spec/`. Si no existen en ninguna ruta, avisa al usuario y detente: no escribas la spec sin esa referencia.
3. Lee `contrato-plataforma.md` y `plantilla-spec-juego.md` (en la carpeta de este skill). Son una **especialización** de `/spec` para juegos: añaden contenido propio de la plataforma, pero no sustituyen su estructura ni sus reglas.
4. Detecta si el **registro genérico** ya existe: comprueba `lib/game-engine.ts`, `lib/game-registry.ts` y `components/game-canvas.tsx`, y si `components/game-player.tsx` aún contiene `isAsteroids`. Si no existe, la spec debe incluir el paso de refactor (ver contrato). Si existe, el juego solo se registra.
5. Lee `supabase/seed.sql` y `supabase/migrations/` para saber el siguiente `sort_order` y comprobar que el `id` del juego no existe ya.

Si `$ARGUMENTS` está vacío, pide una descripción de una frase o el nombre de una carpeta de `references/started-games/`.

## Fase 2 — Origen del juego

**Con referencia** (el argumento es una carpeta de `references/started-games/`, o el usuario elige una de la lista):

- Lee su `README.md`, `CLAUDE.md`, `index.html`, JS/CSS y los assets.
- Inventaría: variables globales, loop, entrada, HUD o game over dibujados en el juego, reinicio, dimensiones del canvas, sprites y sonidos, persistencia propia (localStorage).
- Propón qué se porta 1:1 y qué se sustituye por la plataforma (HUD, pausa, game over, reinicio y guardado de puntuación son de la plataforma, no del juego).
- Si el juego no usa `<canvas>` (DOM/CSS), señálalo: hay que decidir entre portarlo a canvas o dejar que el motor gestione un contenedor.

**Sin referencia:** pregunta mecánica, objetivo, controles, cómo se puntúa, condición de fin, vidas/niveles y estética.

## Fase 3 — Preguntas

Usa `AskUserQuestion` en bloques de 3 a 5, con la recomendación primero. No preguntes lo que ya puedas deducir del código de referencia. Cubre siempre:

- `id` (slug = ruta `/juegos/<id>` y `game_id`), `title`, `short`, `long`, `category` (`ARCADE|PUZZLE|SHOOTER|VERSUS`) y `color` (`cyan|magenta|yellow|green`). Si lo que quieren no encaja en esos valores, avisa de que exige cambiar el `check` en BD y `lib/game-types.ts` y pregunta si entra en la spec.
- Mapeo al HUD: qué es `score`, y si el juego tiene `lives` y `level` (si no, el HUD los oculta).
- Tamaño lógico del canvas (proporción) y controles de teclado (para la línea de ayuda).
- Assets: destino `public/games/<id>/`; sonido dentro o fuera de alcance.
- Qué queda fuera (táctil, sonido, modos extra...).

Para en cuanto puedas responder sin suponer: qué archivos aparecen o cambian, cuál es el primer y el último paso, y cómo se verifica.

## Fase 4 — Escribir y guardar

0. Antes de escribir, comprueba que has leído en esta sesión el `SKILL.md` y el `template.md` de `/spec` (Fase 1, paso 2). Si no es así, léelos ahora.
1. Número: el mayor de `specs/` + 1, con dos dígitos. Nombre: `specs/NN-juego-<slug>.md`.
2. Escribe el archivo directamente. La **estructura, el orden de secciones, la cabecera y las reglas globales** (una frase por idea, nombres concretos, sin TODOs, sin código largo, markdown estándar, criterios booleanos, plan con pasos que dejan el sistema funcionando) vienen de `/spec` y su `template.md`. Sobre esa base, aplica `plantilla-spec-juego.md` para el contenido propio de juegos: estado `borrador`, `Depends on: SPEC 05, SPEC 06` (más la spec que introdujo el registro, si ya existe), la fecha del contexto de sesión. Si hay conflicto entre ambos, manda `/spec` en forma y `plantilla-spec-juego.md` en contenido de plataforma.
   Respeta además de `/spec`: no marcar la spec como aprobada, no pedir permiso para escribir el archivo, y sembrar `specs/.spec-config.yml` solo si no existe (con el contenido por defecto que indica `/spec`).
3. Incluye los **criterios base obligatorios** de la plantilla además de los específicos del juego. Todo criterio debe ser verificable con sí/no.
4. Si el registro genérico no existe, el plan empieza con el refactor (Asteroids migra al registro) y un criterio «Asteroids se comporta igual».
5. Comprueba que cada SPEC citada en `Depends on` existe en `specs/`.
6. Confirma: ruta creada, recordatorio de pasar el estado a `aprobado` tras revisarla, y siguiente paso `/spec-impl NN-juego-<slug>`. **Detente ahí.**

## Reglas duras

- Nunca escribas la spec sin haber leído antes `/spec` (`SKILL.md` y `template.md`): es la referencia de formato y reglas.
- Nunca escribas código ni toques nada fuera de `specs/` y esta carpeta.
- No asumas decisiones que el usuario no haya confirmado; pregunta en la Fase 3.
- Si el juego requiere multijugador, servidor de partidas o anti-trampas real, propón una spec aparte.
- Si el juego no cabe en una frase de objetivo o toca más de tres áreas, propón dividirlo.
- No propongas implementar la spec después de guardarla.
