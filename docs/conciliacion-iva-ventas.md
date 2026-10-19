# Conciliación contable de IVA ventas

Actualizado el 17/10/2026. Caso inicial: comercio textil, responsable inscripto en Tucumán, sociedad comercial SRL o SAS configurable. Autores: Mauricio Montero y Débora Pardes.

La ruta `/contabilidad/conciliacion-iva-ventas` conserva papeles de trabajo INT-IDV para comparar preparaciones mensuales INT-IVT con movimientos reales del diario. No genera asientos ni modifica comprobantes, autorizaciones o TXT de ventas.

## Uso y alcance

Se elige la última preparación vigente por mes y ambiente, del mismo CUIT y de un mes completo terminado. El corte contable va desde el cierre del mes hasta la fecha actual, dentro del ejercicio conservado. Se reúnen todas las sucursales, aunque el selector general muestre una sola.

El operador selecciona entre una y veinte cuentas del Pasivo, incluidas cuentas históricas que ya no admitan imputaciones. Se calcula Haber menos Debe en los asientos originales vinculados. La revisión distingue el IVA de comprobantes, el complemento interno de ingresos contabilizados en el mismo mes, la suma de ambos como referencia de trabajo y los movimientos contables efectivamente vinculados. Muestra diferencias frente a comprobantes y frente a esa referencia por separado.

Los devengamientos anteriores se muestran como origen sin sumarse otra vez. Las conciliaciones posteriores al mes, hasta el corte, se exponen aparte y mantienen el estado «Conciliaciones posteriores por revisar». Las facturas con devengamientos pendientes de conciliar mantienen su estado propio aunque la diferencia aritmética sea cero.

Cada asiento manual existente se elige expresamente con referencia y fundamento. Se incluyen sus reversiones hasta el corte y se impide reutilizarlo en las últimas revisiones vigentes de distintos meses. Las versiones conservan fuentes, fechas, nombres, cuentas y prefijos; ofrecen consulta histórica y JSON completo.

El permiso específico concede lectura del diario completo, cuentas y reversiones, pruebas completas de ingresos devengados y sus conciliaciones, y preparaciones mensuales de IVA ventas con sus documentos. Ese alcance permite reproducir el cálculo. No concede por sí mismo escritura del diario, conciliación de ingresos, preparación fiscal o autorización de comprobantes. El permiso de conciliación de compras sigue separado.

Es un papel de trabajo de movimientos seleccionados. No determina el saldo completo del mayor, saldo técnico, declaración jurada ni ajuste fiscal admitido. Una diferencia cero no acredita correcta imputación fiscal. El artículo 5 de la Ley de IVA contiene reglas que no se reducen a la fecha de factura y requieren revisar el hecho imponible y sus excepciones; este módulo no automatiza todos esos supuestos. Fuente primaria consultada: [Ley de IVA, biblioteca ARCA](https://biblioteca.arca.gob.ar/dcp/TOR_C_020631_1997_03_26).

Las fuentes simuladas conservan la identificación ENSAYO. No se emitió ni presentó información real ante ARCA.

## Ensayo y verificación

Septiembre de 2026, dos sucursales, corte 17/10/2026:

| Concepto | Importe |
| --- | ---: |
| IVA de comprobantes | $87,15 |
| Complemento de ingresos del mes | −$10,50 |
| Referencia de trabajo | $76,65 |
| Primer movimiento vinculado | $74,65 |
| Primera diferencia frente al trabajo | −$2,00 |
| Asiento manual preexistente respaldado | $2,00 |
| Segundo movimiento vinculado | $76,65 |
| Segunda diferencia frente al trabajo | $0,00 |
| Segunda diferencia frente a comprobantes | −$10,50 |

El origen de agosto por $21 se muestra sin sumarlo otra vez. La segunda revisión conserva la primera. Permanecen sin cambios ocho documentos, diez asientos, cinco autorizaciones simuladas, una preparación INT-IVT, dos devengamientos y una conciliación de ingresos. La revisión no contabilizó la corrección: el asiento ya existía.

Pasaron 566 pruebas de dominio, 81 HTTP, 31 fiscales y 36 de archivos: 714 aprobadas y cero fallos. Las compilaciones compartida y del servidor pasaron. Los registros están en `output/qa/vat-sales-ledger-*-final.log` y los de compilación en `output/qa/vat-sales-ledger-*-build.log`.

La recuperación independiente de una copia sellada pasó de revisión 19 a 20, preservó todo el estado, credenciales, autorizaciones y bytes de los archivos, revocó las sesiones de la copia recuperada y comprobó HMAC. La copia temporal se eliminó al finalizar. Script: [verificación de recuperación](../scripts/verify-vat-sales-ledger-recovery.mjs). Resultado: [prueba independiente](../output/qa/vat-sales-ledger-independent-recovery.json).

La [verificación integral](../scripts/verify-vat-sales-ledger-ui.mjs) contrasta el historial, transcripciones, archivos JSON, integridad SQLite, HMAC y fuentes fiscales de 57 bases persistidas. Resultado: [informe](../output/verification-vat-sales-ledger-2026-10-17.json). La [captura nativa](../output/vat-sales-ledger-recovered-2026-10-17.png) muestra el resultado después de recargar. Los bytes JSON fueron contrastados; el evento de descarga del navegador y las exportaciones parciales de tablas no se verificaron.

## Continuidad y archivos de trabajo

Ver [IVA Simple ventas](iva-simple-ventas.md) y la [matriz del PPTX](requisitos-y-alcance.md). Siguen pendientes la determinación fiscal integral, los ajustes con fundamento fiscal y la validación de los servicios reales pertinentes. El objetivo completo del PPTX continúa abierto; esta prueba no certifica cumplimiento normativo integral.

La escritura del proyecto volvió a estar disponible y la documentación y los scripts se integraron en `docs` y `scripts`. Los artefactos previos y el registro del bloqueo se conservaron.
