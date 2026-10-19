# Valor recuperable de inventario y CPP neto

SICA incorpora una comparación revisada INT-VI en Contabilidad → Valuación de inventario. Se conserva el costo bruto del SKU y depósito y se reconoce la pérdida en una cuenta regularizadora del activo. La cantidad y los comprobantes comerciales no cambian. Las salidas posteriores consumen la parte proporcional de esa pérdida y presentan su costo neto en CPP versión 7. Las versiones 1–6 y sus cortes permanecen consultables.

## Referencia normativa y alcance

La referencia consultada es la [RT 54, texto ordenado por RT 59 y modificaciones posteriores](https://www.consejo.org.ar/storage/attachments/Resolucion%20Tecnica%20N%2054%20%28TO%20RT%2059%20y%20modi-7TbUsld18i.pdf), párrafos 296–304 y 309–311. El inventario se compara con su valor neto de realización según la forma de realización. Se admiten partidas individuales, conjuntos comerciales complementarios, líneas relacionadas con evidencia de impracticabilidad y misma zona geográfica, y realización mediante productos terminados, descontando costos para completar y vender. La aplicación no verifica por sí sola la adopción profesional específica en Tucumán ni determina la norma aplicable a cada entidad.

El operador define miembros completos y documenta precios, gastos directos, fecha de evidencia, moneda homogénea y alcance. La selección parcial queda identificada y no acredita una revisión de todo el inventario. Una reversión necesita cambios de estimaciones fundamentados y nunca lleva el neto por encima del costo sin pérdida. No se usa el máximo entre valor de uso y VNR de bienes de uso para esta comparación. El catálogo de precios tampoco determina automáticamente un VNR.

## Contabilización y continuidad

- Pérdida: débito a Pérdidas por desvalorización de inventario y crédito a Desvalorización acumulada de inventario.
- Reversión: débito a la cuenta regularizadora y crédito a Reversiones de desvalorización de inventario, separadas del CMV.
- Venta: el CPP conserva su salida bruta; la pérdida proporcional se debita de la cuenta regularizadora y reduce el CMV de esa salida.
- Traslado: lleva el costo bruto y la pérdida al depósito y sucursal de destino, cancelando la cuenta de tránsito.
- Fabricación: lleva la pérdida atribuible a los materiales a las unidades producidas junto con su costo bruto; no agrega mano de obra ni costos indirectos todavía pendientes.
- Devolución de cliente: recupera el costo bruto y la pérdida de la entrega original. Si la entrega es anterior a una nueva base, requiere importes y respaldo manuales en la moneda de esa base.
- Devolución de proveedor: cancela la pérdida proporcional y reconoce la diferencia entre crédito y costo neto en Diferencias de inventario.
- Corrección de precio: el recálculo limita la pérdida conservada al costo bruto corregido y reconoce el exceso liberado como reversión. No duplica compras, salidas ni pérdidas ya contabilizadas.

La cuenta regularizadora se fija desde la primera comparación. Debe presentarse en el mismo rubro de inventarios en la preparación de estados contables. Los asientos y saldos se concilian por sucursal. No se permiten asientos manuales ajenos a su subregistro. La evaluación sólo se incorpora en el último corte valorizado exacto y en una fecha abierta; una evaluación retroactiva no puede modificar costos posteriores conservados.

## Revisión, acceso y conservación

El perfil de inventario puede revisar y conservar comparaciones y CPP. Sólo el Administrador General prepara las cuentas. El servidor verifica permisos, actor, revisión, versión, idempotencia y validación completa dentro de una transacción. Los perfiles de stock y notas no reciben estas comparaciones ni sus datos contables. La copia de seguridad conserva fuentes, cantidades, valores, repartos y asientos; la restauración rechaza cambios inconsistentes.

Las nuevas comparaciones usan revisión completa versión 2, que incluye por separado venta estimada, gastos de venta, fundamento de reversión y evidencia de líneas relacionadas, aunque el VNR final coincida. Las primeras dos constancias de ensayo conservadas durante este desarrollo retienen su revisión anterior y siguen siendo legibles; no se pueden crear comparaciones nuevas con esa versión. La auditoría HMAC conserva su integridad. Los registros de ensayo no son documentación fiscal ni profesional.

## Recorrido verificado

El ejemplo usa comercio textil, Responsable Inscripto, Tucumán, con valores e índices sintéticos:

1. El inventario conciliado tenía doce unidades y costo bruto de $2.000. Venta estimada $1.300 menos gastos $100: VNR $1.200. INT-VI-00000001 conservó pérdida $800, sin cambiar cantidades ni cortes nominales anteriores.
2. La entrega posterior de tres unidades consumió costo bruto $500 y pérdida $200: CMV neto $300. INT-VC-00000004 conservó nueve unidades, costo bruto $1.500, pérdida $600 y neto $900.
3. Una nueva cotización por $2.000 permitió revertir sólo $600: INT-VI-00000002 dejó neto $1.500. La interfaz rechazó primero la reversión sin fundamento de nuevas estimaciones. Ambas comparaciones y el CPP se recuperaron desde SQLite. Una tercera revisión completa conservó por separado venta estimada $2.000 y gastos cero, sin otro asiento.

Se verificaron también devoluciones de clientes/proveedores, devolución histórica después de otra comparación, correcciones de precio, fabricación, traslados entre sucursales, cantidades fraccionarias, agotamiento de centavos, límites del alcance y copia alterada. Los anexos conservan siete hojas XLSX con importes numéricos y siete páginas PDF revisadas visualmente. Los bytes verificados proceden del registro persistido; activar los botones del navegador no acredita por sí solo una descarga.

Evidencia: [verificación completa](../output/verification-inventory-recoverability-2026-10-12.json), [recorrido textual](../output/inventory-recoverability-browser-2026-10-12.txt), [pérdida](../output/inventory-recoverability-loss-2026-10-12.jpg), [CPP neto](../output/inventory-recoverability-costing-2026-10-12.jpg), [reversión](../output/inventory-recoverability-reversal-2026-10-12.jpg), [XLSX](../output/valor-recuperable-inventario-2026-10-12.xlsx) y [PDF](../output/pdf/valor-recuperable-inventario-2026-10-12.pdf).

## Pendientes concretos

La conciliación anual INT-CI ahora distribuye la reexpresión del costo bruto y de la cuenta regularizadora por artículo y depósito, con continuidad del CPP neto y conservación de fuentes. El ajuste anual requiere clasificación no monetaria y orígenes revisados; [reglas y evidencia de la conciliación neta](conciliacion-inventario-neto-moneda-cierre.md). Queda pendiente el circuito completo de una comparación con VNR actual después de expresar a moneda de cierre; llevar a esa moneda una pérdida anterior no sustituye dicha comparación.

También siguen pendientes costos completos de conversión, tratamiento de errores de períodos cerrados, otras bases de medición, verificaciones fiscales reales, adopción jurisdiccional y emisión profesional. La nueva funcionalidad no certifica el cumplimiento contable/fiscal integral de la aplicación ni completa todo el objetivo del PPTX.
