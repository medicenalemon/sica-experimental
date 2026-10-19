# Bienes de uso y depreciaciones

Disponible en **Contabilidad → Bienes de uso y depreciaciones**, tanto en modo local como compartido. Este circuito inicial incorpora bienes adquiridos mediante factura de proveedor, puesta en marcha y depreciación lineal diaria al costo nominal. Se conserva el historial y se integra al cierre y a la continuidad entre ejercicios.

## Criterio profesional y alcance

Se consultó el [texto ordenado de RT 54 con sus modificaciones](https://www.consejo.org.ar/storage/attachments/Resolucion%20Tecnica%20N%2054%20%28TO%20RT%2059%20y%20modi-7TbUsld18i.pdf) el 11/10/2026. Los párrafos 313–315 tratan el reconocimiento de bienes tangibles destinados al uso y su costo; 319 y 321 describen modelos y medición posterior; 339–342 vinculan depreciación, puesta en marcha y estimaciones; 345 trata cambios posteriores de estimación; 349 distingue la función del cargo y 352–356 las revelaciones. La norma adoptada, su vigencia y los tratamientos aplicables deben verificarse para la entidad y su jurisdicción. La referencia no acredita adopción en Tucumán ni cumplimiento contable integral de SICA.

## Registrar una adquisición

1. Crear un artículo de tipo **Bien de uso**. El tipo queda conservado cuando interviene en documentos. La importación de productos admite la columna opcional **Tipo**; sin ella sigue siendo Producto.
2. Registrar la compra. Un remito de Bien de uso conserva su recepción, cantidad y unidad; no genera existencias de mercadería para reventa. No admite ajustes, traslados de stock, componentes de combos ni materiales/productos de fabricación.
3. Seleccionar **Preparar cuentas** con Administrador General cuando hagan falta: costo 1.2.1, depreciación acumulada 1.2.2 y gasto 5.9. También pueden seleccionarse otras cuentas imputables de los grupos correspondientes, distintas entre sí y de las asociaciones automáticas de operaciones comerciales, fiscales e inventario.
4. Seleccionar **Capitalizar compra**. Elegir factura y SKU, identificación, clase, ubicación, fecha, referencia y fundamento del costo, destino, beneficios esperados y estimaciones. Una constancia registra la cantidad completa de esa línea. Usar SKU separados para componentes que tengan vidas diferentes.
5. Si está puesto en marcha, indicar fecha de inicio, primer día posterior a la vida útil y residual estimado en ARS. Si está pendiente, conservar fechas vacías y registrar después una puesta en marcha. El circuito admite terrenos no depreciables, sin fechas ni residual; otros supuestos específicos requieren ampliar el modelo.
6. Revisar costo y asiento y registrar la constancia. **INT-BU** debita el costo del bien y acredita exactamente la porción del gasto original de esa compra. La factura, su asiento original, el IVA, la deuda y los pagos quedan conservados. El costo proviene del asiento original: incorpora IVA no recuperable si estaba incluido en su gasto, aunque luego cambien el régimen o las asociaciones de cuentas.

La adquisición debe registrarse en una fecha abierta, dentro del ejercicio y no anterior al asiento original. Ese asiento también debe pertenecer a un período abierto. Compras con notas vinculadas requieren revisar el costo corregido mediante un circuito pendiente. No se permite duplicar una línea ni agregar adquisiciones en o antes de un corte de depreciación ya conservado.

## Puesta en marcha y cargos

Un bien pendiente admite una constancia **INT-PM** con inicio, vida útil y residual respaldados. No agrega un asiento de costo. La fecha de inicio y el registro deben ser posteriores al último corte de depreciación y pertenecer a períodos abiertos. Una segunda puesta en marcha se rechaza: los cambios posteriores de vida útil y residual tienen su [circuito de nuevas estimaciones](reestimaciones-bienes-de-uso.md).

**Preparar depreciación** calcula todos los bienes y sucursales hasta la fecha elegida. Incluye el día de puesta en marcha y excluye el primer día posterior a la vida útil. La base es costo menos residual. La proporción acumulada por días se calcula con enteros y redondeo a centavos; el cargo nuevo descuenta los cargos previamente registrados. No continúa depreciando debajo del residual. Años bisiestos y costos grandes conservan el cálculo exacto.

La revisión muestra anterior, acumulado, cargo nuevo, neto y asientos por sucursal. **INT-DP** debita gasto y acredita depreciación acumulada, sólo por la diferencia nueva. El corte es global y debe ser posterior al último conservado. No se registra un cargo cero. Todas las compras de bienes de uso hasta el corte deben estar capitalizadas; notas pendientes de corregir y ventas pendientes de baja impiden registrar la depreciación.

La fecha de consulta distingue depreciación contabilizada, cargo pendiente y valor neto registrado. Consultar una fecha anterior conserva los importes disponibles entonces. Las tablas permiten exportar XLSX/PDF de trabajo y abrir las constancias conservadas.

## Cierres, permisos y recuperación

El cierre exige capitalizar las compras de bienes de uso y contabilizar la depreciación pendiente hasta su fecha exacta. Conserva altas, puestas en marcha, cargos y asientos como fuentes del corte. Advierte sobre bienes recibidos sin factura, bienes sin puesta en marcha y políticas nominales aún pendientes de revisión. Notas y ventas o entregas de bienes de uso pendientes de conciliar impiden cerrar. Las bajas totales revisadas se integran al cierre con sus constancias.

El cierre de resultados comprende el gasto de depreciación. La apertura del ejercicio siguiente conserva costo y depreciación acumulada por sucursal sin otro asiento que duplique los saldos; las constancias y vidas útiles siguen disponibles.

General, Administración y perfiles personalizados con permiso del módulo pueden registrar altas, puesta en marcha y depreciación. Preparar cuentas requiere Administrador General. El servidor conserva el responsable de sesión, exige revisión idéntica y versión vigente, permite reintentos del mismo identificador sin duplicar y registra constancia/asientos/auditoría en una transacción. Las respuestas de un perfil exclusivo del módulo incluyen las compras necesarias con observaciones y descripciones ajenas omitidas. Para revisar las bajas, incluyen cantidades, importes, IVA y asientos originales de las facturas y entregas de bienes de uso, sin identidad del cliente, descripciones, cobros, aplicaciones ni observaciones privadas. Una factura mixta conserva sus importes necesarios para conciliar el asiento completo. De ingresos legados relacionados sólo se expone su enlace con el remito y SKU para advertir el tratamiento pendiente. La restauración vuelve a validar fuentes, estimaciones, secuencias, revisiones y asientos vinculados; rechaza constancias faltantes o alteradas.

## Verificación del 11/10/2026

Una base sintética separada registró desde el navegador una adquisición de **$1.000**, residual **$100** y vida de **30 días**, del 01/10 al 30/10 inclusive. Esta duración sólo prueba el cálculo; no representa una tasa fiscal. El corte del 10/10 consumió diez días: **$300** de depreciación y **$700** netos. La compra conservó IVA **$210** y deuda **$1.210**, sin movimientos de stock ni tesorería adicionales.

Después de recargar, la interfaz recuperó INT-BU-00000001 y INT-DP-00000001 desde SQLite en versión 3. Los asientos acumulados sumaron $2.510 en debe y haber. Quince bases de prueba, incluidas las de recorridos anteriores, conservaron validación completa, integridad SQLite y cadena HMAC. La suite pasó **311 pruebas**: 236 de dominio, 13 de archivos/QR, 40 HTTP y 22 fiscales. Lint, interfaz local/compartida y servidor compilaron.

Evidencia: [captura del registro](../output/fixed-assets-2026-10-11.png), [constancia recuperada](../output/fixed-assets-detail-2026-10-11.png), [transcripción del navegador](../output/fixed-assets-browser-2026-10-11.txt) e [informe de recuperación](../output/verification-fixed-assets-2026-10-11.json). Se reproduce con Node 24, compilación compartida y servidor, usando `scripts/preview-fixed-assets-ui.mjs` y `scripts/verify-fixed-assets-ui.mjs`; no usar esas credenciales sintéticas para datos reales.

## Trabajo pendiente

Faltan saldos de apertura de bienes existentes, adquisiciones sin factura, costos adicionales, componentes y mejoras, cambios de método/función/clase, corrección de errores anteriores, anulaciones con historial, notas de precio, bajas parciales o diferidas, deterioro de otros tipos de activos, revaluación, inflación, depreciación como costo de fabricación o construcción y anexos completos. La vida útil y el residual se fundamentan por bien; no hay amortización fiscal automática. Se deben conciliar las diferencias contables/fiscales con el profesional responsable. Este avance no completa el objetivo integral del PPTX.


## Ampliación: nuevas estimaciones

El 11/10/2026 se incorporaron cambios fundamentados de vida útil y residual, aplicados desde la nueva evidencia. Conservan costo, cargos, cierres y parámetros anteriores; el cálculo posterior reparte sólo la base remanente. Reglas y evidencia en [reestimaciones-bienes-de-uso.md](reestimaciones-bienes-de-uso.md). La suite actual suma 322 pruebas, con recuperación verificada en dieciséis bases. Los conteos y resultados de la primera verificación anterior se conservan como historial.


## Ampliación: bajas totales

Las bajas por venta, pérdida y abandono conservan antecedentes y separan su resultado, con depreciación final y conciliación de la factura. Reglas, casos pendientes y evidencia en [bajas-bienes-de-uso.md](bajas-bienes-de-uso.md). La suite actual suma 358 pruebas, con recuperación verificada en dieciocho bases. Los resultados anteriores permanecen como historial.

Las evaluaciones INT-VR conservan alcance, mediciones y evidencia; registran deterioro o reversión limitada, adaptan cargos posteriores y se integran a bajas y cierres. Reglas y evidencia en [valor-recuperable-bienes-de-uso.md](valor-recuperable-bienes-de-uso.md).

## Integración posterior de moneda de cierre

La [conciliación por bien INT-CB](conciliacion-bienes-moneda-cierre.md) enlaza el ajuste anual ya contabilizado con costo, depreciación, deterioro y estimaciones del subregistro. Las operaciones posteriores requieren esa base y conservan sus referencias; las constancias anteriores mantienen su revisión. El recuperable y las nuevas estimaciones requieren evidencia en una base monetaria homogénea. La conciliación por SKU/depósito y otras ampliaciones siguen pendientes.
