# Producción: calendario, operaciones y materiales

La pantalla **Producción → Planificación y avance** permite preparar una orden, registrar su ejecución y finalizar el lote. Es planificación operativa: los importes de la orden son referencias de gestión; la capa contable se completa mediante [INT-PC y CPP](costos-conversion-produccion.md), con los límites indicados en ese documento.

## Preparar un lote

1. Registrar un centro en la sucursal de la orden, con inicio de jornada, horas disponibles por día y unidades por hora positivas. La ventana debe terminar antes de medianoche o exactamente a las 24:00; todavía no admite turnos nocturnos. Los centros nuevos proponen 08:00, y los anteriores sin horario conservan 00:00. Los días laborables se ingresan como números separados por coma: `1` lunes, `7` domingo. El valor inicial es lunes a viernes.
2. Cargar las fechas no laborables del centro como `AAAA-MM-DD`, separadas por coma. Los feriados y cierres se cargan manualmente; no se presupone un calendario argentino automático.
3. Definir una ruta mediante el editor de operaciones: nombre, centro y horas de cada paso; permite agregar, quitar y reordenar hasta 50 operaciones. Todos los centros deben pertenecer a una misma sucursal. El tiempo previsto corresponde **al lote completo**, con hasta seis decimales, y el total no puede superar 100.000 horas. No es tiempo por unidad. Las rutas anteriores con pasos separados por `→` o punto y coma y un único centro siguen admitidas: reparten el total por igual hasta que se editan sus operaciones.
4. Crear una orden Planificada con producto físico, cantidad, sucursal y fechas del ejercicio. Si la orden indica centro, debe coincidir con el de la primera operación de la ruta. Se puede dejar vacío para usar la ruta.
5. Registrar los materiales con cantidad total requerida para el lote, depósito de la sucursal y unidad del SKU. No se convierten metros a unidades ni se admiten servicios como materia prima.
6. Desde Planificación y avance, pulsar **Preparar ruta**. Sin ruta configurada se puede preparar una operación directa cuyo tiempo se estima como cantidad ÷ unidades por hora del centro.

La preparación ocupa primero las horas libres desde el inicio previsto. Distribuye cada operación dentro del horario de su propio centro, sobre días laborables, omite cierres y respeta las franjas reservadas de las otras órdenes. La siguiente operación comienza después del fin previsto de la anterior, incluso si usa otro centro. Puede ocupar varias franjas libres del mismo día o continuar otro día. Si no cabe antes del fin previsto, rechaza la preparación sin guardar reservas parciales. En el servidor, el control de versión evita que dos preparaciones concurrentes usen la misma disponibilidad.

Los centros también admiten [varios turnos por día](turnos-produccion.md), con descansos excluidos y horas disponibles calculadas como suma de las franjas. Cada operación conserva los turnos empleados al preparar su plan; estos planes usan versión 3. Los planes anteriores conservan su formato.

El plan conserva nombres, producto, unidad, cantidad, operaciones, centro y calendario de cada paso, franjas horarias y requerimientos. Cambiar después el catálogo de rutas no modifica una orden preparada. La orden y sus materiales quedan bloqueados; se puede cancelar desde Órdenes de producción solamente si todavía está Planificada y ninguna operación comenzó. Esa cancelación libera las reservas y conserva el historial. No hay reapertura ni replanificación del mismo lote.

Se pueden preparar materiales aún no disponibles para gestionar su compra. **La preparación no reserva existencias.** La [reserva revisada de materiales INT-RM](reservas-materiales-produccion.md) es una operación separada: conserva el stock físico y protege cantidades para el lote completo. Los faltantes comparan los requerimientos agrupados con la disponibilidad para cada orden, incluyendo su propia reserva. La disponibilidad por fecha se verifica al reservar y finalizar, incluyendo salidas posteriores ya registradas. El tipo y la unidad del artículo no pueden cambiar mientras tenga movimientos de stock o un plan abierto.

## Ejecutar y terminar

Cada operación pasa de Pendiente a En curso y luego a Completada. La siguiente se habilita cuando todas las anteriores están completas. El responsable se toma de la sesión. Se registran fecha de inicio, fecha de finalización y horas reales positivas; las fechas respetan el inicio de la orden, la secuencia y el ejercicio abierto. Se admite terminar después de la fecha prevista, dentro del ejercicio.

Las fechas reales son registros manuales diarios, sin marcación horaria automática. La carga diaria muestra **horas previstas**, incluso para órdenes terminadas. No redistribuye reservas al registrar tiempos reales, ni limita la carga real por persona o máquina. El centro no admite reducir capacidad, cambiar el horario o cerrar un día actual/futuro si deja fuera una franja ya reservada. Los calendarios anteriores se conservan en el plan.

**Finalizar** requiere completar las operaciones y las tareas adicionales de la orden. Consume los materiales conservados y agrega el producto terminado al depósito de la misma sucursal. Agrupa requerimientos repetidos y valida todos antes de crear movimientos. El cierre no puede repetirse. Una orden antigua sin ruta preparada puede finalizarse manualmente si no tiene ruta asignada y cumple materiales, tareas y stock.

El costo de materiales de gestión usa los costos de referencia vigentes al finalizar. El costo de gestión conserva el mayor entre el costo real declarado y esos materiales. No incorpora automáticamente horas, amortizaciones o gastos indirectos. La finalización no genera por sí sola un asiento. El cierre del módulo Inventario valorizado calcula los consumos a CPP y los incorpora al producto terminado, con asientos por sucursal en la fecha del corte. Los costos de gestión de la orden siguen separados. La capa contable de [INT-PC](costos-conversion-produccion.md) conserva gastos reconocidos asignados al trabajo en curso y su transferencia al terminado mediante CPP, con los límites allí detallados. Reglas de materiales en [inventario-valorizado.md](inventario-valorizado.md).

## Copias y permisos

Los planes se guardan en la base compartida y en las copias JSON. La restauración revisa referencias, secuencia, calendario conservado, sumas de horas, estados y fechas reales. Rechaza planes perdidos, reservas incompatibles, exceso de capacidad entre planes y movimientos de un lote terminado que no concilien con sus materiales y producto. Las bases anteriores sin planes siguen admitidas cuando ninguna orden refiere a uno. Los planes anteriores sin franjas se conservan; su carga diaria ocupa una franja desde las 00:00 para competir con nuevas reservas. No se inventan horarios históricos. Los planes de jornada única tienen versión 2; los que incluyen turnos usan versión 3. Ambos controlan precisión de horas, calendarios y superposición por centro. La pantalla muestra horarios redondeados al segundo; los datos conservan la precisión original.

Los comandos requieren acceso a `/produccion`; están disponibles para Administrador General, Producción y perfiles personalizados habilitados. Preparación y ejecución usan la identidad autenticada. Los perfiles sin acceso a producción no reciben la colección de planes.

## Verificación del ejemplo

El 8 de octubre de 2026 se probó desde el navegador una base temporal compartida, con el ejemplo textil de Tucumán:

- Taller: cuatro horas diarias; ruta Corte → Costura → Control, tres horas para el lote.
- Orden: dos pantalones; requerimiento sintético de tres unidades de `REM-M-NEG`. Es una prueba funcional de movimientos, no una receta textil real.
- Preparación: tres horas reservadas el 08/10 y una hora disponible.
- Ejecución: 1,25 horas de Corte, una de Costura y una de Control, por el usuario Administrador.
- Finalización única: stock de `REM-M-NEG` de 40 a 37 y de `PANT-42-AZ` de 20 a 22; tres operaciones completas, estado Terminada.

Una segunda prueba en una base sintética aislada editó la ruta desde el navegador: Cortar 2,5 horas en Corte (08:00–12:00), Coser tres horas en Costura (09:00–17:00) y Controlar media hora en Control (08:00–12:00). La orden reservó Corte el 08/10 de 08:00 a 10:30, Costura de 10:30 a 13:30 y Control el 09/10 de 08:00 a 08:30. La preparación conservó los materiales sin consumirlos. Este segundo ejemplo verificó edición y planificación; no se finalizó el lote.

En la verificación inicial, dieciséis pruebas de dominio de producción comprobaron planificación, fines de semana/cierres, franjas libres, centros por operación, competencia por capacidad, atomicidad, conservación de materiales, transiciones, tareas, fechas, unidades, recuperación y compatibilidad de planes anteriores. Tres pruebas HTTP comprobaron el ciclo con permisos/identidad/idempotencia, preparación concurrente y rutas entre centros. La suite general de esa etapa sumó 160 pruebas: 97 de dominio, 13 de archivos, 28 HTTP y 22 fiscales. Las reservas de materiales y la capa contable se ampliaron posteriormente en los documentos enlazados; siguen pendientes turnos múltiples, capacidad individual de máquinas/personas, recepción parcial, mermas y replanificación.

## Ejemplo local reproducible

Después de compilar servidor e interfaz compartida, se puede ejecutar con Node 24:

```bash
SICA_PREVIEW_DATABASE=var/qa-production-routes.sqlite node scripts/preview-production-route-ui.mjs
```

Abre `http://localhost:3005` con una empresa sintética, sin conexiones externas. Acceso de prueba: `admin` / `Sica-Route-UI-QA-2026`. El archivo se encuentra bajo `var/`, fuera de Git. Al reiniciar conserva las operaciones existentes; sólo inicializa el ejemplo si la base tiene revisión cero. Sin `SICA_PREVIEW_DATABASE` usa una base temporal aislada. Esta base de demostración utiliza una contraseña pública y debe mantenerse en el equipo local.

El entorno de pruebas se reinició durante la verificación y eliminó nuevamente las bases de `/tmp`. Se repitió edición y preparación sobre la base persistente del proyecto, con las tres reservas indicadas y sin consumo de materiales.

Se incorporó [INT-PC](costos-conversion-produccion.md) para mano de obra, servicios, depreciaciones y cargas reconocidas, con absorción de fijos y saldo por orden en proceso. El CPP exige su revisión antes de valuar un lote nuevo. También se incorporó la [reserva de materiales](reservas-materiales-produccion.md), con liberación completa y consumo al finalizar. Estas ampliaciones no implementan consumos parciales o correcciones de procesos cerrados.
