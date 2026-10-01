# CRM de prospección Devly

CRM web para gestionar prospectos de negocios locales con cuentas individuales y un tablero compartido por equipo. Usa Vite, JavaScript vanilla y Supabase (Auth + PostgreSQL con RLS).

## Configurar Supabase

1. Crea un proyecto en Supabase.
2. En **SQL Editor**, ejecuta el contenido de `supabase/schema.sql`. El script crea equipos, membresías, prospectos, invitaciones y el historial de actividad con políticas RLS.
3. Copia la plantilla de variables:

```powershell
Copy-Item .env.example .env.local
```

4. Completa `.env.local` con la URL del proyecto y su clave `anon` o `publishable`:

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-clave-publicable
```

No uses ni publiques la clave `service_role`. Reinicia Vite si cambias `.env.local`.

En **Authentication > URL Configuration**, configura como `Site URL` la URL local o la URL principal del sitio y agrega las URLs de desarrollo y Netlify a `Redirect URLs` para confirmar correos.

## Usuarios del equipo

- Cada persona crea su cuenta con su propio correo y contraseña.
- La primera cuenta crea el espacio compartido y recibe un código de invitación.
- El resto crea su cuenta y se une con ese código.
- Todos los miembros pueden ver y gestionar los prospectos del equipo. RLS impide acceder a datos de otros equipos.
- El historial registra quién creó, editó, contactó, cambió el estatus o eliminó cada negocio. El historial se genera en PostgreSQL.

Mantén privado el código de invitación: cualquier persona que lo tenga puede unirse al equipo.

Si había prospectos guardados en `localStorage`, la app intenta importarlos una sola vez al iniciar sesión y elimina la copia local cuando la importación termina correctamente.

## Desarrollo

```powershell
npm install
npm run dev
```

## Publicar en Netlify

- Build command: `npm run build`
- Publish directory: `dist`
- Define `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en las variables de entorno del sitio y vuelve a desplegar.
- Agrega el dominio de Netlify a las `Redirect URLs` de Supabase Auth.

También puedes probar el build localmente:

```powershell
npm run build
npm run preview
```

El resultado de producción queda en `dist/`. La métrica “Mensajes enviados hoy” cuenta contactos que el usuario registra manualmente; abrir WhatsApp no confirma que se haya enviado un mensaje.
