# Bajas de bienes de uso

SICA permite registrar una baja total por venta, pérdida o abandono desde Contabilidad → Bienes de uso y depreciaciones. El responsable confirma la transferencia o pérdida de control, su fecha y su respaldo. Cada baja conserva su revisión, número INT-BA, responsable, fecha de registro y asientos por sucursal.

El costo nominal original y las constancias anteriores permanecen como antecedentes. Se retiran el costo y la depreciación acumulada de las cuentas del activo. El valor neto se reconoce en una cuenta de otros gastos; en las ventas, el ingreso neto correspondiente se reclasifica del ingreso comercial original a otros ingresos. El resultado mostrado es la venta neta menos el valor neto retirado. No se modifica la factura, el IVA, la deuda original, los cobros, los pagos ni el stock de reventa.

## Procedimiento

1. Preparar las cuentas de bajas con un administrador, o seleccionar cuentas imputables separadas: otros ingresos y valor neto de baja. No usar las asociaciones automáticas ni el gasto de depreciación.
2. Para una venta, registrar la factura de cliente. Una entrega vinculada debe conservar cantidad, unidad, contraparte, sucursal y la misma fecha de la factura y de transferencia de control. El responsable identifica el bien particular que se vende.
3. Contabilizar la depreciación hasta la fecha de baja inclusive. Una venta del mismo día permite este cargo final. Ventas o entregas anteriores pendientes de conciliar impiden seguir depreciando.
4. Seleccionar Dar de baja, causa, fecha, referencia y evidencia. Revisar costo, depreciación, valor neto, venta, IVA de la línea, resultado y asientos por sucursal antes de registrar.
5. Consultar la constancia conservada. La tabla muestra Baja registrada y valor neto cero desde la fecha del evento, y conserva el costo de alta y la depreciación como antecedentes. Las métricas de bienes vigentes excluyen esos saldos.

En una factura mixta se reclasifica sólo el neto de la línea vendida. Si la factura y el activo pertenecen a sucursales distintas, cada sucursal mantiene un asiento balanceado para su propia reclasificación. Una línea de factura sólo puede conciliarse una vez; un bien sólo puede darse de baja una vez.

Los cortes posteriores incluyen un antecedente de baja y congelan sus cargos. El cálculo conservado en la depreciación de la fecha del evento se mantiene para recuperar su revisión original; la situación del registro y los saldos contables de esa fecha ya reflejan la baja. Los cierres anteriores mantienen sus documentos, parámetros y cargos originales. Un cierre posterior exige conciliar todas las líneas vendidas y entregadas de bienes de uso, y conserva las bajas hasta su fecha. La apertura del ejercicio siguiente arrastra los saldos del activo ya retirado en cero.

## Alcance pendiente

El circuito genérico de ingresos sin factura rechaza nuevas líneas de bienes de uso. Los ingresos legados permanecen recuperables, pero una venta vinculada a ese devengamiento requiere su conciliación y reclasificación específicas antes de registrar una baja. Un perfil exclusivo de bienes de uso sólo recibe los enlaces a remito y SKU de esas constancias, sin sus importes ni evidencia privada.

Este circuito admite la línea adquirida completa, con la misma cantidad y unidad, costo positivo y venta neta positiva cuando corresponde. No distribuye componentes ni unidades de una compra agrupada. Requieren ampliar el circuito las bajas parciales, las ventas sin factura o con transferencia y facturación en fechas distintas, donaciones, permutas, venta a precio cero, costos de disposición, notas de compras o ventas que modifican el bien, reversión de una baja y reconocimiento de indemnizaciones. Pérdida o abandono no crean automáticamente un crédito a una aseguradora. Las compensaciones exigibles deben reconocerse separadamente con su evidencia.

El modelo continúa siendo nominal. El deterioro de bienes de uso se integra mediante [evaluaciones revisadas INT-VR](valor-recuperable-bienes-de-uso.md): la baja retira también su saldo acumulado y calcula el resultado desde el neto remanente. No resuelve revaluación, ajuste por inflación ni los estados contables completos. La adopción normativa y su aplicación a la entidad y jurisdicción concretas requieren su revisión profesional.

## Referencia normativa consultada

La [RT 54, texto ordenado RT 59 y modificaciones publicado por el Consejo](https://www.consejo.org.ar/storage/attachments/Resolucion%20Tecnica%20N%2054%20%28TO%20RT%2059%20y%20modi-7TbUsld18i.pdf), consultada el 11/10/2026, establece el criterio general de baja por transferencia o pérdida de control y el reconocimiento de la diferencia en resultados (§§46–48). Para bienes de uso, remite a ese criterio (§358), separa el resultado de disposición de las actividades ordinarias (§351) y trata compensaciones por pérdidas como hechos separados (§347). Estas referencias orientan los controles implementados; no acreditan cumplimiento integral para una entidad particular.

## Verificación del 11/10/2026

Pasaron 338 pruebas: 260 de dominio, 13 de archivos/QR, 43 HTTP y 22 fiscales. Lint y las compilaciones local, compartida y de servidor pasaron. Las nuevas pruebas cubren ventas con ganancia/pérdida, facturas mixtas, pérdidas/abandonos, terrenos, residual cero, sucursales diferentes, cantidades completas, evidencia, fechas, cuentas, permisos, reintentos, cierres previos, ingreso legado, apertura del siguiente ejercicio y recuperación de fuentes y asientos alterados.

Desde la interfaz se revisó, registró y recuperó una baja sintética del 20/10: costo ARS 1.000, depreciación ARS 600, neto retirado ARS 400, venta neta ARS 800 y ganancia ARS 400. La factura conservó IVA ARS 168 y total ARS 968. El costo y la depreciación acumulada quedaron en cero; la compra anterior mantuvo su IVA ARS 210 y deuda ARS 1.210. El cierre del 10/10 conservó neto ARS 700. Seis asientos acumulan ARS 5.578 por cada lado.

Diecisiete bases pasaron validación completa después del recorrido JSON, integridad SQLite y cadena HMAC. Evidencia: [registro recuperado](../output/asset-disposal-2026-10-11.png), [detalle INT-BA](../output/asset-disposal-detail-2026-10-11.png), [transcripción](../output/asset-disposal-browser-2026-10-11.txt) e [informe de verificación](../output/verification-asset-disposal-2026-10-11.json). Para repetir el caso, usar Node 24, compilación compartida y servidor, `scripts/preview-asset-disposal-ui.mjs` y `scripts/verify-asset-disposal-ui.mjs`. Los datos y credenciales son exclusivos del ensayo, sin operaciones reales.
