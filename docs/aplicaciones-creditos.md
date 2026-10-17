# Aplicaciones posteriores de créditos

En **Finanzas → Cuentas por cobrar / pagar**, el panel de aplicaciones permite asignar un cobro, pago, nota de crédito o saldo inicial negativo ya registrado a uno o varios cargos pendientes. Cada destino debe pertenecer a la misma contraparte, tipo de cuenta y sucursal. Se admiten aplicaciones parciales y hasta cien destinos por constancia.

El operador elige el crédito, los importes, fecha, referencia y motivo. «Revisar aplicación» muestra la disponibilidad del crédito y de cada cargo antes y después; la confirmación exige que esa revisión siga vigente. La constancia INT-AC conserva comprobantes de origen, importes, referencia, motivo, responsable autenticado y fecha de creación. «Ver constancia» permite consultar el detalle y el historial puede exportarse a XLSX/PDF.

## Efectos y disponibilidad

Se agrega una constancia independiente. Los comprobantes y sus aplicaciones originales permanecen intactos. La nueva asignación no genera cobros, pagos, asientos, stock, comisiones, IVA ni otros impuestos: cambia exclusivamente qué parte del crédito y del cargo se considera aplicada. El saldo neto de la contraparte se conserva.

El formulario reserva todas las aplicaciones conocidas, incluso las posteriores al corte consultado, para impedir usar dos veces un importe. La fecha de una nueva constancia debe ser igual o posterior a los comprobantes y a otras aplicaciones o reversiones conservadas que afecten esos documentos. Una cancelación nueva tampoco puede usar con fecha anterior el saldo que libera una reversión posterior. Si el origen tiene aplicaciones originales a un cargo futuro, esa parte ya está reservada y no se ofrece como crédito libre.

El formulario de un nuevo cobro o pago toma los pendientes actualizados. El servidor comprueba la revisión, los importes, los destinos, los permisos, la versión y los reintentos dentro de su transacción. Dos solicitudes simultáneas sobre la misma versión no pueden consumir el crédito dos veces. Las referencias no pueden repetirse, sin distinguir mayúsculas, dentro del tipo de cuenta y sucursal.

## Liberación de aplicaciones originales

«Liberar aplicación original» permite corregir lo asignado al emitir un recibo, pago, nota de crédito o saldo inicial negativo. Se eligen sus destinos originales y se libera todo o parte de cada importe, con fecha, referencia, motivo y revisión. Cada liberación conserva el comprobante completo y descuenta de la asignación efectiva sólo lo solicitado. No permite liberar un cargo ajeno, un importe negativo o mayor al original todavía no liberado.

El crédito vuelve a estar disponible y el cargo recupera su pendiente desde esa fecha. Puede registrarse una nueva aplicación al mismo cargo o a otro de la misma cuenta, conservando ambas constancias. Esa nueva aplicación no habilita a liberar por segunda vez el importe original. Una liberación se conserva; para restituir su asignación se crea una nueva aplicación revisada.

Este control comparte permisos, referencias, revisión, concurrencia, recuperación e históricos con las demás constancias INT-AC. También alcanza pagos a proveedores y notas de crédito sin cambiar la factura asociada, el IVA ni sus asientos. Los cierres y aperturas anteriores permanecen conservados cuando se libera en un ejercicio siguiente.

## Reversión y períodos

«Revertir aplicación» libera la constancia completa y conserva su vínculo con la original. Requiere otra referencia, fecha abierta, motivo y revisión. Sólo se revierte una vez. Para redistribuir una parte se revierte la constancia y se registran las nuevas asignaciones revisadas. No se modifica el documento de cobro ni se devuelve dinero.

La antigüedad y la cuenta corriente muestran las constancias hasta el corte consultado. Una reversión del día 15 no cambia la consulta del día 14. El cierre conserva las aplicaciones dentro de sus fuentes y la apertura identifica los cargos y créditos con sus importes pendientes; las operaciones posteriores no reescriben ese detalle. Se comprobó aplicación en un ejercicio, cierre/apertura y reversión en el siguiente.

Las restauraciones reproducen cada revisión a partir del prefijo conservado de comprobantes de esa cuenta, verifican el orden y los importes y rechazan sobreaplicaciones en fechas intermedias, aunque una reversión futura dejara el saldo final correcto. Los roles autorizados para cuenta corriente o cobros/pagos reciben las constancias necesarias para calcular pendientes; otros módulos no las reciben. Gestionarlas requiere permiso de Finanzas → Cuentas por cobrar / pagar.

## Verificación del 14/10/2026

Pasaron **485 pruebas de dominio y 71 HTTP**, con lint y compilaciones de interfaz compartida/servidor. **47 bases** conservaron validación completa después de JSON, integridad SQLite, auditoría HMAC y conciliación de antigüedad.

En el navegador se aplicaron $200 de un anticipo de $300 a una factura A por $1.210. Al 14/10 quedaron cargo pendiente $1.010 y crédito libre $100, con saldo neto $910. La reversión del 15/10 restituyó pendientes $1.210 y crédito $300, manteniendo el neto $910. La consulta del 14 conservó la aplicación. La base agregó únicamente dos constancias: comprobantes, IVA $210, efectivo $300, asientos, stock y el resto del estado original permanecieron iguales.

Se conservan captura nativa, revisiones y recorrido DOM. Informe: `output/verification-account-applications-2026-10-14.json`. El verificador reproducible es `scripts/verify-account-applications-ui.mjs`.

El circuito administra asignaciones posteriores y liberaciones documentadas de aplicaciones originales. Quedan pendientes compensaciones entre contrapartes o sucursales, convenios, intereses y evaluación de recuperabilidad de créditos. Tampoco interpreta la exigibilidad legal ni sustituye el tratamiento fiscal que correspondía al cobro original. Las restantes ampliaciones del objetivo integral siguen abiertas.


### Ampliación verificada: aplicaciones originales

Se verificaron **493 pruebas de dominio y 72 HTTP**, incluidas liberaciones parciales por destino, notas, pagos a proveedores, límites, permisos, revisión desactualizada, concurrencia, reintentos y conservación entre ejercicios. **48 bases** mantuvieron validación completa después de JSON, integridad SQLite, HMAC y conciliación de antigüedad.

El navegador partió de un recibo de $300 con $200 aplicados originalmente. Liberó $150 al 14/10 y asignó $100 al 15/10. La aplicación original del comprobante permanece en $200; la efectiva final queda en $150, con cargo pendiente $1.060, crédito libre $150 y saldo neto $910. Todavía pueden liberarse $50 del original; la nueva asignación tiene su propio circuito de reversión. IVA $210, efectivo $300, comprobantes, asientos y stock se conservaron. El corte del 14 mantuvo el efecto anterior a la reasignación.

Se conservan captura nativa y recorrido DOM; informe `output/verification-original-applications-2026-10-14.json`, reproducible con `scripts/verify-original-applications-ui.mjs`. Las restantes ampliaciones del objetivo integral permanecen abiertas.
