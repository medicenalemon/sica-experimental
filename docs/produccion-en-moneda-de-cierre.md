# Conversión pendiente en moneda de cierre

La ampliación incorpora la conciliación anual de la conversión que sigue en producción en proceso. Se mantiene el ejemplo configurable de comercio textil, Responsable Inscripto, Tucumán, y la autoría de Mauricio Montero y Débora Pardes.

## Recorrido disponible

1. Conservar INT-PC con costos directos, variables y fijos absorbidos por actividad normal. Administración y ociosidad permanecen en gastos.
2. Contabilizar el corte CPP exacto de inventario al cierre anual.
3. Preparar moneda de cierre: clasificar la cuenta de proceso como no monetaria y revisar las antigüedades de sus costos. Las órdenes pendientes deben conciliar exactamente con el mayor por cuenta y sucursal.
4. Contabilizar INT-AI. Las nuevas constancias usan versión 4; los antecedentes de versiones anteriores conservan su cálculo.
5. En Valuación de inventario, abrir «Conciliar conversión en proceso con moneda de cierre». Repartir cada antigüedad entre las órdenes y cuentas pendientes y conservar INT-CP después de revisar.
6. Conciliar también las existencias físicas con INT-CI y conservar la comparación actual con el VNR del inventario antes de cerrar resultados y abrir el siguiente ejercicio.
7. Al finalizar una orden, el CPP incorpora materiales valorizados y conversión ajustada; descarga el costo de proceso y conserva las demás órdenes pendientes.

INT-CP no agrega un segundo asiento del ajuste, ni modifica movimientos físicos, capacidad normal, facturas o gastos originales. Su diferencia se incorpora como referencia adicional de conversión, exclusivamente después de la fecha del cierre. Esto permite recuperar los cortes anteriores con sus revisiones originales. Las antigüedades conservan importes firmados y el reparto mantiene el total redondeado al centavo del ajuste fuente.

La conciliación requiere Administrador General. Un perfil autorizado únicamente a inventario recibe los importes y referencias necesarios para reproducir el CPP, sin el expediente de estados contables, el reparto privado de antigüedades ni la revisión financiera. El servidor comprueba revisión, permisos, versión y repetición de la solicitud antes de guardar.

## Verificación de ensayo

Índices sintéticos: septiembre 100 / octubre 150. Conversión inicial: $60; órdenes A $40 y B $20. Base ajustada: $90; A $60 y B $30. Tras el cierre y la apertura, terminar A incorpora materiales $45 y conversión $60 al lote ($105), mientras B conserva $30 en proceso. No cambia la deuda nominal de $107.

La prueba de continuidad conserva dos cierres: una segunda base a índice 200 lleva conversión $90 a $120; terminar A incorpora $80 de conversión y mantiene $40 en B. También se prueba el reparto de un centavo adicional, la restauración después de JSON, permisos, concurrencia/repetición HTTP y SQLite con auditoría HMAC.

La captura del detalle recuperado está en `output/production-inflation-detail-2026-10-13.jpg`; la evidencia de bases persistentes está en `output/verification-production-inflation-2026-10-13.json`.

## Base normativa y alcance

La RT 54 (texto ordenado RT 59 y modificaciones) trata la medición del costo de producción y la expresión de estados contables en moneda de cierre como procedimientos contables diferenciados; esta implementación conserva esa separación y enlaza los costos por orden con el ajuste revisado. Fuente primaria consultada el 13/10/2026: [texto publicado por el Consejo](https://www.consejo.org.ar/storage/attachments/Resolucion%20Tecnica%20N%2054%20%28TO%20RT%2059%20y%20modi-7TbUsld18i.pdf), capítulo 2, costos de producción y expresión en moneda de cierre (párrafos 104–110 y 176–200). La constancia por orden y su control por sucursal son decisiones de implementación, sujetas a la documentación de la entidad.

Se incorporaron la [recuperabilidad de producción](valor-recuperable-produccion.md) y su [comparación actual al cierre con estados finales](recuperable-actual-produccion-cierre.md). Los nuevos ajustes usan versión 5; las constancias de versión 4 descritas en el circuito conservan su alcance. Quedan pendientes el puente de nuevas estimaciones y notas sobre costos ya reexpresados, producción parcial y consumos anormales, otras mediciones y revelaciones. El ejemplo sintético no verifica adopción profesional en Tucumán, índices reales, ajuste por inflación impositivo ni emisión fiscal. El objetivo integral del PPTX permanece abierto.
