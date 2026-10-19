# Reestimaciones vinculadas de conversión en proceso

## Operación incorporada

En **Contabilidad → Valuación de inventario → Correcciones vinculadas de producción**, el Administrador General puede revisar nueva información sobre servicios devengados incorporados a órdenes que todavía están íntegramente en proceso. La constancia **INT-RPC** conserva juntos el cambio del gasto/pasivo estimado **INT-RS** y la reclasificación de conversión. La estimación inicial, INT-PC y los asientos anteriores permanecen intactos.

Se indican nuevos importes de cada servicio, fecha, referencia, nueva información y fundamento del reparto. La confirmación mantiene la parte del servicio seleccionada y las bases originales de cada grupo, sin volver a estimar actividad normal ni horas de órdenes. La revisión muestra variaciones de deuda, proceso y gastos del período, el reparto por orden y ambos asientos. Un cambio de fuente o revisión invalida la propuesta. El guardado es atómico, atribuye el administrador autenticado y conserva las referencias para el próximo CPP versión 8.

## Medición y centavos

La proporción seleccionada de cada cuenta de la estimación original se aplica al nuevo costo de esa cuenta. Las partes de distintos grupos/constancias y la parte no imputada se distribuyen conjuntamente con restos mayores: su suma no excede el costo actualizado, incluso con un único centavo. Las reestimaciones sucesivas parten de las proporciones originales y comparan contra la última medición conservada; no multiplican redondeos anteriores.

Los grupos directos/variables mantienen su base real; los fijos conservan actividad real y normal; los excluidos no se activan. La variación en gastos del período es el cambio total del servicio menos el cambio incorporado a proceso, e incluye partes no asignadas. El respaldo del grupo también conserva por separado su ociosidad. El próximo lote terminado incorpora materiales y conversión actualizada, sin modificar valuaciones históricas.

El tratamiento de nueva información y la separación de costos de conversión, actividad normal y ociosidad se apoya en los párrafos 90–91 y 104–110 de la [RT 54, texto ordenado RT 59 y modificatorias](https://consejo.org.ar/storage/attachments/Resolucion%20Tecnica%20N%2054%20%28TO%20RT%2059%20y%20modi-7TbUsld18i.pdf). La conservación del criterio proporcional es una decisión explícita de esta operación, que debe respaldarse para la empresa. Este circuito corresponde a cambios de estimación; los errores originales requieren su tratamiento específico. La adopción jurisdiccional y emisión profesional siguen pendientes.

## Alcance controlado

- La fuente debe ser una parte positiva del asiento de devengamiento original. Una reestimación utilizada como fuente separada o partes repetidas de una línea dentro del mismo grupo requieren consolidación previa.
- Todas las órdenes afectadas deben seguir íntegramente en proceso. La fecha debe ser posterior al último corte CPP y no preceder a la imputación. No admite bases con ajuste anual o conciliación de moneda.
- Las notas de proveedor, diferencias de conciliación con factura y anulaciones mantienen sus bloqueos cuando afectan conversión. Las correcciones de productos terminados/existencias/costo de ventas, el cambio de bases y una nueva imputación desde la fuente corregida requieren ampliar la conciliación.
- El perfil de inventario recibe sólo identidad, fecha, órdenes y asignaciones necesarias para reproducir CPP; no recibe fuentes financieras, fundamentos, asientos de corrección ni revisión privada. Otros perfiles sin inventario no reciben estas referencias.
- Restaurar exige revisión reproducible, vínculos de fuente, prefijos de diario/stock/imputaciones, reparto, asientos y secuencia íntegros. Quitar o alterar la constancia vinculada se rechaza.

## Evidencia sintética del 12/10/2026

Empresa textil de prueba, Responsable Inscripto en Tucumán. El servicio fijo pasa de **$60 a $30**, conservando tres horas reales frente a diez normales. La conversión del grupo baja de **$18 a $9** y su gasto de ociosidad de **$42 a $21**. El conjunto de conversión pasa de **$60 a $51**: orden A **$40 → $34** y B **$20 → $17**. La deuda del servicio queda en **$30**, administración en **$5** y gastos totales revisados en **$26**. INT-PC original sigue mostrando $60/$47 como respaldo histórico.

El navegador conservó INT-RPC-00000001 en `var/qa-production-correction.sqlite`, revisión 2, y se recuperó el detalle después de recargar. La prueba HTTP termina posteriormente la orden A: materiales $30 + conversión $34 = lote $64, dejando $17 de conversión en B. El perfil restringido reproduce exactamente la revisión CPP del administrador.

Pasaron 493 pruebas: 385 de dominio, 32 de archivos, 54 HTTP y 22 fiscales, incluidas reestimaciones sucesivas, partes de un centavo, costos fijos parciales, permisos, revisión obsoleta, atomicidad, privacidad, CPP posterior y rechazo de restauraciones alteradas. Se verificaron 28 bases con validación completa después de JSON, integridad SQLite y auditoría HMAC. La evidencia conservada incluye captura real de la revisión, transcripción DOM de la constancia recuperada y validación de bases. La captura posterior al guardado no estuvo disponible:

- `output/production-correction-review-2026-10-12.jpg`.
- `output/production-correction-browser-2026-10-12.txt`.
- `output/verification-production-correction-2026-10-12.json`.

El objetivo integral del PPTX permanece activo; esta ampliación no acredita cumplimiento contable/fiscal completo ni conexión real a ARCA.


## Ampliación vigente: lotes terminados y vendidos

La primera etapa de sólo proceso se conserva para las constancias históricas. Las nuevas revisiones **INT-RPC versión 2** incluyen [conciliación de lotes terminados y vendidos mediante CPP9](correcciones-conversion-lotes-terminados.md), con reestimación, reclasificación y corte vinculado en una transacción. El cambio se reparte entre proceso, existencias y costo de ventas; los movimientos pendientes deben valorizarse antes. Las bases de VNR que sustituyen fabricación y las bases reexpresadas todavía necesitan ampliar sus puentes.


Las nuevas revisiones **RPC3/CPP10** incluyen [continuidad de conversión sobre VNR y devoluciones](conversion-sobre-base-vnr.md), manteniendo las evaluaciones y cortes originales. Las bases reexpresadas siguen requiriendo ampliar su puente.
