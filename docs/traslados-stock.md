# Traslados entre depósitos

Esta función completa el circuito de stock y logística del prototipo. Es una propuesta de implementación: las diapositivas 78–79 del PPTX contemplan depósitos, existencias, ajustes y remitos; la operación de traslado vinculada se agregó para gestionar cambios de ubicación dentro de la empresa.

## Operación

En Stock y logística → Traslados entre depósitos, crear un traslado e indicar fecha, origen, destino, motivo y artículos. Solo se pueden seleccionar depósitos de sucursales activas y SKU de tipo Producto. El origen y destino deben ser diferentes. Se admite hasta 100 SKU por traslado, sin repetirlos; cada cantidad debe ser positiva, hasta 1.000.000 unidades y con hasta seis decimales.

Al guardar, SICA crea la constancia `INT-TR-00000001` y, por artículo, una salida del origen y una entrada equivalente en el destino. Ambas se guardan juntas. No aumenta ni reduce las existencias totales de la empresa, ni crea ventas, compras, deuda, cobros o asientos. Cada movimiento lleva la sucursal de su depósito. El selector superior muestra un traslado si la sucursal elegida participa en su origen o destino.

El circuito registra recepción inmediata: usar la fecha en que la mercadería ya está recibida. No se administra transporte en curso ni confirmación de recepción diferida. La constancia interna no reemplaza un remito autorizado para circulación de mercadería.

## Disponibilidad y permisos

El servidor controla el ejercicio y el período cerrado. Para productos que prohíben stock negativo, comprueba las existencias del origen al día elegido y las salidas ya registradas en días posteriores. Un ingreso futuro no respalda una salida anterior. Si falta un componente o una referencia es inválida, no se agrega ningún movimiento ni constancia. Los productos que admiten stock negativo conservan esa opción explícita.

Administrador General, Administración y Depósito pueden registrar traslados. Producción no recibe ese permiso automáticamente. Un perfil Personalizado necesita `/stock/traslados`. Tener ese permiso no habilita ajustes manuales. El responsable se obtiene de la sesión; el comando no acepta un responsable suministrado por el formulario.

El servidor utiliza el control de revisión y el identificador de solicitud existente para impedir sobrescrituras y movimientos duplicados al reintentar. La auditoría registra la operación dentro de la misma transacción.

## Historia, exportación y recuperación

La constancia conserva nombres de los depósitos, referencias de sucursales, SKU, descripción y unidad del artículo de ese momento. Editar el catálogo después no cambia el detalle histórico. El listado y el detalle pueden exportarse a XLSX/PDF internos.

No se edita ni elimina un traslado registrado. Una devolución se registra como otro traslado con origen y destino invertidos y una referencia al original en el motivo; debe cumplir los mismos controles de stock y fecha.

La copia JSON admite bases anteriores sin la colección de traslados. En las nuevas copias valida identificadores, números, artículos y exactamente dos movimientos vinculados por línea, con cantidades opuestas y depósitos, fechas y sucursales coincidentes. Rechaza constancias incompletas, cantidades alteradas y movimientos sin su traslado. Los respaldos SQLite conservan todos los registros y la auditoría.

Las pruebas automatizadas cubren traslados entre sucursales, stock total conservado, faltantes sin cambios parciales, fechas y operaciones posteriores, permisos, cantidades y precisión, nombres históricos, devolución y recuperación de copias. Las pruebas HTTP verifican el responsable de sesión, reintentos sin duplicación y consultas de un perfil que solo tiene acceso a traslados.

La prueba manual se ejecutó con una base SQLite ficticia separada en el puerto local 3002. Se cargó el ejemplo textil y un depósito de exhibición, luego se registró `INT-TR-00000001` por cinco remeras y dos pantalones. La interfaz confirmó 35 remeras y 18 pantalones en el origen, y 5 y 2 en el destino: totales de 40 y 20 conservados. El detalle mostró fecha, responsable Administrador, motivo y las dos líneas. No se registraron documentos comerciales ni movimientos de dinero.
