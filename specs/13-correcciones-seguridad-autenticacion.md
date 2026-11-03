# SPEC 13 — Correcciones de seguridad en autenticación

> **Status:** aprobado
> **Depends on:** SPEC 04, SPEC 12
> **Date:** 2026-10-30
> **Objective:** Corregir cinco vulnerabilidades identificadas en el flujo de autenticación: validación de sesión en middleware, TypeError en setAll, cambio de username no autorizado, enumeración de cuentas por correo y ausencia de validación del código OAuth.

## Por qué existe esta spec

Una auditoría de seguridad sobre `proxy.ts`, `session-provider.tsx`, `completar-perfil/actions.ts` y `auth/callback/route.ts` identificó cinco hallazgos:

1. `proxy.ts` toma la decisión de redirección con `getSession()`, que parsea el JWT localmente sin verificar con el servidor de Supabase; un token alterado o caducado puede pasar el check si `getClaims()` falla silenciosamente.
2. El callback `setAll` de `@supabase/ssr` en `proxy.ts` llama a `Object.entries(headers)` sobre un segundo parámetro no documentado que puede ser `undefined`, lo que lanzaría un TypeError en runtime.
3. La Server Action `setUsername` en `completar-perfil/actions.ts` no verifica si el usuario ya tiene un username; un POST directo al endpoint permite cambiar el username en cualquier momento, saltando el guard del middleware.
4. `session-provider.tsx` devuelve mensajes distintos para `user_already_exists`/`email_exists` vs `invalid_credentials`, lo que permite confirmar si un correo está registrado mediante el formulario de registro.
5. El parámetro `code` en `app/auth/callback/route.ts` se pasa a `exchangeCodeForSession()` sin validación de formato ni longitud.

## Alcance

**Dentro:**

- `proxy.ts`: reemplazar `getSession()` por `getUser()` para la decisión de redirección a `/completar-perfil`.
- `proxy.ts`: añadir guardia `if (headers)` antes de `Object.entries(headers)` en el callback `setAll`.
- `app/completar-perfil/actions.ts`: leer el perfil antes del `UPDATE` y rechazar si ya tiene `username` establecido.
- `components/session-provider.tsx`: unificar los casos `user_already_exists` y `email_exists` en un mensaje genérico que no revele si el correo está registrado.
- `app/auth/callback/route.ts`: validar longitud y caracteres del parámetro `code` antes de pasarlo a Supabase.

**Fuera de alcance (para futuras specs):**

- Anti-trampas en puntuaciones (documentado en SPEC 06 como trabajo futuro).
- Edición de username tras el onboarding inicial (requiere pantalla de perfil propia).
- Rate limiting adicional en el lado del cliente para el formulario de login.
- Identity linking entre cuentas OAuth y cuentas email existentes.
- Tests automatizados de seguridad.

## Modelo de datos

Esta spec no introduce nuevas estructuras de datos ni migraciones SQL. Los cambios son exclusivamente en lógica TypeScript de los archivos ya existentes.

## Plan de implementación

Ejecutar `npx tsc --noEmit` tras cada paso para confirmar que el proyecto sigue compilando.

1. **`proxy.ts`: reemplazar `getSession()` por `getUser()`.**
   Sustituir el bloque que llama a `supabase.auth.getSession()` (línea 34) por `supabase.auth.getUser()`. Actualizar todas las referencias a `session` dentro del bloque condicional: `session.user.id` → `user.id`, `session.user.user_metadata` → `user.user_metadata`, la condición `if (session)` → `if (user)`. Verificación: `npx tsc --noEmit`.

2. **`proxy.ts`: guardia en `Object.entries(headers)`.**
   En el callback `setAll`, envolver el bloque `Object.entries(headers).forEach(...)` (línea 23) con `if (headers) { ... }`. Verificación: `npx tsc --noEmit`.

3. **`app/completar-perfil/actions.ts`: bloquear sobreescritura de username.**
   Tras obtener el `user` (línea 26) y antes del `UPDATE`, añadir:

   ```ts
   const { data: existing } = await supabase
     .from("profiles")
     .select("username")
     .eq("id", user.id)
     .maybeSingle();
   if (existing?.username) {
     return { ok: false, error: "El nombre de jugador ya está establecido." };
   }
   ```

   Verificación: `npx tsc --noEmit`.

4. **`components/session-provider.tsx`: mensaje genérico para correo duplicado.**
   En la función `authMessage`, reemplazar los casos `user_already_exists` y `email_exists` por un mensaje que no revele si el correo ya existe:

   ```ts
   case "user_already_exists":
   case "email_exists":
     return "No se pudo completar el registro. Comprueba los datos e inténtalo de nuevo.";
   ```

   Verificación: `npx tsc --noEmit` y `npm run lint`.

5. **`app/auth/callback/route.ts`: validar el parámetro `code`.**
   Justo después de leer `code` de `searchParams` (línea 13) y antes de `exchangeCodeForSession`, añadir:

   ```ts
   if (code.length > 512 || !/^[A-Za-z0-9_\-]+$/.test(code)) {
     return NextResponse.redirect(`${origin}/acceso`);
   }
   ```

   Verificación: `npx tsc --noEmit`.

6. **Verificación final.**
   Ejecutar `npm run build` y `npm run lint`. Probar manualmente: login email+contraseña, intento de registro con correo ya existente (verificar mensaje genérico), flujo OAuth completo Google o GitHub, y POST directo a la Server Action `setUsername` desde un usuario que ya tiene username (esperar `{ ok: false, error: "El nombre de jugador ya está establecido." }`).

## Criterios de aceptación

- [ ] `npm run build`, `npm run lint` y `npx tsc --noEmit` terminan sin errores.
- [ ] `proxy.ts` usa `supabase.auth.getUser()` y no `supabase.auth.getSession()` para la decisión de redirección.
- [ ] El callback `setAll` en `proxy.ts` no lanza TypeError si el segundo argumento `headers` es `undefined`.
- [ ] Un usuario autenticado con username ya establecido que llama directamente a la Server Action `setUsername` recibe `{ ok: false, error: "El nombre de jugador ya está establecido." }` sin que se modifique su perfil en `profiles`.
- [ ] Intentar crear una cuenta con un correo ya registrado devuelve el mismo mensaje genérico que un error genérico de registro, sin revelar que el correo existe.
- [ ] Una petición GET a `/auth/callback?code=<cadena_de_más_de_512_caracteres>` o con caracteres no URL-safe en `code` redirige a `/acceso` sin llegar a llamar a `exchangeCodeForSession`.
- [ ] El flujo de login con email+contraseña y el flujo OAuth completo (Google o GitHub) siguen funcionando sin cambios funcionales.
- [ ] El flujo de onboarding de username para usuarios OAuth nuevos sigue funcionando.

## Decisiones tomadas y descartadas

- **Sí:** `getUser()` en lugar de `getSession()`. `getUser()` valida el JWT contra el servidor de Supabase en cada petición; `getSession()` parsea localmente y podría aceptar tokens caducados o alterados si `getClaims()` falla silenciosamente.
- **Sí:** guardia `if (headers)` en lugar de eliminar el parámetro del callback. La librería `@supabase/ssr` podría en versiones futuras pasar cabeceras desde el servidor; conservar el handler con guardia es compatible hacia adelante.
- **Sí:** bloquear sobreescritura de username en la Server Action. El middleware ya redirige a `/` a usuarios con username, pero una Server Action es un endpoint HTTP directo que puede llamarse fuera de la navegación normal del navegador.
- **Sí:** mensaje genérico para correo duplicado. Unificar el mensaje en la capa de aplicación elimina la fuga de información independientemente de lo que el proveedor OAuth o Supabase devuelvan.
- **No:** rate limiting adicional en el cliente. Supabase gestiona sus propios límites de tasa y los códigos `over_request_rate_limit` / `over_email_send_rate_limit` ya se manejan en `authMessage`. Añadir throttling en el cliente sería redundante en esta fase.
- **No:** regex más estricta para `code` (por ejemplo, longitud exacta de 43 caracteres PKCE). La longitud exacta no está documentada de forma estable; un límite de 512 caracteres con solo caracteres URL-safe es suficientemente defensivo sin riesgo de falsos positivos con futuros proveedores.

## Riesgos identificados

| Riesgo                                                                                                             | Mitigación                                                                                                                                                                                                |
| ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `getUser()` añade una llamada de red en cada petición del middleware                                               | `getClaims()` ya realiza una llamada al servidor de Supabase; `getUser()` trabaja sobre el token ya refrescado, por lo que la latencia extra es mínima. Monitorizar si aparece degradación en producción. |
| El mensaje genérico de registro puede frustrar a usuarios legítimos que no saben si su correo ya estaba registrado | El mensaje puede sugerir la recuperación de contraseña como alternativa, sin confirmar ni desmentir la existencia del correo.                                                                             |
| La regex de validación de `code` podría bloquear proveedores OAuth futuros con formatos diferentes                 | Antes de activar un nuevo proveedor OAuth, verificar el formato exacto de su código de autorización y ajustar la regex si fuera necesario.                                                                |
