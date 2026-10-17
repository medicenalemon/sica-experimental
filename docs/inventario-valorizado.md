# Inventario valorizado y costo de ventas

**Contabilidad → Valuación de inventario** ofrece apertura y cierres con promedio ponderado por SKU y depósito. El método de cálculo opera sobre costos históricos nominales en ARS. Se incorpora mediante revisión explícita; no convierte el costo editable del catálogo en un costo contable ni reescribe los asientos originales.

## Apertura

El administrador prepara las cuentas de existencias, costo de ventas, diferencias de inventario, traslados, producción en proceso y mercadería recibida sin facturar. El comando incorpora cuentas faltantes y conserva las asociaciones existentes. Un código ya usado para otro concepto requiere revisión manual; no lo sustituye.

Se elige fecha, referencia, cuentas y **valor total** de todos los saldos no nulos de stock al corte. Las cantidades se calculan del historial. Los valores son datos revisados por el operador; cero también debe declararse. No admite existencias negativas ni cantidades con más de seis decimales. La cuenta de existencias debe estar sin asientos hasta ese corte para evitar una segunda incorporación del activo. La contrapartida de apertura se elige según los saldos anteriores; el capital de la demostración no es una regla para migrar cualquier empresa.

La revisión muestra saldos y asientos por sucursal. Contabilizar conserva movimientos, cantidades, valores, nombres, cuentas y responsable de sesión, y registra Debe Existencias / Haber Contrapartida. No altera cantidades, documentos comerciales ni cuentas corrientes.

## Cierres posteriores

La fecha debe ser posterior al último corte. Se reproducen los movimientos por fecha y orden de registro dentro del día. No se inventa una hora histórica. El método requiere existencias disponibles en esa secuencia aunque el SKU permita stock negativo operacionalmente.

- **Compras recibidas:** cada remito de proveedor necesita factura vinculada con las mismas cantidades, incorporada a costos dentro del corte, o una estimación documentada de todos sus artículos físicos. La estimación devenga un pasivo y la factura posterior lo cancela y concilia sus diferencias; [reglas y límites](recepciones-sin-factura.md). Se toma el neto de cada línea después de descuentos; se agrega el IVA cuando la condición configurada no lo registra como crédito fiscal. Los servicios siguen en gasto. La reclasificación acredita la cuenta de gasto del asiento original de la factura, incluso si cambió después la asociación contable. Las percepciones siguen en sus cuentas separadas; no se capitalizan automáticamente.
- **Salidas comerciales:** el remito de cliente descarga existencias y genera costo de mercadería vendida. La factura vinculada posterior no vuelve a descargar stock. La aplicación usa la entrega registrada como disparador operativo; debe verificarse cuándo se transfiere el control para el contrato concreto y conciliar el reconocimiento de ingresos.
- **Ajustes negativos:** consumen costo promedio contra Diferencias de inventario. Los positivos requieren un valor total y referencia explícitos; acreditan esa misma cuenta. El módulo no crea facturas o deudas para justificar esos valores.
- **Traslados:** la entrada conserva exactamente el costo retirado del origen y se combina con el saldo valorizado del destino. Entre sucursales se utilizan asientos por sucursal y la cuenta de traslados queda cancelada en el consolidado. En una misma sucursal puede no quedar un asiento neto, aunque se conserve el cambio entre depósitos.
- **Fabricación terminada:** consume materiales a promedio ponderado contra Producción en proceso e incorpora ese mismo total al producto terminado. Sus movimientos deben estar completos en el cierre. No incorpora todavía mano de obra, amortizaciones o gastos indirectos; no constituye el costo de producción completo. El costo de gestión de la orden sigue separado.

Cada salida proporcional usa cantidades enteras en millonésimas y cálculo entero para prorratear los centavos. La salida que agota existencias consume todo el valor residual. El costo medio por unidad mostrado es redondeado; la valuación conserva el total del saldo.

Los asientos se registran **en la fecha del corte**, agrupados por sucursal. No son asientos retroactivos individuales con la fecha de cada movimiento. Las compras permanecen como gasto hasta que se contabiliza su recepción valorizada; una factura sin recepción no se capitaliza automáticamente. La versión 5 devenga mercadería recibida sin factura mediante estimaciones explícitas revisadas. No usa precios del catálogo automáticamente. Los servicios sin factura todavía requieren un circuito separado.

## Conservación y límites

La revisión incluye movimientos, costos, saldos y asientos calculados. El servidor vuelve a calcular y rechaza una revisión que cambió, además del control de versión e idempotencia de los comandos. La referencia no se puede repetir. No hay anulación o reapertura de una valuación contabilizada; la recuperación requiere una copia previa revisada.

Las operaciones normales no permiten agregar movimientos de stock hasta el último corte valorizado. Las copias rechazan movimientos omitidos o modificados, costos inconsistentes, asientos perdidos y diferencias entre el saldo contable de existencias y los saldos por sucursal. Cambiar nombres de artículos o depósitos no modifica las constancias. El depósito con movimientos conserva su sucursal y la asociación de existencias permanece fija tras la apertura. Un asiento manual que afecte existencias hasta el corte no puede alterar una valuación ya conservada.

## Correcciones de precio por notas de compra

Los cierres nuevos conservan la versión 5 del cálculo, que agrega recepciones estimadas y conciliación de facturas posteriores. La versión 3 incorporó asignaciones sobre la apertura; la versión 4 incorpora devoluciones físicas vinculadas a notas. La versión 2 incorporó notas de crédito y débito vinculadas a facturas de compras recibidas **después de la apertura**. La nota debe conservar proveedor, sucursal, clase y artículos de la factura, y no ser anterior a ella. Su importe de cada línea modifica el costo de adquisición de las unidades originalmente recibidas; no implica una devolución física. Las notas vinculadas a devoluciones físicas usan el circuito de [devoluciones de stock](devoluciones-stock.md), y se excluyen de las bonificaciones de precio.

Se reproducen las compras y salidas desde la apertura, incorporando las correcciones de precio conocidas hasta el nuevo corte. El ajuste del costo atraviesa los promedios, traslados, consumos de materiales, productos terminados y salidas posteriores a cada recepción. No se cambian las cantidades ni las constancias anteriores. Se registra **la diferencia entre el costo recalculado y los asientos de valuación ya contabilizados**, en la fecha del nuevo corte, incluso si no existen movimientos nuevos. Las cuentas de las salidas anteriores se conservan para esa corrección; las nuevas operaciones usan las cuentas del nuevo corte.

Cada nota conserva un detalle de su efecto por sucursal y cuenta. Las sucesivas notas se incorporan por fecha y orden de registro, con el mismo redondeo entero del CPP; el siguiente corte sin cambios no vuelve a contabilizar el ajuste. Los asientos comerciales de las notas ya modifican proveedores, IVA y gasto de compra. La valuación compensa únicamente su porción de costo de artículos recibidos, usando la cuenta de gasto original de la nota. Los servicios permanecen en gasto. El IVA capitalizable se identifica en el asiento original de cada comprobante para que un cambio posterior de la condición fiscal no reescriba el costo histórico. No se permite que una corrección convierta en negativo el costo de la compra.

La revisión muestra el efecto de cada nota y los asientos netos propuestos; al contabilizar vuelve a calcular todo. Una nota de compra cargada después de un corte conserva su fecha de emisión y se incorpora a contabilidad y costos desde el día siguiente a ese corte. Una copia que altera esas fechas o sus correcciones se rechaza; los períodos contables generales cerrados siguen bloqueados. Las constancias anteriores a esta versión conservan su cálculo original; el primer cierre nuevo puede incorporar una nota posterior sin reescribirlas.

Si la compra fue absorbida en los valores manuales de apertura, falta información que vincule esa apertura con la recepción. Una nota posterior sobre esa compra **requiere una asignación revisada**. La versión 3 ofrece ese reparto en el formulario de cierre y lo conserva con su fundamento. El cierre rechaza una nota pendiente si falta esa asignación. Las notas sobre facturas sin recepción continúan como gasto; no se capitalizan sin bienes recibidos.

### Asignación sobre la apertura

La interfaz presenta cada nota pendiente y el importe de costo de sus artículos recibidos, calculado desde su asiento original. El operador declara magnitudes no negativas en centavos; el signo se aplica por el tipo de nota. Cada artículo de origen debe quedar distribuido **exactamente** entre:

- Saldos de apertura: SKU y depósito que tenían cantidad positiva en ese corte. Se puede identificar un producto transformado antes de la apertura y explicar la relación con el artículo de la nota.
- Resultados de bienes vendidos o consumidos antes de la apertura: sucursal y cuenta de gastos escogida. Se trata de una clasificación operativa de la corrección; no resuelve por sí sola errores de ejercicios anteriores ni la política profesional para esos casos.

Se exige un fundamento de hasta 200 caracteres. El sistema comprueba pertenencia del artículo de origen a la nota y a la recepción, igualdad de importes, unicidad de destinos, sucursales y cuentas existentes, y que los saldos corregidos no se vuelvan negativos. Tampoco permite encubrir un precio de adquisición negativo asignando todo a resultados: concilia el costo por artículo de la factura y sus notas. No deduce automáticamente el origen de los valores manuales de apertura; el vínculo y el reparto son declaraciones revisadas del operador.

La parte atribuida a existencias modifica el saldo de partida del recálculo, conservando cantidades. Las salidas posteriores, traslados y fabricación absorben el nuevo promedio. La parte atribuida a bienes ya vendidos o consumidos se reconoce en la cuenta y sucursal elegidas. La cuenta de compra original de la nota se compensa en su sucursal; si el destino es otra sucursal se usa Traslados a conciliar, con saldo consolidado cero.

La revisión muestra el reparto, su fundamento, el efecto por cuenta y el asiento neto. Todo queda conservado con la constancia. El servidor vuelve a calcular, rechaza una revisión distinta y la restauración verifica también las asignaciones. Los cierres siguientes reutilizan las declaraciones conservadas y no repiten su contabilización. Las constancias de versiones 1, 2 y 3 mantienen sus cálculos y reglas originales.

Una recepción anterior a la apertura cuya factura se incorporó después se concilia si la apertura conservó su deuda estimada: exige un reparto explícito de diferencias por artículo, con fundamento. Si una apertura antigua omitió esa deuda, se bloquea la reclasificación hasta resolver la migración. Reglas en [recepciones-sin-factura.md](recepciones-sin-factura.md).



Faltan devengamiento de servicios sin factura, corrección de aperturas antiguas que omitieron deuda, gastos de adquisición adicionales, costos completos de conversión, recepción parcial valorizada de una factura, producción en curso antes de terminar, desvalorizaciones/valor recuperable, moneda homogénea, otros métodos y cierre anual normativo. La base del marco contable debe aprobarse para la entidad y jurisdicción.

La referencia técnica consultada el 09/10/2026 es el texto aprobado de RT 54 ordenado por RT 59: costo de adquisición y técnicas CPP en los párrafos 103, 291, 296 y 301–304. Se sustituyó el enlace anterior al Proyecto 52, que no era el texto aprobado. Esto no acredita cumplimiento completo del sistema ni resuelve la adopción aplicable a la entidad. [FACPCE, RT 54 ordenada por RT 59](https://www.facpce.org.ar/wp-content/uploads/2024/07/Resolucion-Tecnica-N%C2%B0-59-TO-RT-54-NUA.pdf).

## Permisos y verificación

Los comandos de valuación requieren `/contabilidad/inventario`. Preparar cuentas requiere Administrador General. Un perfil personalizado de costos recibe stock, cuentas y facturas, remitos y notas de compra con sus asientos originales necesarios; las referencias de remitos de clientes se reducen a los campos de clasificación, sin precios ni datos de cliente. Los perfiles de depósito no reciben valuaciones ni asientos de costos y no pueden contabilizarlos.

Las pruebas de dominio cubren apertura, promedio, centavos y fracciones, IVA no recuperable, separación de servicios, traslados entre sucursales, materiales de fabricación, costos explícitos de ajustes, referencias/revisión, recuperación, stock retroactivo, notas en el mismo período y posteriores, agotamiento, cuentas originales, migración de constancias y compras anteriores a la apertura, devoluciones físicas, costo histórico recuperado, diferencias de proveedor e IVA conservado. Las pruebas HTTP del módulo recorren apertura/cierre, notas con perfil exclusivo de costos, idempotencia, persistencia, permisos y rechazo de cambios sobre stock conservado.

El ejemplo local del navegador usa datos sintéticos: apertura al 01/10/2026 de 40 remeras por $400 y 20 pantalones por $200; compra vinculada de diez remeras por $200 netos; entrega de cinco unidades. El cierre al 03/10 calcula $12 por remera, $60 de costo de ventas y existencias de $540 en remeras más $200 en pantalones. Luego, una nota sintética al 04/10 bonifica $20 netos de esa compra: revierte $18 de existencias y $2 del costo de ventas anterior. Quedan $722 de inventario y $58 de costo de ventas acumulado. El asiento nuevo acredita Existencias $18 y Costo de ventas $2, y debita Compras $20. No representa precios reales ni una emisión fiscal.

Con Node 24, después de `npm run build:server` y `npm run build:shared`:

```bash
node scripts/preview-inventory-cost-ui.mjs
```

La vista está en `http://127.0.0.1:3006/contabilidad/inventario`. Acceso de prueba: `admin` / `Sica-Cost-UI-QA-2026`. Usa `var/qa-inventory-cost.sqlite`, fuera de Git, y conserva la base al reiniciar. La contraseña es pública y el servidor escucha exclusivamente en el equipo local.

## Ejemplo local de asignación

Con Node 24 y las compilaciones del servidor e interfaz compartida:

```bash
node scripts/preview-opening-note-ui.mjs
```

La vista está en `http://127.0.0.2:3007/contabilidad/inventario`. Acceso público de prueba: `admin` / `Sica-Opening-UI-QA-2026`. Escucha sólo en esa dirección de loopback; conserva `var/qa-opening-note.sqlite` al reiniciar.

Los datos son sintéticos: de 50 remeras se entregan 20 antes de la apertura. Se declaran 30 unidades por $360 en apertura, más 20 pantalones por $200. Una entrega posterior de cinco remeras registra $60 de costo; el inventario queda en $500. Una nota de compra posterior de $20 netos se reparte en $12 al saldo de apertura y $8 a ventas anteriores. El recálculo lleva $2 de la parte de apertura a la entrega posterior, de modo que el nuevo corte acredita Existencias $10 y Costo de ventas $10, y debita Compras $20. Quedan 25 remeras por $290 y pantalones por $200: $490 de inventario. La apertura y el cierre anterior conservan sus cifras. Es una prueba del circuito de valuación y asignación; no representa balances completos de una empresa ni una emisión fiscal.

## Devoluciones físicas

La versión 4 restaura el costo de entrega en devoluciones de cliente, exige costo histórico declarado si la entrega precede la apertura, descarga CPP en devoluciones a proveedor y muestra la diferencia respecto del costo acreditado. El vínculo con remito y nota se conserva; la nota vinculada no modifica otra vez el precio de adquisición. La revisión y las copias reproducen fuentes y costos. Política, permisos, límites y ejemplo real de interfaz con datos sintéticos en [devoluciones-stock.md](devoluciones-stock.md).

## Integración del ajuste anual por artículo y depósito

La [conciliación INT-CI](conciliacion-inventario-moneda-cierre.md) incorpora el ajuste ya contabilizado al CPP posterior mediante una base virtual. Las versiones anteriores conservan su cálculo nominal; la versión 6 usa la base conciliada, con asignación de notas y facturas de recepciones anteriores, costos recuperados de devoluciones, traslados y continuidad de cierres. Se conservan las fechas originales de estimación de recepciones pendientes. Esta ampliación implementa la capa por artículo/depósito; no completa costos de conversión, valor recuperable ni el conjunto de requisitos normativos.
