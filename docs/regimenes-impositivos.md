# Catálogo de retenciones y percepciones

Ruta: Finanzas → Retenciones y percepciones (`/finanzas/retenciones`). El Administrador General mantiene el catálogo por empresa; un perfil con esa ruta puede consultarlo, sin poder guardar cambios por ese permiso solo.

Cada registro requiere nombre, tipo Retención/Percepción, impuesto del catálogo, alícuota numérica entre 0 y 100, fecha inicial real y referencia normativa. Ingresos Brutos exige una jurisdicción del catálogo. La fecha final es opcional; si se declara, debe ser real y no preceder al inicio. Ambas fechas se incluyen en la vigencia. El identificador es único dentro del catálogo; pueden coexistir varios regímenes del mismo impuesto y jurisdicción con identificadores distintos.

La pantalla informa la fecha de consulta en Tucumán y muestra «Próximo según fechas», «Vigente según fechas» o «Vencido según fechas». Un registro incompleto muestra «Revisar configuración». La validación del servidor y la restauración también rechazan datos incoherentes; no basta con modificar el formulario para omitir los controles.

La presencia en el catálogo no verifica condición de agente, inscripción, padrón, actividad, mínimos, exclusiones, Convenio Multilateral ni vigencia legal de la norma escrita. Una alícuota cero no acredita exención. No se deduce el régimen por la provincia o por elegir SRL/SAS. Las referencias del ensayo son sintéticas y no deben utilizarse en operaciones reales.

El catálogo no calcula ni aplica retenciones o percepciones. Los certificados e importes se registran en sus circuitos existentes. Modificar un régimen no reescribe documentos, saldos, asientos ni certificados anteriores; el cambio queda en la auditoría administrativa del servidor. La tasa anterior no queda como una versión independiente del catálogo: para mantener dos vigencias consultables deben conservarse como registros distintos.

## Verificación

Las pruebas de dominio comprueban límites inclusivos, fecha abierta, año bisiesto, datos incompletos, fechas inexistentes, intervalos invertidos, parámetros inválidos, coexistencia de regímenes, restauraciones y conservación exacta de datos financieros. La prueba HTTP comprueba repetición idempotente, rechazo atómico sin cambio de revisión, permisos de consulta/escritura, restauración inválida y reapertura de SQLite con auditoría HMAC.

El ensayo independiente `var/qa-tax-rules.sqlite` contiene tres referencias sintéticas: una vigente durante 2026, otra terminada en 2025 y otra que comienza en 2027. El navegador rechazó IIBB sin jurisdicción en la revisión 5, guardó una corrección válida de la referencia y alícuota sintéticas en la revisión 6 y las recuperó después de recargar. Permanecieron intactos los datos ajenos al catálogo, incluidos los dos movimientos iniciales de stock. Las pruebas de dominio también conservaron exactamente una factura, un cobro con retención certificada, la comisión automática y sus asientos al editar el régimen. Los resultados automatizados se conservan en `output/qa/tax-rules-*.log`.

Los mínimos, reglas de cálculo, padrones, exclusiones, revisión normativa real e integración con certificados permanecen entre los pendientes del objetivo integral. Ver la [matriz del PPTX](requisitos-y-alcance.md).

Resultado del 17/10/2026: **570 pruebas de dominio y 82 HTTP**, todas aprobadas; lint sin advertencias y compilaciones compartida/servidor aprobadas. Las 58 bases persistidas conservaron validación completa después de JSON, integridad SQLite, auditoría HMAC y conciliación de fuentes fiscales. La recuperación de un respaldo sellado del ensayo pasó de revisión 6 a 7 con estado y credenciales idénticos, tres regímenes conservados y cero sesiones recuperadas; se revocó una sesión y se retiró la copia temporal.

Script reproducible: [verify-tax-rules-ui.mjs](../scripts/verify-tax-rules-ui.mjs). Informe: [verification-tax-rules-2026-10-17.json](../output/verification-tax-rules-2026-10-17.json). Se conservaron transcripciones y [captura nativa de la tabla recuperada](../output/tax-rules-recovered-2026-10-17.png). Las exportaciones XLSX/PDF de esta tabla no se verificaron en el navegador.

El [reporte de operaciones registradas](retenciones-percepciones-registradas.md) reúne los importes ingresados en sus circuitos. No aplica las alícuotas del catálogo ni sustituye la comparación con certificados externos.

La [comparación manual de certificados INT-CCF](comparacion-certificados-impositivos.md) conserva los datos transcritos del respaldo y sus diferencias con los movimientos. Elegir un régimen del catálogo no valida el certificado ni determina su cómputo.
