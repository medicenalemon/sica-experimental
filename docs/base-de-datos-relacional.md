# Base de datos y pruebas locales

Actualización del 19/10/2026: **PostgreSQL ya está implementado y es el backend predeterminado**. Ver [puesta en marcha, migración y recuperación PostgreSQL](postgresql.md). Este documento conserva el contrato SQLite utilizado para compatibilidad y ensayos históricos.

## Decisión para el sistema experimental

Se utiliza **SQLite en el servidor**, con WAL, sincronización FULL, claves foráneas habilitadas y un archivo privado por empresa. El navegador opera por HTTP; nunca abre un archivo SQLite compartido por red. Los importes se conservan como enteros en centavos dentro del rango seguro de JavaScript.

Esta elección corresponde al despliegue actual de un servidor y conserva las herramientas de auditoría, respaldo y recuperación existentes. SQLite es relacional y transaccional. Su documentación contempla aplicaciones con servidor, lectores concurrentes y un escritor por archivo: [usos adecuados](https://sqlite.org/whentouse.html), [WAL](https://sqlite.org/wal.html). La selección es una decisión del proyecto, no una recomendación universal.

PostgreSQL se incorporó como backend real con conexiones asíncronas, transacciones y bloqueos entre instancias. Las pruebas de concurrencia son ensayos de conflictos; no constituyen un benchmark productivo de ninguno de los dos motores.

## Modelo implementado

La migración versionada `1`, en `server/relational-store.mjs`, crea 14 tablas STRICT:

| Información | Tablas |
| --- | --- |
| Catálogos y organización | `rel_branches`, `rel_accounts`, `rel_deposits`, `rel_treasury_accounts`, `rel_parties`, `rel_products` |
| Comprobantes | `rel_documents`, `rel_document_lines`, `rel_document_payments`, `rel_document_allocations` |
| Movimientos | `rel_stock_moves`, `rel_treasury_moves` |
| Diario | `rel_entries`, `rel_entry_lines` |

Las claves compuestas incluyen la empresa. Las relaciones verifican contraparte y su sentido cliente/proveedor, sucursal, productos, depósitos, cuentas, documentos de origen y aplicaciones. Las claves diferidas permiten actualizar el conjunto dentro de una única transacción sin referencias intermedias inválidas. Se rechazan centavos fraccionarios, importes como texto y enteros fuera de precisión segura. Se conservan saldos iniciales negativos y aplicaciones históricas de cero, que no se habilitan para nuevas cargas.

Hay índices por empresa, contraparte, sucursal, fecha, artículo, depósito y cuenta. Las vistas `rel_account_totals`, `rel_stock_balances` y `rel_treasury_balances` exponen agregados SQL. El cálculo de períodos, permisos y reglas contables sigue a cargo del dominio.

Cada entidad conserva un payload JSON con sus metadatos y columnas SQL generadas con tipos y controles. Los detalles de comprobantes y asientos se almacenan en tablas hijas. El snapshot `companies.state` se mantiene para intercambio, respaldos anteriores y módulos especializados. **No es una descomposición completa de todos los módulos en columnas SQL.** Los triggers de inserción/actualización del snapshot mantienen las relaciones dentro de la misma transacción. Las lecturas del repositorio reconstruyen catálogos y operaciones del núcleo desde SQL; no hay doble escritura independiente desde la aplicación.

Se conserva el orden de filas y propiedades, porque algunas revisiones históricas se calcularon con `JSON.stringify`. Las referencias `documentId` de movimientos pueden representar cheques, transferencias, valuaciones u otras operaciones internas: se exponen como `origin_id`, sin inventar una relación con una factura. El dominio sigue validando esos orígenes y el equilibrio de los asientos.

El estado, las relaciones, la revisión, el evento HMAC y el identificador idempotente se confirman juntos mediante `BEGIN IMMEDIATE`. Las lecturas usan una transacción coherente. Una restauración sigue conservando usuarios y comprobantes protegidos. El arranque y la inspección de respaldos rechazan divergencias entre snapshot y relaciones o un esquema relacional incompleto.

## Puesta en marcha

Se requiere **Node.js 24 o superior** (`.nvmrc` y `package.json`). Con Node 24 instalado:

```bash
nvm use
cp .env.example .env
```

Elegir `SICA_ADMIN_PASSWORD` en `.env` antes del primer arranque; no existe contraseña predeterminada. Mantener `SICA_ARCA_MODE=disabled` para este objetivo.

```bash
npm run build
SICA_DATABASE_DRIVER=sqlite npm run server
```

Abrir `http://127.0.0.1:3001`. El frontend usa el servidor por defecto. Para desarrollar, mantener ese servidor y ejecutar `npm run dev` en otra terminal: usa `http://127.0.0.1:5174` y el proxy existente. `npm run dev:shared` y `npm run build:shared` siguen disponibles.

El modo autónomo del navegador es explícito: `npm run dev:local`, `npm run build:local` o `VITE_SICA_MODE=local`. Los datos anteriores del navegador permanecen en su almacenamiento. Para llevarlos al servidor, ingresar como administrador y usar la revisión de migración local en Configuración; no se trasladan silenciosamente ni se reemplazan los usuarios del servidor.

Al abrir una base existente, la migración SQL es automática, atómica e idempotente. No incrementa su revisión ni reescribe operaciones. Conservar primero un respaldo completo y su clave; la [recuperación independiente](recuperacion-independiente.md) permite iniciar desde una carpeta nueva. Nunca copiar sólo el archivo principal de una base con WAL activo ni eliminar tablas relacionales para forzar la migración.

La implementación aún reconstruye el estado y actualiza el núcleo por empresa en cada comando. Conserva las reglas existentes, pero no elimina el costo proporcional al tamaño del estado. La evaluación de escala y una eventual migración a escrituras incrementales/PostgreSQL requieren otro objetivo.

## Verificación reproducible

```bash
npm run test:all
npm run verify:database
npm run build
npm run lint
```

`test:all` compila el servidor y ejecuta dominio, archivos XLSX/PDF, fiscal simulada, HTTP, recuperación y base de datos. Falla si hay fallos, cancelaciones, pruebas omitidas o pendientes. Genera logs individuales y `output/qa/relational/tests.json`. `test:database` permite repetir la suite SQL por separado.

El preloader fiscal/HTTP y de la batería integral bloquea `fetch` y HTTP/HTTPS fuera de loopback, incluidas redirecciones de `fetch`. Las respuestas ARCA se inyectan: se ensayan numeración reservada, resultados inciertos, reintentos, CAE ficticio, tickets cifrados, separación de ambientes y recuperación. No se conecta a homologación ni a producción reales.

`verify:database` abre las bases de `var/` en sólo lectura, migra copias temporales y comprueba estado, revisión, credenciales derivadas, auditoría, solicitudes/tickets fiscales, relaciones, respaldo sellado y recuperación independiente. Registra las huellas originales sin modificar las fuentes. Informe: `output/qa/relational/history.json`.

La suite nueva cubre rollback de migraciones y de escrituras que fallan después de proyectar SQL/auditoría, centavos/referencias inválidas, aislamiento de empresas, idempotencia, conflictos, divergencias SQL, esquema incompleto, lectores durante una escritura interrumpida con SIGKILL y cuatro escritores en procesos distintos. También se corrigió la fecha/vencimiento de las notas internas por rechazo de cheques propios, de terceros y endosados.

Quedan para otros objetivos la conexión real a ARCA, credenciales/habilitaciones fiscales reales, despliegue, almacenamiento externo, supervisión de respaldos y ampliaciones funcionales de la matriz. No son pruebas locales omitidas dentro de esta batería.
