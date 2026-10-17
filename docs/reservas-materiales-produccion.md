# Reserva de materiales de producción

En **Producción → Planificación y avance**, una orden abierta con ruta preparada puede reservar todos los materiales conservados de su lote. La operación no mueve stock ni genera asientos: aparta cantidades por SKU y depósito y conserva la revisión de disponibilidad.

## Reservar y consultar

1. Preparar la ruta y sus requerimientos. La preparación reserva capacidad del calendario; la reserva de materiales es una operación separada.
2. Pulsar **Reservar materiales**, indicar fecha abierta y fundamento y revisar disponibilidad.
3. Verificar cantidad requerida, existencia a la fecha, reservas anteriores, cantidad libre y mínimo libre considerando movimientos posteriores ya registrados.
4. Confirmar la revisión. Se conserva una constancia `INT-RM`, responsable de sesión, materiales y fuentes revisadas. Los requerimientos repetidos del mismo SKU y depósito se suman.
5. En **Stock → Inventario**, seleccionar la fecha y consultar existencia física, cantidad reservada y disponibilidad para otras salidas.

La reserva requiere insumos suficientes durante su vigencia, incluidos los movimientos posteriores conocidos. No se reservan materiales inexistentes por habilitar stock negativo. Cada orden admite una reserva activa; después de una liberación puede revisarse otra, conservando el antecedente. Las cantidades agrupadas admiten hasta seis decimales y un máximo de un millón por SKU y depósito.

Los remitos a clientes, ajustes, traslados, devoluciones a proveedores y consumos de otras órdenes respetan las reservas, incluso si el artículo admite stock negativo. Los controles revisan el saldo por fecha y las operaciones posteriores ya registradas. Los remitos agrupan cantidades repetidas para comprobar la salida completa antes de crear movimientos.

## Liberar o consumir

**Liberar materiales** requiere fecha desde la reserva y motivo. Libera el lote completo sin alterar cantidades físicas ni borrar la constancia. Debe liberarse antes de cancelar la orden; la cancelación mantiene su control de operaciones aún no iniciadas y libera por separado las reservas de calendario.

Al finalizar la orden, el sistema utiliza su propia reserva, protege las de otras órdenes, marca la constancia como **Consumida** y registra juntos los movimientos físicos: consumo de insumos e ingreso del terminado. La operación no puede repetirse. La revisión original queda conservada. El costo contable continúa en el circuito separado de INT-PC y CPP.

Las reservas admiten continuidad entre ejercicios; sus fechas históricas se conservan. Las reservas y liberaciones nuevas respetan las fechas abiertas. El inventario por fecha representa los movimientos y reservas registrados, sin anticipar operaciones futuras desconocidas.

## Permisos, recuperación y evidencia

La reserva y su liberación requieren acceso a Producción. El servidor revisa permisos, versión y revisión vigente y conserva la identidad autenticada. El perfil de depósito recibe sólo referencias, fechas y cantidades necesarias para calcular disponibilidad; no recibe fundamento, fuentes de la revisión ni identidad del responsable de producción.

Las copias JSON y SQLite conservan las constancias. La recuperación comprueba materiales del plan, fuentes y secuencia de stock, reservas anteriores, revisión, fechas de liberación/consumo, órdenes cerradas y disponibilidad durante la vigencia. Los identificadores compuestos se mantienen separados aunque contengan dos puntos. Las bases anteriores sin reservas mantienen su alcance.

El navegador conservó tres unidades para un lote: existencia física **40**, reserva **3** y disponible para otras salidas **37**. Rechazó una salida de **38** y mantuvo el stock. Una copia separada completó el lote: insumos **37**, terminados **22** y reserva consumida, sin duplicar el consumo ni modificar los comprobantes o asientos iniciales.

Pasaron **446 pruebas de dominio** y **63 HTTP**. Se verificaron **41 bases** con validación completa después de JSON, integridad SQLite y auditoría HMAC. Informe: `output/verification-material-reservations-2026-10-13.json`; captura: `output/material-reservations-inventory-2026-10-13.jpg`; recorrido: `output/material-reservations-browser-2026-10-13.txt`.

Quedan pendientes reservas parciales, consumos parciales, mermas, replanificación y las demás ampliaciones de producción y del PPTX. La reserva operativa no acredita cumplimiento contable o fiscal integral. El objetivo general permanece activo.
