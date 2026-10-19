# Corrección de conversión de lotes terminados y vendidos

## Operación incorporada

La revisión **INT-RPC versión 2** amplía la nueva estimación de servicios a órdenes en proceso, lotes terminados, ventas parciales y lotes agotados. Mantiene la proporción del servicio elegida originalmente, las bases por orden y la actividad normal de costos fijos. Los gastos no asignados y la ociosidad conservan su tratamiento en resultados.

En **Contabilidad → Valuación de inventario → Correcciones vinculadas de producción**, el Administrador General revisa la nueva información del servicio y el fundamento del reparto. La propuesta distingue variaciones de deuda, producción en proceso, existencias, costo de ventas y otros gastos. Muestra el asiento de reestimación INT-RS, la reclasificación de conversión y los asientos del CPP vinculado. La conservación de los tres registros se realiza en una transacción, con revisión vigente, responsable autenticado y protección de reintentos.

## Conciliación del costo

El **CPP versión 9** reproduce movimientos, materiales, fabricación y salidas con la conversión revisada disponible en la fecha de la corrección. Compara los asientos recalculados con los efectivamente conservados y agrega la diferencia en un nuevo corte, sin modificar cortes anteriores ni movimientos físicos. La parte de órdenes sin terminar sigue en proceso; las unidades conservadas cambian su costo promedio; la parte vendida afecta el costo de ventas en la fecha de la nueva información. Un corte posterior sin novedades no repite el ajuste.

La revisión de RPC enlaza el nuevo corte CPP y su revisión completa. Los perfiles de inventario reciben sólo las referencias y asignaciones necesarias para reproducir CPP, mientras que fuentes, fundamentos financieros y revisión privada de RPC permanecen reservados. Se mantienen las cuentas originales de los asientos alcanzados, incluso si cambió la cuenta configurada de CMV. Los nombres comerciales conservados en el respaldo no se recalculan por un cambio posterior del catálogo.

El registro de nueva información en el período actual se apoya en los párrafos 90–91 de la [RT 54, texto ordenado RT 59 y modificatorias](https://www.consejo.org.ar/storage/attachments/Resolucion%20Tecnica%20N%2054%20%28TO%20RT%2059%20y%20modi-7TbUsld18i.pdf). El recálculo histórico es la conciliación del importe a registrar hoy; los asientos previos permanecen intactos. Los errores originales tienen un tratamiento distinto, todavía pendiente de su circuito específico. La decisión de mantener el reparto proporcional requiere respaldo de la empresa; no acredita adopción jurisdiccional ni emisión profesional.

## Requisitos y ampliaciones pendientes

- Los lotes terminados y los movimientos/correcciones de inventario deben estar valorizados antes de revisar RPC. La fecha debe ser posterior al último corte CPP. Así, la propuesta distingue la nueva estimación de otras operaciones pendientes.
- Las fuentes deben seguir siendo partes positivas del devengamiento original. Las partes repetidas en un mismo grupo y reestimaciones utilizadas como fuentes separadas requieren consolidación previa.
- Las bases reexpresadas siguen requiriendo su conciliación de moneda. Una evaluación de VNR anterior puede sustituir la apertura del CPP y cortar la historia de fabricación: corregir conversión anterior a esa apertura requiere un puente de costo y desvalorización. Este caso se detecta y no guarda una corrección parcial. Un VNR posterior a RPC conserva el costo ya corregido.
- Las notas de proveedor, diferencias de conciliación con factura, anulaciones y nuevos criterios de asignación requieren ampliar el circuito vinculado. Materiales anormales, producción parcial/en proceso y otros tratamientos del PPTX continúan en la matriz general.
- Restaurar exige enlace íntegro RPC/CPP9, revisión, fuentes, prefijos, destinos y asientos. Las correcciones históricas de sólo proceso mantienen su versión y alcance originales.

## Evidencia sintética del 12/10/2026

Ejemplo textil, Responsable Inscripto en Tucumán. El lote A tiene dos unidades y costo original **$70**: materiales $30 + conversión $40. Una unidad ya se entregó, con CMV $35 y existencia restante $35. B conserva conversión $20 en proceso.

La nueva cotización reduce el servicio fijo de $60 a $30, manteniendo tres horas reales frente a diez normales. La conversión total disminuye $9: **$3 en proceso, $3 en existencias y $3 en costo de ventas**. La ociosidad disminuye $21. A queda con conversión $34, costo total $64, unidad existente $32 y CMV $32; B conserva $17 en proceso. El inventario total queda en **$102** —materias primas $70 + producto terminado $32—, la deuda del servicio en $30, ociosidad en $21 y administración en $5.

El navegador conserva INT-RPC-00000001, INT-RS-00000001 e INT-VC-00000004 con CPP9 en `var/qa-production-finished-correction.sqlite`, revisión 2. Los tres cortes anteriores e INT-PC original permanecen conservados. Se comprueban lotes sin vender/agotados, órdenes pendientes, reestimaciones sucesivas, cortes sin duplicación, restauración, privacidad, cambio de cuenta y de nombres, VNR y el recorrido de pantalla.

La evidencia se conserva en `output/production-finished-correction-review-2026-10-12.jpg`, `output/production-finished-correction-browser-2026-10-12.txt` y `output/verification-production-finished-correction-2026-10-12.json`. Pasaron **503 pruebas**: 394 de dominio, 32 de archivos, 55 HTTP y 22 fiscales; lint, compilaciones de interfaz/servidor y comprobación de diferencias. Se verificaron **29 bases** mediante validación completa después de JSON, integridad SQLite y HMAC. La captura `output/production-finished-correction-saved-2026-10-12.jpg` muestra la constancia recuperada. El objetivo integral del PPTX permanece activo.


## Ampliación vigente sobre VNR

Las nuevas revisiones **RPC versión 3 / CPP10** incorporan el [puente de conversión sobre VNR](conversion-sobre-base-vnr.md), conservan la pérdida y sus movimientos reales, aplican el límite de costo y actualizan devoluciones históricas. Las constancias RPC2/CPP9 mantienen su alcance original. El puente de moneda de cierre continúa pendiente.
