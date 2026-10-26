# Contrato de plataforma para juegos

Referencia que toda spec de juego debe respetar. Sale de SPEC 05 (motor + reproductor) y SPEC 06 (leaderboard). Verifica contra el código actual antes de citar rutas.

## 1. Contrato del motor

Archivo `lib/game-engine.ts` (lo crea la primera spec si no existe):

```ts
export interface GameStats {
  score: number;
  lives?: number; // si no se emite, el HUD oculta VIDAS
  level?: number; // si no se emite, el HUD oculta NIVEL
}
export interface GameCallbacks {
  onStats: (s: GameStats) => void; // solo cuando cambia algún valor
  onGameOver: (finalScore: number) => void; // una sola vez por partida
}
export interface GameEngine {
  start(): void;
  setPaused(paused: boolean): void;
  finish(): void; // botón FIN: termina con el puntaje actual
  destroy(): void;
}
export type CreateEngine = (
  canvas: HTMLCanvasElement,
  cb: GameCallbacks,
) => GameEngine;
```

`AsteroidsEngine` ya cumple esta forma (`lib/asteroids/engine.ts`); su `AsteroidsStats` pasa a ser `GameStats`.

## 2. Canvas y registro genéricos

- `components/game-canvas.tsx`: generaliza `components/asteroids-canvas.tsx`. Props: `createEngine`, `width`, `height`, `paused`, `over`, `onStats`, `onGameOver`. Mismo patrón: callbacks en ref, motor creado/destruido en `useEffect`, efectos aparte para `paused` y `over`, `className="block w-full"` con `aspect-ratio` según `width/height`. Se elimina `asteroids-canvas.tsx`.
- `lib/game-registry.ts` (apto para Client Components: sin `next/headers`):

```ts
export interface GameEntry {
  width: number;
  height: number;
  createEngine: CreateEngine;
  controls: { keys: string[]; action: string }[]; // línea de ayuda bajo el CRT
}
export const GAME_REGISTRY: Record<string, GameEntry> = {/* asteroids, ... */};
```

- `components/game-player.tsx` busca `GAME_REGISTRY[game.id]`: con entrada usa `GameCanvas` y los `controls`; sin entrada conserva el reproductor simulado (`game-arena`). Desaparece `isAsteroids`.

**Pasos del refactor** (solo si el registro no existe): 1) `lib/game-engine.ts`; 2) `AsteroidsEngine implements GameEngine`; 3) `game-canvas.tsx`; 4) `game-registry.ts` con `asteroids` y sus controles; 5) adaptar `GamePlayer` y borrar `asteroids-canvas.tsx`. Verificación: Asteroids se juega igual y los demás juegos conservan el simulado.

## 3. Reglas del motor (de SPEC 05)

- Código en `lib/<id>/{constants,entities,engine}.ts`. Sin React ni `next/*`; solo DOM y canvas.
- Estado global del juego original → campos privados de la clase; nada de globales de módulo.
- `dt` en segundos, acotado a 0,05; `lastTime` se reinicia al reanudar.
- `onStats` solo ante cambios, no por frame. `onGameOver` una sola vez.
- Teclado en `window`: se registra en `start()`, se quita en `destroy()` y al llegar a game over. `preventDefault` solo para las teclas del juego. Se ignoran eventos cuyo `target` sea un `input` (campo del modal).
- Tras game over el loop puede seguir dibujando, pero no procesa entrada. El reinicio lo hace el modal remontando el canvas con `key`; el juego no tiene su propio «pulsa para reiniciar».
- El HUD, la pausa («EN PAUSA»), el modal «FIN DEL JUEGO» y el guardado son de la plataforma. El canvas solo dibuja el juego (y indicadores propios sin equivalente en la plataforma).
- El canvas solo se toca dentro de `useEffect` (`cacheComponents`). Seguro bajo React Strict Mode: nunca dos motores ni listeners duplicados.
- Persistencia propia del original (p. ej. `localStorage` de récords) se elimina: el récord es el leaderboard.
- Assets en `public/games/<id>/`.

## 4. Integración con el leaderboard (de SPEC 06)

No hay que tocar `submitScore`, `lib/scores.ts`, el Salón ni las fichas: son genéricos por `game_id`. Para que un juego aparezca:

1. **Migración** `supabase/migrations/<timestamp>_juego_<id>.sql`:
   ```sql
   insert into public.games (id, title, short, long, category, cover, color, sort_order)
   values ('<id>', '<TÍTULO>', '<short>', '<long>', '<CATEGORÍA>', 'cover-<id>', '<color>', <n>)
   on conflict (id) do nothing;
   ```
   Se aplica con el MCP de Supabase (`apply_migration`).
2. **Seed**: la misma fila en `supabase/seed.sql` (idempotente) y, si procede, 2–3 puntuaciones de `PLAYERTEST` para ver «TU MEJOR MARCA».
3. **Portada** `.cover-<id>` en `app/globals.css` (junto a `.cover-asteroids`), diseñada con `/frontend-design`.
4. `category` y `color` deben estar en los valores permitidos (`check` en BD y `lib/game-types.ts`).
5. Si no cambia el esquema no se regeneran `database.types.ts`.
6. `submitScore` valida entero entre 0 y 10 000 000: el motor debe mantener su puntuación en ese rango.

## 5. Convenciones del repo

- Español en UI y specs; mayúsculas y estilo de textos como en la plataforma («PUNTUACIÓN GUARDADA_», «INICIA SESIÓN PARA GUARDAR»).
- Tailwind v4, Next 16 App Router: leer `node_modules/next/dist/docs/01-app` antes de implementar.
- Sin tests automatizados en el repo: la verificación son `npm run build`, `npm run lint`, `npx tsc --noEmit` y pruebas manuales/Playwright.
