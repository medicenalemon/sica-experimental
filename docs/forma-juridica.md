# Forma jurídica declarada de la empresa

El primer caso confirmado por los autores es un comercio textil, responsable inscripto en Tucumán, organizado como sociedad comercial. Todavía no se eligió entre SRL y SAS. Las empresas nuevas de ensayo parten de **Sociedad comercial · forma por definir**; las bases existentes conservan su valor o permanecen sin especificar.

Configuración e inicio guiado permiten declarar SRL, SAS, SA, persona humana u otra forma jurídica. Este campo es independiente de IVA, CUIT, provincia y razón social. Guardarlo requiere administrador. Se valida también al restaurar una copia; no se infiere a partir de un nombre ni de la condición fiscal.

Las nuevas preparaciones de estados contables conservan la forma declarada dentro de su identidad. Se muestra al consultar el expediente y en la portada de sus exportaciones XLSX y PDF. Un cambio posterior no reescribe expedientes anteriores y deja desactualizada su preparación frente a los parámetros actuales. Confirmar una revisión preparada con otra forma se rechaza. Los expedientes antiguos sin el campo siguen siendo legibles y restaurables.

El dato es descriptivo y declarado: no acredita inscripción registral, habilitación de libros ni modifica automáticamente impuestos, cuentas o cálculos. Los libros y estados normativos específicos de la sociedad y la emisión profesional continúan entre los pendientes del objetivo integral.

## Evidencia del 15/10/2026

El navegador guardó SRL, volvió a consultarla, guardó SAS y la recuperó en la revisión 3 de `var/qa-legal-form.sqlite`. Esta es una empresa sintética independiente: la prueba no selecciona SAS para la empresa real de los autores. Se conservan los recorridos DOM; la captura nativa de configuración no estuvo disponible.

Las pruebas de dominio comprueban datos admitidos, rechazo de valores inválidos, compatibilidad con bases sin especificar, revisión desactualizada y conservación de expedientes históricos. Las pruebas HTTP comprueban permisos, persistencia, repetición de solicitudes y rechazo de restauraciones inválidas. Las exportaciones verifican la forma en la hoja Expediente y el texto completo del PDF. El ejemplo SAS produjo once páginas; se renderizó y revisó la portada.

Informe reproducible: `scripts/verify-legal-form-ui.mjs`; resultado `output/verification-legal-form-2026-10-15.json`. Pasaron **503 pruebas de dominio, 74 HTTP y 33 de archivos**, lint y compilaciones compartida/servidor. El informe incluye los registros de pruebas y la validación JSON, integridad SQLite y auditoría HMAC de las cincuenta bases de ensayo acumuladas.
