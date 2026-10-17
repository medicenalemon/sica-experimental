# Conversión de producción sobre una base de VNR

## Operación incorporada

Las nuevas revisiones **INT-RPC versión 3** incluyen **CPP versión 10**. El puente reconstruye el costo bruto de la fabricación y las salidas que quedaron detrás de una evaluación de VNR, registra el cambio de conversión en la fecha de la nueva información y conserva INT-PC, INT-VI y los cortes anteriores.

La revisión en **Contabilidad → Valuación de inventario → Correcciones vinculadas de producción** identifica la evaluación de VNR y el corte fuente, muestra bruto anterior/revisado, pérdida conservada y neto por SKU y depósito. Conserva juntos reestimación, reclasificación y nuevo CPP, con responsable autenticado, revisión vigente y protección de reintentos.

## Costo bruto y pérdida

El cálculo compara el costo bruto reconstruido al momento del corte fuente con el costo de esa misma historia bajo la nueva conversión. Lleva la diferencia a la apertura utilizada por el CPP y a los resultados de las unidades ya vendidas. Repite este proceso a través de evaluaciones sucesivas, sin volver a contabilizar sus asientos ni modificar cantidades.

La pérdida arranca desde el saldo efectivamente conservado al último corte. Los movimientos actuales consumen o restituyen su parte, y el costo menor libera cualquier exceso que llevaría el neto por debajo de cero. Un aumento posterior del costo no restablece automáticamente pérdidas ya liberadas. Una nueva comparación de VNR, con evidencia y cambio de estimaciones, puede revisar esa pérdida por su propio circuito.

El puente conserva la evaluación anterior; **no convierte una cotización histórica en una evaluación actual**. Antes del cierre debe revisarse el VNR cuando corresponda. La separación de nueva información, comparación con recuperable y fundamentos de pérdidas/reversiones se documenta en la [RT 54, texto ordenado RT 59 y modificatorias](https://www.consejo.org.ar/storage/attachments/Resolucion%20Tecnica%20N%2054%20%28TO%20RT%2059%20y%20modi-7TbUsld18i.pdf). La conservación de la pérdida y el límite de costo son reglas explícitas de esta conciliación; la adopción jurisdiccional y emisión profesional siguen pendientes.

## Devoluciones

Las devoluciones históricas conservadas después de la apertura de VNR reciben la diferencia proporcional del costo de su entrega. El respaldo original no cambia. El nuevo CPP conserva identificación de devolución/entrega e importes anteriores/revisados. Las devoluciones posteriores restituyen la pérdida efectivamente consumida en la entrega; si supera el costo bruto revisado, se restituye esa fuente y se libera el exceso por el límite de costo.

Cuando hay una entrega valorizada, la pantalla propone su costo actualizado y las referencias. El servidor rechaza un importe anterior o una pérdida que no coincidan con la fuente. Si un retorno histórico registrado con el circuito manual anterior ya era inconsistente con una entrega conservada, exige conciliarlo antes de reestimar conversión. Las fuentes sin historia valorizada mantienen su revisión manual.

## Privacidad, conservación y límites

- El administrador revisa la nueva información y el reparto original. Los perfiles de inventario reciben sólo referencias y asignaciones necesarias para reproducir CPP; no reciben gastos fuente, fundamentos financieros ni la revisión privada de RPC.
- Restaurar verifica el puente, sus cantidades, saldo bruto, pérdida, fuente de VNR, revisión y asientos. Las versiones históricas de RPC/CPP mantienen su alcance y revisión originales.
- Deben estar valorizados los movimientos y otras correcciones pendientes antes de conservar RPC. Las partes positivas de la estimación original, bases y actividad normal se mantienen.
- Las bases de moneda de cierre requieren todavía su puente. Una fabricación incorporada sólo en una apertura manual, sin fila de fabricación valorizada, necesita reconciliar su conversión antes de reestimarla. Notas de proveedor, conciliaciones de factura, anulaciones, cambios de bases, producción parcial y materiales anormales continúan pendientes.

## Evidencia sintética del 13/10/2026

Ejemplo textil, Responsable Inscripto en Tucumán. Al 12/10 el inventario tiene materias primas $70 y una unidad terminada por $35; VNR reconoce pérdida $10, dejando neto $95. La nueva cotización del servicio fijo reduce la deuda $30, conversión $9 y ociosidad $21: $3 de conversión alcanzan proceso, $3 existencias y $3 costo de ventas.

El producto terminado queda en **bruto $32, pérdida $10 y neto $22**. El total de inventario queda en bruto $102/pérdida $10/neto $92; la orden B mantiene $17 en proceso y el CMV acumulado queda en $32. Se conservan INT-VI-00000001 y los cuatro cortes anteriores; INT-RPC vincula INT-RS y **INT-VC-00000005 con CPP10**, en la revisión 2 de `var/qa-production-vnr-bridge.sqlite`.

Se verifican límites y aumentos posteriores, nueva evaluación explícita, consumo de pérdida, devoluciones antes/después de la reestimación, devoluciones con pérdida superior al nuevo bruto, varias aperturas de VNR, propuesta/rechazo de costo histórico, privacidad y recuperación. La evidencia incluye las capturas `output/production-vnr-bridge-review-2026-10-13.jpg`, `output/production-vnr-bridge-saved-2026-10-13.jpg` y `output/production-vnr-bridge-detail-2026-10-13.jpg`, el recorrido DOM y `output/verification-production-vnr-bridge-2026-10-13.json`.

Pasaron **514 pruebas**: 404 de dominio, 32 de archivos, 56 HTTP y 22 fiscales; lint y compilaciones de interfaz/servidor. Se verificaron **30 bases** con validación completa después de JSON, integridad SQLite y auditoría HMAC. El objetivo integral del PPTX permanece activo.
