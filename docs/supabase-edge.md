# SICA en Supabase Edge Functions

El backend y la base están desplegados en **SICA Experimental**, referencia `dudraffygijvufwhqvza`, región `us-west-2`. La API es `https://dudraffygijvufwhqvza.supabase.co/functions/v1/sica-api`. El frontend React sigue siendo una aplicación Vite y se ejecuta o publica por separado.

## Usar esta instalación

La configuración local `.env` apunta al backend remoto. Con Node.js 24 o superior:

```bash
npm run dev
```

Abrir `http://127.0.0.1:5174`. El usuario inicial es `admin`; su contraseña aleatoria está en **`var/supabase-admin.local.json`**, con permisos 600 y excluido de Git. Crear cuentas individuales desde Usuarios y perfiles. La configuración inicial no carga operaciones de demostración. La verificación dejó una nota técnica identificada como `supabase-deployment-check`.

Se autorizaron los orígenes locales `http://127.0.0.1:5174`, `http://localhost:5174`, `http://127.0.0.1:4173` y `http://localhost:4173`. Para publicar el frontend, agregar su origen HTTPS exacto al archivo privado `configuration/sica.json` del bucket `sica-private` y volver a desplegar la función para renovar las instancias que ya lo hayan leído. No usar comodines. El navegador envía `forceFunctionRegion=us-west-2`, para ejecutar junto a PostgreSQL y evitar viajes repetidos desde Sudamérica. Ver [invocaciones regionales](https://supabase.com/docs/guides/functions/regional-invocation).

## Arquitectura y seguridad

La función comparte las rutas, validaciones, permisos y comandos del servidor Node. El adaptador Fetch no abre un puerto ni depende de archivos persistentes. El esquema `sica` contiene 23 tablas —14 del núcleo relacional—, tres vistas y el trigger de proyección. Se conserva la versión y checksum esperados por el servidor original.

`sica` es privado; no agregarlo a los esquemas expuestos de la Data API. Sus permisos se revocan para `PUBLIC`, `anon`, `authenticated` y `service_role`. El backend usa la conexión PostgreSQL interna del entorno, verifica TLS y conserva bloqueos de transacción y sesión. Cada instancia Edge abre como máximo una conexión. El bucket `sica-private` es privado y carece de políticas de acceso para usuarios de la API.

La función tiene `verify_jwt=false` porque autentica con las sesiones opacas de SICA: login limitado por usuario/dirección, token de 256 bits almacenado como hash en PostgreSQL, vencimiento, revocación y permisos derivados de la cuenta. Cada POST requiere origen autorizado, `X-SICA-Client` y CSRF, además del token salvo el login. El navegador conserva el token en `sessionStorage`, o `localStorage` si se elige mantener sesión; lo elimina al cerrar sesión, recibir 401 o invalidar la cuenta. La instalación Node conserva sus cookies HttpOnly originales.

`/setup` requiere una clave secreta del proyecto y sólo inicializa una instalación sin configuración. No permite reiniciar contraseñas ni reemplazar una empresa existente. La contraseña se deriva antes de guardarse y nunca se escribe en Storage. La función obtiene las claves de servidor de los [secretos internos de Supabase](https://supabase.com/docs/guides/functions/secrets). No se incorporan claves secretas al paquete ni a variables `VITE_*`. `.env` contiene una clave privada para la herramienta del operador y debe conservarse fuera del repositorio; rotar una clave compartida en el chat desde el panel de Supabase y actualizar ese archivo.

## Respaldos

Las claves de auditoría originales de 32 bytes se guardan en `sica-private/keys/EMPRESA.audit-key`. La creación es exclusiva: dos instancias adoptan el mismo archivo y no lo reemplazan. Si ya existe una empresa y falta su clave, el backend rechaza el arranque.

La primera escritura exitosa de cada día UTC genera un respaldo completo en Storage, mediante `EdgeRuntime.waitUntil`; incluye copia independiente de la clave y sello HMAC. Se registra un marcador diario después de terminar la copia. Si falla, se reintenta en la próxima escritura. No hay temporizador permanente: un día sin escrituras no genera otra copia. Configuración permite **Guardar respaldo completo en Supabase**, exclusivo del administrador. Este respaldo contiene estado, credenciales derivadas, auditoría, sesiones, idempotencia, recuperación y antecedentes fiscales.

Para recuperación independiente, descargar el archivo `.sica-pg.json` y su acompañante `.audit-key` desde Storage privado y usar el procedimiento de [PostgreSQL](postgresql.md). La importación revoca las sesiones copiadas. `npm run supabase:verify` conserva además una copia verificada en `var/supabase-verification-backup/`. Mantener otra copia privada fuera de la cuenta de Supabase; una copia de PostgreSQL no incluye el contenido de los objetos de Storage.

## Compilar y desplegar

```bash
npm ci
npm run build:edge
```

`scripts/build-edge.mjs` usa Rolldown con versión fijada para empaquetar el dominio y servidor existentes. Genera `supabase/functions/sica-api/backend.mjs` y `deploy-entry.ts`, excluidos de Git. `deno.json` fija `pg` y `saxes`. SQLite no está disponible en Edge. Se puede desplegar con el conector Supabase incluyendo `backend.mjs`, `deploy-entry.ts` como `index.ts` y `deno.json`; al actualizar, indicar explícitamente `import_map_path=deno.json`.

Con Supabase CLI instalado y autenticado, consultar primero `supabase functions deploy --help`, vincular la referencia del proyecto y desplegar `sica-api` usando `supabase/config.toml`, que apunta a la entrada generada. No hace falta configurar una clave privada en el frontend.

Para instalar en **otro proyecto vacío**, generar `npm run supabase:bootstrap` y aplicar `deploy/supabase/bootstrap.sql` dentro de una transacción; el script rechaza un esquema existente. Crear después el bucket mediante `deploy/supabase/storage.sql`. Desplegar la función y ejecutar el setup privado con una contraseña inicial y los orígenes concretos. La herramienta de esta instalación, `scripts/supabase-live.mjs`, usa los valores privados de `.env` y las credenciales locales; no cargar su salida como una migración.

## Verificar

```bash
npm run test:edge
npm run test:cloud
npm run test:server
npm run build
npm run lint
npm run supabase:verify
```

Las suites Edge y cloud usan PostgreSQL real temporal con TLS y no contactan a ARCA. La verificación remota comprueba salud, anonimato, origen, sesión, CSRF, escritura, repetición, revisión, respaldo descargado y firma HMAC, y revocación; escribe `output/supabase-live-verification.json`, sin credenciales. Esa herramienta registra una nota técnica real.

ARCA permanece deshabilitado en Edge. Su firma actual mediante OpenSSL y archivos requiere otra adaptación antes de habilitar homologación o producción. Las operaciones siguen sujetas a los [límites de Edge Functions](https://supabase.com/docs/guides/functions/limits), incluido CPU, memoria y tamaño de solicitudes. El frontend público y su dominio se publican por separado.
