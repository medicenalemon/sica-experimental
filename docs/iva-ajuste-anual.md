# Ajuste anual nominal del prorrateo de IVA

Amplía la [estimación global y mixta de compras](iva-prorrateo.md). En Finanzas → IVA ventas y compras se preparan constancias **INT-IA** para el ejercicio comercial completo de una empresa responsable inscripta. Se admiten entre uno y doce meses calendario completos desde abril de 1992; el ejercicio debe haber terminado y pertenecer al calendario conservado. La forma jurídica SRL/SAS no determina por sí sola el destino fiscal de las compras.

## Cómputos y bases declarados

Cada mes con compras ordinarias requiere su última preparación INT-IC vigente, con originales y fuentes actuales. Las estimaciones globales/mixtas deben usar el mismo ejercicio. Se declara el crédito prorrateado efectivamente computado, su respaldo mensual y una explicación si difiere del preparado. SICA no presume que una preparación mensual sea una declaración presentada. El importe declarado no puede superar el IVA común conservado de ese mes; una diferencia de clasificación exige revisar primero la preparación mensual.

Los meses sin compras ordinarias o con apropiación directa requieren referencia y confirmación expresa de ausencia de IVA común omitido, con cómputo prorrateado cero. Esto no declara SIN MOVIMIENTO ante ARCA. Los internos X permanecen excluidos y se advierten para revisar posibles originales omitidos.

Las bases anuales son importes netos fiscales gravados, exentos y no gravados, declarados con referencia, fundamento y revisión del responsable. No se reconstruyen automáticamente desde ventas. Se confirma el criterio nominal y la cobertura completa de meses, cómputos y devoluciones.

## Devoluciones y diferencia anual

Cada nota de crédito ordinaria requiere revisar la factura de origen. Se declara qué IVA común de compras **originadas en el mismo ejercicio** se devolvió y qué crédito común histórico fue restituido. El IVA común devuelto está limitado por el IVA de la nota y, acumulando notas, por el común de la factura de origen conservado en INT-IC. La restitución común no puede superar el común devuelto, la restitución mensual total ni, acumulando notas, el cómputo declarado del mes de origen.

Las notas sobre compras de ejercicios anteriores conservan ambos importes de alcance anual en cero. Su restitución mensual histórica continúa separada; no se vuelve a prorratear usando la proporción del ejercicio actual. Destinos y restituciones requieren clasificación documentada: el sistema no los infiere de una nota parcial.

El papel de trabajo calcula:

- IVA común neto anual = común de facturas/débitos del ejercicio − común devuelto de compras del mismo ejercicio.
- Crédito común anual = común neto × bases gravadas / total de bases; redondeo conjunto a centavos con aritmética entera exacta.
- Cómputo neto comparado = suma de cómputos mensuales declarados − restitución histórica común de ese mismo conjunto.
- Ajuste total = crédito común anual − cómputo neto comparado; positivo a favor de la empresa y negativo a favor de ARCA.

La apropiación directa queda fuera de esta diferencia. No se reescriben TXT ni se registran asientos o presentaciones. Una nueva versión reemplaza la preparación total y conserva el antecedente; se muestra aparte la variación entre preparaciones, que no debe sumarse de nuevo al ajuste total.

## Conservación, permisos y salida

La confirmación requiere revisión exacta. Se conservan bases, meses, referencias, restituciones, empresa, nombres, calendario y prefijos de comprobantes/originales/preparaciones mensuales. Cambios posteriores señalan fuentes desactualizadas y no reescriben el historial. El servidor controla permisos, concurrencia, repetición y auditoría. Finanzas/impuestos permite conservar; Reportes/impositivos permite leer. Los perfiles ajenos no reciben estas constancias.

La descarga es un **JSON de trabajo SICA** con la revisión completa; no es un diseño oficial para importar en ARCA. El responsable revisa el resultado en Ajustes al Crédito Fiscal del período de cierre y concilia su efecto contable por separado.

## Fundamento consultado el 17/10/2026

El [artículo 13 de la Ley de IVA](https://biblioteca.arca.gob.ar/dcp/TOR_C_020631_1997_03_26) prevé estimaciones sobre destinos indistintos y ajuste en el último mes del ejercicio. El [decreto 692/98, artículos 50 y 53–55](https://biblioteca.arca.gob.ar/dcp/DEC_C_000692_1998_06_11) trata restitución según cómputo histórico, bases netas, actividades especiales y apropiación directa. La conciliación declarada implementada arriba requiere revisión profesional del caso.

El [artículo 39 de la Ley 24.073](https://www.argentina.gob.ar/normativa/nacional/ley-24073-472/actualizacion) establece un límite temporal para las variaciones de tablas e índices de actualización. El alcance implementado exige confirmar el criterio nominal para un ejercicio moderno; no implementa índices ni extiende ese criterio automáticamente a supuestos especiales o períodos históricos anteriores.

El [manual oficial de ARCA, Ajustes al Crédito Fiscal](https://www.arca.gob.ar/iva/documentos/Libro-IVA-Digital-Especificaciones.pdf), habilita el ajuste anual en el mes de cierre y distingue importes a favor del responsable y de ARCA. No se verificó una presentación real.

## Evidencia y límites

El navegador conservó INT-IA-00000001 y 00000002 en `var/qa-vat-annual.sqlite`, revisión 3, sobre el ejercicio sintético 2025. Común bruto $63 − devolución $2,10 = común neto $60,90. Cómputos declarados $43,05 − restitución $1 = $42,05. Al 80%: crédito anual $48,72 y ajuste $6,67 a favor de empresa. La segunda versión, al 20%: crédito anual $12,18 y ajuste $29,87 a favor de ARCA; variación respecto del antecedente −$36,54. Ambas se recuperaron después de recargar. Los cuatro comprobantes, cuatro asientos, originales y tres preparaciones mensuales con sus archivos permanecieron intactos.

Pasaron **531 pruebas de dominio y 77 HTTP**, lint y compilaciones compartida/servidor. **53 bases** conservaron validación completa después de JSON, integridad SQLite y auditoría HMAC. Informe: `output/verification-vat-annual-2026-10-17.json`; script: `scripts/verify-vat-annual-ui.mjs`; JSON verificados: `output/vat-annual-2026-10-17/`. Se conservan capturas nativas y recorridos completos de ambas versiones recuperadas. El evento nativo de descarga no fue observado; se verificaron los bytes desde las constancias guardadas.

Quedan pendientes la constatación externa de bases, destinos y cómputos, su contabilización automática, actividades especiales, cambios de destino conocidos en ejercicios posteriores, imputaciones fiscales distintas de emisión, otros diseños/tributos y la presentación/validación real en ARCA. Se incorporó la [conciliación con movimientos contables y ajustes manuales respaldados](conciliacion-iva-contabilidad.md), sin contabilización automática. El objetivo integral del PPTX continúa abierto.
