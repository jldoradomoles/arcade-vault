## Checklist de seguridad básico

- [x] RLS: Row Level Security habilitado en `games`, `scores` y `profiles`
- [ ] Minimum password length — mínimo 8 caracteres (**Dashboard → Auth → Password settings**)
- [ ] Leaked password protection — (**Dashboard → Auth → Password settings** → activar HaveIBeenPwned)
- [ ] Max signup rate — limitar signups por IP (**Dashboard → Auth → Rate limits**)
- [x] Headers de seguridad en Next.js (`next.config.ts` — X-Frame-Options, HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy)

## Por el lado de Supabase (requiere dashboard):

1. **Minimum password length**: Authentication → Sign In / Up → Password → mínimo 8 caracteres
2. **Leaked password protection**: Authentication → Sign In / Up → Password → activar "Prevent use of leaked passwords"
3. **Max signup rate**: Authentication → Rate Limits → ajustar "Signups per hour"

## Advisors activos (ignorados intencionalmente):

- `anon_security_definer_function_executable` / `authenticated_security_definer_function_executable` → función `public.rls_auto_enable()` — **aceptada como excepción** (event trigger interno, `SET search_path TO 'pg_catalog'`, no expone datos sensibles ni acepta parámetros del usuario)
- `auth_leaked_password_protection` — **pendiente de resolución en Dashboard** (HaveIBeenPwned no habilitado; registrado también como tarea pendiente en el checklist principal)

## Auditorias

### [2026-10-29] — completa (rama login-security)

- RLS activo en todas las tablas publicas: `games`, `profiles`, `scores` (rowsecurity = true en las tres).
- Funcion SECURITY DEFINER `handle_new_user` tiene `SET search_path TO ''` correctamente — sin riesgo de search_path injection.
- Funcion SECURITY DEFINER `rls_auto_enable` usa `SET search_path TO 'pg_catalog'` y esta aceptada como excepcion documentada.
- Headers de seguridad en `next.config.ts` completos y correctos: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Strict-Transport-Security: max-age=63072000` (2 años, con `includeSubDomains; preload`), `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`.
- Middleware `proxy.ts`: llama a `getClaims()` en cada peticion, matcher cubre todas las rutas de la aplicacion, sin bypass de verificacion de sesion antes del check de autenticacion.
- `components/auth-form.tsx`: validacion de contrasena con 5 reglas (longitud minima 8, mayuscula, minuscula, digito, caracter especial), regex de username `^[A-Za-z0-9_]{3,10}$` aplicado antes de llamar a Supabase, sin credenciales ni secretos hardcodeados.
- Sin ocurrencias de `SERVICE_ROLE` ni `SUPABASE_DB_PASSWORD` en `components/` ni en `app/` — no hay filtracion de credenciales de servidor al bundle cliente.
- Advisors activos `anon_security_definer_function_executable` y `authenticated_security_definer_function_executable` corresponden a la excepcion ya documentada (`rls_auto_enable`). Sin advisors nuevos fuera de lo documentado.
- Advisor `auth_leaked_password_protection`: HaveIBeenPwned deshabilitado en Dashboard — pendiente de activar manualmente (no es accionable desde codigo).
- Migraciones auditadas hasta `20261029123432_profiles_update_own` — no se detectaron tablas nuevas sin RLS ni funciones SECURITY DEFINER sin `search_path` en las ultimas migraciones.
- Falta cabecera `Content-Security-Policy` en `next.config.ts` — recomendacion no bloqueante para endurecer la proteccion contra XSS.
