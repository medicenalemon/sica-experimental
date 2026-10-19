# Recuperabilidad de producción pendiente

INT-VP compara la conversión activada en cada orden pendiente con el importe recuperable del producto terminado: precio del lote completo menos costos de venta y todos los materiales y trabajos restantes. Las materias primas sin consumir continúan en el inventario físico, con su evaluación separada. Se mantiene el ejemplo textil, Responsable Inscripto, Tucumán, y la autoría de Mauricio Montero y Débora Pardes.

## Recorrido disponible

1. Conservar la imputación completa INT-PC; valuar los movimientos físicos pendientes.
2. En Valuación de inventario, preparar las cuentas de recuperable de producción y una comparación por orden. Seleccionar producción con conversión pendiente completa o una selección parcial.
3. Documentar el precio del lote, gastos para venderlo, materiales y trabajos todavía necesarios, evidencia, fecha y moneda homogénea. Revisar los importes antes de conservar INT-VP.
4. La pérdida se registra en resultados y en una cuenta regularizadora de proceso. El costo bruto, las deudas, los gastos originales y los movimientos físicos permanecen conservados.
5. Una nueva comparación puede reconocer pérdidas adicionales o revertirlas, con nuevas estimaciones documentadas y hasta el costo que existiría sin desvalorización.
6. Al terminar una orden, CPP11 incorpora materiales y conversión a su costo bruto. Transfiere la pérdida de conversión desde la regularizadora de proceso a la de inventario. Las ventas consumen la pérdida proporcional, sin otro gasto de desvalorización.
7. El producto terminado puede compararse nuevamente con VNR mediante INT-VI. El límite para una reversión es el costo bruto conservado, no el valor neto después de la pérdida.

La comparación requiere Administrador General. El perfil de inventario recibe únicamente las referencias y los importes necesarios para reproducir el CPP; no recibe evidencia comercial, revisiones financieras ni el diario de la pérdida de proceso. El servidor verifica permisos, revisión vigente y repetición de solicitudes antes de guardar; constancias y fuentes se verifican al restaurar desde JSON/SQLite.

## Moneda de cierre

Cuando existe pérdida de proceso anterior al ajuste anual, deben revisarse por separado la naturaleza no monetaria y las antigüedades del costo bruto y de la cuenta regularizadora. INT-CP permite repartir ambas capas por orden, conciliándolas con sus mayores por sucursal. La pérdida ajustada debe quedar entre cero y el costo bruto ajustado. La conciliación no agrega un segundo asiento.

Si la pérdida ya fue transferida a inventario, INT-CI conserva costo y pérdida por artículo y depósito, incluso cuando la regularizadora se originó en CPP11 y todavía no existe una evaluación INT-VI. Los cortes, las comparaciones de proceso y las imputaciones nominales siguen recuperables. El VNR actual del inventario físico mantiene su ventana de cierre y sus estados finales derivados.

Una corrección vinculada de conversión con pérdida activa en proceso exige ampliar su puente antes de aplicarla. Después de una reversión revisada, la corrección puede conservar sus destinos y el CPP11 correspondiente. No se elimina la comparación anterior para habilitar la corrección.

## Evidencia de ensayo

El navegador conservó INT-VP-00000001 con A: costo bruto $40, recuperable $30 y pérdida $10; B: costo $20, recuperable $65 y valor reconocido limitado a $20. Total de proceso neto: $50. Las tres unidades de materia prima de cada orden ($30) todavía estaban pendientes de consumo.

Con comandos autenticados se finalizó A: lote bruto $70, conversión $40, pérdida transferida $10 y neto $60. La entrega posterior de una unidad tuvo costo bruto $35, pérdida consumida $5 y costo neto de ventas $30. B conservó $20 en proceso; quedó pérdida $5 en el inventario terminado. El corte siguiente no agregó asientos. Las constancias INT-PC e INT-VP originales permanecieron iguales.

También se verificaron pérdida total, reversión del producto terminado, corrección después de reversión y ajuste anual con pérdida aún en proceso o ya transferida al inventario. Con índices sintéticos 100/150, proceso bruto $60 pasa a $90 y pérdida $10 a $15; el lote A recibe esa pérdida ajustada sin volver a reconocerla.

Pasaron 533 pruebas: 421 de dominio, 32 de archivos, 58 HTTP y 22 fiscales. Se verificaron 34 bases con validación completa después de JSON, integridad SQLite y auditoría HMAC. Captura: `output/production-recoverability-detail-2026-10-13.jpg`; informe: `output/verification-production-recoverability-2026-10-13.json`.

## Fuente y límites

Los criterios de comparación según utilización, recuperación mediante productos terminados, reconocimiento en resultados y reversión limitada se apoyan en los párrafos 296–301 de la [RT 54, texto ordenado RT 59 y modificaciones, publicado por el Consejo](https://consejo.org.ar/storage/attachments/Resolucion%20Tecnica%20N%2054%20%28TO%20RT%2059%20y%20modi-7TbUsld18i.pdf), consultado el 13/10/2026. La identificación por orden, las dos regularizadoras y su transferencia mediante CPP11 son decisiones de implementación que requieren respaldo de la entidad.

Se incorporó la [comparación actual de proceso posterior a INT-AI y sus estados finales](recuperable-actual-produccion-cierre.md). Permanecen pendientes comparaciones conjuntas entre órdenes y materias primas, producción parcial y consumos anormales, correcciones con pérdida activa y otras ampliaciones del PPTX. La comparación de una selección parcial no acredita revisión completa. Los índices y precios usados son sintéticos; no verifican adopción profesional en Tucumán, impuestos reales ni emisión fiscal. El objetivo integral continúa abierto.
