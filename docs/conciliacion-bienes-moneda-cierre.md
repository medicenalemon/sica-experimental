# Conciliación del ajuste anual por bien de uso

Contabilidad → Bienes de uso y depreciaciones incorpora INT-CB. Enlaza la contabilización anual INT-AI con cada bien vigente al corte, su costo, depreciación acumulada y deterioro. Conserva los asientos del ajuste: INT-CB agrega metadatos revisados, sin otro asiento ni cambios en la factura, alta o cargos históricos.

## Recorrido

1. Conservar y contabilizar el ajuste anual INT-MC/INT-AI. Seleccionar ese ajuste en el registro de bienes. También se puede conciliar después del cierre de resultados y apertura del siguiente ejercicio: las constancias históricas conservan las capas que tenían al registrarse.
2. Incluir todos los bienes vigentes al corte. Distribuir entre ellos las partidas de costo, depreciación y deterioro, conservando el mes de origen, cuenta y saldo de cada partida fuente. El sistema propone importes cuando hay un único propietario y el saldo coincide exactamente; para cuentas compartidas exige reparto revisado.
3. Identificar por cuenta y sucursal los saldos ajenos al registro. No se incorporan como bienes ficticios ni se reparten automáticamente entre los bienes existentes. Cada antigüedad debe quedar asignada completamente; los saldos anterior y posterior deben coincidir con el mayor por cuenta y sucursal.
4. Fundamentar las magnitudes y meses de origen del residual y de la depreciación que habría correspondido sin deterioro. Su suma conserva la estimación previa; la conversión usa exactamente los índices del ajuste fuente. Las magnitudes compensadas requieren respaldo. La conciliación cambia la unidad de medida, no supone una nueva estimación económica.
5. Revisar costo, acumulada, deterioro, neto, residual, límite sin deterioro y conciliación con el mayor. Confirmar y conservar INT-CB. Una fuente admite una conciliación; los reintentos HTTP no duplican la constancia.
6. Descargar el anexo completo PDF o XLSX desde **Ver conciliación por bien**. Incluye trece secciones: control, costos, depreciación, deterioro, valores/estimaciones, fuentes por bien, orígenes de estimaciones, mayor por sucursal, saldos ajenos, fuentes ajenas, antigüedades fuente, índices y continuidad.

El reparto de centavos conserva el importe redondeado de cada partida del ajuste anual mediante restos mayores. El anexo expone el redondeo individual del costo y cualquier reducción del límite sin deterioro necesaria para mantenerlo dentro de ese costo. Las sumas usan centavos enteros seguros; los coeficientes conservan los valores decimales exactos del antecedente.

## Operaciones posteriores e historia

Antes de una puesta en marcha, nueva depreciación, cambio de estimaciones, deterioro/reversión o baja, el sistema exige conciliar los ajustes anuales que afectaron al bien. Las operaciones usan la base incorporada por INT-CB y conservan sus referencias. El residual y el límite sin deterioro están expresados en la misma moneda de cierre que el costo.

Desde el día siguiente al corte se distribuye el neto conciliado menos el residual durante la vida restante. Un deterioro posterior cambia la base futura y una reversión conserva el tope que habría quedado sin deterioro; las nuevas estimaciones se aplican hacia adelante. Los bienes pendientes de puesta en marcha conservan costo y deterioro conciliados hasta comenzar su uso. Los bienes totalmente consumidos o con costo reexpresado redondeado a cero no generan cargos ficticios.

Una baja total retira todo el costo y la depreciación/deterioro registrados, incluidos los del ajuste anual. Un bien de valor cero puede salir del registro sin inventar un asiento de importes cero. Los cargos históricos mantienen su cálculo nominal y revisión original; la consulta del registro al corte muestra los valores posteriores a la conciliación.

No se permite incorporar retroactivamente una conciliación sobre operaciones posteriores ya conservadas del mismo bien. Tampoco omitir una capa anterior necesaria para la siguiente. La restauración recalcula repartos, fuentes e índices y rechaza alteraciones de importes o revisiones.

## Acceso

El permiso de Bienes de uso permite conciliar; preparar cuentas contables conserva los controles de administración existentes. Un perfil limitado recibe únicamente el ajuste, índices, saldos y antigüedades necesarios para el subregistro, sin los cuatro estados completos ni el expediente financiero INT-MC. La API compara esa revisión con el estado completo del servidor y atribuye la constancia a la sesión autenticada. Los perfiles ajenos no reciben INT-CB.

## Evidencia de ensayo del 11/10/2026

Se registró y recuperó **INT-CB-00000001** en el navegador, usando una máquina textil sintética. La factura y alta conservan costo $1.000 y residual $100; el cargo original al 11/10 es $360. La serie de ensayo tiene índice septiembre 100 y octubre 150: costo conciliado $1.500, acumulada $540, neto $960 y residual $150. El cierre anterior y apertura 12/10–31/12 se conservan.

En pantalla se registró un cargo nuevo de $360 al 19/10, con acumulada total $900. La pérdida total posterior retiró costo $1.500 y acumulada $900, reconociendo pérdida $600. El mayor de ambas cuentas termina en cero. INT-CB no agregó asientos; se conservaron cinco asientos previos y sólo se agregaron el cargo posterior y la baja. Los índices y períodos abreviados son de ensayo.

Pasaron **408 pruebas**: 316 de dominio, 22 de archivos, 48 HTTP y 22 fiscales. Los casos nuevos incluyen deterioro previo al ajuste, puesta en marcha pendiente con deterioro, reestimaciones posteriores, reversión con tope en moneda homogénea, cuentas con saldos ajenos, distribución de centavos y baja de valor cero y dos cierres sucesivos con depreciación y baja en la moneda de la segunda capa. Las **22 bases de ensayo** pasaron validación completa tras JSON, integridad SQLite y verificación HMAC de auditoría. También pasaron compilación local/compartida, compilación del servidor y lint.

El PDF contiene trece páginas y el XLSX trece hojas, generados sobre la constancia efectivamente persistida; se verificaron importes numéricos y lectura de archivos. Se inspeccionaron las páginas renderizadas. Los botones de exportación se activaron sin error visible; el navegador no proporcionó un evento de descarga verificable. La comprobación de bytes corresponde a los mismos constructores del producto aplicados a esa constancia, no a una descarga acreditada por el navegador.

Archivos: `output/pdf/conciliacion-bienes-2026-10-11.pdf`, `output/conciliacion-bienes-2026-10-11.xlsx`, capturas `output/asset-inflation-2026-10-11.jpg` y `output/asset-inflation-disposal-2026-10-11.jpg`, recorrido `output/asset-inflation-browser-2026-10-11.txt` e informe `output/verification-asset-inflation-2026-10-11.json`. Fixture y comprobaciones: `scripts/asset-inflation-fixture.mjs`, `scripts/asset-inflation-ui-fixture.mjs`, `scripts/preview-asset-inflation-ui.mjs` y `scripts/verify-asset-inflation-ui.mjs`.

## Límites y marco

La conciliación incorpora los saldos de un ajuste anual revisado; no selecciona índices oficiales, certifica el origen económico ni sustituye la evaluación profesional. Se debe revisar que el recuperable y las nuevas estimaciones utilicen la misma base monetaria del bien. Los ajustes intermedios posteriores requieren su propio tratamiento; no se agregan índices silenciosamente a una comparación de valor recuperable.

El marco de referencia consultado es [RT 54, texto ordenado con RT 59/62 y JG 656/2025](https://www.consejo.org.ar/storage/attachments/Resolucion%20Tecnica%20N%2054%20%28TO%20RT%2059%20y%20modi-7TbUsld18i.pdf), especialmente el proceso de reexpresión y la coherencia entre mediciones y consumos. Su adopción y aplicabilidad a una entidad concreta requieren revisión jurisdiccional. Esta implementación no acredita cumplimiento normativo integral.

Siguen pendientes las capas por SKU/depósito del inventario, otras mediciones y anexos, altas iniciales de bienes ya existentes, fabricación de bienes, bajas parciales/diferidas, revaluación, correcciones y reapertura controlada, ajustes fiscales/impuestos diferidos, estados normativos completos y conexión real de homologación ARCA. El objetivo integral del PPTX permanece abierto.
