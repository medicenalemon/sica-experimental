# VNR actual del inventario después del ajuste anual

SICA incorpora una comparación actual y completa del inventario al cierre, posterior a INT-AI y a su conciliación INT-CI. La operación conserva INT-VI, sus estimaciones y evidencia, y registra solamente la pérdida adicional o reversión limitada. No reexpresa otra vez el costo ni la pérdida anterior.

## Secuencia y controles

1. Conservar la valuación exacta, la preparación anual y el ajuste INT-AI.
2. Conciliar costo bruto y desvalorización acumulada por artículo/depósito con INT-CI.
3. En **Contabilidad → Valuación de inventario**, usar **Comparar VNR actual al cierre**. El administrador revisa el inventario completo, el corte fijo, evidencia actual y moneda homogénea.
4. Revisar el asiento y las cifras finales de activo, resultado, patrimonio y efectivo. Conservar la comparación.
5. Consultar **Ver cuatro estados finales con VNR actual** desde la constancia y exportar PDF/XLSX.
6. Cerrar resultados y abrir el ejercicio siguiente. El CPP posterior conserva el costo bruto ajustado y consume proporcionalmente la pérdida final.

Los nuevos INT-AI usan `ledgerVersion: 3`. Cuando hay cantidades de inventario al corte, su revisión incluye el paso pendiente de VNR actual. El cierre de resultados y el bloqueo genérico del período lo exigen, incluso si la comparación actual no genera asiento. El parámetro no puede desactivarse en la solicitud de contabilización. Los registros históricos sin versión o de versión 2 conservan su revisión y alcance originales; no se les inventa retrospectivamente una nueva evaluación.

La excepción para INT-VI permite únicamente esta comparación en la fecha del ajuste anual y antes del cierre de resultados y de la apertura. No habilita comprobantes, asientos manuales ni otros movimientos del ejercicio ajustado. La cuenta regularizadora debe quedar fuera de efectivo y junto a las existencias.

## Estados finales y privacidad

El informe final es una derivación del expediente anual y de las comparaciones de cierre enlazadas, con fuentes identificadas. No crea un INT-EC nominal ni modifica INT-MC. Recalcula el resultado final, situación patrimonial y evolución del patrimonio contra el mayor; el asiento de inventario no cambia efectivo. Expone por separado pérdidas y reversiones, y agrega una nota con estimaciones y respaldo.

Las pérdidas anteriores se identifican por sus líneas reales del diario para evitar mover otros gastos que compartan cuenta contable. La distribución de cuentas del informe usa los saldos finales.

La revisión de inventario contiene sólo antecedentes de inventario. Un segundo comprobante de revisión vincula las cifras financieras completas de cierre. El perfil que sólo puede operar inventario recibe la referencia segura, sin estados ni revisiones financieras completas, y reproduce el CPP del servidor. La comparación de cierre requiere administrador; también se verifican sesión, CSRF, idempotencia y versión de datos.

## Evidencia del ensayo del 12/10/2026

| Etapa | Bruto ARS | Pérdida acumulada ARS | Neto ARS |
|---|---:|---:|---:|
| Origen, septiembre | 1.000 | 400 | 600 |
| INT-AI + INT-CI, octubre | 1.500 | 600 | 900 |
| VNR actual, octubre | 1.500 | 700 | 800 |
| Venta posterior de tres unidades | 450 | 210 consumidos | 240 de costo neto |
| Siete unidades restantes | 1.050 | 490 | 560 |

La nueva pérdida es $100. Los estados finales derivados muestran activo y patrimonio $800, resultado −$700, variación de efectivo $0 y conciliaciones $0. La venta siguiente fue verificada por dominio y HTTP, con cierre/apertura y continuidad anual; no se atribuye ese recorrido al navegador.

Desde el navegador se revisó y conservó INT-VI-00000002 y se consultaron los cuatro estados finales; se activaron ambos botones de exportación. La herramienta del navegador rechazó la captura de pantalla en sus API documentadas, por lo que se conserva la transcripción DOM. Los bytes PDF/XLSX fueron producidos por los mismos constructores sobre la constancia persistida; no se acredita una descarga del navegador.

Se verificaron **462 pruebas**: 358 de dominio, 30 de archivos, 52 HTTP y 22 fiscales; compilación compartida y del servidor y análisis estático. **26 bases** pasaron validación completa tras JSON, integridad SQLite y auditoría HMAC. El PDF tiene diez páginas revisadas visualmente y el XLSX diez hojas, incluida la distribución final y las fuentes del diario.

Evidencia en `output/verification-inventory-current-vnr-2026-10-12.json`, `output/inventory-current-vnr-browser-2026-10-12.txt` y `output/qa/inventory-current-vnr-*.log`. Base separada de prueba: `var/qa-inventory-current-vnr.sqlite`, revisión 2.

## Marco y límites

La referencia técnica consultada es [RT 54, texto ordenado con RT 59 y modificaciones](https://www.consejo.org.ar/storage/attachments/Resolucion%20Tecnica%20N%2054%20%28TO%20RT%2059%20y%20modi-7TbUsld18i.pdf), párrafos 191 y 296–311: homogeneidad de magnitudes comparadas, comparación con recuperable y presentación/revelación de pérdidas y reversiones. Esta implementación no acredita adopción jurisdiccional ni cumplimiento integral.

La presentación fuente del inventario debe conservar un único rubro; las distribuciones entre varios rubros requieren ampliación. Por ahora, el informe final se consulta desde INT-VI por administrador; la consulta independiente para perfiles autorizados de estados permanece pendiente. Tampoco resuelve otros modelos de medición, costos completos de conversión, pasivos estimados reexpresados, correcciones de ejercicios cerrados, fiscalidad real ni emisión profesional. El objetivo integral del PPTX continúa activo.
