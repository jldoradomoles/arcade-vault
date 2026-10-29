# Arcade Vault

Plataforma web para jugar juegos clásicos de arcade online y competir por la mayor cantidad de puntos. Construida con **Next.js 16 / React 19**, **Supabase** y **Tailwind v4**, siguiendo un flujo de desarrollo llamado **Spec Driven Design**.

---

## Tabla de contenidos

- [¿Qué es?](#qué-es)
- [Juegos disponibles](#juegos-disponibles)
- [Tecnologías](#tecnologías)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Spec Driven Design](#spec-driven-design)
- [Skills de Claude Code](#skills-de-claude-code)
- [Agentes de Claude Code](#agentes-de-claude-code)
- [Hooks automáticos](#hooks-automáticos)
- [Archivos de referencia en `/references`](#archivos-de-referencia-en-references)
- [Base de datos (Supabase)](#base-de-datos-supabase)
- [Comandos](#comandos)

---

## ¿Qué es?

Arcade Vault es un **arcade online multijuego** donde los usuarios pueden:

- Explorar el catálogo de juegos en `/biblioteca`.
- Jugar directamente en el navegador con canvas 2D.
- Guardar su puntuación y competir en el **Salón de la Fama** (`/salon`).
- Registrarse e iniciar sesión con usuario + contraseña (Supabase Auth).
- Contactar con el equipo vía formulario (integración con Resend).

La plataforma gestiona de forma centralizada el **HUD** (puntuación, vidas, nivel), la **pausa**, el modal de **fin de partida** y el **guardado de puntuación**. Cada juego solo dibuja su lógica en el canvas; el chrome lo pone `components/game-player.tsx`.

Los juegos soportan controles de **teclado**, **gamepad táctil virtual** en móvil y **skins visuales** (`classic`, `neon`, `retro`) con un selector integrado en el propio juego.

---

## Juegos disponibles

| #   | ID          | Título    | Categoría | Color   |
| --- | ----------- | --------- | --------- | ------- |
| 9   | `asteroids` | ASTEROIDS | SHOOTER   | cyan    |
| 10  | `tetris`    | TETRIS    | PUZZLE    | magenta |
| 11  | `arkanoid`  | ARKANOID  | ARCADE    | yellow  |
| 12  | `snake`     | SNAKE     | ARCADE    | green   |

> El inventario detallado con estadísticas de partidas está en `references/implemented-games.md`.

---

## Tecnologías

| Área      | Stack                                         |
| --------- | --------------------------------------------- |
| Framework | Next.js 16.4.1 (App Router, Turbopack)        |
| UI        | React 19.3, Tailwind v4                       |
| Auth & BD | Supabase (PostgreSQL + Row Level Security)    |
| Email     | Resend                                        |
| Tipado    | TypeScript estricto                           |
| Calidad   | ESLint (flat config) + Prettier               |
| Fuentes   | Press Start 2P, JetBrains Mono, Courier Prime |

---

## Estructura del proyecto

```
arcade-vault/
├── app/                        # App Router: rutas y Server Actions
│   ├── /                       # Home / landing
│   ├── /acerca-de              # Página con formulario de contacto
│   ├── /biblioteca             # Catálogo de juegos
│   ├── /salon                  # Salón de la Fama / leaderboard global
│   ├── /acceso                 # Login y registro
│   └── /juegos/[id]/           # Ficha del juego
│       └── jugar/              # Reproductor del juego
├── components/                 # UI compartida
│   ├── game-player.tsx         # Chrome: HUD, pausa, modal, selector de skin
│   ├── game-canvas.tsx         # Canvas + controles táctiles
│   ├── touch-controls.tsx      # Gamepad virtual (clásico y arcade)
│   └── ...
├── lib/                        # Lógica de negocio
│   ├── game-engine.ts          # Contrato GameEngine (interfaz de motores)
│   ├── game-registry.ts        # Mapa id → motor + controles + skin
│   ├── game-types.ts           # Tipos compartidos (category, color, SkinId)
│   ├── asteroids/              # Motor Asteroids
│   ├── tetris/                 # Motor Tetris
│   ├── arkanoid/               # Motor Arkanoid
│   ├── snake/                  # Motor Snake
│   └── supabase/               # Clientes browser / server + tipos generados
├── supabase/
│   ├── seed.sql                # Datos iniciales (juegos)
│   └── migrations/             # Historial de migraciones
├── specs/                      # Specs numeradas (Spec Driven Design)
├── references/                 # Material de apoyo y memoria de agentes
├── .claude/
│   ├── agents/                 # Subagentes de Claude Code
│   ├── skills/                 # Skills del proyecto
│   └── hooks/                  # Hooks automáticos (format-lint)
└── proxy.ts                    # Middleware Next.js (refresca sesión Supabase)
```

---

## Spec Driven Design

El proyecto usa **Spec Driven Design** (`/spec` y `/spec-impl` del paquete `Klerith/fernando-skills`):

```bash
npx skills@latest add Klerith/fernando-skills
```

Cada funcionalidad parte de una spec numerada en `specs/NN-*.md`. El flujo es:

1. **Escribir la spec** (`/spec` o `/nuevo-juego`) → estado `borrador`.
2. **Revisar y aprobar** manualmente → estado `aprobado`.
3. **Implementar** (`/spec-impl` o `/spec-impl-game`) paso a paso con pausas para revisar diffs.

### Specs entregadas (11)

| #   | Spec                          |
| --- | ----------------------------- |
| 01  | Pantallas MVP visuales        |
| 02  | Home / landing                |
| 03  | Acerca de + contacto (Resend) |
| 04  | Conexión Supabase             |
| 05  | Juego Asteroids               |
| 06  | Leaderboard + tabla `games`   |
| 07  | Juego Tetris                  |
| 08  | Juego Arkanoid                |
| 09  | Juego Snake                   |
| 10  | Controles táctiles móvil      |
| 11  | Gamepad arcade (Arkanoid)     |

---

## Skills de Claude Code

Los skills son comandos que Claude puede ejecutar escribiendo `/nombre-skill`. Los del proyecto viven en `.claude/skills/`.

### `/nuevo-juego [carpeta-o-descripción]`

Genera la **spec** para añadir un juego nuevo. Funciona con una carpeta de `references/started-games/` o con una descripción en lenguaje natural. Hace preguntas sobre `id`, `title`, `category`, `color`, canvas, controles y qué queda fuera de alcance. **Solo produce la spec**; la implementación la hace `/spec-impl`.

### `/arcade-gamepad <game-id>`

Activa el gamepad arcade visual (carcasa `.av-gp`, D-pad con hub y gema, botones A/B circulares) para un juego concreto. Requiere que **SPEC 11** ya esté implementada. Solo añade `touchStyle: "arcade"` a la entrada del juego en `lib/game-registry.ts` después de mostrar un preview del layout y pedir confirmación.

### `/spec-impl-game <NN-spec>`

Pipeline completo para un juego nuevo. Extiende `/spec-impl` y, tras confirmar que la implementación está terminada, lanza en secuencia:

1. Agente `skin-designer` (skins visual).
2. Skill `arcade-gamepad` (gamepad táctil arcade).
3. Agente `mobile-porter` + implementación de la spec correctiva móvil.

---

## Agentes de Claude Code

Los agentes son subagentes especializados que Claude puede invocar. Viven en `.claude/agents/`.

### `game-planner`

**Propone el próximo juego** a añadir analizando el catálogo actual, los huecos de categoría/color y las carpetas de `references/started-games/`. No escribe código ni specs.

- **Entrada:** pista del usuario, instrucción sobre el backlog, o vacío (propuesta libre).
- **Salida:** 1–3 candidatos razonados + actualización del backlog en `references/game-suggestions-todo.md`.
- **Siguiente paso sugerido:** `/nuevo-juego`.

El backlog tiene cuatro tablas: `Sugeridos`, `Aceptados`, `Implementados`, `Descartados`. Las filas se mueven entre tablas; nunca se duplican.

### `game-jam`

Genera **3 specs de juegos** a partir de un tema (p. ej. «espacio», «medieval», «velocidad»). Cada juego viene con dos variantes de implementación (`spec-v1.md` y `spec-v2.md`) para elegir. Las specs salen en estado `borrador` en `specs/game-jam/<game-id>/`. Es autónomo: no hace preguntas, solo necesita el tema.

- Las 3 propuestas cubren al menos 2 categorías distintas y 2 colores distintos.
- Las variantes v1/v2 de cada juego difieren en mecánica, controles, puntuación o complejidad — no son cambios cosméticos.
- **Siguiente paso:** copiar la variante elegida a `specs/NN-juego-<id>.md`, cambiar estado a `aprobado` y usar `/spec-impl`.

### `skin-designer`

Añade tres skins (`classic`, `neon`, `retro`) a un juego concreto e incrusta un **selector de skin** dentro del propio juego. La primera invocación introduce la infraestructura compartida (`SkinId`, parámetro `skin` en `CreateEngine`, componente `GameSkinPicker`); las siguientes la reutilizan.

- Tiñe spritesheets existentes con `ctx.filter` (no sustituye los PNG).
- No persiste la selección (al recargar vuelve a `classic`).
- No toca Supabase ni `localStorage`.
- Actualiza el seguimiento en `references/games-with-themes.md`.

### `mobile-porter`

Audita la **experiencia móvil** de un juego concreto en cuatro viewports (375×812, 667×375, 768×1024, ≥1024) y genera una spec correctiva en `specs/NN-mobile-<game-id>.md`. La auditoría es estática (sin navegador). No escribe código; solo la spec y actualiza `references/mobile-review.md`.

- Toma SPEC 10 como contrato táctil/responsive.
- Toma `references/gamepad-assets/gamepad.html` como contrato visual del gamepad neón.
- **Siguiente paso:** `/spec-impl` sobre la spec generada.

---

## Hooks automáticos

Configurados en `.claude/settings.json` como `PostToolUse`:

### `format-lint.mjs`

Se ejecuta automáticamente tras cada operación `Write` o `Edit` de Claude. Pasa **Prettier** y **ESLint** sobre el archivo modificado, manteniendo el código siempre formateado y sin errores de lint sin intervención manual.

---

## Archivos de referencia en `/references`

Estos archivos sirven como **memoria persistente** para los agentes y como fuente de verdad del estado del proyecto.

### `references/implemented-games.md`

Inventario de los juegos **actualmente jugables** en la plataforma. Incluye `id`, título, categoría, color, ruta de juego, número de partidas jugadas y mejor puntuación registrada. Los datos vienen de la tabla `public.games` y la vista `public.game_stats` de Supabase.

Los agentes leen este archivo para no volver a proponer juegos ya implementados, y para conocer los colores y categorías en uso al diseñar un nuevo juego.

### `references/game-suggestions-todo.md`

Backlog de sugerencias mantenido por el agente `game-planner`. Tiene cuatro tablas:

| Tabla             | Descripción                                                     |
| ----------------- | --------------------------------------------------------------- |
| **Sugeridos**     | Propuestas del agente pendientes de decisión                    |
| **Aceptados**     | Juegos con luz verde, sin implementar aún                       |
| **Implementados** | Juegos jugables (referencia cruzada con `implemented-games.md`) |
| **Descartados**   | Juegos rechazados (no se vuelven a proponer)                    |

Cada juego vive en **una sola** de las tablas en cada momento; cambiar de estado = mover la fila. El agente nunca reescribe el archivo completo: usa `Edit` para mover o añadir filas.

Actualmente hay **18 juegos sugeridos** (Pong, Space Invaders, 2048, Pac-Man, Galaga, Minesweeper…) y ninguno en estado `Aceptado` o `Descartado`.

### `references/games-with-themes.md`

Seguimiento de los juegos que ya tienen las tres skins (`classic`, `neon`, `retro`) y su selector visual. Mantenido por el agente `skin-designer`.

Estado actual:

| Juego     | classic | neon | retro |
| --------- | :-----: | :--: | :---: |
| asteroids |   ✅    |  ✅  |  ✅   |
| tetris    |   ⬜    |  ⬜  |  ⬜   |
| arkanoid  |   ✅    |  ✅  |  ✅   |
| snake     |   ✅    |  ✅  |  ✅   |

---

## Base de datos (Supabase)

Tablas principales:

| Tabla      | Descripción                                                       |
| ---------- | ----------------------------------------------------------------- |
| `games`    | Catálogo de juegos (id, title, category, color, sort_order…)      |
| `profiles` | Perfiles de usuario (username, creado por trigger al registrarse) |
| `scores`   | Puntuaciones guardadas (game_id, user_id, score)                  |

Vista `game_stats` (con `security_invoker = true`): estadísticas agregadas por juego (partidas jugadas, mejor puntuación).

Cada juego nuevo requiere una migración `YYYYMMDDHHMMSS_juego_<slug>.sql` con el insert en `games`.

---

## Comandos

```bash
npm run dev     # Servidor de desarrollo (Turbopack)
npm run build   # Build de producción
npm run start   # Servir el build
npm run lint    # ESLint (flat config en eslint.config.mjs)
```
