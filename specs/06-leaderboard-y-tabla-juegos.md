# SPEC 06 — Leaderboard real, tabla de juegos y autenticación con Supabase

> **Status:** implmentado
> **Depends on:** SPEC 01, SPEC 04, SPEC 05
> **Date:** 2026-10-23
> **Objective:** Crear en Supabase las tablas `games`, `profiles` y `scores`, con Supabase Auth (email + contraseña), para que el Salón de la Fama, las fichas de juego y el guardado de puntuaciones al terminar una partida usen datos reales.

## Por qué existe esta spec

Hasta ahora todo lo que parece un ranking es simulado: el catálogo está hardcodeado en `lib/games.ts` (con `best` y `plays` falsos), el Salón de la Fama genera filas con `seededScores`, la sesión es `av_user` en localStorage y las partidas se guardan en `av_scores`. La SPEC 04 dejó la conexión a Supabase lista y la SPEC 05 hizo jugable el primer juego real.

Esta spec es grande (esquema, auth, lectura y escritura). El usuario decidió expresamente mantenerla en una sola spec y no abrir una SPEC 07, así que el plan está ordenado para que cada paso deje la app funcionando.

## Alcance

**Dentro:**

- Migraciones en `supabase/migrations/` (primeras del repo) con las tablas `games`, `profiles` y `scores`, sus índices, la vista de ranking, el trigger de creación de perfil y las políticas RLS.
- Tabla `games`: catálogo en base de datos (los 9 juegos actuales de `lib/games.ts`) como fuente de verdad; `lib/games.ts` deja de contener el array `GAMES` y pasa a leer de Supabase.
- Tabla `profiles` (`username` único) creada automáticamente por trigger al registrarse un usuario.
- Tabla `scores` con una fila por partida guardada.
- Supabase Auth con email + contraseña, sin confirmación por correo: `/acceso` pasa de simulado a real (registro e inicio de sesión), con `signOut` real.
- `proxy.ts` para refrescar la sesión de Supabase en cada petición.
- `SessionProvider` y `useSession` basados en Supabase Auth, manteniendo la forma de `user` que consumen `nav.tsx` y `hall-of-fame.tsx` (`user.name`).
- Server Action `submitScore` que valida y guarda la puntuación del usuario autenticado; el modal «FIN DEL JUEGO» de `GamePlayer` la usa en lugar de `saveScore` local.
- Sin sesión (invitado), el modal no guarda y muestra «INICIA SESIÓN PARA GUARDAR» con enlace a `/acceso`; el invitado puede seguir jugando.
- Salón de la Fama (`/salon`) con datos reales: pestañas por juego (desde `games`), podio y tabla del top 12 desde `scores`, y fila «TU MEJOR MARCA» con la mejor puntuación real del usuario en ese juego y su rango.
- Fichas de juego (`game-card.tsx`, detalle, home) con `best` y `plays` calculados desde `scores` en lugar de los valores hardcodeados.
- Datos de prueba (`supabase/seed.sql`): los 9 juegos y un usuario de prueba con cuenta real y puntuaciones propias para ver «TU MEJOR MARCA».
- Eliminar `seededScores` (`lib/scores.ts`), `av_user`, `av_scores` y el componente temporal `components/supabase-check.tsx` con su montaje en `app/layout.tsx`.
- Tipos generados `lib/supabase/database.types.ts` y `createClient<Database>()` tipado en `client.ts` y `server.ts`.

**Fuera de alcance (para futuras specs):**

- OAuth (Google, GitHub): los botones de `/acceso` quedan inertes como hoy.
- Confirmación de email, recuperación de contraseña, cambio de contraseña y edición de perfil o avatar.
- Anti-trampas real (validar la partida en servidor, firmar puntuaciones, límites de tasa). La validación se limita a tipo y rango.
- Realtime (ranking en vivo) y Edge Functions.
- Guardar puntuaciones de los juegos que aún usan el reproductor simulado de forma distinta al de Asteroids: el guardado funciona igual para los 9 `game_id`, pero solo Asteroids es un juego real.
- Páginas de perfil o historial de partidas del usuario.
- Paginación o filtros por periodo (semanal, mensual) del ranking: solo top 12 global por juego.
- Migrar las partidas ya guardadas en `av_scores` del navegador.
- Panel de administración del catálogo `games`.
- Tests automatizados.

## Modelo de datos

```sql
-- supabase/migrations/<ts>_games_profiles_scores.sql

create table public.games (
  id          text primary key,              -- 'asteroids', 'caida', ... (mismo id que las rutas)
  title       text not null,
  short       text not null,
  long        text not null,
  category    text not null check (category in ('ARCADE','PUZZLE','SHOOTER','VERSUS')),
  cover       text not null,                 -- clase CSS: 'cover-asteroids'
  color       text not null check (color in ('cyan','magenta','yellow','green')),
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now()
);

create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  username    text not null unique check (username ~ '^[A-Za-z0-9_]{3,10}$'),
  created_at  timestamptz not null default now()
);

create table public.scores (
  id           uuid primary key default gen_random_uuid(),
  game_id      text not null references public.games(id) on delete cascade,
  user_id      uuid references public.profiles(id) on delete set null,
  player_name  text not null,                -- copia del username en el momento de guardar
  score        int  not null check (score >= 0),
  created_at   timestamptz not null default now()
);

create index scores_game_score_idx on public.scores (game_id, score desc);
create index scores_user_game_idx  on public.scores (user_id, game_id);
```

Vista para fichas (la `security_invoker = true` respeta RLS):

```sql
create view public.game_stats with (security_invoker = true) as
select g.id as game_id,
       coalesce(max(s.score), 0) as best,
       count(s.id)               as plays
from public.games g left join public.scores s on s.game_id = g.id
group by g.id;
```

Triggers:

- `on_auth_user_created` (`after insert on auth.users`) llama a `public.handle_new_user()` (`security definer`, `search_path = ''`), que inserta en `profiles` con `username = raw_user_meta_data->>'username'`.

RLS (activada en las tres tablas):

| Tabla      | Política                                                                                                                    |
| ---------- | --------------------------------------------------------------------------------------------------------------------------- |
| `games`    | `select` para `anon` y `authenticated`; sin escritura desde la app.                                                         |
| `profiles` | `select` para `anon` y `authenticated`; sin `insert`/`update` (solo trigger).                                               |
| `scores`   | `select` para `anon` y `authenticated`; `insert` para `authenticated` con `user_id = auth.uid()`; sin `update` ni `delete`. |

Tipos de TypeScript:

```ts
// lib/games.ts — la forma de Game se mantiene; lo que cambia es la fuente
export interface Game {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: GameCategory; // category en BD
  cover: string;
  color: GameColor;
  best: number; // game_stats.best
  plays: string; // game_stats.plays formateado: 8.7K, 31.8K
}
export async function getGames(): Promise<Game[]>;
export async function getGame(id: string): Promise<Game | null>;
```

```ts
// lib/scores.ts — sustituye a seededScores
export interface ScoreRow {
  rank: number;
  name: string; // player_name
  score: number;
  date: string; // dd/mm/yyyy
}
export async function getTopScores(
  gameId: string,
  limit = 12,
): Promise<ScoreRow[]>;
export async function getUserBest(
  userId: string,
  gameId: string,
): Promise<{ rank: number; score: number; date: string } | null>;
```

```ts
// app/juegos/[id]/jugar/actions.ts  (nombre propuesto)
"use server";
export async function submitScore(input: {
  gameId: string;
  score: number;
}): Promise<
  { ok: true } | { ok: false; error: "no-session" | "invalid" | "failed" }
>;
```

```ts
// components/session-provider.tsx
interface SessionContextValue {
  user: { id: string; name: string } | null; // name = profiles.username
  signIn: (email: string, password: string) => Promise<string | null>; // devuelve mensaje de error
  signUp: (
    username: string,
    email: string,
    password: string,
  ) => Promise<string | null>;
  signOut: () => Promise<void>;
}
```

Convenciones:

- `rank` se calcula al leer (orden por `score desc`, desempate por `created_at asc`), no se guarda.
- «Tu mejor marca» es la fila de mayor `score` del usuario en ese juego y su `rank` es la posición de esa puntuación frente a la mejor de cada jugador; si el usuario no tiene partidas en ese juego, la fila no se muestra.
- El top del Salón muestra una fila por jugador (su mejor puntuación en ese juego), no varias del mismo.
- `player_name` y `username` se muestran en mayúsculas en la UI; en BD se guardan tal como se registran.
- Solo se usa la clave publicable; la `service_role` no entra en la app. El seed se aplica desde el MCP/SQL con privilegios del proyecto, no desde la app.
- Las lecturas con `cookies()` van bajo `<Suspense>` por `cacheComponents`, como se hizo con `params` en la SPEC 05.
- El catálogo `games` y los rankings se leen con el cliente de servidor; la sesión del navegador solo se usa en `/acceso`, `signOut` y el nombre del usuario.

## Plan de implementación

Antes del paso 1, leer en `node_modules/next/dist/docs/01-app` las guías de `cacheComponents`, `proxy` (middleware en Next 16), Server Actions y `cookies`. Usar `/frontend-design` para los estados nuevos de `/acceso` (errores, cargando), la fila «INICIA SESIÓN PARA GUARDAR» del modal y los estados vacíos del Salón. Los nombres de archivo son la propuesta de esta spec.

1. Aplicar la migración con `games`, `profiles`, `scores`, índices, `game_stats`, trigger `on_auth_user_created` y RLS; no se aplican datos. Verificación: `list_tables` muestra las tres tablas con RLS activa y `get_advisors` (security) no reporta tablas sin RLS ni funciones `security definer` expuestas.
2. Crear `supabase/seed.sql` con los 9 juegos (mismos ids, textos, categorías y covers que `lib/games.ts`) y el usuario de prueba `test@arcadevault.gg` / `PLAYER_TEST` con cuenta real en `auth.users`, su `profile` y 3–5 puntuaciones en 2–3 juegos, de forma que su mejor marca no sea la primera ni la última. Aplicarlo y verificar con `execute_sql` (conteos por tabla). Verificación: el seed es idempotente (`on conflict do nothing`) y se puede volver a ejecutar.
3. Generar `lib/supabase/database.types.ts` con `generate_typescript_types` y tipar `createClient<Database>()` en `client.ts` y `server.ts`. Verificación: `npx tsc --noEmit` pasa.
4. Convertir `lib/games.ts` en acceso a datos: `getGames()` y `getGame(id)` leen `games` + `game_stats`; conservar `CATS` y los tipos. Actualizar `app/biblioteca`, `app/juegos/[id]`, `app/juegos/[id]/jugar`, `components/library.tsx`, `components/game-card.tsx`, `components/home/*` y `lib/home.ts` para recibir los juegos por props o `await`, bajo `<Suspense>` donde haga falta. Verificación: biblioteca, home y detalle muestran los 9 juegos con `best` y `plays` de la BD y `npm run build` pasa.
5. Crear `lib/scores.ts` con `getTopScores` y `getUserBest`, y reescribir `components/hall-of-fame.tsx` para mostrar top 12 real (un jugador por fila), podio y pestañas desde `getGames()`. Mantener «TU MEJOR MARCA» como placeholder oculto hasta el paso 8. Verificación: `/salon` muestra las puntuaciones reales en cada pestaña y cambia al cambiar de juego; un juego sin puntuaciones muestra un estado vacío y no rompe el podio.
6. Crear `proxy.ts` (refresco de sesión con `createServerClient` y `getClaims()`/`getUser()`) y reescribir `components/session-provider.tsx` sobre `supabase.auth` (`onAuthStateChange`), con `user.name` leído de `profiles`. Mientras no haya formulario real, `/acceso` sigue como está. Verificación: `npm run build` pasa y, con un usuario de prueba iniciado desde la consola de Supabase, la navegación muestra su `username`.
7. Convertir `components/auth-form.tsx` en real: registro (`username`, email, contraseña) con `signUp` y `options.data.username`, inicio de sesión con email y contraseña, errores visibles (usuario ya existe, credenciales inválidas, validación del patrón de `username`) y redirección a `/`. «JUGAR COMO INVITADO» sólo navega a `/` sin sesión. Verificación: crear cuenta nueva, ver su fila en `profiles`, cerrar sesión, volver a entrar.
8. Activar «TU MEJOR MARCA» en el Salón con `getUserBest` para el usuario autenticado. Verificación: con `test@arcadevault.gg` la fila aparece con su rango y puntuación reales en los juegos donde tiene partidas y no aparece en los demás.
9. Crear la Server Action `submitScore` (sesión con `getUser()`, `gameId` existente, `score` entero entre 0 y 10 000 000, `player_name` = `username`) e integrarla en `components/game-player.tsx`: «GUARDAR PUNTUACIÓN» la invoca y muestra «PUNTUACIÓN GUARDADA_» o el error; sin sesión se muestra «INICIA SESIÓN PARA GUARDAR» con enlace a `/acceso`. Eliminar `saveScore`, `appendScore`, `av_scores` y `av_user`. Verificación: jugar Asteroids con la cuenta de prueba, guardar, y ver la nueva fila en `/salon` y el `best`/`plays` actualizado en la ficha.
10. Limpiar: borrar `seededScores`, `components/supabase-check.tsx` y su montaje, y las referencias a `av_*`; actualizar el pie de `/acceso` si hace falta. Verificación: `rg "seededScores|av_scores|av_user|SupabaseCheck"` no devuelve nada, y `npm run lint` y `npm run build` pasan.

## Criterios de aceptación

- [ ] `npm run build` y `npm run lint` terminan sin errores, y `npx tsc --noEmit` pasa.
- [ ] `public.games`, `public.profiles` y `public.scores` existen con RLS activada y `get_advisors` (security) no reporta errores (se acepta el aviso WARN de `rls_auto_enable()`; ver Decisiones).
- [ ] La migración vive en `supabase/migrations/` y el seed en `supabase/seed.sql`; ejecutar el seed dos veces no duplica filas.
- [ ] `games` contiene los 9 juegos y `/biblioteca` los lista con el mismo orden, textos, categorías y portadas de antes; `lib/games.ts` ya no contiene el array `GAMES`.
- [ ] Las fichas y el detalle muestran `best` y `plays` calculados desde `scores`, y cambian al insertar una puntuación nueva.
- [ ] `/salon` muestra, para cada juego, el podio y la tabla top 12 con datos de la BD, con un único registro por jugador y ordenados de mayor a menor puntuación.
- [ ] Un juego sin puntuaciones muestra un estado vacío sin errores en consola.
- [ ] Registrar una cuenta nueva con `username`, email y contraseña crea la fila en `profiles` y deja la sesión iniciada sin pedir confirmación por correo.
- [ ] Un `username` duplicado, con caracteres no permitidos o con menos de 3 o más de 10 caracteres muestra un error en `/acceso` y no crea la cuenta.
- [ ] Credenciales incorrectas en el inicio de sesión muestran un error y no inician sesión.
- [ ] La sesión persiste al recargar la página y `signOut` la cierra; la navegación muestra el `username` solo con sesión.
- [ ] «JUGAR COMO INVITADO» permite jugar sin sesión.
- [ ] Al terminar una partida con sesión, «GUARDAR PUNTUACIÓN» crea una fila en `scores` con `game_id`, `user_id = auth.uid()`, `player_name` y la puntuación final, y muestra «PUNTUACIÓN GUARDADA_».
- [ ] Al terminar una partida sin sesión el modal muestra «INICIA SESIÓN PARA GUARDAR» con enlace a `/acceso` y no escribe en `scores`.
- [ ] La puntuación guardada aparece en `/salon` y en «TU MEJOR MARCA» solo si supera la anterior mejor del usuario en ese juego.
- [ ] Con `test@arcadevault.gg`, la fila «TU MEJOR MARCA» del Salón muestra el rango y la puntuación reales de los datos de prueba, y no aparece en los juegos donde no tiene partidas.
- [ ] `submitScore` rechaza `score` negativo, no entero o mayor de 10 000 000, y un `gameId` inexistente, sin insertar.
- [ ] Un `insert` en `scores` hecho con la clave publicable y otro `user_id` es rechazado por RLS; `update` y `delete` sobre `scores` están denegados.
- [ ] `rg "seededScores|av_scores|av_user|SupabaseCheck"` no devuelve resultados.
- [ ] La consola del navegador y la del servidor no muestran errores de hidratación ni el aviso «URL data outside of Suspense» en `/`, `/biblioteca`, `/salon`, `/acceso` ni `/juegos/[id]`.
- [ ] La clave `service_role` no aparece en el repo ni en el bundle del cliente.

## Decisiones

- **Sí:** una sola spec para esquema, auth, lectura y guardado. Decisión del usuario, que descartó dividirla y abrir una SPEC 07; el riesgo se mitiga ordenando los pasos para que cada uno deje la app funcionando.
- **Sí:** tabla `games` en Supabase como fuente de verdad del catálogo. Decisión del usuario; da la clave foránea de `scores.game_id` y permite calcular `best`/`plays`.
- **No:** mantener `GAMES` hardcodeado como fallback. Dos fuentes de verdad acabarían divergiendo.
- **Sí:** `best` y `plays` calculados con la vista `game_stats` y no guardados en `games`. Evita contadores desincronizados.
- **Sí:** `scores` en Supabase como única fuente del ranking. Decisión del usuario; ranking real y compartido.
- **No:** `av_scores` ni mezclar partidas locales con las reales. Dos listas con significados distintos confunden y no son comparables.
- **Sí:** Supabase Auth con email + contraseña sin confirmación por correo. Decisión del usuario; permite probar el flujo completo sin SMTP. Requiere desactivar «Confirm email» en el panel de Supabase (acción manual, fuera del repo).
- **No:** OAuth, recuperación de contraseña ni confirmación de email en esta spec. Cada uno añade configuración externa y UI propia.
- **Sí:** `profiles` con `username` único creado por trigger desde `raw_user_meta_data`. Decisión del usuario; el ranking muestra un nombre estable y único.
- **No:** guardar el nombre solo en `user_metadata`. No permite unicidad ni joins.
- **Sí:** `scores.player_name` además de `user_id`. Conserva el nombre mostrado si el perfil se borra.
- **Sí:** un único usuario de prueba con cuenta real. Permite ver «TU MEJOR MARCA» y probar el guardado sin crear cuentas a mano.
- **No:** crear decenas de usuarios reales en `auth.users` para los datos de prueba. Mezcla datos de prueba con el sistema de auth.
- **Sí:** Server Action `submitScore` con sesión y RLS de insert (`user_id = auth.uid()`). Decisión del usuario; el cliente no escribe en la tabla directamente y RLS es la red de seguridad.
- **No:** insert directo desde el cliente. Habría que confiar en que el navegador envía bien el `game_id` y la puntuación.
- **No:** anti-trampas real. Un jugador técnico puede llamar a la acción con cualquier puntuación dentro del rango; validar partidas necesita un servidor de juego o puntuaciones firmadas, y va en otra spec.
- **Sí:** invitado puede jugar pero no guardar; el modal invita a iniciar sesión. Decisión del usuario; no hay ranking de «anónimos» que moderar.
- **Sí:** el Salón muestra una fila por jugador (su mejor marca). Un mismo jugador no copa el top con sus propias partidas.
- **Sí:** `proxy.ts` ahora. La SPEC 04 lo dejó fuera porque nadie leía sesión en servidor; con auth real es necesario para refrescar el token.
- **Sí:** eliminar `SupabaseCheck`, que la SPEC 04 marcó como temporal.
- **No:** `service_role` en la app; el seed se aplica con las herramientas del proyecto.
- **Excepción aceptada:** `get_advisors` (security) sigue avisando (WARN) de `public.rls_auto_enable()`, una función `security definer` ejecutable por `anon` y `authenticated`. No la crea esta spec: es un trigger de eventos (`ensure_rls`) del proyecto que activa RLS en las tablas nuevas de `public`. Al devolver `event_trigger` no se puede invocar vía RPC, así que el riesgo es mínimo. Decisión del usuario: dejarla como está y no revocar su `EXECUTE`, para no tocar una pieza que no es de esta spec.

## Riesgos

| Riesgo                                                                                                                  | Mitigación                                                                                                                                       |
| ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| «Confirm email» está activo en el proyecto y el registro no deja sesión iniciada.                                       | Criterio de aceptación de registro con sesión inmediata; desactivarlo en Auth → Providers → Email antes del paso 7.                              |
| `cacheComponents` falla al leer `cookies()` (cliente de servidor) fuera de `<Suspense>`.                                | Las lecturas de Supabase van bajo `<Suspense>`, como se hizo con `params`; el criterio de consola limpia lo comprueba.                           |
| Si el trigger `handle_new_user` falla (por ejemplo `username` duplicado), el registro de auth falla con un error opaco. | Validar el patrón en el formulario y traducir el error de Supabase a un mensaje claro; probar duplicados en los criterios.                       |
| Función `security definer` mal protegida o con `search_path` mutable.                                                   | `set search_path = ''`, nombres calificados y revisión con `get_advisors`.                                                                       |
| Puntuaciones falsificadas con la Server Action.                                                                         | Validación de rango y RLS; se acepta explícitamente (ver Decisiones) y queda fuera de esta spec.                                                 |
| Insertar el usuario de prueba en `auth.users` por SQL queda incompleto (identidades, hash) y no puede iniciar sesión.   | Verificar el inicio de sesión del usuario de prueba en el paso 7; si falla, crearlo con `signUp` real y dejar el seed solo con sus puntuaciones. |
| Cambiar `lib/games.ts` a asíncrono rompe a los consumidores síncronos (home, biblioteca, Salón).                        | El paso 4 migra todos los consumidores en un mismo paso y `tsc` detecta los restantes.                                                           |
| Consultas de ranking lentas al crecer `scores`.                                                                         | Índice `(game_id, score desc)` y límite de 12; la paginación queda fuera de alcance.                                                             |
| El `username` en mayúsculas en la UI y minúsculas en BD genera duplicados que parecen distintos.                        | `username` único insensible a mayúsculas: índice único sobre `lower(username)` en la migración.                                                  |

## Qué **no** está en esta spec

- OAuth con Google o GitHub, confirmación de email y recuperación de contraseña.
- Anti-trampas real, límites de tasa y moderación de nombres.
- Realtime y Edge Functions.
- Perfil de usuario, avatar, historial de partidas y logros.
- Filtros por periodo, paginación del ranking y panel de administración de `games`.
- Migrar las partidas antiguas de `av_scores`.
- Juegos reales distintos de Asteroids; el resto siguen con el reproductor simulado.
- Tests automatizados.

Cada uno, si llega, va en su propia spec.
