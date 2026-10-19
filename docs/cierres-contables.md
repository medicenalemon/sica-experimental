# Cierres de períodos y balance de comprobación

El PPTX, diapositivas 76–77, pide diario cronológico, mayor y balance de sumas y saldos. El informe distingue saldo inicial, movimientos del rango seleccionado y saldo final. El saldo inicial acumula asientos anteriores a «Desde»; el filtro de sucursal se aplica tanto a esos asientos como a los movimientos. Se comprueban por separado los totales deudores y acreedores iniciales, el Debe/Haber del período y los saldos finales. Un rango inválido o un asiento inconsistente impide presentar un balance calculado. Los importes se suman en centavos enteros seguros.

## Registrar un bloqueo revisado

1. Revisar diario, imputaciones, devengamientos y ajustes que correspondan al período. Si hubo movimientos de mercadería, contabilizar una valuación de inventario exactamente en la fecha elegida para cerrar.
2. Abrir Contabilidad → Cierres de períodos. El Administrador General indica fecha, referencia única y fundamento de la revisión.
3. Revisar el balance consolidado, la comprobación por sucursal y las observaciones. La fecha debe pertenecer al ejercicio y ser posterior al bloqueo vigente.
4. Reconocer todas las observaciones y registrar el cierre. Si cambian las fuentes, referencia, fundamento o fecha después de preparar la revisión, hay que volver a prepararla.

El bloqueo alcanza a toda la empresa, aunque se haya seleccionado una sucursal en la cabecera. La constancia `INT-CC-...` conserva responsable de la sesión, fecha de registro, rango, antecedente, balance y fuentes financieras acumuladas: asientos, estructura financiera de comprobantes, movimientos de stock y movimientos de tesorería. El cierre no genera asientos. Los cierres siguientes incorporan el saldo anterior como apertura y preservan las constancias existentes.

La validación de la base y de las copias recuperadas vuelve a comprobar las fuentes y la secuencia. No se pueden cambiar importes, cuentas, conceptos o fechas cubiertos manteniendo una constancia incompatible. Se admite renombrar cuentas y agregar cuentas sin movimientos; el grupo de una cuenta utilizada no puede cambiar. Los datos descriptivos privados de clientes y proveedores no forman parte de la revisión financiera expuesta a un perfil que sólo consulta cierres.

Configuración muestra la fecha bloqueada en modo de lectura. El cambio de datos generales conserva el identificador de la constancia vigente. Un perfil con permiso de consulta de cierres puede leer el detalle financiero necesario; únicamente el Administrador General puede registrar el bloqueo. En modo compartido, permisos, responsable, versión e identificador de reintento se validan en el servidor y el registro se guarda en una transacción SQLite.

## Observaciones y límites

Las observaciones incluyen la política nominal de inventario, recepciones con deuda estimada sin factura, servicios recibidos sin factura, entregas pendientes de facturar y revisión fiscal de comprobantes de venta. Al cerrar al final del ejercicio se agrega una observación específica sobre procesos anuales pendientes. Si el bloqueo fue generado por un cierre de resultados, conserva el vínculo e indica que las cuentas de resultados ya quedaron canceladas.

Marcar «Revisado» conserva una declaración del operador. No demuestra por sí solo que se haya registrado un ajuste ni calcula su importe. El profesional debe determinar el tratamiento de cada operación y cargar los ajustes necesarios antes de bloquear. Los servicios consumidos como gasto admiten [devengamiento, reestimación por nueva información y conciliación revisados](servicios-devengados.md). Una estimación que ya tiene factura debe estar conciliada antes del cierre. Los [ingresos realizados sin factura](ingresos-devengados.md) admiten evidencia de aceptación/conclusión, IVA revisado, activo separado y conciliación obligatoria de la factura antes de cerrar. Los servicios con otro tratamiento todavía necesitan revisión y registro manual; las recepciones de mercadería estimadas siguen el circuito de [recepciones-sin-factura.md](recepciones-sin-factura.md).

Se trata de un bloqueo operativo. El [cierre de cuentas de resultados](cierre-resultados.md) ya agrega asientos por sucursal y bloqueo del ejercicio con balances anteriores y posteriores conservados. La [apertura del siguiente ejercicio](apertura-ejercicio.md) conserva saldos nominales y operaciones pendientes. Todavía faltan estados contables completos, notas y anexos, ajustes por inflación, valor recuperable y otros tratamientos normativos. Tampoco autoriza comprobantes ni presenta impuestos. Las reglas de inventario permanecen en [inventario-valorizado.md](inventario-valorizado.md). Esta funcionalidad no acredita cumplimiento contable o fiscal integral.

La conciliación bancaria puede continuar después del cierre porque sus marcas y vínculos no cambian el importe ni la fecha del movimiento conservado. Una operación financiera nueva con fecha cubierta por el bloqueo se rechaza. Actualmente no existe una reapertura controlada con nueva constancia: para corregir un bloqueo se necesita revisar y recuperar una copia anterior mediante el procedimiento de [servidor-y-recuperacion.md](servidor-y-recuperacion.md), considerando también las operaciones posteriores que esa recuperación reemplazaría. No se debe recuperar una copia sin esa revisión.

Las bases antiguas con una fecha de bloqueo sin constancia se aceptan como antecedente. El primer cierre nuevo conserva esa fecha; no inventa una revisión histórica inexistente. La protección del modo local depende del almacenamiento del navegador. En el servidor, la auditoría HMAC permite detectar alteraciones sin la clave; quien controla el servidor y la clave conserva capacidad de reescritura.

## Verificación sintética

La base `var/qa-accounting-close.sqlite` contiene un ejemplo textil, responsable inscripto, Tucumán, sin identidad fiscal real. En la interfaz se registró un cierre al 09/10/2026 con tres observaciones reconocidas. Saldo final deudor y acreedor: $1.066,20. Existencias: $958; costo de ventas: $62; IVA crédito de referencia: $46,20; proveedores: $266,20; mercadería recibida sin factura: $200; capital: $600. Son importes sintéticos para comprobar el circuito, sin afirmar que el ejemplo sea un balance profesional completo.

El rango del 04/10 al 09/10 mostró $740 iniciales y $218 de movimientos para existencias, con saldo final $958; costo de ventas inicial $60 más $2, con saldo final $62. La revisión persistida, integridad SQLite y auditoría se verifican mediante `scripts/verify-accounting-close-ui.mjs`. Evidencia: [verification-accounting-close-2026-10-09.json](../output/verification-accounting-close-2026-10-09.json). La captura del navegador no estuvo disponible; la evidencia no incluye una imagen simulada.
