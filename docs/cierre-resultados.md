# Cierre de cuentas de resultados

Contabilidad → Cierre de resultados calcula el resultado de los saldos registrados de Ingresos y Gastos, conserva su revisión, genera los asientos por sucursal y bloquea el ejercicio completo en una sola operación. Se relaciona con las diapositivas 76–77 del PPTX y con el circuito de [cierres de períodos](cierres-contables.md).

La [RT 54, texto ordenado con RT 59 y modificatorias publicado por el Consejo](https://www.consejo.org.ar/storage/attachments/Resolucion%20Tecnica%20N%2054%20%28TO%20RT%2059%20y%20modi-7TbUsld18i.pdf), párrafos 515–517, distingue aportes, resultados acumulados y resultados diferidos y requiere su presentación en el patrimonio neto. Esta fuente fundamenta mantener el resultado separado del capital; no acredita adopción jurisdiccional ni cumplimiento integral para una entidad de Tucumán. La presentación profesional, moneda de cierre, ajustes, revelaciones y decisiones sobre el destino del resultado necesitan sus tratamientos específicos.

Si existe una preparación anual INT-MC, primero se registra la [contabilización del ajuste](contabilizacion-moneda-cierre.md). El cierre comprueba el resultado ajustado y usa la cuenta revisada de Resultados no asignados; su constancia conserva el enlace INT-AI.

## Preparar y revisar

1. Registrar y revisar los hechos del ejercicio, sus imputaciones, devengamientos, impuestos y ajustes normativos. Si hubo stock, contabilizar una valuación exactamente al fin del ejercicio configurado. Los servicios estimados con factura deben estar conciliados. Las mismas comprobaciones del bloqueo de períodos se aplican al cierre de resultados.
2. El Administrador General puede preparar la cuenta de referencia `3.2 Resultado del ejercicio sin asignar`. Si ese identificador ya existe, no se cambia su contenido. Seleccionar una cuenta imputable de Patrimonio neto distinta de la asociación de capital/saldos iniciales. El sistema no distribuye ganancias, crea reservas ni aumenta capital.
3. Indicar una referencia única y fundamento. La fecha corresponde al fin del ejercicio configurado. El cierre incluye todas las sucursales, incluidas las inactivas que conservan movimientos, aunque el encabezado muestre una sola.
4. Revisar el balance anual anterior, resultado consolidado, resultado y asiento de cada sucursal, y reconocer todas las observaciones. Una revisión preparada pierde vigencia si cambian sus fuentes o parámetros.
5. Registrar asientos y bloqueo. La constancia `INT-CR-...` conserva revisión, cuenta de destino, balances anterior/posterior, fuentes financieras, responsable de la sesión, fecha del registro, identificadores de asientos y bloqueo asociado `INT-CC-...`.

Para cada cuenta de Ingresos o Gastos con saldo final distinto de cero se genera su contrapartida. La diferencia va a la cuenta de resultado elegida: una ganancia acredita Patrimonio neto y una pérdida lo debita. El cálculo respeta también ingresos con saldo deudor y gastos con saldo acreedor; no presupone el signo habitual. Cada sucursal conserva su propio asiento y resultado. Los importes se suman en centavos enteros seguros.

Un resultado neto cero puede necesitar un asiento que cancele ingresos y gastos entre sí, sin una línea de Patrimonio neto. Si no hay saldos de resultados, no se inventan asientos: se conserva la constancia y el bloqueo con cero asientos. No se cancelan las cuentas patrimoniales ni se cambia la deuda de una contraparte, las cantidades, documentos o movimientos de tesorería.

El circuito exige revisar cualquier saldo inicial heredado en cuentas de resultados antes de cerrar. Esos saldos no se trasladan automáticamente como si fueran el resultado del ejercicio actual. Las cuentas con saldo deben admitir imputaciones al preparar la operación; deshabilitarlas posteriormente no invalida los asientos históricos conservados.

## Conservación y permisos

Únicamente el Administrador General puede preparar la cuenta o registrar el cierre. Administración y perfiles autorizados al módulo pueden consultar las constancias y sus fuentes financieras; ese permiso de consulta no concede escritura ni acceso a comandos de diario o configuración. Las respuestas filtradas permiten reproducir la revisión sin exponer datos privados de contrapartes, precios comerciales o credenciales.

Servidor: asientos, constancia y bloqueo se guardan en una transacción SQLite con control de versión, revisión exacta, idempotencia y auditoría. Una referencia de bloqueo en conflicto o cualquier comprobación fallida deja intacto el estado original. Repetir un reintento identificado no crea otro cierre. La validación de recuperación reconstruye balances y asientos, comprueba vínculos, fuentes y revisiones, y rechaza constancias faltantes o alteradas. El modo local conserva las limitaciones del navegador documentadas en [servidor-y-recuperacion.md](servidor-y-recuperacion.md).

Los cierres de períodos anteriores permanecen conservados. Una vez cerrado el ejercicio, no admite nuevas operaciones con fechas cubiertas. Configuración conserva sus fechas; ampliar el rango para continuar cargando operaciones sobre el ejercicio cerrado no sustituye la apertura de un nuevo ejercicio. Cambiar nombres descriptivos compatibles no reescribe los importes de las constancias.

## Tratamientos pendientes

Este cierre cancela las cuentas de resultados sobre los asientos disponibles. No determina ni registra por sí solo amortizaciones, impuesto a las ganancias corriente/diferido, ajuste por inflación, deterioros/valor recuperable, conversión completa, hechos posteriores, correcciones de errores o reclasificaciones para exposición. Los informes y balances son de trabajo. Reconocer una observación no demuestra que se haya calculado y contabilizado el ajuste necesario.

Siguen pendientes los estados contables completos, comparativos, notas y anexos, y reapertura/corrección controlada. La [apertura del siguiente ejercicio](apertura-ejercicio.md) ya conserva saldos nominales y operaciones pendientes. Un período final ya bloqueado antes de registrar este cierre no admite agregar retroactivamente el asiento; necesita revisión y una reapertura o recuperación controlada según el caso. La recuperación de una copia previa debe considerar todas las operaciones posteriores que reemplazaría. No se acredita cierre anual normativo integral, legalización ni presentación fiscal mediante esta constancia.

## Evidencia sintética

La interfaz de `var/qa-year-end.sqlite` revisó y registró el ejercicio 01/01–31/12/2026 con Casa Central seleccionada en el encabezado. El cierre incluyó ambas sucursales: ganancia de $650 y pérdida de $100, resultado consolidado $550. Guardó `INT-CR-00000001`, dos asientos por sucursal y bloqueo `INT-CC-00000001`; la base terminó en versión 2. Ventas y Gastos quedaron en cero, Caja en $650, Proveedores en $100 acreedores y Resultado en $550 acreedores. Los balances permanecieron después de recargar. Se trata de saldos sintéticos, sin presentación profesional, emisión fiscal o pago externo.

La [verificación](../output/verification-year-end-2026-10-09.json) comprueba balances, partidas, revisión, responsable, vínculos, integridad SQLite, auditoría y compatibilidad de diez bases de ejemplo. Pasaron las 256 pruebas —186 de dominio, 13 de archivos, 35 HTTP y 22 fiscales—, lint y compilación compartida. Las pruebas incluyen ganancia, pérdida, resultado cero, ejercicio vacío, saldos con signo inverso, inventario, conciliación de servicios, cierres previos, permisos, reintentos, configuración de fechas y recuperación de fuentes alteradas.

La captura del navegador no estuvo disponible para este recorrido; no se generó una imagen simulada. La interfaz y los datos persistidos fueron comprobados mediante el recorrido descrito y el verificador.
