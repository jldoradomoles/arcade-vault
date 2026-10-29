# SPEC 12 — Autenticación OAuth: Google y GitHub

> **Status:** aprobada
> **Depends on:** SPEC 04
> **Date:** 2026-10-29
> **Objective:** Conectar los botones de Google y GitHub ya existentes en `/acceso` con Supabase OAuth, añadir un flujo de onboarding de username para nuevos usuarios y proteger las rutas que lo requieren.

## Por qué existe esta spec

`auth-form.tsx` ya renderiza los botones "◆ GOOGLE" y "▣ GITHUB" (líneas 151–157) pero no tienen handler: son placeholders sin funcionalidad. Esta spec los conecta al proveedor OAuth de Supabase, maneja el callback, y resuelve la única incompatibilidad estructural: el esquema actual exige un username de 3-10 caracteres en el momento del registro, mientras que los proveedores OAuth no lo proporcionan.

## Prerrequisitos (manuales, fuera del alcance de la implementación)

Antes de implementar, el desarrollador debe:

1. **Google OAuth App:** crear un cliente OAuth 2.0 en Google Cloud Console con el `Authorized redirect URI` que Supabase genera para el proyecto (`https://<project-ref>.supabase.co/auth/v1/callback`).
2. **GitHub OAuth App:** crear una GitHub OAuth App en GitHub → Settings → Developer settings → OAuth Apps con la misma Callback URL.
3. **Supabase dashboard:** habilitar ambos proveedores en Authentication → Providers, pegando el `Client ID` y `Client Secret` de cada app.
4. **URL de site:** en Supabase Authentication → URL Configuration, añadir `http://localhost:3000` (dev) y el dominio de producción en Redirect URLs.

## Alcance

**Dentro:**

- Conectar los botones existentes en `auth-form.tsx` con `signInWithProvider`.
- Exponer `signInWithProvider` en `components/session-provider.tsx`.
- Ruta de callback OAuth `app/auth/callback/route.ts`.
- Migración SQL que hace `username` nullable en `profiles`.
- Ajuste del trigger `handle_new_user` para insertar `NULL` cuando no hay username en los metadatos.
- Ruta de onboarding `app/completar-perfil/page.tsx` con `app/completar-perfil/actions.ts` para que el usuario OAuth elija su username.
- Guard en `proxy.ts`: si el usuario está autenticado pero su perfil tiene `username IS NULL`, redirige a `/completar-perfil` antes de servir cualquier ruta protegida.
- Regenerar `lib/supabase/database.types.ts` tras la migración.

**Fuera de alcance (para futuras specs):**

- Otros proveedores OAuth (Twitter/X, Discord…).
- Edición de username después del onboarding inicial (requiere pantalla de perfil).
- Vinculación de cuenta OAuth con una cuenta email existente (identity linking de Supabase).
- Magic link / autenticación sin contraseña.
- Tests automatizados.

## Modelo de datos

**Migración:** `supabase/migrations/YYYYMMDDHHMMSS_oauth_username_nullable.sql`

```sql
ALTER TABLE public.profiles ALTER COLUMN username DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'username'  -- NULL para OAuth, valor para email+pass
  );
  RETURN new;
END;
$$;
```

`username` pasa a ser `text | null` en `profiles`. El constraint de formato (`^[A-Za-z0-9_]{3,10}$`) sigue en la lógica de aplicación y se aplica únicamente al registrarse por email o al completar el onboarding OAuth.

**Tipos afectados:** `lib/supabase/database.types.ts` — regenerar con el MCP tool de Supabase tras aplicar la migración.

## Plan de implementación

Leer `node_modules/next/dist/docs/01-app` (routing y route handlers) antes del paso 3. Cada paso deja el proyecto compilando.

1. **Migración SQL.** Crear `supabase/migrations/YYYYMMDDHHMMSS_oauth_username_nullable.sql` con el `ALTER COLUMN` y la nueva versión del trigger. Aplicar con el MCP de Supabase. Regenerar `lib/supabase/database.types.ts`. Verificación: `npx tsc --noEmit`.

2. **`signInWithProvider` en session-provider.** En `components/session-provider.tsx`, añadir la función `signInWithProvider(provider: "google" | "github")` que llama a `supabase.auth.signInWithOAuth({ provider, options: { redirectTo: \`\${origin}/auth/callback\` } })`. Exponer en el contexto. Verificación: `npx tsc --noEmit`.

3. **Callback route.** Crear `app/auth/callback/route.ts` como Route Handler (GET). Llama a `supabase.auth.exchangeCodeForSession(code)`, luego consulta el perfil del usuario en `profiles`: si `username IS NULL`, redirige a `/completar-perfil`; si tiene username, redirige a `/`. Verificación: `npx tsc --noEmit`.

4. **Conectar botones en `auth-form.tsx`.** Añadir `signInWithProvider` al destructuring de `useSession`. En los botones de GOOGLE y GITHUB, añadir `onClick={() => signInWithProvider('google')}` y `onClick={() => signInWithProvider('github')}` respectivamente. Verificación: `npx tsc --noEmit` y `npm run lint`.

5. **Ruta `/completar-perfil`.** Crear `app/completar-perfil/page.tsx` (Server Component con un Client Component para el formulario). Muestra un input de username con la validación `^[A-Za-z0-9_]{3,10}$`. Al enviar, llama a la Server Action en `app/completar-perfil/actions.ts` que hace `UPDATE profiles SET username = $1 WHERE id = $2` y redirige a `/`. Si el usuario ya tiene username, la página redirige a `/`. Verificación: `npx tsc --noEmit`.

6. **Guard en `proxy.ts`.** Tras `getClaims()`, si hay sesión activa, consultar el perfil. Si `username IS NULL` y la ruta actual no es `/completar-perfil` ni empieza por `/auth/`, redirigir a `/completar-perfil`. Verificación: `npx tsc --noEmit`.

7. **Verificación final.** Probar flujo completo con Google y GitHub en dev: click en botón → proveedor OAuth → callback → `/completar-perfil` → elegir username → `/`. Verificar que el login email+contraseña sigue funcionando sin cambios. Ejecutar `npm run build`. Verificación: `npm run build` sin errores.

## Criterios de aceptación

- [ ] `npm run build`, `npm run lint` y `npx tsc --noEmit` terminan sin errores.
- [ ] El login con email + contraseña sigue funcionando igual que antes de esta spec.
- [ ] Click en "◆ GOOGLE" redirige al flujo OAuth de Google.
- [ ] Click en "▣ GITHUB" redirige al flujo OAuth de GitHub.
- [ ] Tras autenticarse por primera vez con un proveedor OAuth, el usuario llega a `/completar-perfil`.
- [ ] `/completar-perfil` valida el username con `^[A-Za-z0-9_]{3,10}$` y muestra error si no cumple.
- [ ] Tras elegir username, el perfil queda actualizado en `profiles` y el usuario llega a `/`.
- [ ] Un usuario OAuth que ya eligió username no vuelve a ver `/completar-perfil` en logins posteriores.
- [ ] Un usuario OAuth sin username que navega a `/juegos/[id]/jugar` es redirigido a `/completar-perfil`.
- [ ] Los usuarios registrados con email (con username existente) no son afectados por el guard.
- [ ] La columna `username` en `profiles` admite `NULL` (verificable en Supabase dashboard).
- [ ] `lib/supabase/database.types.ts` refleja `username: string | null` tras la migración.

## Decisiones tomadas y descartadas

- **Sí:** OAuth complementa, no sustituye, el formulario email+username. El formulario existente sigue disponible para usuarios que prefieren no usar cuentas de Google/GitHub.
- **Sí:** onboarding en ruta dedicada `/completar-perfil` en lugar de modal. Más simple de implementar; un modal requeriría estado global o contexto para dispararse desde cualquier ruta.
- **Sí:** `username = NULL` hasta el onboarding. La columna pasa a nullable; es semánticamente más limpio que un string vacío y evita que el trigger falle para OAuth.
- **Sí:** guard en `proxy.ts`. Garantiza que no se pueda acceder a rutas protegidas sin username, sin necesidad de checks duplicados en cada ruta o layout.
- **No:** identity linking (vincular OAuth a cuenta email existente). Supabase lo soporta pero añade complejidad de UX (¿qué pasa si el email ya existe?) que merece su propia spec.
- **No:** editar username después del onboarding. Requiere una pantalla de perfil que no existe todavía; se deja para una spec futura.
- **No:** otros proveedores OAuth. Se limita a los dos que ya tienen botón en la UI. Añadir más es trivial una vez este flujo funcione.
- **No:** automatizar la configuración de las apps en Google/GitHub/Supabase. Son pasos manuales en consolas externas; documentarlos como prerrequisitos es más honesto que intentar automatizarlos.

## Riesgos identificados

| Riesgo                                                                                                            | Mitigación                                                                                                                                                                                       |
| ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| El email de OAuth ya existe en `auth.users` (registro previo con email+contraseña)                                | Supabase lanza error de duplicado; mostrar mensaje y sugerir que use el formulario de email. Identity linking queda fuera de esta spec.                                                          |
| La consulta al perfil en `proxy.ts` (para el guard) añade latencia a todas las peticiones                         | Si el JWT de Supabase expone `user_metadata`, leer el username desde ahí sin consulta extra; si no, la consulta solo se hace cuando hay sesión activa y la ruta no es pública.                   |
| `raw_user_meta_data->>'username'` podría no ser NULL en algunos proveedores OAuth (GitHub puede devolver `login`) | Verificar en Supabase que para Google/GitHub el campo `username` del metadato no existe o es NULL; si el trigger lo recoge erróneamente, ajustar para ignorarlo y dejar siempre NULL para OAuth. |
| Sesión no hidratada en el callback antes de la consulta de perfil                                                 | Usar el cliente de servidor en el Route Handler y llamar `exchangeCodeForSession` antes de cualquier consulta a `profiles`.                                                                      |
