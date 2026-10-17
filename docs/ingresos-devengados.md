# Ingresos realizados sin factura

Contabilidad → Ingresos devengados permite revisar ventas de bienes entregados y aceptados o servicios concluidos antes de su factura. Complementa las diapositivas 52–54 y 76–77 del PPTX. El remito por sí solo no prueba el devengamiento: el operador documenta la aceptación o conclusión, el precio acordado y el tratamiento fiscal. Las constancias son internas; no autorizan facturas ni sustituyen sus plazos de emisión.

## Criterios y alcance

La RT 54, texto ordenado consultado con sus modificaciones, párrafos 523, 523A y 525, vincula el ingreso con la conclusión económica y el control obtenido por el cliente. El precio convenido excluye los importes cobrados por cuenta de terceros, como IVA. Fuente primaria: [RT 54 / NUA, pp. 92–94 del PDF](https://www.consejo.org.ar/storage/attachments/Resolucion%20Tecnica%20N%2054%20%28TO%20RT%2059%20y%20modi-7TbUsld18i.pdf). La norma aplicable y su adopción en Tucumán siguen requiriendo definición por empresa.

La Ley de IVA, artículo 5, contempla para ventas la entrega o factura, según cuál ocurra antes; para servicios, la conclusión o percepción, con excepciones. Por eso este circuito incorpora IVA revisado al devengar, sin presumir que sólo nace al facturar. Fuentes primarias: [Ley de IVA, texto actualizado en ARCA](https://biblioteca.afip.gob.ar/dcp/TOR_C_020631_1997_03_26) y [plazos de emisión y entrega de comprobantes](https://www.afip.gov.ar/facturacion/comprobantes/emision.asp). Consulta: 11/10/2026.

La implementación admite operaciones simples a precio fijo cuyo reconocimiento contable y nacimiento fiscal coinciden con la fecha del remito. Exige esa misma fecha, abierta dentro del ejercicio. No sirve para diferir obligaciones de facturación o tributación ni para registrar retroactivamente fechas bloqueadas. Servicios continuos, consignaciones, anticipos, fechas fiscales distintas, componentes financieros y contraprestación variable necesitan otros circuitos.

## Registrar el ingreso

1. Registrar el remito de cliente. Para bienes, este movimiento ya controla el stock; la valuación CPP registra su costo por su propio circuito.
2. Preparar la cuenta de ventas sin factura, si todavía no existe. El Administrador General puede incorporar el activo `1.1.12 · Ventas realizadas sin facturar`; no se reemplazan cuentas existentes.
3. Elegir el remito, referencia única, fundamento contable, activo separado y fundamento fiscal. Para cada artículo elegido, indicar el importe neto total de toda su cantidad, cuenta de Ingresos, alícuota o tratamiento de IVA y evidencia de aceptación/conclusión. No se infiere el precio del catálogo.
4. Revisar detalle y asiento, y registrar la constancia `INT-DI-...`. El servidor conserva revisión exacta, evidencia, fuente, cantidades, cuentas, responsable de sesión, fecha y asiento vinculado. Los datos cambiados requieren una nueva revisión.

Se pueden reconocer distintos artículos del remito mediante constancias separadas. Cada artículo sólo se devenga una vez y por su cantidad completa; no admite subdividir nuevamente esa cantidad. Una devolución ya registrada en la fecha del remito impide reconocer toda la entrega por este circuito. Un remito ya facturado no admite un nuevo devengamiento.

El asiento debita el activo por neto más IVA y acredita Ingresos por el neto e IVA débito por el impuesto revisado. No crea deuda en la cuenta corriente, cobro, movimiento de caja ni nueva salida de stock. Las cuentas de activo e IVA deben estar separadas de otras asociaciones automáticas. Una empresa que no sea responsable inscripta no admite IVA débito discriminado en este circuito.

## Conciliar la factura

Registrar la factura asociada al remito por el circuito habitual. Una factura interna X no permite conciliar este ingreso; se requiere un borrador A/B/C compatible con las condiciones fiscales. La conciliación exige la factura del mismo remito, cliente, sucursal y cantidades, una fecha abierta posterior o igual a su registro contable y un fundamento revisado.

La factura mantiene su asiento, cuenta corriente, IVA, percepciones y detalle. `INT-CI-...` agrega una reclasificación que cancela el activo sin facturar, retira el ingreso e IVA duplicados de las cuentas **originales de esa factura** y registra las diferencias frente al precio e impuesto reconocidos. Las cuentas usadas siguen siendo las originales aunque luego se modifiquen las asociaciones automáticas. Cada constancia se concilia una vez; una factura mixta puede conciliar varias constancias independientes sin reclasificar sus artículos no seleccionados.

Una factura de $110 netos y $23,10 IVA frente a un devengamiento de $100 netos y $21 IVA deja $110 de ingreso acumulado, $23,10 de IVA y cero en el activo sin facturar. El cliente conserva su cargo de $133,10. Los importes son sintéticos.

## Cierres, apertura e informes

El cierre conserva los devengamientos y conciliaciones conocidos hasta su fecha. Si ya hay factura registrada al corte, exige conciliar cada devengamiento antes de bloquear, para impedir duplicaciones. Sin factura, conserva una observación sobre evidencia, precio, impuesto, emisión pendiente y devoluciones. Una entrega parcialmente devengada mantiene además la observación por sus artículos pendientes.

El cierre de resultados incorpora estos ingresos por sucursal. La apertura conserva el activo, el IVA y los pendientes del ejercicio anterior; las conciliaciones posteriores no cambian esas constancias. Si el ingreso original ya quedó cerrado, el nuevo ejercicio registra sólo las diferencias, conservando el saldo patrimonial inicial.

Reportes → IVA ventas y compras, también disponible en Finanzas → Impuestos, muestra una sección separada de devengamientos y descuentos de importes ya reconocidos. El indicador de IVA ventas combina esas constancias con los comprobantes seleccionados. Una factura pendiente de conciliación al corte produce un aviso de posible duplicación. Los perfiles exclusivos de impuestos reciben los importes necesarios, sin evidencia, fundamentos ni revisión completa del ingreso. Estas filas son un papel de trabajo y **no** un archivo para cargar directamente en IVA Simple.

Los reportes comerciales de ventas y el tablero siguen mostrando facturas y notas registradas. Para el ingreso contable devengado corresponde consultar diario, mayor, sumas y saldos y este módulo.

## Verificación y pendientes

La interfaz registró en `var/qa-revenue-accrual.sqlite` una entrega textil aceptada de cinco unidades: $100 netos, $21 IVA y $121 de activo; luego una factura por $110 netos y su conciliación. Tras recargar quedaron pendientes cero, Ingresos $110, IVA $23,10, Clientes $133,10, existencias $50 y costo de ventas $50. El papel de trabajo al 03/10 conserva $21 de IVA antes de la factura; al 05/10 muestra $23,10 sin duplicación.

Evidencia real: [pantalla conciliada](../output/revenue-settlement-2026-10-11.png), [papel de trabajo de IVA](../output/revenue-vat-work-2026-10-11.png) y [verificación persistida](../output/verification-revenue-accrual-2026-10-11.json). El script `scripts/verify-revenue-accrual-ui.mjs` comprueba importes, revisiones, actores, partidas originales, stock, costos, JSON, integridad SQLite y HMAC de doce bases de ejemplo. Pasaron **285 pruebas**: 213 de dominio, 13 de archivos/QR, 37 HTTP y 22 fiscales, junto con lint y compilación compartida.

Permanecen pendientes la reestimación antes de facturar, anulación de ingresos sin factura, reducción parcial de entregas no facturadas, reclasificación detallada de notas posteriores, fechas contables y fiscales separadas, servicios continuos, declaraciones y autorización fiscal productiva. Las devoluciones se registran por su módulo; su efecto contable y fiscal exige revisión y vinculación con factura/nota. El circuito no acredita cumplimiento integral ni reemplaza estados contables y ajustes normativos.
