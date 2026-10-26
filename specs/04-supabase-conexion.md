# SPEC 04 — Conexión de la aplicación con Supabase

> **Status:** implementado
> **Depends on:** SPEC 03
> **Date:** 2026-10-22
> **Objective:** Instalar el cliente de Supabase y configurar la conexión de la app Next.js con el proyecto `xxfgpzljuglpfyqshcps`, sin crear tablas, modelos ni cambiar ninguna pantalla.

## Por qué existe esta spec

La idea inicial era «implementar Supabase» con auth, puntuaciones, ranking, Realtime y Edge Functions. Es demasiado grande para una sola spec, así que se empieza por lo mínimo: dejar la conexión lista y verificada. Todo lo que use esa conexión (auth, esquema, puntuaciones, Realtime, Edge Functions) irá en specs posteriores, cada una con su propia numeración.

## Alcance

**Dentro:**

- Dependencias `@supabase/supabase-js` y `@supabase/ssr`.
- Cliente de navegador en `lib/supabase/client.ts`.
- Cliente de servidor en `lib/supabase/server.ts`, con `createServerClient` y la gestión de cookies mediante `cookies()` de `next/headers`. Queda creado pero sin ningún consumidor todavía.
- Componente temporal `components/supabase-check.tsx`, montado en `app/layout.tsx`, que comprueba la conexión (`getSession()` y `/auth/v1/health`) y escribe el resultado con `console.log` en la consola del navegador. Se elimina cuando ya no haga falta.
- Variables de entorno `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, documentadas en `.env.example` y definidas en `.env.local`.
- Verificación de que la conexión funciona contra el proyecto remoto, sin escribir ni leer tablas.

**Fuera de alcance (para futuras specs):**

- Cualquier cambio en la base de datos: tablas, migraciones, RLS, triggers, funciones y `supabase/migrations/`.
- Tipos generados (`database.types.ts`) y modelos de datos.
- Autenticación (registro, login, logout, `SessionProvider` sobre Supabase). La sesión simulada `av_user` y las puntuaciones `av_scores` no se tocan.
- `proxy.ts` (refresco de sesión) y cualquier uso del cliente de servidor.
- Realtime y Edge Functions.
- Cambios en pantallas, rutas o estilos, y en componentes salvo el `SupabaseCheck` temporal (sin salida visual).
- Supabase local con Docker y CLI.
- Tests automatizados.

## Modelo de datos

Esta feature no introduce datos ni estructuras nuevas: no hay tablas, modelos ni tipos de dominio.

Solo hay dos módulos y dos variables de entorno:

```ts
// lib/supabase/client.ts
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
```

```ts
// lib/supabase/server.ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Llamado desde un Server Component: no se pueden escribir cookies.
            // Se ignora; el refresco de sesión lo hará proxy.ts en otra spec.
          }
        },
      },
    },
  );
}
```

Variables de entorno (`.env.local` no versionado; `.env.example` sí, sin valores reales):

```
NEXT_PUBLIC_SUPABASE_URL=https://xxfgpzljuglpfyqshcps.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
```

Convenciones:

- Solo se usa la clave publicable. La `service_role` nunca entra en el repositorio ni en el bundle.
- La URL y la clave publicable se obtienen con `get_project_url` y `get_publishable_keys` del MCP de Supabase.
- `SUPABASE_DB_PASSWORD` (ya presente en `.env.example`) no la lee la app; se deja como está.
- Cada módulo exporta una función `createClient`: la de `client.ts` es síncrona (navegador) y la de `server.ts` es asíncrona porque `cookies()` lo es. Nada instancia Supabase fuera de esos dos archivos.
- `server.ts` solo debe importarse desde código de servidor (Server Components, Server Actions, Route Handlers) y se crea un cliente nuevo por petición, nunca uno global.
- Sin tipado de `Database` (`createClient()` sin genérico), porque aún no hay esquema.

## Plan de implementación

Antes del paso 1, leer en `node_modules/next/dist/docs/01-app` la guía de variables de entorno (`NEXT_PUBLIC_*`) y la referencia de Client Components. Los nombres de archivo son la propuesta de esta spec.

1. Instalar `@supabase/supabase-js` y `@supabase/ssr`. Verificación: aparecen en `package.json` y `npm run build` sigue pasando.
2. Obtener la URL y la clave publicable con el MCP, crear `.env.local` con ambas y añadir las dos variables con valores de ejemplo a `.env.example`. Verificación: `git status` muestra `.env.example` modificado y `.env.local` ignorado.
3. Crear `lib/supabase/client.ts` con `createClient`. Verificación: `npx tsc --noEmit` pasa.
4. Comprobar la conexión con un script de un solo uso (en el directorio temporal, no en el repo) que cree el cliente con esas variables y llame a `supabase.auth.getSession()` y a `GET <URL>/auth/v1/health` con la clave publicable. Verificación: la sesión es `null` sin error y el health devuelve 200.
5. Confirmar que nada cambia en la app. Verificación: `npm run lint` y `npm run build` pasan y `git diff` solo toca `package.json`, `package-lock.json`, `.env.example` y `lib/supabase/client.ts`.
6. Crear `lib/supabase/server.ts` con `createClient` asíncrona: `createServerClient` con las dos variables de entorno y `getAll`/`setAll` sobre `cookies()` de `next/headers`. Antes, leer en `node_modules/next/dist/docs/01-app` la referencia de `cookies`. Verificación: `npx tsc --noEmit`, `npm run lint` y `npm run build` pasan, y `git diff` solo añade ese archivo a los del paso 5.
7. Crear `components/supabase-check.tsx` (cliente, temporal) y montarlo en `app/layout.tsx`: al cargar la app llama a `createClient().auth.getSession()` y a `GET <URL>/auth/v1/health`, y escribe el resultado con `console.log` (o `console.error` si falla). Verificación: con `npm run dev`, la consola del navegador muestra `[Supabase] Conexión OK` y `npm run lint` y `npm run build` pasan.

## Criterios de aceptación

- [ ] `@supabase/supabase-js` y `@supabase/ssr` están en las dependencias de `package.json`.
- [ ] `lib/supabase/client.ts` exporta `createClient` (síncrona, `createBrowserClient`) y `lib/supabase/server.ts` exporta `createClient` (asíncrona, `createServerClient` con `getAll`/`setAll` sobre `cookies()` de `next/headers`); son los únicos archivos que instancian Supabase.
- [ ] `lib/supabase/server.ts` no tiene directiva `"use client"` y ningún componente cliente lo importa.
- [ ] `.env.example` documenta `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` sin valores reales.
- [ ] `.env.local` contiene ambas variables y no está versionado.
- [ ] Con las variables definidas, `supabase.auth.getSession()` responde sin error (sesión `null`).
- [ ] `GET <URL>/auth/v1/health` con la clave publicable devuelve 200.
- [ ] `public` no tiene tablas nuevas, no existe `supabase/migrations/` y no hay tipos generados.
- [ ] Ninguna pantalla, ruta ni estilo ha cambiado y no hay otros componentes modificados salvo el montaje de `SupabaseCheck` en el layout; `av_user` y `av_scores` siguen funcionando igual.
- [ ] Al cargar cualquier página con `npm run dev`, la consola del navegador muestra `[Supabase] Conexión OK` con sesión `null`; con una variable ausente muestra un `console.error` claro.
- [ ] El log no imprime la clave publicable.
- [ ] La clave `service_role` no aparece en el repo ni en el bundle del cliente.
- [ ] `npm run build` y `npm run lint` terminan sin errores.

## Decisiones

- **Sí:** limitar la spec a la conexión. Deja una base verificada sobre la que construir y evita mezclar esquema, auth y tiempo real en un solo cambio.
- **No:** crear tablas, migraciones o tipos en esta spec. Decisión explícita del usuario; el diseño del esquema se hará cuando se sepa qué datos hacen falta.
- **No:** implementar auth ahora. La sesión simulada sigue vigente; cambiarla es una spec propia.
- **Sí:** `@supabase/ssr` con `createBrowserClient`. Es el cliente recomendado para Next.js y sirve de base cuando se añada el cliente de servidor.
- **Sí:** crear ya el cliente de servidor (`lib/supabase/server.ts`), aunque nada lo use todavía. Decisión del usuario posterior a la primera redacción; deja la conexión completa (navegador y servidor) lista para las siguientes specs.
- **No:** `proxy.ts`. Sin lecturas de sesión en servidor no tiene consumidor; por eso `setAll` ignora el error de escritura de cookies en Server Components.
- **Sí:** llamar `createClient` también en `server.ts`, por coherencia con `client.ts`; el contexto (servidor o navegador) lo da la ruta del import.
- **Sí:** clave publicable (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`). Es la clave diseñada para exponerse en el cliente y la seguridad real la dará RLS más adelante.
- **No:** `service_role` en el proyecto. Se saltaría RLS y nunca debe llegar al navegador.
- **Sí:** verificar la conexión con un script temporal y no con una ruta o página de prueba. No deja código muerto en la app ni cambia el alcance visual.
- **Sí:** además, un componente cliente temporal `SupabaseCheck` con `console.log`, a petición del usuario, para ver la conexión en la consola mientras se desarrolla. Un log dentro de `createClient` no se ejecutaría porque nadie la llama aún, y no probaría la conexión.
- **No:** un `instrumentation.ts` o una ruta de prueba. El componente cubre el navegador sin añadir rutas y se borra fácilmente.
- **Sí:** proyecto remoto ya enlazado por `.mcp.json`. No hace falta Supabase local.

## Riesgos

| Riesgo                                                                             | Mitigación                                                                                                                                  |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Variables ausentes o mal escritas y el `!` de TypeScript oculta el error.          | El paso 4 y el criterio de aceptación comprueban la conexión real con las variables definidas.                                              |
| La clave `service_role` o una clave real acaban en git o en el cliente.            | Solo se usa la clave publicable; `.env.example` lleva valores de ejemplo y `.env*` está en `.gitignore`.                                    |
| Se confunde la clave publicable nueva (`sb_publishable_…`) con la `anon` heredada. | La clave se obtiene con `get_publishable_keys`, que devuelve la vigente del proyecto.                                                       |
| `cookies()` solo se puede leer en tiempo de petición con `cacheComponents`.        | `createClient` de `server.ts` es asíncrona y no se usa todavía; quien la llame deberá hacerlo bajo `<Suspense>` o fuera del shell estático. |
| Importar `server.ts` desde un componente cliente rompe el build (`next/headers`).  | Criterio de aceptación: ningún componente cliente lo importa.                                                                               |

## Qué **no** está en esta spec

- Tablas, migraciones, RLS, tipos y modelos de datos.
- Autenticación y perfiles de jugador.
- Puntuaciones y ranking en base de datos.
- `proxy.ts` y cualquier uso del cliente de servidor.
- Realtime y Edge Functions.
- Cambios en la interfaz.
- Tests automatizados.

Cada uno, si llega, va en su propia spec.
