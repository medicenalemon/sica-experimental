# PostgreSQL para SICA experimental

El servidor usa **PostgreSQL por defecto**. SQLite sigue disponible explícitamente para compatibilidad y migración. Se probó PostgreSQL **18.6**, con el controlador `pg`, consultas parametrizadas y conexiones asíncronas; no se simula PostgreSQL mediante SQLite.

Para alojar la base en Supabase y compartir SICA mediante HTTPS, seguir la [guía Supabase y Docker](supabase.md). La conexión remota verifica TLS y requiere conexión directa o pooler de sesión; el puerto 6543 del pooler de transacciones se rechaza antes de conectar. El servidor configura `search_path` y tiempos de espera al obtener cada conexión, sin depender de opciones de inicio que un pooler podría ignorar.

## Iniciar una instalación nueva

Se requiere Node.js 24 o superior y una base PostgreSQL vacía accesible por el servidor. Conservar las credenciales de PostgreSQL fuera del frontend y del repositorio. Copiar `.env.example` a `.env` y elegir:

```dotenv
SICA_DATABASE_DRIVER=postgres
SICA_DATABASE_URL=postgresql://sica:CLAVE_ELEGIDA@127.0.0.1:55432/sica
SICA_AUDIT_KEY_FILE=var/postgres/sica.audit-key
SICA_ADMIN_PASSWORD=CONTRASENA_INICIAL_ELEGIDA
SICA_ARCA_MODE=disabled
```

La contraseña de PostgreSQL y la del administrador SICA son independientes. Codificar los caracteres reservados de la contraseña al escribir una URI de conexión. Para una base remota, configurar TLS verificado en la conexión y certificados de confianza; no deshabilitar su verificación. La base y el rol deben existir antes del arranque. El rol necesita permisos para crear y mantener el esquema `sica`; el despliegue experimental usa un rol propietario, sin separación entre migrador y aplicación.

Hay una opción local con Docker Compose:

1. Elegir `SICA_POSTGRES_PASSWORD` en `.env` y reflejar esa clave en `SICA_DATABASE_URL`.
2. Ejecutar `docker compose up -d postgres`.
3. Ejecutar `npm run build` y `npm run server`.
4. Abrir `http://127.0.0.1:3001`. Para desarrollo, mantener el servidor y ejecutar `npm run dev` en otra terminal; abre el puerto 5174.

Compose publica PostgreSQL sólo en `127.0.0.1:55432` y conserva los datos en el volumen `sica-postgres`. No se lo levantó como servicio persistente durante las pruebas: se validó la configuración y se utilizó el PostgreSQL instalado en un cluster temporal. El montaje `/var/lib/postgresql` corresponde a la [imagen oficial desde PostgreSQL 18](https://github.com/docker-library/docs/blob/master/postgres/content.md). No eliminar el volumen para actualizar o recuperar datos.

Al primer arranque se aplican las migraciones y se crea el administrador con la contraseña elegida. Si falta la URL, el servidor falla explícitamente; no cambia a SQLite. Si ya existe una empresa y falta su clave de auditoría, tampoco genera otra clave para sustituirla.

**Para migrar una empresa existente, hacer la migración antes de iniciar una empresa nueva con el mismo código.** Las herramientas rechazan un destino que ya contenga esa empresa, incluso si se había creado sin operaciones.

## Migrar desde SQLite

Conservar el archivo original y su `.audit-key`. La herramienta abre SQLite en sólo lectura y usa la API de backup para obtener una copia coherente, también si la fuente tiene WAL. Las adaptaciones históricas se realizan sobre la copia temporal.

Configurar en `.env` la URL de destino y un archivo de clave PostgreSQL nuevo para la empresa original. Ejemplo para una empresa cuyo código SQLite sea `sica`:

```bash
npm run postgres:data -- migrate --source /ruta/BASE.sqlite --company sica --reason "Migración revisada a PostgreSQL"
```

Se conserva el código de empresa: no se renombra porque forma parte del contexto de cifrado de tickets. Se verifica estado, credenciales derivadas, cadena HMAC, solicitudes fiscales y tickets; se importan operaciones, usuarios, historial de solicitudes idempotentes y recuperaciones anteriores. Se conserva la clave original en `SICA_AUDIT_KEY_FILE`, con permisos privados, y se revocan todas las sesiones copiadas. Se agrega una constancia HMAC y la revisión aumenta una vez, sin crear comprobantes, asientos ni movimientos económicos nuevos. El origen permanece intacto.

Para el cambio definitivo, detener primero las escrituras en SQLite, migrar y configurar `SICA_COMPANY_ID` con el mismo código de `--company` antes de iniciar PostgreSQL. Una copia coherente no incluye operaciones que se registren en SQLite después de tomarla; no mantener ambos servidores aceptando escrituras sobre empresas divergentes.

Para usuarios del antiguo modo navegador, ingresar al servidor y usar la migración revisada de Configuración. Esa copia operativa JSON no contiene solicitudes ni tickets fiscales del servidor; para ellos se requiere el procedimiento completo correspondiente.

## Empresas, transacciones y datos

El esquema `sica` contiene las tablas de empresa, sesiones, idempotencia, auditoría, recuperaciones y persistencia fiscal, más **14 tablas relacionales del núcleo**. Las claves compuestas y los filtros incluyen `company_id`. Varias empresas pueden compartir la misma base PostgreSQL y deben utilizar archivos de clave exclusivos. Configuración de ejemplo: `server/companies.postgres.example.json`; las URL se obtienen de variables de entorno y no se escriben en ese JSON.

Cada transacción mantiene todas sus consultas sobre el mismo cliente del pool. Una escritura toma un bloqueo por empresa y de la fila de empresa, valida la revisión y confirma juntos estado, relaciones, evento HMAC e identificador idempotente. Una solicitud repetida con el mismo contenido no duplica operaciones; otra solicitud con una revisión vieja obtiene conflicto. Las lecturas compuestas usan `REPEATABLE READ`. Las empresas diferentes pueden escribir simultáneamente. Se conserva el control de permisos, CSRF y sesiones; el navegador nunca recibe la URL de PostgreSQL ni las credenciales derivadas.

Las operaciones fiscales mantienen además un bloqueo de sesión PostgreSQL por empresa, ambiente y documento durante la consulta/envío simulado. Ese bloqueo coordina instancias distintas, mientras la reserva de serie/número se confirma antes de llamar al cliente ARCA. Una respuesta incierta conserva su solicitud para consultarla sin duplicar la autorización.

Los importes SQL son `bigint` en centavos, limitados al rango entero seguro de JavaScript. Se verifican tipos, claves foráneas diferidas, sentido de contraparte y relaciones de líneas, aplicaciones, stock y tesorería. Los metadatos por entidad usan `json`, con columnas generadas tipadas e índices SQL; las líneas se consultan desde tablas hijas. Se conserva el snapshot de intercambio para módulos especializados y compatibilidad histórica. Esto **no equivale a descomponer todos los módulos en columnas ni a eliminar las escrituras del estado completo**. La revisión sigue siendo global por empresa: la escala de escrituras por una misma empresa necesitaría una evolución adicional del contrato de comandos.

Se usa `json` para conservar el orden de propiedades de revisiones históricas calculadas con `JSON.stringify`; PostgreSQL documenta esa diferencia frente a `jsonb` en sus [tipos JSON](https://www.postgresql.org/docs/18/datatype-json.html). La cadena de auditoría mantiene exactamente el texto original de cada evento. Las referencias polimórficas de movimientos a cheques, transferencias o valuaciones se conservan como `origin_id`, sin inventar facturas.

La migración inicial tiene versión y checksum. El arranque verifica tablas, vistas y trigger habilitado, la consistencia entre estado y relaciones, las reglas de dominio, HMAC y fuentes fiscales. No modificar una migración aplicada: los cambios futuros necesitan otra versión. La clave externa también se sincroniza a disco antes de confirmar una empresa nueva.

## Respaldos y recuperación

El temporizador existente crea cada 24 horas un respaldo lógico **por empresa**, desde una lectura coherente, y lo valida antes de publicarlo. No es un `pg_dump` ni una copia física de todo el cluster. Incluye usuarios con contraseñas derivadas, estado, auditoría, recuperaciones previas, solicitudes idempotentes, solicitudes fiscales y tickets cifrados. Contiene datos privados.

El resultado son `*.sica-pg.json` y su `*.sica-pg.json.audit-key`. El contenido completo se protege con HMAC y la clave externa permite verificarlo y descifrar los tickets. Copiar ambos a almacenamiento privado independiente. Por defecto se guardan en `backups/` junto a la clave de empresa. El límite del verificador es 256 MiB por archivo.

```bash
npm run postgres:data -- verify --source /ruta/COPIA.sica-pg.json --company sica
```

`verify` no conecta a PostgreSQL ni a ARCA. Sólo imprime cantidades, código y versión de empresa y estado del sello; no imprime contraseñas, cookies o tickets.

Para recuperar, apuntar `SICA_DATABASE_URL` a una base nueva o a una base donde no exista esa empresa, y `SICA_AUDIT_KEY_FILE` al destino privado de su clave original:

```bash
npm run postgres:data -- recover --source /ruta/COPIA.sica-pg.json --company sica --operator "Operador responsable" --reason "Recuperación revisada"
```

La recuperación valida antes de importar, no reemplaza empresas existentes y confirma la importación completa en una transacción. Revoca las sesiones copiadas y agrega la constancia HMAC/revisión. Después se ingresa con las credenciales originales y se genera un respaldo nuevo. Los respaldos SQLite antiguos siguen usando `npm run recovery`; no son intercambiables con el formato PostgreSQL.

Las migraciones y recuperaciones no consultan ARCA, no envían comprobantes y no resuelven automáticamente una emisión incierta. Conservar y revisar esos pendientes antes de habilitar conexiones reales en otro objetivo.

## Pruebas y límites

```bash
npm run test:postgres
npm run test:all
npm run build
npm run lint
```

`test:postgres` descubre los binarios mediante `pg_config --bindir` o `SICA_PG_BIN`, crea un cluster privado con contraseña aleatoria, socket Unix privado, WAL/fsync y sincronización de commits activos, y elimina sus datos al terminar. Requiere los binarios locales de PostgreSQL y no usa servicios ni bases de usuario existentes. La batería integral incluye estas pruebas además de las suites anteriores.

Se cubren centavos/referencias inválidos, orden JSON, permisos, sesiones, bloqueo de ingreso, idempotencia, conflictos entre repositorios, lectores coherentes, empresas simultáneas, rollback después de proyectar datos/auditoría, terminación de una conexión, HTTP, esquema alterado, respaldo manipulado, CLI y ARCA simulada. Las bases históricas de `var/` se migran y recuperan manteniendo sus códigos originales en destinos temporales; el informe verifica también las huellas de las fuentes.

Evidencia: `output/qa/relational/tests.json`, `output/qa/relational/postgres.log` y `output/qa/postgres/history.json`. No se probó un despliegue productivo, alta disponibilidad, recuperación física/PITR ni rendimiento a escala. El backup lógico no reemplaza una política operativa supervisada de PostgreSQL; [pg_dump](https://www.postgresql.org/docs/18/app-pgdump.html) es una opción adicional para el cluster completo. ARCA real permanece fuera de este objetivo.
