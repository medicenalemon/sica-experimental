# Preparación de compras para IVA Simple

Disponible en Finanzas → IVA ventas y compras, con consulta también desde el reporte impositivo. Se preparan compras ordinarias A/B/C en ARS de una empresa responsable inscripta, por mes de emisión y para todas las sucursales. El selector general de sucursal y el filtro del reporte de trabajo no recortan esta preparación mensual.

## Revisión y conservación

Cada factura, nota de crédito y nota de débito A/B/C del mes debe tener identificado su original. Se conservan sus CUIT, tipo, punto, número, versión de identificación, líneas, importes y denominación del proveedor. Los internos X se muestran excluidos. Un original pendiente, un receptor distinto, importes que no concilian o un carácter incompatible impiden conservar la preparación completa; no se descartan filas en silencio.

El operador elige expresamente el criterio. **Sin prorrateo** informa el IVA discriminado de cada A. **Asignación directa** requiere indicar un importe entre cero y ese IVA para cada comprobante. B y C llevan crédito cero y no generan detalle de alícuotas, aunque un B histórico tenga IVA contenido en el registro interno. Las notas se escriben con importes positivos; su tipo determina su efecto negativo en los totales de la preparación. El [prorrateo global y mixto](iva-prorrateo.md) agrega bases documentadas y cálculo sobre el IVA de uso común; no presume deducibilidad a partir de la actividad textil.

Antes de confirmar se muestran originales, denominación completa y texto exportado, importes, crédito, alícuotas, exclusiones y totales. La constancia INT-IC conserva la revisión exacta y el responsable de sesión. No cambia compras, notas, deuda, stock, tesorería ni asientos. **El IVA no computable y las restituciones requieren su conciliación y tratamiento contable por separado.** La preparación no contabiliza esa diferencia ni determina el saldo fiscal de la declaración.

Una nueva preparación del mismo mes requiere el antecedente vigente y una referencia nueva. Conserva todas las versiones anteriores. Un cambio posterior de original, nombre o compras del mes deja desactualizada la fuente de una versión conservada, sin reescribir sus TXT. Los documentos incorporados después de prepararla no alteran esa historia. Puede prepararse un mes cuyo ejercicio contable ya está cerrado: exportar sus fuentes no reabre el ejercicio ni modifica su diario.

Conservar exige permiso de Finanzas → IVA ventas y compras. El perfil exclusivo del reporte impositivo puede consultar las preparaciones y reproducir su revisión, pero no guardarlas. Perfiles de compras o módulos ajenos no reciben las constancias fiscales completas.

## Archivos

Las cabeceras tienen 325 bytes por registro y los detalles de alícuotas 84, sin contar CRLF. Se escriben directamente como ISO-8859-1, sin BOM, con importes en centavos y sin separador decimal. Se preserva el orden entre archivos, moneda PES, cambio 1 y códigos de comprobante y alícuota. Sólo se informa la percepción IIBB que conserva el documento; los tributos no representados en la operación actual no se inventan.

La denominación tiene treinta caracteres en el diseño. Se conserva el texto completo y se muestra su corte para revisión; caracteres de control o no representables en el campo impiden exportar. Se comprueban anchuras, tamaños de hasta diez millones de bytes por TXT y límites seguros de importes. Una preparación sólo de B/C no tiene registros de alícuotas: la interfaz deshabilita ese archivo vacío.

Las compras A exclusivamente exentas o no gravadas informan su importe separado y el código de operación correspondiente, con detalle cero. Se bloquean la tasa cero sin tratamiento fiscal definido y la combinación exclusivamente exenta/no gravada sin código revisado, en lugar de deducir un encuadre. Los otros tipos y modalidades requieren ampliar su circuito.

## Fuentes consultadas el 17/10/2026

La página de IVA Simple remite a los diseños y manuales de Libro IVA Digital. Distingue registración mensual, confirmación de la declaración, formatos ANSI, separación de archivos, cómputo por comprobante y modalidades de prorrateo. Esta implementación prepara compras ordinarias; no realiza esa confirmación. [ARCA, especificaciones especiales de IVA Simple](https://www.arca.gob.ar/iva/iva-simple/especificaciones-especiales.asp).

Las posiciones y anchuras siguen el diseño de compras y alícuotas. [ARCA, diseño de registros, páginas 4 y 6](https://www.arca.gob.ar/iva/documentos/libro-iva-digital-diseno-registros.pdf). Los importes, campos vacíos, crédito, código de operación y separación de B/C se contrastaron con el manual publicado, revisión 30/07/2025. [ARCA, especificaciones y validaciones](https://www.arca.gob.ar/iva/documentos/Libro-IVA-Digital-Especificaciones.pdf). Códigos ordinarios y alícuotas: [ARCA, tablas del sistema](https://www.arca.gob.ar/libro-iva-digital/documentos/Libro-IVA-Digital-Tablas-del-Sistema.pdf).

No se ingresó a un portal autenticado ni se comprobó la aceptación real de los archivos. El manual conserva referencias históricas, incluida una descripción restrictiva del punto de venta. La salida usa el campo de cinco posiciones y rechaza 99999; otros casos requieren contrastar la validación efectiva del portal antes del uso real.

## Evidencia

La empresa sintética `var/qa-vat-purchases.sqlite` conservó INT-IC-00000001 en revisión 2 y la recuperó después de recargar. Luego conservó INT-IC-00000002, sin prorrateo, en revisión 3: crédito $42,60, conservando íntegra la primera preparación directa y sus archivos. Incluye cinco compras de dos sucursales, una factura A con dos alícuotas y conceptos exentos/no gravados, notas A, un B histórico y un C; muestra un X excluido. Total neto $476,20; IVA discriminado neto $42,60; crédito directo $31; diferencia no computable $11,60. El B se creó para el ensayo como documento histórico de una etapa exenta; no se relajó la validación fiscal de las altas actuales. Todos los documentos, originales y asientos previos permanecieron iguales.

Se conservaron recorrido DOM y captura nativa. Los bytes generados desde la constancia efectivamente guardada tienen cinco cabeceras, cuatro alícuotas, 1635 y 344 bytes respectivamente, CRLF y caracteres latinos sin conversión UTF-8. La interfaz ofreció la descarga; el navegador no informó un evento nativo, por lo que esa entrega no se considera confirmada. No se subieron archivos a ARCA.

Verificación reproducible: `scripts/verify-vat-purchases-ui.mjs`, informe `output/verification-vat-purchases-2026-10-17.json`. Las pruebas cubren posiciones del diseño, notas, crédito, omisiones, permisos, concurrencia, repetición de solicitudes, correcciones, restauración y conservación después del cierre.

## Pendientes

Las ventas ordinarias A/B autorizadas tienen su [preparación separada](iva-simple-ventas.md). Siguen pendientes compras imputadas fiscalmente a un mes distinto de emisión, selección por lotes mayores, ajuste anual y otros criterios de prorrateo, otras clases y documentos especiales, moneda extranjera, importaciones, anulados, otros tributos, ajustes de la declaración, conciliación con los comprobantes precargados y constancia de presentación. La inexistencia de compras en SICA no declara SIN MOVIMIENTO: puede haber ventas u otras operaciones. El objetivo integral del PPTX permanece activo.
