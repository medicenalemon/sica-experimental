# Devoluciones físicas de mercadería

**Stock y logística → Devoluciones físicas** registra entradas de clientes y salidas a proveedores. Es un circuito interno de cantidades; la nota de crédito continúa modificando la cuenta corriente y generando su asiento comercial en Clientes o Proveedores.

## Registro y vínculo

Se selecciona un remito que haya movido stock, fecha posterior al último corte valorizado, depósito activo de su sucursal, motivo y cantidades. Sólo se admiten productos físicos, una línea por SKU, hasta seis decimales y hasta la cantidad del remito que aún no se devolvió. La devolución a proveedor controla disponibilidad por fecha y salidas posteriores, respetando la configuración operacional de stock negativo. El costo CPP exige siempre cantidades cronológicamente disponibles.

El registro conserva una constancia `INT-DV`, contraparte, remito, depósito, artículos, cantidades y responsable autenticado. Produce un movimiento por artículo una sola vez. No cambia el remito, factura ni nota. El detalle y el historial ofrecen XLSX y PDF como constancias internas; no reemplazan documentación fiscal ni de transporte.

Puede vincularse una nota existente al registrar, o después desde el detalle de una devolución pendiente. Debe ser crédito de la factura vinculada a ese remito, con la misma contraparte, sucursal y clase. Sus artículos físicos y cantidades deben coincidir exactamente con una sola devolución. Líneas de servicio pueden acompañar la nota y mantienen su tratamiento comercial. Un vínculo conservado no se reemplaza y vincularlo no mueve stock otra vez.

La nota y el movimiento físico deben estar dentro del corte para contabilizar costos. Si falta la nota, el cierre espera el vínculo. Una nota ya incluida en un corte de costos no se puede reclasificar después como devolución; debe completarse el vínculo antes de valorizarla. El módulo no intenta deducir si una nota sin vínculo es por precio o devolución.

## Valuación y política operativa

La versión 4 del cálculo excluye las notas vinculadas a devoluciones del recálculo de bonificaciones de precio:

- **Cliente:** incorpora el costo de las unidades de la entrega original y revierte su costo de ventas. Las devoluciones parciales prorratean el saldo de costo aún no devuelto con centavos exactos; la última consume todo el residual. No usa precio de venta ni costo editable del catálogo. Si la entrega es anterior a la apertura manual, requiere declarar el costo total histórico devuelto y una referencia. Las correcciones posteriores de precio de compras recalculan también esa entrega y su devolución.
- **Proveedor:** descarga el CPP del depósito de salida. Compensa en Compras el costo acreditado de los artículos físicos, usando la cuenta e IVA recuperable/no recuperable del asiento original de la nota. La diferencia entre ese importe y el CPP se reconoce en la cuenta elegida de Diferencias de inventario: un crédito superior al costo genera Haber en esa cuenta, uno inferior genera Debe. Los servicios acreditados permanecen en gasto y las percepciones no se capitalizan automáticamente.

El tratamiento de la diferencia del proveedor es una **política operativa explícita del prototipo**, revisable para la entidad. La referencia FACPCE usada para CPP y consistencia de medición no prescribe por sí sola esta clasificación exacta. No se afirma su adopción normativa en Tucumán ni cumplimiento integral. El operador revisa costos, importe acreditado, diferencia, saldos y asientos antes de contabilizar. Los asientos se agregan al corte; las constancias anteriores conservan sus cifras.

La revisión conserva las fuentes de devolución y notas. El servidor reproduce el cálculo, controla revisión y versión, y ejecuta comandos atómicos e idempotentes. Las copias verifican límites del remito, movimientos físicos, nota vinculada y asientos de costos. Versiones 1–3 de valuación mantienen sus reglas originales.

## Acceso y límites

Registrar o vincular exige `/stock/devoluciones`, disponible para Depósito y perfiles personalizados autorizados. Un perfil que sólo tiene ese permiso recibe documentos con cantidades y referencias, sin sus precios, totales, autorizaciones fiscales, listas de precios ni asientos. Un perfil exclusivo de costos recibe devoluciones y referencias mínimas de las notas de cliente, además de los documentos de compra y asientos necesarios para reproducir la valuación.

Se requiere el circuito remito → factura vinculada → nota. Faltan devoluciones de facturas directas sin remito, una nota distribuida en varias devoluciones, reemplazos, anulaciones/reversiones operativas, mercadería averiada con desvalorización y devoluciones parciales de producción. Una devolución física no autoriza reintegros de dinero ni emite comprobantes fiscales reales.

## Prueba local

Con Node 24, después de compilar servidor e interfaz compartida:

```bash
npm run build:server
npm run build:shared
node scripts/preview-stock-return-ui.mjs
```

Vista: `http://127.0.0.3:3008/stock/devoluciones`. Acceso público de prueba: `admin` / `Sica-Returns-UI-QA-2026`. Escucha sólo en loopback y conserva `var/qa-stock-returns.sqlite` al reiniciar.

La empresa es sintética: apertura $600; compra de diez remeras por $200 netos y entrega de cinco con costo $60; existencias $740. En la interfaz se registraron el 08/10/2026 dos remeras devueltas por cliente, se comprobó el rechazo del cierre sin nota y luego se vinculó la nota del 04/10. También se registraron dos remeras enviadas al proveedor, vinculadas a su nota del 05/10 por $40 netos. El cierre revisado del 08/10 recuperó $24 de costo de ventas, descargó $24 al proveedor y reconoció $16 a favor en Diferencias de inventario. Quedaron 45 remeras por $540 y 20 pantalones por $200. Costo de ventas acumulado: $36. El total de existencias coincidió con el anterior porque entrada y salida tenían igual costo; son dos movimientos físicos conservados.

Evidencia: [constancia de ejemplo](../output/stock-returns-example.json), [captura de interfaz](../output/stock-returns-2026-10-08.png) y [verificación](../output/verification-devoluciones-2026-10-08.json). Son datos de prueba y no balances completos ni emisiones fiscales.
