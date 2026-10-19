# Recuperabilidad actual de producción al cierre

Después de INT-AI y de la conciliación INT-CP, el Administrador General puede comparar el costo ajustado de cada orden pendiente con su importe recuperable actual. La operación conserva INT-VP y un informe de los cuatro estados finales que incorpora las comparaciones actuales de inventario y proceso. Los documentos anuales anteriores conservan sus cifras y revisiones originales.

## Circuito y controles

1. Conservar el corte de inventario y el ajuste anual revisado.
2. Conciliar inventario con INT-CI y conversión pendiente con INT-CP, incluidas las pérdidas anteriores cuando existan.
3. En «Valuación de inventario», abrir «Comparar recuperable actual de proceso al cierre». La fecha corresponde al ajuste y el alcance incluye todas las órdenes pendientes.
4. Revisar precio del lote completo, costos de venta y materiales y trabajos restantes, expresados en la moneda del cierre. Los materiales todavía sin consumir conservan su comparación en el inventario físico.
5. Revisar el asiento y las cifras de los estados finales. El servidor exige tanto la revisión de proceso como una revisión financiera vinculada antes de guardar.
6. Consultar la constancia y «Ver cuatro estados finales con proceso actual», con exportaciones PDF y XLSX. Completar las demás mediciones y revelaciones antes de la emisión profesional.

Los nuevos ajustes anuales usan versión 5 y, cuando contienen conversión pendiente, exigen la comparación completa antes de cerrar resultados o bloquear el período. Las versiones históricas mantienen su alcance. Se rechazan fechas distintas, referencias incompatibles, cuentas de efectivo como regularizadoras y registros posteriores al cierre que intenten modificar su base.

La pérdida reduce el proceso mediante una cuenta regularizadora. La reversión requiere nuevas estimaciones y queda limitada al costo sin pérdida. Los estados derivados concilian activo, resultado, evolución patrimonial y efectivo con el mayor; identifican las fuentes del gasto incluso cuando comparte cuenta con otros gastos. Las comparaciones actuales de inventario y proceso pueden conservarse en cualquiera de los dos órdenes sin alterar las revisiones anteriores. La apertura posterior utiliza el patrimonio final efectivo.

Un usuario autorizado sólo a inventario recibe las referencias e importes necesarios para reproducir el CPP. Las cotizaciones, revisiones financieras y cifras de los estados finales permanecen fuera de esa respuesta.

## Evidencia

Ejemplo sintético de dos órdenes: conversión ajustada $90, pérdida actual $10 y proceso neto $80. El informe final muestra activo $230, pasivo $107, patrimonio $123, resultado −$27 y variación de efectivo $0, sin diferencias de conciliación. El ajuste original conserva resultado −$17.

Después del cierre y la apertura, terminar A genera un lote bruto $105, con conversión $60 y pérdida transferida $10. B conserva $30 en proceso. CPP11 transfiere la pérdida sin repetir el gasto. Se verifican también reversión, combinación con pérdidas de inventario, continuidad hacia otro cierre, permisos, repetición de solicitudes y recuperación desde JSON y SQLite.

Pasaron **542 pruebas**: 428 de dominio, 33 de archivos, 59 HTTP y 22 fiscales. Las **36 bases de ensayo** conservaron validación completa después de JSON, integridad SQLite y auditoría HMAC. La compilación compartida, la del servidor y el análisis estático pasaron. La exportación nativa de once páginas fue renderizada e inspeccionada visualmente.

- Informe: `output/verification-production-current-closing-2026-10-13.json`.
- Captura: `output/production-current-closing-statements-2026-10-13.jpg`.
- Recorrido: `output/production-current-closing-browser-2026-10-13.txt`.
- PDF: `output/pdf/estados-finales-proceso-2026-10-13.pdf`.

## Fuente y alcance pendiente

La comparación por utilización, la recuperación mediante productos terminados y la reversión limitada se apoyan en los párrafos 296–301 de la [RT 54, texto ordenado RT 59 y modificaciones](https://consejo.org.ar/storage/attachments/Resolucion%20Tecnica%20N%2054%20%28TO%20RT%2059%20y%20modi-7TbUsld18i.pdf), consultada el 13/10/2026. La vinculación de constancias, el orden del circuito y la revisión financiera son decisiones de implementación.

Siguen pendientes agrupaciones conjuntas, producción parcial y consumos anormales, correcciones con pérdida activa, nuevas estimaciones sobre costos reexpresados y las demás ampliaciones de la matriz. Precios e índices del ejemplo son sintéticos; aún deben validarse la adopción profesional local, fiscalidad real y emisión productiva. El objetivo integral del PPTX permanece abierto.
