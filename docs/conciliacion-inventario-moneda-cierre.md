# Inventario conciliado en moneda de cierre

Contabilidad → Valuación de inventario incorpora **INT-CI**, que enlaza el ajuste anual INT-AI con cada artículo y depósito. Conserva cantidades y los importes del ajuste ya contabilizado. No registra otro asiento de inflación ni modifica documentos, movimientos de stock o valuaciones anteriores.

## Recorrido

1. Valuar el inventario exactamente al corte anual antes de contabilizar INT-AI. El ajuste nuevo exige este corte, para que la posterior conciliación pueda conservar sus cantidades y costos. La validación de una valuación histórica compara su saldo anterior al ajuste de esa misma fecha, sin exigirle que contenga una reexpresión registrada después.
2. Seleccionar INT-AI en la pantalla de inventario. Incluir todos los artículos y depósitos de la valuación, incluso los saldos agotados. Distribuir cada partida de antigüedad del ajuste entre sus propietarios, conservando signo y suma. Un único propietario con saldo coincidente recibe una propuesta; para cuentas compartidas se requiere reparto explícito.
3. Fundamentar el reparto y revisar cantidad, valor anterior, diferencia, valor en cierre y conciliación con el mayor por sucursal. El reparto de centavos usa restos mayores y conserva exactamente el importe redondeado de cada fuente.
4. Confirmar y conservar INT-CI. La referencia y fuente no se repiten. La API calcula nuevamente la revisión sobre el estado completo, atribuye la constancia a la sesión y conserva los reintentos sin duplicación.
5. Descargar el anexo PDF o XLSX desde **Ver conciliación de inventario**. Sus nueve secciones contienen constancia, artículos/depósitos, mayor por sucursal, fuentes asignadas, antigüedades, índices, recepciones pendientes, respaldo/continuidad y cuentas del CPP.
6. Preparar los cierres posteriores. La versión 6 del cálculo toma los valores conciliados como base. Conserva las compras, salidas, traslados, fabricación y devoluciones posteriores, y contabiliza únicamente sus efectos y correcciones pendientes.

La base de cálculo es una apertura **virtual**, con las cantidades y valores de INT-CI. Sus asientos auxiliares sirven únicamente al recálculo: no se guardan como una nueva apertura o como otro ajuste en el diario. Los cierres y revisiones antiguos permanecen conservados. Una consulta seleccionada de la valuación nominal muestra su importe original; la vista actual incorpora la conciliación y señala su corte monetario.

## Operaciones que cruzan el corte

Las notas sobre compras recibidas antes de INT-CI requieren reparto entre los saldos que había en la base conciliada y resultados de bienes previamente vendidos/consumidos. Su diferencia monetaria se incorpora al nuevo corte y atraviesa el CPP posterior; no se vuelve a aplicar automáticamente el coeficiente del ajuste anterior. Las notas sobre compras posteriores mantienen el recálculo desde su recepción. Las devoluciones físicas vinculadas se excluyen de esas correcciones de precio.

Las recepciones estimadas pendientes conservan su pasivo monetario y la fecha original de la estimación. La apertura virtual no representa una nueva estimación. Una factura posterior cancela el pasivo y requiere asignar la diferencia entre factura y estimación sobre los saldos de la base y resultados; una diferencia cero también debe quedar declarada. Si INT-AI cambió la medición del pasivo estimado, este circuito bloquea la continuación hasta conciliar además esa deuda: no presume que conserva su importe monetario anterior.

Las devoluciones de ventas anteriores a la base requieren un costo recuperado explícito y respaldo en la moneda de esa base. Las de ventas posteriores recuperan el costo del recálculo. Las devoluciones a proveedor descargan el CPP conciliado y separan la diferencia respecto de la nota. Los traslados conservan el costo retirado y su cuenta intermedia queda cancelada en el consolidado; la fabricación incorpora el costo de materiales según la misma base.

Las diferencias operativas de precios no resuelven por sí solas la clasificación de errores de ejercicios anteriores, los cambios de políticas o una reapertura. El operador debe fundamentar la moneda y tratamiento de cada diferencia; esos circuitos profesionales siguen pendientes. Los precios del catálogo continúan separados del costo contable.

## Secuencia, permisos e historia

Una fuente admite una sola conciliación y necesita las capas anteriores. No se incorpora INT-CI retroactivamente sobre cierres posteriores ya conservados. Los nuevos cierres CPP se bloquean mientras falte conciliar un ajuste anterior aplicable al inventario. Las cantidades operativas pueden seguir registrándose en fechas abiertas; su valuación necesita primero esa base.

La conciliación también puede hacerse después del cierre/apertura del ejercicio. Los cierres anteriores conservan las conciliaciones presentes al momento de su revisión. Dos ajustes sucesivos parten de la moneda incorporada por el primero; el cálculo siguiente no regresa al costo nominal anterior.

El permiso `/contabilidad/inventario` permite conciliar y valuar; preparar cuentas conserva los controles de Administrador General. Un perfil exclusivo de costos recibe la fuente necesaria —inventario, cuenta, saldos, antigüedades e índices— sin los cuatro estados ni el expediente financiero INT-MC completo. La revisión de ese perfil coincide con la calculada sobre la base completa del servidor. Los perfiles ajenos no reciben las conciliaciones.

La restauración verifica fuentes, revisiones, cantidades, repartos, asientos y la igualdad entre saldos valorizados y mayor. Las versiones 1 a 5 mantienen sus cálculos; la versión 6 conserva las referencias a INT-CI.

## Evidencia del 12/10/2026

El navegador conservó y recuperó **INT-CI-00000001**: diez remeras en Depósito principal, costo anterior $1.000 y valor de cierre $1.500, usando índices de **Ensayo** septiembre 100/octubre 150. Cantidad conservada: diez. La apertura y el corte nominal siguen mostrando $1.000 al seleccionarlos.

Después se conservó **INT-VC-00000003**, corte 13/10/2026: compra posterior de cinco unidades por $1.000, entrega de tres con costo $500, y saldo de doce unidades por $2.000. La cuenta de existencias concilia con esos $2.000 y la compra queda reclasificada una sola vez. INT-CI no agregó un asiento; el CPP posterior agregó un asiento con Debe Existencias $500, Debe CMV $500 y Haber Compras $1.000. La factura, el IVA, las cantidades y los cierres anteriores se conservan.

Pasaron **422 pruebas**: 327 de dominio, 24 de archivos, 49 HTTP y 22 fiscales. Incluyen notas y facturas sobre recepciones anteriores, devoluciones con costo recuperado, traslados entre sucursales, dos saldos de un centavo, dos cierres sucesivos, fechas originales de estimación, permisos, reintentos, revisión y restauración. Se verificaron **23 bases** después del recorrido JSON, con integridad SQLite y HMAC de auditoría. También se compilaron interfaz local/compartida y servidor, y pasó lint.

El PDF entregado tiene nueve páginas y el XLSX nueve hojas. Se comprobaron importes y cantidades numéricos, índices exactos, cantidades de hasta seis decimales y paginación de respaldos largos. Todas las páginas se revisaron renderizadas; las tablas de artículos y mayor también se inspeccionaron a resolución completa.

Los botones de exportación se activaron en la interfaz. Los bytes entregados provienen de los mismos constructores del producto sobre la constancia efectivamente persistida; no se acredita una descarga del navegador. Se guardaron capturas reales de la constancia recuperada y del CPP posterior, junto con el recorrido textual que incluye la consulta del corte nominal. La vista local quedó disponible en Codex.

Archivos: `output/pdf/conciliacion-inventario-2026-10-12.pdf`, `output/conciliacion-inventario-2026-10-12.xlsx`, capturas `output/inventory-inflation-2026-10-12.jpg` y `output/inventory-inflation-costing-2026-10-12.jpg`, recorrido `output/inventory-inflation-browser-2026-10-12.txt` e informe `output/verification-inventory-inflation-2026-10-12.json`. Scripts: `inventory-inflation-fixture.mjs`, `inventory-inflation-ui-fixture.mjs`, `preview-inventory-inflation-ui.mjs` y `verify-inventory-inflation-ui.mjs`, dentro de `scripts/`.

## Marco y límites pendientes

La referencia consultada es [RT 54, texto ordenado con RT 59/62 y JG 656/2025](https://www.consejo.org.ar/storage/attachments/Resolucion%20Tecnica%20N%2054%20%28TO%20RT%2059%20y%20modi-7TbUsld18i.pdf). La adopción y aplicabilidad a la entidad en Tucumán requieren revisión jurisdiccional y profesional. La conciliación no acredita cumplimiento normativo integral ni emisión de estados.

INT-CI enlaza un ajuste anual revisado. No sustituye los orígenes documentados, automatiza todos los ajustes intermedios ni obtiene índices oficiales. Las nuevas compras, diferencias y costos recuperados requieren revisar su moneda; la reexpresión posterior necesita sus propias fuentes e índices. Siguen pendientes mediciones alternativas, valor recuperable de inventario, costos completos de conversión, conciliación de pasivos estimados reexpresados, correcciones/reapertura, impuestos, revelaciones normativas completas y validación fiscal real. El objetivo integral del PPTX permanece abierto.


## Continuidad con desvalorización

El 12/10/2026 se amplió INT-CI para conciliar también la pérdida acumulada por artículo, depósito y sucursal. Los registros anteriores de esta página conservan su estructura y anexos de nueve secciones; las conciliaciones que incorporan desvalorización agregan cinco secciones. El CPP posterior usa costo bruto y pérdida reexpresados, sin duplicar asientos. [Reglas, límites y evidencia](conciliacion-inventario-neto-moneda-cierre.md).
