# Turnos de producción por centro

En **Producción → Centros y capacidad**, el editor permite conservar una jornada única o definir hasta ocho turnos con nombre, inicio y fin. Los nombres son únicos por centro; las franjas no se superponen y se ordenan por inicio al guardar. Las horas disponibles por día son la suma de las franjas, sin los descansos.

## Circuito

1. Editar un centro y elegir **Definir turnos separados**.
2. Indicar nombres y horarios, agregar o quitar turnos y guardar. **Usar jornada única** vuelve a los campos de inicio y duración; revisar ambos antes de guardar.
3. Preparar una orden desde **Planificación y avance**. La planificación busca franjas libres en cada turno, considera otras órdenes, días laborables y cierres y conserva el calendario por operación.
4. Abrir **Ver ruta** para consultar turnos conservados y reservas concretas. Una operación puede ocupar varias franjas; los pasos posteriores respetan el fin del anterior.

Una jornada de 08:00–12:00 y 14:00–18:00 tiene ocho horas disponibles. Un lote de seis horas con una operación reserva 08:00–12:00 y 14:00–16:00; el intervalo 12:00–14:00 queda fuera de la planificación. Otra orden sólo puede ocupar las franjas restantes y continúa otro día si es necesario.

## Protección e historial

Guardar turnos requiere permiso para el catálogo de centros. Preparar la ruta requiere acceso a producción; el servidor conserva la identidad autenticada. El control de versión impide que dos órdenes concurrentes ocupen la misma franja. Si no hay capacidad antes del fin previsto, no se guardan reservas parciales.

Una edición de calendario no puede dejar fuera una reserva de hoy o futura ni reducir sus horas disponibles. Los planes anteriores conservan sus calendarios aunque se modifique el centro después. Los planes con turnos usan versión 3; los de jornada única mantienen versión 2 y los planes históricos anteriores siguen admitidos.

La recuperación valida nombres, horarios en minutos completos, sumas de horas, calendario por operación, resumen del primer centro, secuencia, descansos, cierres y superposición entre órdenes. Las horas reservadas se conservan en microhoras; no se redondea cada franja a horas enteras. No se modifican materiales, stock, comprobantes ni asientos al definir o preparar turnos.

## Verificación y límites

Pasaron **456 pruebas de dominio** y **64 HTTP**. Se verificaron **42 bases** con validación completa después de JSON, integridad SQLite y auditoría HMAC; lint y compilaciones compartida y servidor pasaron.

Se conserva el ensayo textil en `var/qa-production-shifts.sqlite`, con empresa Responsable Inscripto de Tucumán, un centro dividido en mañana y tarde y un lote de seis horas. El informe reproducible está en `output/verification-production-shifts-2026-10-13.json`; el editor, plan y recorrido del navegador se conservan en `output/production-shifts-*`.

Todos los turnos comparten los días laborables y cierres del centro. El horario se interpreta como hora local declarada de la planta. Cada franja debe terminar en el mismo día; se admite 24:00. Un horario nocturno se expresa como dos franjas diarias y no conserva una agrupación de turno entre fechas. Siguen pendientes calendarios distintos por turno, capacidad simultánea por máquina/persona, replanificación por ejecución real, consumos parciales y mermas.
