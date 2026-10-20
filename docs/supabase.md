# Supabase y acceso compartido con Docker

**Despliegue actual:** el backend se adaptó y desplegó en [Supabase Edge Functions](supabase-edge.md), junto con PostgreSQL y Storage privado. Esa guía describe la instalación activa, acceso local y respaldos. El resto de este documento conserva la alternativa con servidor Node y Docker.

SICA puede usar PostgreSQL alojado en un proyecto nuevo de Supabase. Los usuarios acceden a una misma URL HTTPS de SICA; el navegador habla con el servidor Node y éste conecta a PostgreSQL. Las cuentas, permisos, sesiones, auditoría y transacciones siguen siendo los de SICA. No se necesitan claves `anon` ni `service_role` en el frontend.

La alternativa Docker contiene el servidor Node 24 y los archivos web en una imagen, un proxy Caddy con [HTTPS automático](https://caddyserver.com/docs/automatic-https) y un volumen privado para las claves y respaldos. Supabase aloja la base. Esta alternativa necesita una máquina o proveedor con Docker, un dominio y DNS apuntando a esa máquina. La adaptación Edge utiliza el mismo dominio y rutas mediante un adaptador Fetch y Storage para archivos persistentes.

**Estado de Docker:** archivos y herramientas preparados; la imagen no está publicada en una máquina remota. El backend Edge y la base sí tienen un despliegue remoto propio. ARCA permanece deshabilitado en ambas configuraciones.

## 1. Proyecto nuevo en Supabase

Conectar la cuenta de Supabase en Codex para poder crear el proyecto desde esta conversación, o crearlo desde el panel de Supabase. Elegir la organización, región y plan de la cuenta y guardar la contraseña PostgreSQL en un gestor de secretos. No enviar contraseñas por chat ni agregarlas al repositorio.

En **Connect → Session pooler**, copiar la URI completa del proyecto, con puerto **5432**, base `postgres` y usuario `postgres.REFERENCIA`. Copiar el host del panel; no calcularlo a partir de la región. La conexión directa, también con 5432, es válida cuando el servidor tiene conectividad al endpoint directo. El pooler de sesión permite conectar por IPv4. **No utilizar Transaction pooler ni el puerto 6543**: SICA conserva bloqueos de sesión durante el procesamiento fiscal y necesita estado de sesión estable. [Conexiones de Supabase](https://supabase.com/docs/guides/database/connecting-to-postgres).

La conexión remota exige TLS y verifica el certificado y el nombre del servidor. `sslmode=require` se endurece a verificación completa. Si la cadena no usa una CA del sistema, descargar el certificado raíz desde la configuración de base de Supabase, guardarlo en `deploy/certificates/supabase-ca.crt` y configurar su ruta dentro del contenedor. Nunca desactivar la verificación. Activar también la exigencia de SSL en Supabase.

## 2. Configuración privada

Crear `.env` desde `.env.example` en la raíz del proyecto y limitar su lectura al operador. Para Docker, ajustar al menos:

```dotenv
SICA_DOMAIN=sica.ejemplo.com
SICA_DATABASE_URL=postgresql://postgres.REFERENCIA:CLAVE_CODIFICADA@HOST_COPIADO_DEL_PANEL:5432/postgres
SICA_DATABASE_POOL_SIZE=4
SICA_COMPANY_ID=sica
SICA_ADMIN_PASSWORD=CONTRASENA_INICIAL_UNICA_DE_AL_MENOS_12_CARACTERES
# Sólo si hace falta una CA propia:
# SICA_DATABASE_SSL_CA_FILE=/app/certificates/supabase-ca.crt
```

Codificar los caracteres reservados de la contraseña para escribirla dentro de una URI. `SICA_DATABASE_SSL_CA` permite proporcionar el PEM completo mediante un secreto de entorno como alternativa al archivo; elegir una sola fuente. Ninguna de estas variables debe comenzar con `VITE_`. La imagen se compila sin `.env`, bases locales, claves o respaldos: `.dockerignore` usa una lista de archivos permitidos. No publicar la salida completa de `docker compose config` ni `docker inspect`, porque pueden mostrar secretos.

El pool permite de 1 a 20 conexiones **por empresa y proceso**; con cuatro y una empresa, el servidor abre hasta cuatro. Considerar ese total al configurar el límite del proyecto. Para la instalación inicial, mantener una instancia de la aplicación y conservar su volumen. Una futura ampliación a varias réplicas necesita distribuir de forma segura la misma clave original de cada empresa.

## 3. Construir y preparar la base

Con Docker accesible al operador, ejecutar desde la raíz del proyecto:

```bash
docker compose --env-file .env -f deploy/compose.yaml build app
docker compose --env-file .env -f deploy/compose.yaml run --rm --no-deps app node scripts/supabase-prepare.mjs
```

El segundo comando aplica las mismas migraciones versionadas que usa el servidor, verifica el esquema y restringe sus permisos. No crea una empresa, no carga demostraciones y no contacta a ARCA. También puede ejecutarse sin Docker con Node 24: `npm run supabase:prepare`.

El esquema `sica` es interno: no añadirlo a los esquemas expuestos de la Data API. Al migrar, SICA revoca acceso a `PUBLIC`, `anon`, `authenticated` y `service_role` sobre ese esquema, sus tablas, secuencias y funciones, y los permisos predeterminados del rol migrador para nuevos objetos. No modifica los esquemas `public`, `auth` o `storage` de Supabase. El servidor experimental utiliza el rol propietario para migraciones y operaciones; sus credenciales se conservan exclusivamente en el backend. [Seguridad de la Data API](https://supabase.com/docs/guides/api/securing-your-api).

**Si se van a conservar operaciones existentes, completar la migración o recuperación antes del primer arranque.** No iniciar una empresa vacía y luego intentar sobrescribirla. Ver [migración y recuperación PostgreSQL](postgresql.md); copiar la fuente y su `.audit-key` juntas y conservar el código original. Una opción dentro de Docker es montar temporalmente la carpeta de origen en sólo lectura:

```bash
docker compose --env-file .env -f deploy/compose.yaml run --rm --no-deps \
  -v /ruta/privada/origen:/migration:ro app \
  node scripts/postgres-data.mjs migrate --source /migration/sica.sqlite --company sica \
  --reason "Migración inicial a Supabase"
```

El comando conserva la clave original en el volumen de SICA, revoca las sesiones copiadas y rechaza un destino que ya contenga esa empresa. Detener las escrituras en la instalación anterior antes del cambio definitivo. Los archivos históricos de las pruebas no se seleccionan automáticamente como la empresa activa.

## 4. Publicar y dar acceso

Configurar DNS para `SICA_DOMAIN` hacia la máquina Docker y permitir los puertos 80 y 443. El proxy necesita resolver ese dominio y obtener el certificado HTTPS. Luego:

```bash
docker compose --env-file .env -f deploy/compose.yaml up -d
docker compose --env-file .env -f deploy/compose.yaml ps
```

Ingresar en `https://DOMINIO_ELEGIDO` con `admin` y la contraseña inicial elegida. Crear una cuenta individual por persona desde la gestión de usuarios y asignar sus permisos. Todos usan esa misma URL y la misma base compartida. Las operaciones simultáneas mantienen revisión, idempotencia y bloqueos; una revisión desactualizada pide actualizar antes de volver a guardar.

El proxy es el único servicio que publica puertos; Node queda en la red interna, con cookies `Secure` y origen HTTPS exacto. El contenedor de aplicación ejecuta como usuario sin privilegios, con raíz de sólo lectura y volumen de datos escribible. `/api/health` comprueba que PostgreSQL responda y permite supervisar la instancia. `PORT` se admite para otros proveedores cuando no se especifica `SICA_PORT`.

## 5. Conservar claves y respaldos

El volumen `sica-experimental_sica-data` conserva `/app/var`, incluyendo `postgres/EMPRESA.audit-key` y `postgres/backups/`. El temporizador crea copias cada 24 horas mientras el proceso está activo. Para generar una copia completa inmediatamente:

```bash
docker compose --env-file .env -f deploy/compose.yaml exec app node scripts/postgres-data.mjs backup
docker compose --env-file .env -f deploy/compose.yaml cp app:/app/var/postgres/backups ./copias-sica
```

Guardar esas copias y sus archivos `.audit-key` en almacenamiento privado independiente de la máquina. Se verifican sin conexión mediante `npm run postgres:data -- verify --source ARCHIVO.sica-pg.json --company sica`. Para recuperar se necesitan el respaldo y su clave original. Un respaldo PostgreSQL de Supabase por sí solo **no incluye la clave externa de SICA**. La carpeta descargada contiene datos privados: no subirla al repositorio ni a un almacenamiento público.

Para actualizar la aplicación, volver a construir y ejecutar `up -d` conservando el volumen. `docker compose down` conserva los volúmenes; **no ejecutar `down -v`**, que los elimina. Ver [persistencia de volúmenes Docker](https://docs.docker.com/engine/storage/volumes/). Si se pierde la clave de una empresa existente, el arranque falla y requiere recuperar la original. No generar una sustituta.

## Verificación reproducible

`npm run test:cloud` verifica TLS con PostgreSQL real temporal, rechazo de certificados no confiables y del pooler de transacciones, permisos de roles de Supabase simulados localmente, reinicio con clave persistente, copia completa y entrada real del servidor con cookies seguras. No se conecta a Supabase ni a ARCA. `npm run test:all` incluye esta suite y las pruebas anteriores; la conexión remota, el certificado HTTPS público y la imagen Docker requieren su propia comprobación al publicar.
