# Recepciones de mercadería sin factura

La versión 5 de **Contabilidad → Valuación de inventario** permite cerrar existencias con mercadería recibida cuya factura aún no se incorporó. Se declara un costo total estimado por artículo físico del remito y un fundamento. Una factura vinculada posterior cancela esa deuda y concilia la diferencia con su costo original. La operación requiere revisar los saldos y asientos antes de contabilizar.

## Estimación en el corte

El administrador prepara la cuenta **2.1.6 Mercadería recibida sin facturar**, del grupo Pasivo. Se conserva cualquier asociación existente; una colisión de códigos requiere revisión. Cada estimación conserva la cuenta escogida, el remito, proveedor, artículos, cantidades, valor y fundamento de hasta 200 caracteres.

El formulario solicita todos los artículos físicos de cada recepción pendiente dentro del corte. El importe es el costo total del artículo recibido, no el precio por unidad. Se expresa en ARS, se guarda en centavos y puede ser cero si se declara explícitamente. No se toma automáticamente el precio de referencia del remito ni el costo editable del catálogo. Se requiere el fundamento del operador y se rechazan artículos faltantes, repetidos, desconocidos o remitos ya facturados dentro de ese corte.

Una recepción posterior a la apertura incorpora **Debe Existencias / Haber Mercadería recibida sin facturar** por el importe estimado. Las salidas usan ese valor en el CPP. El siguiente cierre conserva la deuda pendiente y no vuelve a devengarla. La estimación no genera un comprobante comercial ni una deuda en la cuenta corriente individual del proveedor; es un pasivo contable conciliable mediante el detalle por remito.

La estimación excluye el IVA recuperable y debe incluir el impuesto no recuperable en el costo declarado. No registra crédito fiscal ni agrega importes al libro IVA. Los servicios de un remito no tienen movimiento físico y quedan fuera de esta estimación; su devengamiento sin factura todavía requiere otro circuito. La factura conserva su asiento original de proveedor, gasto e impuestos.

## Factura posterior

La factura debe vincularse al remito original y conservar proveedor, sucursal, artículos y cantidades. Facturar no incorpora nuevamente stock. La parte capitalizable se obtiene del neto por artículo y del tratamiento de IVA del asiento original, para que un cambio posterior de configuración no reescriba ese costo. Los servicios y percepciones permanecen separados.

Para recepciones posteriores a la apertura, se reproduce el CPP desde su entrada con el costo facturado. La diferencia alcanza existencias, entregas y devoluciones de clientes, traslados y materiales consumidos. Se contabiliza la diferencia respecto de los asientos conservados: cancela el pasivo estimado, compensa el gasto original de los bienes y ajusta las cuentas afectadas. Las cantidades y constancias anteriores permanecen intactas. Las notas posteriores siguen su circuito de correcciones de precio o devoluciones físicas.

El detalle conserva estimación, costo facturado, diferencia, fecha de emisión de la factura, fecha de incorporación a costos y efecto por sucursal y cuenta. Una diferencia cero también conserva una conciliación y cancela la deuda una sola vez. Si la diferencia es negativa, revierte costo; no admite saldos corregidos negativos.

### Fecha de emisión y fecha de registro

Una factura o nota de compra de mercadería recibida que se carga después de un corte y tiene fecha de emisión hasta ese corte conserva su fecha de emisión. El servidor deriva su fecha de registro contable e incorporación a costos como el día siguiente al último corte, y conserva el identificador de esa constancia. El cliente no puede imponer esas marcas. Los listados de comprobantes muestran ambas fechas; las conciliaciones y correcciones también las distinguen. El asiento comercial de esa compra se registra en la fecha derivada, mientras que el ajuste de inventario se registra en el nuevo corte revisado.

Esto preserva cortes de inventario, pero **no reabre períodos contables generales**. Si la fecha original está bloqueada por un cierre general, o la fecha derivada queda fuera del ejercicio, la operación se rechaza. No resuelve automáticamente errores de ejercicios anteriores ni constituye una regla fiscal de imputación del IVA: los reportes fiscales de trabajo siguen usando la fecha del comprobante y requieren conciliación profesional.

## Recepción incluida en una apertura manual

La apertura ya contiene valores totales revisados de las existencias restantes. Deben identificarse también los remitos pendientes de factura a esa fecha, incluso si sus artículos fueron vendidos o transformados antes de abrir. Su costo estimado reconoce **Debe Contrapartida de apertura / Haber Mercadería recibida sin facturar**. No se agrega nuevamente su importe al activo declarado. La contrapartida elegida debe conciliarse con la migración real; la cuenta de capital de la demostración no determina la política de una empresa.

Cuando llega la factura, falta información para deducir qué parte de la diferencia pertenecía a existencias de apertura o a bienes vendidos antes de ella. El formulario exige un reparto por artículo de origen, con magnitudes no negativas cuyo signo aplica según la diferencia:

- **Existencias de apertura:** SKU y depósito con cantidad positiva en la apertura. Puede identificarse un producto transformado, explicando el vínculo.
- **Resultados anteriores:** sucursal y cuenta de gastos elegida para los bienes ya vendidos o consumidos.

Cada diferencia, incluso cero, debe quedar distribuida exactamente. Se conserva un fundamento y se comprueban destinos, cuentas, unicidad y valor neto no negativo de cada saldo. Las diferencias positivas y negativas de componentes asignadas al mismo producto se suman antes de validar su saldo. La porción de existencias ajusta la base de CPP y alcanza movimientos posteriores; la otra se registra en la cuenta escogida. Se cancela la estimación completa y se compensa el costo facturado. Una nota posterior requiere su propio reparto y no vuelve a crear la deuda cancelada.

Una apertura antigua que omitió la estimación de una recepción sin factura bloquea su reclasificación posterior. No se supone que una factura nueva sea un gasto nuevo o que ese pasivo ya estaba migrado. Falta un procedimiento específico de corrección de migraciones conservadas; actualmente requiere revisar la copia y la apertura previa.

## Controles y límites

El servidor reproduce la revisión con los datos vigentes, exige el permiso de costos y obtiene el responsable de la sesión. Controla versión e idempotencia. Las restauraciones verifican estimaciones, facturas, fechas derivadas, repartos, conciliaciones, asientos y el saldo de mercadería sin facturar por cuenta y sucursal en cada corte. Una alteración o asiento manual incompatible impide restaurar la copia. Las constancias de versiones 1–4 conservan su cálculo original.

El perfil exclusivo de costos recibe los datos necesarios de proveedores y sus asientos originales; los remitos de clientes mantienen referencias y movimientos con precios y datos personales reducidos. Depósito no puede contabilizar costos. Los detalles de recepciones y conciliaciones tienen exportación XLSX/PDF.

La recepción es el disparador operativo de este prototipo. Debe verificarse la transferencia de control y la obligación en el contrato concreto. No hay recepción parcial valorizada de una factura, devengamiento de servicios sin factura, gastos adicionales completos, conversión completa, trabajo en curso, valor recuperable ni reexpresión por inflación. No acredita cumplimiento integral.

La referencia técnica ahora es el texto aprobado de la **RT 54 ordenado por RT 59**, no el Proyecto 52 enlazado anteriormente. Sus párrafos 18–19 tratan devengado; 103, costo de adquisición; 291 y 301–304, bienes de cambio y técnicas de costo. La política operativa de SICA necesita revisión para la entidad y jurisdicción. [FACPCE, texto aprobado](https://www.facpce.org.ar/wp-content/uploads/2024/07/Resolucion-Tecnica-N%C2%B0-59-TO-RT-54-NUA.pdf). El CGCET publicó novedades sobre la aplicación de NUA y una dispensa de presentación que no posterga su aplicación; faltan revisar las disposiciones concretas para la entidad. [CGCET, comunicación de abril de 2026](https://www.cgcetucuman.org.ar/el-cgcet-adopto-la-resolucion-jg-n-660-2026-de-facpce/). Fuentes consultadas el 09/10/2026.

## Ejemplos locales comprobados

Con Node 24 y las compilaciones compartida y de servidor:

```bash
node scripts/preview-unbilled-receipt-ui.mjs
node scripts/preview-unbilled-receipt-ui.mjs --opening
```

Son servidores independientes, exclusivamente de loopback, con datos sintéticos conservados al reiniciar. Acceso público de prueba: `admin` / `Sica-Receipts-UI-QA-2026`.

| Ejemplo | Dirección | Cierre verificado desde la interfaz al 09/10 |
| --- | --- | --- |
| Recepción posterior a apertura | `http://127.0.0.4:3009/contabilidad/inventario` | Estimación original $200, factura $220, ajuste de $18 a existencias y $2 a ventas anteriores. Otra recepción estimada manualmente por $200. Existencias finales $958, deuda sin factura $200 y costo de ventas acumulado $62. |
| Recepción en apertura | `http://127.0.0.5:3010/contabilidad/inventario` | Diferencia $20 repartida manualmente en $12 a apertura y $8 a ventas anteriores. La entrega posterior absorbe $2: el corte debita existencias $10, costo de ventas $10 y cancela deuda $200. Inventario final $510, deuda estimada cero. |

Las pruebas cubren diferencias positivas, negativas y cero, agotamiento, servicios e IVA original, facturas y notas cargadas tarde, devoluciones, traslados, repartos mixtos, recuperación y rechazos atómicos. La suite HTTP verifica el perfil de costos, revisión, reintentos, persistencia e integridad. `scripts/verify-receipt-ui.mjs` comprueba las bases de los ejemplos y guarda `output/verification-receipts-2026-10-09.json`. La captura del navegador integrado no estuvo disponible en esta revisión; las operaciones y resultados sí quedaron verificados por interfaz y SQLite.
