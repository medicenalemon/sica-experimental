# Preparación mensual de ventas para IVA Simple

Disponible en Finanzas → IVA ventas y compras y en el reporte impositivo. Prepara comprobantes ordinarios A/B y sus notas, de una empresa responsable inscripta, en PES y con receptor identificado por CUIT. Comprende todas las sucursales por mes de emisión; el filtro general del reporte no reduce esa preparación. Complementa la [preparación de compras](iva-simple-compras.md). No determina el impuesto final ni confirma una declaración jurada.

## Fuentes fiscales y revisión

El operador elige expresamente el ambiente. Cada factura o nota del mes debe tener una solicitud conservada y aprobada en ese ambiente, coincidente con el documento comercial. Si falta una autorización, está incierta o cambió la fuente, se bloquea el mes completo. Los internos X se muestran excluidos; no se reemplaza una numeración fiscal faltante por su referencia interna.

La revisión se obtiene del servidor. Conserva solicitud, resultado, receptor original, importes, alícuotas y datos declarados del emisor. Cambiar el nombre actual del cliente no cambia la denominación original exportada. Las notas mantienen su tipo y los importes positivos del original; su efecto en los totales de la preparación es negativo para el crédito y positivo para el débito.

Producción simulada y homologación generan una preparación de **ENSAYO** y archivos con prefijo **ENSAYO_NO_PRESENTAR**. Una sola autorización simulada marca la preparación completa como ensayo. El adaptador real sigue deshabilitado en la configuración inicial; este avance no emitió comprobantes ni contactó a ARCA.

El operador revisa total, base gravada, exento, no gravado, IVA contenido/discriminado, percepción IIBB, datos completos y denominación de treinta posiciones. La constancia INT-IVT conserva revisión, fuentes y responsable de sesión. Una versión nueva necesita referencia distinta y el antecedente vigente del mismo mes y ambiente. No modifica documentos, cuentas corrientes, diario, stock ni tesorería, y puede conservarse después de un cierre contable.

## Archivos y clasificación

Se generan dos TXT: comprobantes de 266 posiciones y alícuotas de 62, sin contar CRLF. La codificación es ISO-8859-1 sin BOM. Fechas AAAAMMDD, importes en centavos, moneda PES y cambio 1. Cada comprobante se informa individualmente, con el mismo número en los campos desde/hasta; no se generan agrupaciones diarias. El vencimiento opcional de esta salida ordinaria se completa con ceros.

Las B incluyen sus bases e IVA contenido en alícuotas. Las operaciones exclusivamente exentas o no gravadas se identifican con E o N y detalle cero; una combinación ambigua o tasa cero sin encuadre se bloquea. La percepción IIBB representada en el documento se asigna a su campo. Otros tributos y los impuestos nacionales contenidos positivos de B requieren clasificación adicional; no se los ubica automáticamente como impuestos internos ni se pierden en un campo cero. Las alícuotas se contrastan con las líneas conservadas.

Se validan anchuras, importes seguros, caracteres, unicidad de originales y tamaño máximo de diez millones de bytes por TXT. La denominación completa permanece en la constancia y se muestra su corte para el archivo. El texto exportado con controles o caracteres no representables se rechaza.

El diseño publica cinco posiciones para el punto. La normativa general vigente y WSFE admiten puntos de 00001 a 99998, mientras el manual de registración conserva una descripción de rango diferente y umbrales históricos de identificación. Esta salida usa las cinco posiciones y CUIT; no aplica esos umbrales antiguos. La aceptación efectiva en Portal IVA debe contrastarse antes del uso real.

## Permisos y recuperación

El permiso de Finanzas → IVA ventas y compras permite conservar. Un perfil exclusivo de reporte impositivo puede revisar, consultar antecedentes y generar archivos; no autoriza comprobantes ni conserva preparaciones. Perfiles ajenos y el permiso de conciliación contable de IVA, por sí solos, no reciben estas constancias.

La conservación vuelve a obtener las autorizaciones del servidor: no acepta un resultado fiscal suministrado por el navegador. La restauración y la recuperación independiente comprueban la correspondencia de las fuentes de ventas con las solicitudes originales de su SQLite. Las copias fiscales completas requieren conservar esa base y su clave de auditoría; un JSON de gestión sin las solicitudes no sustituye ese respaldo.

## Evidencia del 17/10/2026

El ensayo `var/qa-vat-sales.sqlite` conservó dos versiones de enero de 2026, INT-IVT-00000001 y 2, y recuperó la primera después de recargar. Incluyó cuatro ventas/notas de dos sucursales, pese a consultar una sola en el filtro general, y excluyó un X. Total neto de notas $476,95, base gravada $400, exento $10, no gravado $5 e IVA neto $61,95. La factura A conserva número fiscal 142; B y notas, sus números propios. Las cinco operaciones comerciales, cinco asientos y cuatro autorizaciones simuladas quedaron intactos.

Se conservaron capturas nativas, transcripciones y ambos pares de TXT desde las constancias persistidas: 1072 bytes de comprobantes y 320 de alícuotas por versión. El navegador no informó el evento de descarga después de pulsar el botón; no se considera confirmado ni ese evento ni una aceptación del portal. Los bytes y sus posiciones sí se verificaron. Informe reproducible: `scripts/verify-vat-sales-ui.mjs`, resultado `output/verification-vat-sales-2026-10-17.json`.

Pasaron 555 pruebas de dominio, 80 HTTP, 31 fiscales y 36 de exportaciones/QR. Las 56 bases acumuladas conservaron validación completa después de JSON, integridad SQLite, HMAC y conciliación de fuentes fiscales. Además, un respaldo sellado de este ensayo fue recuperado en una copia temporal independiente: estado completo, usuarios, cuatro autorizaciones, dos preparaciones y sus TXT idénticos; sin sesiones recuperadas. La copia temporal se retiró después de verificarla.

## Fuentes primarias consultadas

- [ARCA: especificaciones de IVA Simple](https://www.arca.gob.ar/iva/iva-simple/especificaciones-especiales.asp).
- [Diseño de comprobantes y alícuotas, páginas 1 y 3](https://www.arca.gob.ar/iva/documentos/libro-iva-digital-diseno-registros.pdf).
- [Especificaciones y validaciones de registración, revisión 30/07/2025](https://www.arca.gob.ar/iva/documentos/Libro-IVA-Digital-Especificaciones.pdf).
- [RG 1415, texto vigente y numeración](https://biblioteca.arca.gob.ar/search/query/norma.aspx?p=t%3ARAG%7Cn%3A1415%7Co%3A3%7Ca%3A2003%7Cf%3A07%2F01%2F2003).

## Conciliación contable

La [revisión INT-IDV](conciliacion-iva-ventas.md) compara estos comprobantes con el diario y el complemento interno de ingresos del mes, sin modificar los TXT. Conserva diferencias, fuentes y versiones. La referencia de trabajo no constituye un ajuste fiscal admitido ni determina la declaración.

## Pendientes

Conciliación con precargas de Portal IVA, validación real de los TXT, comprobantes históricos emitidos por otro sistema, otras identificaciones y clases, anulados, agrupaciones, regímenes especiales, moneda extranjera, clasificación de otros tributos, ajustes de débito y su relación con ingresos devengados antes de la factura, imputaciones fiscales distintas de emisión, determinación y constancia de presentación. No se deduce ausencia de movimiento de la inexistencia de ventas en SICA. El objetivo integral del PPTX continúa activo.
