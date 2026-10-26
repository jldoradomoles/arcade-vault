# SPEC 03 — Página "Acerca de" y envío de correo de contacto con Resend

> **Status:** implementado
> **Depends on:** SPEC 01, SPEC 02
> **Date:** 2026-10-16
> **Objective:** Crear la página `/acerca-de` idéntica a `about.jsx` del template y hacer que su formulario de contacto envíe un correo real al equipo mediante Resend y una Server Action.

## Por qué existe esta spec

La spec 02 dejó "Acerca de" fuera de alcance. El template `references/templates/home-about/` define la página (`about.jsx`) con misión, tres highlights, divisor y formulario de contacto, pero su formulario solo simula el envío (`setSent`). Esta spec porta la página tal cual y sustituye la simulación por un envío real, que es lo único que se añade respecto al template.

## Alcance

**Dentro:**

- Nueva ruta `/acerca-de` con las dos secciones de `about.jsx`:
  - `▸ ACERCA DE`: título "ACERCA DE ARCADE VAULT", texto de misión y 3 highlights con icono pixel (`HEART`, `BROWSER`, `PLANT`).
  - Divisor animado de 24 píxeles.
  - `▸ CONTACTO`: texto introductorio, 3 "tips" con LED y formulario (nombre, correo, mensaje).
- Textos, estructura, clases y retardos de transición idénticos al template (`transitionDelay: i * 80ms` en los highlights, `animationDelay: i * 80ms` en los píxeles).
- Animación "reveal" al entrar en viewport, reutilizando `components/home/reveal.tsx` de la spec 02 (o su equivalente `useReveal`).
- Estados del formulario como en el template: normal, `shake` de 400 ms cuando falta algún campo, y terminal de éxito `VAULT-OS // TERMINAL` con el nombre en mayúsculas y botón "ENVIAR OTRO MENSAJE".
- Envío real con Resend desde una Server Action: un único correo al equipo, con `reply-to` = correo del visitante.
- Validación en servidor (campos obligatorios, formato de correo, longitudes máximas) y campo honeypot oculto.
- Estado de error inline cuando el envío falla: el formulario conserva lo escrito y no pasa al terminal de éxito.
- Nav (escritorio y panel móvil): nuevo enlace "Acerca de" → `/acerca-de` como último elemento, activo con `pathname.startsWith("/acerca-de")`.
- Integrar en `app/globals.css` el bloque `ABOUT PAGE` de `references/templates/home-about/styles.css` (`.about*`, `.highlight*`, `.hl-*`, `.about-divider`, `.div-*`, `@keyframes pxblink`, `.contact-*`, `.terminal-success`, `.term-*`, `.shake`/`@keyframes shake`, `.btn.press`) más una clase nueva para el error.
- Configuración mediante variables de entorno: `RESEND_API_KEY`, `CONTACT_TO_EMAIL`, `CONTACT_FROM_EMAIL`, documentadas en `.env.example`.
- Instalar la dependencia `resend`.

**Fuera de alcance (para futuras specs):**

- Correo de confirmación al visitante: con el remitente `onboarding@resend.dev` Resend solo entrega a la cuenta propietaria, así que no llegaría a terceros. Queda para cuando haya un dominio verificado.
- Verificación de dominio en Resend y remitente propio.
- Rate limiting por IP o CAPTCHA.
- Guardar los mensajes en base de datos o panel de administración.
- Plantillas de correo con React Email; el correo es HTML/texto simple.
- Prerrellenar el nombre con la sesión simulada (`av_user`): los campos empiezan vacíos, como en el template.
- Cambiar los textos o rediseñar secciones del template.
- Tests automatizados e internacionalización.

## Modelo de datos

No hay persistencia. Solo un contrato de la Server Action y variables de entorno.

```ts
// lib/contact.ts
export const CONTACT_LIMITS = { name: 60, email: 120, message: 2000 } as const;

export interface ContactInput { name: string; email: string; message: string }

export type ContactResult =
  | { ok: true; name: string }
  | { ok: false; error: "invalid" | "send_failed" };
```

```ts
// app/acerca-de/actions.ts  ("use server")
export async function sendContactMessage(formData: FormData): Promise<ContactResult>;
```

Variables de entorno (`.env.local`, no versionado; `.env.example` sí):

```
RESEND_API_KEY=re_xxx
CONTACT_TO_EMAIL=jldoradomoles@gmail.com
CONTACT_FROM_EMAIL=Arcade Vault <onboarding@resend.dev>
```

Convenciones:

- Los campos del formulario son `name`, `email`, `msg` y el honeypot `website`.
- Se hace `trim()` a los tres campos; se rechazan vacíos o por encima de `CONTACT_LIMITS`.
- Si el honeypot llega con contenido, la acción devuelve `{ ok: true }` sin enviar nada (el bot no recibe pista).
- El asunto del correo es `[Arcade Vault] Mensaje de <nombre>`.
- El nombre y el mensaje se escapan antes de incrustarse en el HTML del correo.
- La clave de Resend solo se lee en el servidor; nunca lleva prefijo `NEXT_PUBLIC_`.

## Plan de implementación

Antes del paso 1, leer la guía relevante en `node_modules/next/dist/docs/01-app` (Server Actions y formularios, `useActionState`, Client Components, `cacheComponents`). Usar la skill `/frontend-design` solo si hace falta decidir detalles visuales del estado de error. Los nombres de archivo son la propuesta de esta spec.

1. Integrar en `app/globals.css` el bloque `ABOUT PAGE` del template (por nombre de clase, no por rango de líneas) y la regla nueva `.contact-error`, sin duplicar clases existentes (`.field`, `blink`, `caret`). Verificación: `npm run build` pasa y cada clase aparece una sola vez.
2. Crear `components/about/highlight-icon.tsx` con los tres iconos SVG pixel (`HEART`, `BROWSER`, `PLANT`) idénticos al template. Verificación: `npx tsc --noEmit` pasa.
3. Crear `app/acerca-de/page.tsx` con la sección Acerca de, el divisor y la sección Contacto con una versión **estática** del formulario (sin envío). Los bloques `reveal` usan `components/home/reveal.tsx`. Verificación: `/acerca-de` se ve igual que el template en escritorio.
4. Actualizar `components/nav.tsx`: enlace "Acerca de" → `/acerca-de`, último en la barra y en el panel móvil. Verificación: se marca activo en `/acerca-de` y no en las demás rutas.
5. Instalar `resend`, crear `lib/contact.ts` y `.env.example`. Verificación: `npx tsc --noEmit` pasa y `.env.local` sigue ignorado por git.
6. Crear `app/acerca-de/actions.ts` con `sendContactMessage`: validación, honeypot, llamada a Resend y manejo de errores. Verificación: con una clave válida llega el correo a `CONTACT_TO_EMAIL`; sin clave devuelve `send_failed`.
7. Crear `components/about/contact-form.tsx` (cliente) con los estados normal, `shake`, enviando, error y terminal de éxito; conectarlo a la Server Action y montarlo en la página. Verificación: el flujo completo funciona de extremo a extremo.
8. Revisión visual contra `references/templates/home-about/arcade-vault-standalone.html` en escritorio y móvil (375 px). Verificación: `npm run lint` y `npm run build` pasan.

## Criterios de aceptación

- [ ] `npm run build` y `npm run lint` terminan sin errores.
- [ ] `/acerca-de` renderiza sin errores en la consola ni de hidratación.
- [ ] La página contiene, con los textos exactos del template: kicker "▸ ACERCA DE", título, párrafo de misión, 3 highlights con icono, divisor de 24 píxeles, kicker "▸ CONTACTO", título "CONTÁCTANOS", párrafo y 3 tips.
- [ ] Comparada con `arcade-vault-standalone.html` a 1440 px y 375 px, la página no muestra diferencias visuales de maquetación, color, tipografía ni espaciado.
- [ ] El Nav muestra, en este orden, "Inicio", "Biblioteca", "Salón de la Fama", "Acerca de"; el panel móvil muestra los mismos más la cuenta.
- [ ] "Acerca de" aparece activo solo en `/acerca-de`.
- [ ] Los bloques `reveal` se hacen visibles al hacer scroll y no quedan ocultos si el observer no actúa.
- [ ] Enviar el formulario con algún campo vacío (o solo espacios) aplica `shake` durante 400 ms y no llama a Resend.
- [ ] Enviar datos válidos con la clave correcta entrega un correo a `CONTACT_TO_EMAIL` con asunto `[Arcade Vault] Mensaje de <nombre>`, cuerpo con nombre, correo y mensaje, y `reply-to` igual al correo del visitante.
- [ ] Tras el envío correcto se muestra el terminal `VAULT-OS // TERMINAL` con "MENSAJE RECIBIDO… GRACIAS, <NOMBRE EN MAYÚSCULAS>." y el botón "ENVIAR OTRO MENSAJE" vuelve al formulario vacío.
- [ ] Un correo con formato inválido o un campo por encima de `CONTACT_LIMITS` es rechazado por la Server Action con `invalid`, aunque se salte la validación del navegador.
- [ ] Con el honeypot `website` relleno no se envía ningún correo ni se llama a Resend.
- [ ] Con `RESEND_API_KEY` ausente o inválida, el formulario muestra un mensaje de error inline, conserva lo escrito y no muestra el terminal de éxito.
- [ ] `RESEND_API_KEY` no aparece en el bundle del cliente ni en la respuesta HTML.
- [ ] El texto del mensaje con HTML (`<script>`) llega escapado en el correo.
- [ ] Con ancho de 375 px no hay scroll horizontal; la grilla de contacto y los highlights colapsan a una columna.
- [ ] `.env.local` no está versionado y `.env.example` sí, sin valores reales.

## Decisiones

- **Sí:** ruta `/acerca-de`. Coherente con las rutas en español existentes (`/biblioteca`, `/salon`, `/acceso`).
- **No:** `/about`. Coincide con el template pero mezcla idiomas en las URLs.
- **Sí:** Server Action para el envío. La API key nunca llega al cliente y no hace falta mantener un endpoint.
- **No:** Route Handler `app/api/contacto`. Solo tendría sentido con consumidores externos.
- **Sí:** un único correo al equipo con `reply-to` del visitante. Se puede responder directamente desde el buzón.
- **No:** correo de confirmación al visitante. `onboarding@resend.dev` solo entrega a la cuenta propietaria, y además permitiría usar el formulario para enviar correo a terceros. Decisión tomada al definir la spec.
- **Sí:** remitente `onboarding@resend.dev` y destinatario `jldoradomoles@gmail.com` configurables por entorno. Cero configuración de DNS para empezar; cambiar de dominio no toca código.
- **No:** dominio propio verificado en esta spec.
- **Sí:** validación en servidor más honeypot. El cliente no es de fiar y el honeypot filtra bots básicos sin fricción para el usuario.
- **No:** rate limiting ni CAPTCHA. Requiere almacenamiento externo o servicio de terceros; amplía demasiado el alcance.
- **Sí:** estado de error inline que conserva lo escrito. Perder el mensaje por un fallo de red sería peor que el pequeño añadido visual sobre el template.
- **No:** reutilizar solo el `shake` para los fallos de envío; el usuario no sabría qué ha fallado.
- **Sí:** campos vacíos al cargar, sin prerrellenar con `av_user`. Idéntico al template y sin acoplar con la sesión simulada.
- **Sí:** reutilizar `components/home/reveal.tsx` y copiar solo el bloque About de `styles.css` a `globals.css`. Mantiene un único archivo de estilos, como en las specs 01 y 02.
- **Sí:** `Link` de Next en el Nav, como en el resto de enlaces.

## Riesgos

| Riesgo | Mitigación |
| ------ | ---------- |
| `onboarding@resend.dev` solo envía al correo de la cuenta Resend; si `CONTACT_TO_EMAIL` es otro, Resend rechaza el envío. | `CONTACT_TO_EMAIL` por defecto es el correo propietario; el rechazo se trata como `send_failed` y se documenta en `.env.example`. |
| La clave de Resend se filtra al cliente o al repositorio. | Solo se lee en `actions.ts` (servidor), sin prefijo `NEXT_PUBLIC_`, y `.env*` ya está en `.gitignore`. |
| Inyección de HTML en el correo a través del nombre o el mensaje. | Escapar los valores antes de insertarlos en el HTML; usar también versión de texto plano. |
| Abuso del formulario (spam al buzón del equipo). | Honeypot, límites de longitud y validación en servidor; el rate limiting queda para otra spec. |
| El `reveal` deja el contenido invisible si falla el observer o no hay JS. | Reutilizar la mitigación de la spec 02; verificar en el criterio de aceptación. |
| Copiar CSS de otras secciones o duplicar clases ya presentes (`.field`, `blink`). | Copiar por nombre de clase y comprobar que cada una aparece una sola vez. |
| Los límites de la capa gratuita de Resend (cuota diaria/mensual) pueden cortar los envíos. | El error se muestra inline y no se pierde el mensaje escrito. |

## Qué **no** está en esta spec

- Correo de confirmación al visitante.
- Dominio propio verificado en Resend.
- Rate limiting, CAPTCHA y almacenamiento de mensajes.
- Plantillas de correo elaboradas.
- Prerrellenado con la sesión simulada.
- Tests automatizados e internacionalización.

Cada uno, si llega, va en su propia spec.
