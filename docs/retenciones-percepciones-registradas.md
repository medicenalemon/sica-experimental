# Retenciones y percepciones registradas

Ruta: Reportes → Retenciones y percepciones (`/reportes/retenciones-percepciones`). El reporte reúne datos registrados en cobros, pagos, facturas, notas y liquidaciones de tarjetas. La conciliación con certificados o información externa continúa pendiente.

## Datos conservados

Al crear una factura o nota con percepción positiva desde los comandos de SICA se conserva `perceptionEvidence`: impuesto Ingresos Brutos, jurisdicción del catálogo y referencia de hasta 200 caracteres. Se valida antes de contabilizar y se toma de los campos de la operación; una identidad anidada diferente en el documento enviado no sustituye esos parámetros. El importe y la contabilización existentes permanecen sujetos a sus reglas habituales.

La preparación fiscal utiliza la referencia y jurisdicción conservadas. La base y alícuota continúan requiriendo revisión explícita y deben explicar el importe registrado. Los nuevos datos se incluyen en la fuente congelada de la solicitud fiscal; preparar otra jurisdicción o referencia se rechaza. Los antecedentes que no tenían identificación estructurada siguen admitiendo los parámetros explícitos del circuito anterior.

Las copias históricas sin `perceptionEvidence` se mantienen legibles. El reporte las marca para revisar y no extrae una supuesta identidad de sus observaciones. Si el campo existe, la restauración exige una identificación válida y una factura/nota con percepción positiva. Las referencias nuevas de retención también exigen impuesto admitido, certificado no vacío y jurisdicción del catálogo para IIBB; no se corrigen referencias históricas de forma automática.

## Lectura y totales

Se muestran por separado retenciones sufridas, retenciones practicadas, percepciones sufridas y percepciones practicadas. Las retenciones de cobros y liquidaciones de tarjetas son sufridas; las de pagos, practicadas. Las percepciones de compras son sufridas y las de ventas, practicadas. Las notas de crédito restan percepciones. El reporte no suma estas categorías como un saldo fiscal único.

Los filtros de fechas, impuesto, jurisdicción y sucursal se aplican antes de calcular los totales. Las percepciones de facturas/notas X se excluyen de forma predeterminada y pueden incorporarse expresamente con su identificación interna. Las retenciones de recibos y órdenes de pago se muestran, aunque su numeración operativa lleve X.

Dos o más retenciones con igual sentido, contraparte interna, impuesto, jurisdicción y referencia en la selección conservan todos sus importes y muestran una señal de referencia compartida. Esto no prueba duplicación: un certificado puede estar distribuido entre movimientos. Las referencias de regímenes repetidas en percepciones no se tratan como certificados duplicados.

Las nuevas operaciones [conservan identidad impositiva al registrar](identidad-impositiva.md). Las liquidaciones admiten nombre y CUIT del agente transcritos por retención, o un motivo explícito de identificación pendiente. Los históricos sin esa información muestran el catálogo actual y se identifican como carentes de identidad histórica conservada. La marca de tarjeta no sustituye al agente. Una referencia informada no acredita existencia, vigencia, exactitud ni cómputo fiscal del certificado. Los errores de importe que impidan construir el reporte se informan en esa pantalla, sin bloquear la consulta de otras áreas del sistema.

## Permisos y recuperación

El permiso específico del reporte recibe del servidor una proyección de los renglones necesarios, sin conceder acceso a los comprobantes completos, líneas comerciales, bancos, cargos de tarjetas, asientos o escritura de operaciones. No permite por sí solo crear documentos, editar regímenes ni descargar el respaldo completo. Cada empresa conserva su aislamiento. Los documentos enmascarados para consultas de stock tampoco exponen la identificación nueva de percepciones.

El reporte se obtiene nuevamente de las fuentes y no agrega asientos ni modifica certificados. En modo local se calcula desde las operaciones locales; en modo compartido se usa la proyección calculada por el servidor, sin confiar en una proyección suministrada por el cliente.

## Relación con servicios oficiales

Para los regímenes de su competencia, ARCA describe la consulta de información declarada por agentes, incluidos CUIT, impuesto, régimen, fecha, comprobante e importe, en [Mis Retenciones](https://www.arca.gob.ar/genericos/retenciones.asp). La generación de los certificados previstos para SIRE se realiza mediante su servicio oficial, según [la documentación de ARCA](https://arca.gob.ar/sire/percepciones-retenciones/certificados.asp). Fuentes consultadas el 17/10/2026. El reporte de SICA conserva datos operativos y no sustituye esos trámites; los procedimientos de IIBB requieren su revisión provincial específica.

## Pendientes

La [comparación manual de certificados externos INT-CCF](comparacion-certificados-impositivos.md) permite transcribir el respaldo, vincular movimientos y conservar diferencias y versiones. La constatación externa de la identidad del agente, el tratamiento documentado de correcciones de identidad histórica, importación o conexión con información oficial, constatación de certificados, correcciones/anulaciones fiscales y determinación del cómputo o deuda forman parte del objetivo integral pendiente. No se emiten certificados oficiales, se presentan declaraciones ni se presupone condición de agente. Ver también el [catálogo de regímenes](regimenes-impositivos.md) y la [matriz del PPTX](requisitos-y-alcance.md).

## Evidencia del 17/10/2026

El ensayo `var/qa-tax-movements.sqlite` conservó la revisión 2 íntegra mientras se consultaron los filtros y se recargó el reporte. Contiene 13 documentos, 14 asientos, dos movimientos de stock y una liquidación de tarjeta, sin modificaciones por la consulta. Incluye doce renglones impositivos, once visibles por defecto: retenciones sufridas $5,50, practicadas $0,50, percepciones sufridas $9,50 y practicadas $4,00. La percepción interna X por $7 se incorpora sólo al elegirla y lleva el total practicado a $11. El filtro IIBB/Tucumán mostró cinco renglones; la sucursal norte, uno por $2,50. Un histórico quedó pendiente de identificación y dos retenciones conservaron su referencia compartida.

Pasaron **577 pruebas de dominio, 83 HTTP, 32 fiscales y 36 de archivos: 728**, sin fallos en las ejecuciones confirmadas. Lint y compilaciones compartida/servidor pasaron. Las 59 bases conservaron validación completa después de JSON, integridad SQLite, auditoría HMAC, fuentes fiscales y lectura de sus movimientos impositivos. Un respaldo sellado del ensayo se recuperó de revisión 2 a 3 con estado/credenciales y los doce renglones idénticos, cero sesiones y retiro de la copia temporal; se revocó una sesión.

El primer intento de archivos encontró EPERM al ejecutar Poppler dentro del sandbox. Se conservan los registros de ese intento y su interrupción en `output/qa/tax-movements-files-sandbox-failure.log` y `output/qa/tax-movements-files-interrupted.log`. La ejecución confirmada fuera del sandbox está en `output/qa/tax-movements-files-confirmed.log`, con 36 aprobadas y cero fallos. No se relajaron las comprobaciones.

Script reproducible: [verify-tax-movements-ui.mjs](../scripts/verify-tax-movements-ui.mjs). Informe: [verification-tax-movements-2026-10-17.json](../output/verification-tax-movements-2026-10-17.json). Se conservaron transcripciones de filtros y [captura nativa del reporte recuperado](../output/tax-movements-recovered-2026-10-17.png). No se verificaron los eventos de descarga ni las exportaciones de esta tabla desde el navegador. Todos los datos, referencias y solicitudes de este ensayo son sintéticos y no hubo solicitudes externas de emisión o presentación.
