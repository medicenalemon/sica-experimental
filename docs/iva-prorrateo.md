# Prorrateo global y mixto de IVA compras

Amplía la [preparación de compras ordinarias](iva-simple-compras.md). Se conserva el criterio sin prorrateo y la asignación directa existentes; se agregan **Prorrateo global** y **Asignación directa y global**. Las constancias y los archivos de versiones anteriores permanecen iguales.

## Bases y destinos revisados

Para cada factura o débito A se declara qué parte del IVA discriminado tiene asignación directa, qué parte es de uso común y cuál queda excluida de ambas. Directo más común no puede superar el IVA. B/C llevan cero. El destino se declara con fundamento; no se deduce del rubro de la empresa ni de su forma jurídica.

Se cargan bases netas fiscales documentadas de operaciones gravadas, exentas y no gravadas, desde el inicio del ejercicio que contiene el mes completo hasta el último día de ese mes. La proporción estimada es gravadas / total de esas bases. Son importes declarados para esta estimación acumulada, no una extracción automática de ventas de SICA ni una constatación de ARCA. El responsable confirma las bases y conserva su referencia y fundamento. Se bloquean fechas parciales, valores negativos, importes inseguros, divisiones sin base cuando hay IVA común y asignaciones incompletas.

El cálculo aplica esa proporción al total de IVA común y redondea una sola vez a centavos, con aritmética entera exacta. No se suman redondeos individuales de cada comprobante. La suma de asignación directa y crédito prorrateado forma el crédito computable bruto de facturas y débitos. La diferencia respecto del IVA de esas operaciones es el no computable bruto.

Las notas de crédito no se vuelven a prorratear con el coeficiente actual. Se declara el crédito que corresponde restituir según el cómputo histórico, con límite en el IVA de la nota. Ese importe queda separado. Los totales netos de la preparación restan la restitución y concilian el resto del IVA de la nota sin mezclarlo con el IVA común del mes.

## Archivos y revisión

En modo global, el campo de crédito por comprobante del TXT queda en cero. Sus asignaciones se conservan para el papel global. En modo mixto, ese campo contiene sólo el crédito directo o a restituir declarado; no incluye nuevamente el importe prorrateado. Las alícuotas e importes originales permanecen iguales en ambos modos.

La revisión muestra bases, proporción, asignaciones, restituciones y cinco importes separados para contrastar con CF Computable Global. Los importes brutos de facturas/débitos y la restitución están separados; el encabezado de la preparación muestra además su efecto neto. No deben sumarse de nuevo los importes ya detallados.

Se puede descargar un **papel de trabajo JSON** con identidad, constancia, modo, bases, destinos, cálculo y totales. Es un archivo de SICA para revisión y conservación; **no es un diseño oficial para importar en ARCA**. Los TXT siguen sus diseños de cabeceras y alícuotas. Las descargas históricas conservan sus revisiones originales.

Los permisos, transacciones, revisión exacta, concurrencia, repetición de solicitudes y auditoría del circuito anterior se mantienen. El informe de lectura reproduce el cálculo sin recibir el diario completo. Cambiar parámetros o registrar operaciones posteriores no reescribe las constancias anteriores. Las bases y el ejercicio usado quedan conservados.

## Fundamento consultado el 17/10/2026

La registración admite modalidades directa, global y mixta, con campos globales separados. [ARCA, IVA Simple](https://www.arca.gob.ar/iva/iva-simple/especificaciones-especiales.asp). El manual diferencia el crédito informado por comprobante del global; [ARCA, especificaciones y validaciones, campo 21 de compras](https://www.arca.gob.ar/iva/documentos/Libro-IVA-Digital-Especificaciones.pdf).

La estimación del crédito de uso indistinto y el ajuste del último mes del ejercicio se tratan en el [artículo 13 de la Ley de IVA](https://biblioteca.arca.gob.ar/dcp/TOR_C_020631_1997_03_26). El [decreto reglamentario, artículos 50 y 53–55](https://biblioteca.arca.gob.ar/dcp/DEC_C_000692_1998_06_11) distingue restituciones según cómputo previo, bases netas y casos de apropiación directa. El sistema implementa la estimación acumulada declarada descrita arriba; no presume que sustituya todas las decisiones o ajustes exigibles a la entidad.

## Evidencia del ensayo

`var/qa-vat-proration.sqlite` conserva una preparación directa anterior y las nuevas versiones global INT-IC-00000002 y mixta INT-IC-00000003, en revisión 3. Se usaron datos sintéticos: bases gravadas $7.500, exentas $2.000 y no gravadas $500; proporción 75%. IVA común $21 → crédito prorrateado $15,75. Asignación directa $10,70; computable bruto $26,45; no computable bruto $18,25; restitución histórica $1; crédito neto $25,45.

El TXT global informa crédito cero por comprobante. El mixto informa $9,70 netos; al agregar una sola vez el prorrateo de $15,75 se reconcilian $25,45. Los detalles de alícuotas coinciden. La preparación directa y sus archivos, las compras, los originales, el diario, el stock y la tesorería permanecieron iguales. Se recuperó la versión mixta después de recargar y se conservaron recorridos DOM y captura nativa.

Pasaron **521 pruebas de dominio y 76 HTTP**, lint y compilaciones compartida/servidor. **52 bases** conservaron validación completa, integridad y auditoría. La verificación reproduce bytes de TXT y JSON desde las constancias efectivamente guardadas y comprueba integridad SQLite, validación completa después de JSON y auditoría HMAC. Script: `scripts/verify-vat-proration-ui.mjs`; informe: `output/verification-vat-proration-2026-10-17.json`.

## Límites y trabajo pendiente

No se verificaron bases o destinos contra documentación externa, ni aceptación de los archivos o presentación real en ARCA. No se observó un evento nativo de descarga en este ensayo; se verifican los bytes generados desde SQLite. El cálculo no presenta la declaración ni registra asientos. Las diferencias de IVA requieren conciliación contable por separado.

Se incorporó el [ajuste anual nominal con cómputos y devoluciones declarados](iva-ajuste-anual.md). Los criterios estimativos distintos del acumulado declarado, actividades con reglas especiales, bases negativas que requieran otro tratamiento, ventas, importaciones, otros diseños, otros tributos, imputación fiscal distinta de emisión y los restantes pendientes de IVA Simple continúan abiertos. El objetivo integral del PPTX sigue activo.
