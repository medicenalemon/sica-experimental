# Cierre de una o varias cajas

El requisito de la diapositiva 68 del PPTX permite cerrar una caja o todas al mismo tiempo, indicando dónde va el retiro. En **Finanzas → Cajas y movimientos → Cierres de caja** se puede seleccionar una o varias cajas, o todas las visibles según la sucursal elegida.

Cada cierre conserva una referencia única, fecha, motivo, responsable de la sesión y número interno `INT-CC-...`. Por caja guarda nombre y cuenta contable originales, movimientos incluidos al corte, saldo registrado, retiro, destino y saldo restante. Las cantidades se guardan en centavos ARS. No se consideran ingresos con fecha posterior al corte ni se permite un retiro que deje sin respaldo salidas posteriores ya registradas. Un cambio del saldo revisado requiere revisar nuevamente.

Cada retiro puede ser parcial, para dejar un fondo. El destino debe pertenecer a la misma sucursal y quedar fuera de las cajas incluidas en el cierre; cada caja puede tener su propio destino. El cierre de cajas de varias sucursales es posible con un destino válido para cada una. Un retiro cero conserva la constancia sin generar movimientos ni asientos. El cierre admite hasta 100 cajas por operación.

El arqueo es opcional y expresa el importe contado antes del retiro. Si se informa, el retiro no puede superar ni el saldo registrado ni el dinero contado. La diferencia entre arqueo y saldo queda en la constancia; **no se contabiliza automáticamente** y debe analizarse por separado. Un arqueo omitido se muestra como no informado, nunca como cero. El saldo restante es el saldo registrado después del retiro; puede diferir del dinero físico cuando existe una diferencia de arqueo.

Todos los retiros se guardan en una sola transacción. Si una caja o destino falla, no se registran las demás ni se consume el número. Cada retiro genera una salida y una entrada vinculadas, con un asiento balanceado; no altera cuentas corrientes, stock ni documentos comerciales. No ejecuta transferencias externas. La referencia única, la versión de la base y el identificador de solicitud evitan duplicar cierres al reintentar y controlan dos operadores concurrentes.

El historial permite consultar la constancia y exportar sus tablas XLSX/PDF de uso interno. Los retiros de cierre anteriores, guardados en el catálogo histórico, siguen visibles. Renombrar una caja no cambia los nombres guardados. Las cuentas con movimientos/cierres conservan tipo, sucursal y cuenta contable. El cierre no bloquea nuevos movimientos ni reemplaza el cierre del período contable.

Los respaldos JSON y SQLite conservan los cierres. Se valida correspondencia entre constancias, movimientos incluidos, transferencias, importes, asientos y cuentas. Se rechaza una copia que deje movimientos de cierre sin constancia o reutilice una transferencia en dos cierres. Las bases anteriores sin la colección nueva siguen siendo compatibles.

## Verificación

Se verificaron 7 pruebas de dominio y 2 HTTP adicionales: lote de dos cajas, fondo restante, arqueo omitido/diferente, retiro cero, permiso por sesión, referencia repetida, fracción de centavo, fecha/cierre contable, saldo revisado, futuras entradas/salidas, rango monetario, destinos y asientos por sucursal, rollback total, recuperación adulterada, persistencia tras reinicio y concurrencia. Las pruebas generales de archivos y fiscales también pasaron.

La prueba de navegador utilizó una base nueva aislada con dos anticipos sintéticos de $5.000 y $3.000. Se cerraron ambas cajas: retiro de $4.000 y $3.000 al banco de prueba, saldo registrado restante de $1.000 y $0, arqueo de $4.980 en la primera y diferencia de -$20. La segunda quedó con arqueo no informado. La constancia `INT-CC-00000001` conservó ambas líneas y el responsable. No se transfirió dinero real.

Para reproducir la pantalla con una base sintética nueva, ejecutar `npm run build:server`, `npm run build:shared` y, con Node 24, `node scripts/preview-cash-closing-ui.mjs`. El servidor se limita a `127.0.0.1:3004` y se accede por `http://localhost:3004`. No usar como instalación operativa; detener con Ctrl+C al terminar.
