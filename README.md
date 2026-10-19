# sica-experimental
Versión experimental de SICA para prueba

# Autores
Mauricio Montero - Débora Pardes | (C) 2026. Todos los derechos reservados.

## Desarrollo y alcance

Verificación integral del **19/10/2026: 907 pruebas automatizadas aprobadas**, sin fallos, omitidas ni pendientes: 607 de dominio, 40 de archivos, 32 fiscales simuladas, 87 HTTP, 11 de recuperación, 30 de SQLite y **100 de PostgreSQL**. Las **63 bases históricas** se migraron a PostgreSQL y se recuperaron independientemente en destinos temporales, conservando las fuentes. Informe: [`output/verification-postgresql-2026-10-19.json`](output/verification-postgresql-2026-10-19.json). La verificación SQLite anterior queda conservada en `output/verification-relational-2026-10-19.json`.

El backend predeterminado ahora es **[PostgreSQL](docs/postgresql.md)**, con 14 tablas del núcleo relacional, claves foráneas, centavos enteros, migraciones, bloqueos entre instancias, auditoría y recuperación por empresa. SQLite queda disponible para compatibilidad y migración. Requiere **Node.js 24 o superior** y PostgreSQL accesible. Configurar `.env` desde `.env.example`, elegir credenciales y URL de la base, y ejecutar `npm run build` y `npm run server`; para desarrollo, agregar `npm run dev` en otra terminal. `compose.yaml` ofrece PostgreSQL 18 local opcional. El modo autónomo del navegador se elige con `npm run dev:local`.

Para acceso compartido por Internet, está preparado el [despliegue Supabase + Docker](docs/supabase.md): PostgreSQL remoto con TLS verificado y Session pooler, servidor Node y web en una imagen, HTTPS con Caddy y volumen para claves y respaldos. Archivos: `Dockerfile` y `deploy/compose.yaml`. El proyecto remoto y el alojamiento se provisionan con acceso a las cuentas correspondientes; no se consideran publicados por compilar localmente.

Para reproducir: `npm run test:all` (incluye cluster PostgreSQL temporal), `npm run test:postgres`, `npm run build` y `npm run lint`. `npm run verify:database` conserva el ensayo SQLite. Las pruebas fiscales/HTTP bloquean destinos externos; **no se conectó a ARCA real**, ni a homologación ni a producción.

La [matriz del PPTX](docs/requisitos-y-alcance.md) registra lo implementado y los pendientes. El caso inicial es un comercio textil, responsable inscripto en Tucumán, sociedad comercial con SRL o SAS configurable.

La [conciliación contable de IVA ventas](docs/conciliacion-iva-ventas.md) conserva comprobantes, ingresos y movimientos reales del diario con historial y JSON. Es un papel de trabajo; no presenta declaraciones ni acredita validación fiscal real.

Verificación del 17/10/2026: 714 pruebas aprobadas, 57 bases con integridad/auditoría y recuperación independiente del respaldo. Evidencia: `output/verification-vat-sales-ledger-2026-10-17.json`. Scripts: `scripts/verify-vat-sales-ledger-ui.mjs` y `scripts/verify-vat-sales-ledger-recovery.mjs` (Node 24, después de compilar el servidor).

El [catálogo de regímenes impositivos](docs/regimenes-impositivos.md) controla vigencias y datos declarados. Su estado no acredita vigencia legal ni aplica impuestos automáticamente.

Verificación del catálogo: 570 pruebas de dominio y 82 HTTP aprobadas, 58 bases y recuperación independiente. Informe: `output/verification-tax-rules-2026-10-17.json`.

El [reporte de retenciones y percepciones](docs/retenciones-percepciones-registradas.md) distingue fuentes, importes sufridos/practicados e históricos por revisar. Las nuevas percepciones conservan referencia y jurisdicción; no se determina su cómputo fiscal ni se emiten certificados oficiales.

Verificación del reporte impositivo: 728 pruebas aprobadas, 59 bases y recuperación independiente. Informe: `output/verification-tax-movements-2026-10-17.json`.


La [comparación manual de certificados impositivos INT-CCF](docs/comparacion-certificados-impositivos.md) conserva datos transcritos, movimientos vinculados, diferencias y versiones. Permite guardar una huella SHA-256 del archivo; el contenido debe conservarse externamente. No acredita autenticidad ni determina el cómputo fiscal.

Verificación del 18/10/2026: **739 pruebas aprobadas**, 60 bases y recuperación independiente con ambas versiones intactas. Informe: `output/verification-tax-certificates-2026-10-18.json`. Verificador: `scripts/verify-tax-certificates-ui.mjs` (Node 24, después de compilar el servidor y completar el ensayo documentado).

Las nuevas retenciones/percepciones [conservan nombre y CUIT en el origen](docs/identidad-impositiva.md). Las retenciones de tarjetas identifican al agente por certificado o conservan un motivo pendiente. Los cambios de catálogo no reescriben esa identidad; los históricos sin ella quedan expresamente diferenciados.

Verificación de identidad impositiva: **746 pruebas aprobadas**, 61 bases y recuperación independiente. Informe: `output/verification-tax-identity-2026-10-18.json`; recorrido y límites en la documentación del módulo.

Los [controles de consistencia comercial](docs/consistencia-comprobantes.md) protegen sentido, contenido, origen, importes y aplicaciones de comprobantes también al recuperar copias. La interfaz distingue cargos futuros y muestra la distribución original de cobros, pagos y notas. Verificación: **754 pruebas aprobadas**, 62 bases y recuperación independiente. Informe: `output/verification-document-rules-2026-10-18.json`.
