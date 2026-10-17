# Conciliación contable del IVA de compras

En **Contabilidad → Conciliación de IVA compras**, las constancias **INT-IV** comparan una preparación mensual INT-IC o un ajuste anual INT-IA con los movimientos de compras en cuentas de crédito fiscal elegidas expresamente. Se conserva el resultado, incluso cuando hay diferencias pendientes, sin generar otro asiento.

## Alcance de la comparación

La fuente fiscal debe ser la última versión vigente, con sus originales y bases actuales. El período mensual o anual debe haber terminado. El corte contable no puede ser anterior a su cierre ni futuro y debe estar dentro del calendario conservado. Se incluyen todas las sucursales, con detalle contable por unidad; no se distribuyen automáticamente entre ellas el prorrateo o el ajuste anual.

Se eligen una o varias cuentas del Activo que representen crédito fiscal, incluyendo cuentas históricas aunque ya no admitan nuevas imputaciones. La asociación actual se muestra como orientación; no reemplaza esa elección. La referencia y el fundamento de cada revisión son obligatorios.

Para cada compra se identifica un único asiento original del mismo comprobante y sucursal, registrado hasta el corte. Se leen los Debe y Haber reales de las cuentas elegidas; no se reemplazan por el IVA discriminado del comprobante. Esto conserva el signo de las notas y permite identificar, por ejemplo, B/C sin crédito registrado. La fecha de emisión y la de incorporación contable se muestran por separado.

El importe fiscal mensual es el crédito neto de la preparación INT-IC. En una conciliación anual se suman los créditos mensuales preparados, las diferencias entre el prorrateo preparado y el cómputo que declaró el responsable en INT-IA, y el **ajuste anual total** de esa versión. No se suma la variación entre versiones anuales. Las restituciones comunes ya tratadas por INT-IA no se agregan de nuevo.

## Ajustes manuales y reversiones

El responsable puede vincular asientos existentes identificados como manuales, con movimiento en las cuentas elegidas, fecha desde el inicio del período hasta el corte y respaldo y fundamento individuales. Se conservan sus líneas completas. No se imputan automáticamente todos los movimientos del mayor: otros conceptos y períodos podrían compartir las mismas cuentas.

Las reversiones de un ajuste vinculado, registradas hasta el corte, se incluyen automáticamente. Una reversión posterior no modifica las revisiones anteriores y señala la necesidad de revisar sus fuentes. Se impide usar el mismo asiento manual en las últimas conciliaciones de períodos fiscales no superpuestos. Una revisión anual puede incluir los ajustes que ya respaldaron sus meses.

La diferencia es **movimiento original + ajustes/reversiones vinculados − importe fiscal preparado/declarado**. El resultado se muestra como «Con diferencia pendiente» o «Sin diferencia aritmética». No representa el saldo total del mayor, el saldo técnico ni una declaración presentada. Una igualdad no prueba la correcta imputación de inventarios, bienes de uso, gastos, otros impuestos o las bases fiscales. Los demás asientos automáticos y reclasificaciones requieren análisis separado.

## Historia, permisos y salida

Cada versión requiere revisión exacta y conserva cuentas, nombres, empresa, calendario, referencias fiscales y prefijos de fuentes contables. Cambios posteriores no reescriben el antecedente. El historial y su detalle continúan disponibles aunque la fuente fiscal actual quede desactualizada; se advierte esa situación y se bloquea una nueva preparación hasta revisar las fuentes.

El permiso `/contabilidad/conciliacion-iva` incluye lectura de las fuentes fiscales y del diario necesario para esta revisión. Es un acceso contable: al asignarlo se habilitan fuentes del diario completo, cuentas y reversiones. Conservar una constancia no habilita al perfil a registrar o revertir asientos. Los perfiles sólo fiscales, comerciales o ajenos no reciben INT-IV ni obtienen acceso adicional al diario.

El JSON exporta la revisión completa, fuentes y líneas de los asientos elegidos. No es un archivo para importar en ARCA. Las tablas ofrecen las exportaciones parciales XLSX/PDF del componente de reportes; no sustituyen la constancia completa ni su JSON.

## Ensayo del 17/10/2026

Sobre el ejercicio sintético 2025, el navegador conservó INT-IV-00000001 con movimiento original $102,90 y referencia fiscal $65,72: diferencia $37,18. INT-IV-00000002 vinculó dos ajustes ya existentes de −$21,50 y −$15,68, dejando movimiento $65,72 y diferencia cero. El crédito de referencia conserva $59,05 de estimaciones mensuales más $6,67 de ajuste anual. Ambas revisiones se recuperaron tras recargar.

Luego se cambió el nombre del proveedor mediante un comando auditado. Se verificaron el aviso de fuentes cambiadas, el bloqueo de una nueva preparación y el acceso al historial y al detalle conservado. Permanecieron intactos los cuatro comprobantes, seis asientos —incluidos los dos manuales de ensayo—, originales, tres preparaciones mensuales y una anual con sus archivos. La constancia no agregó movimientos financieros.

Pasaron **546 pruebas de dominio y 78 HTTP**, lint y compilaciones compartida/servidor. **54 bases** conservaron validación completa después de JSON, integridad SQLite y auditoría HMAC. Las pruebas incluyen cuentas históricas, sucursales, B/C, cambios de cómputo declarado, reversiones, revisión exacta, concurrencia, repetición, permisos y recuperación. Después de permitir consultas sobre cuentas cerradas a nuevas imputaciones se repitió, con éxito, el circuito HTTP completo de conciliación con ese caso adicional; sus resultados están separados en `output/qa/vat-ledger-http-current.log`. Informe: `output/verification-vat-ledger-2026-10-17.json`; verificador: `scripts/verify-vat-ledger-ui.mjs`; JSON: `output/vat-ledger-2026-10-17/`.

Se conservan capturas nativas y recorridos completos. No se verificó el evento de descarga del navegador ni las exportaciones parciales XLSX/PDF en este ensayo; se verificaron los bytes de los JSON desde las constancias efectivamente guardadas.

## Trabajo pendiente

La contabilización específica del IVA no computable, su incorporación a costos y demás submayores, la conciliación de todos los movimientos automáticos, la determinación completa de la declaración y la validación/presentación real ante ARCA siguen pendientes. Este circuito permite detectar, documentar y revisar diferencias; no presume resolverlas por guardar una constancia. Se mantienen los límites de [compras ordinarias](iva-simple-compras.md), [prorrateo](iva-prorrateo.md) y [ajuste anual](iva-ajuste-anual.md). El objetivo integral del PPTX continúa activo.
