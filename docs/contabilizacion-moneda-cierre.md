# Contabilización anual de moneda de cierre

Contabilidad → Moneda de cierre y RECPAM incorpora la constancia INT-AI. Toma una preparación INT-MC revisada del ejercicio activo completo, agrega sus diferencias al diario y conserva los saldos antes/después. Es una operación de Administrador General. La preparación INT-MC y sus fuentes permanecen conservadas.

## Recorrido

1. Preparar y revisar el expediente anual INT-MC vigente. El ajuste debe preceder al cierre de resultados; no se contabilizan cortes intermedios ni períodos ya bloqueados.
2. Preparar las cuentas del ajuste o seleccionar cuentas propias. Cada componente patrimonial usa una cuenta distinta y conserva la clasificación del antecedente. Capital nominal y ajuste del capital permanecen separados. RECPAM positivo/negativo y otros resultados positivo/negativo requieren cuatro cuentas de ingresos/gastos sin movimientos del ejercicio. Una cuenta utilizada en ejercicios anteriores puede reutilizarse si su resultado anterior quedó cancelado.
3. Fundamentar cada diferencia de medición y patrimonio y repartirla por sucursal. Los importes son Debe positivo y Haber negativo. Cada reparto conserva el ajuste exacto y no repite sucursales. Un ajuste total cero admite repartos compensados revisados, salvo capital nominal, que conserva su saldo y reparto. El sistema no decide por sí solo la atribución económica entre unidades.
4. Las diferencias de resultados por partidas mantienen la sucursal del asiento de origen. El RECPAM por unidad surge de la exposición monetaria inicial y los movimientos mensuales. Un centavo de diferencia entre sumas redondeadas por unidad y cálculo agregado se expone explícitamente. El resto financiero de cada sucursal queda separado; no se llama RECPAM a toda diferencia de medición o tenencia.
5. Revisar asientos, Debe/Haber, resultado global, mediciones, componentes patrimoniales, saldos antes/después y exposición por sucursal. Confirmar cuentas y reparto. Los índices Ensayo requieren un reconocimiento adicional de que se trata de una prueba; no sirven para una entidad real.
6. Registrar INT-AI. Se agrega un asiento balanceado por cada sucursal con diferencias, sin reescribir los asientos anteriores, documentos, stock o tesorería. El ejercicio ajustado deja de admitir operaciones nuevas; el cierre de resultados es el paso siguiente. Un período no admite dos contabilizaciones del mismo ajuste.
7. Cerrar resultados usando la cuenta revisada de Resultados no asignados. Si existe preparación anual INT-MC, el cierre exige su contabilización. Con INT-AI registrado, el cierre comprueba el resultado ajustado y conserva su enlace y prueba contable. Las cuentas de resultados quedan canceladas y el período se bloquea.
8. Abrir el ejercicio siguiente. La apertura conserva el diario y toma los saldos ajustados como iniciales; no agrega otro asiento de apertura. El aviso identifica INT-AI y exige continuidad con su INT-MC para evitar una segunda reexpresión de los mismos importes. La próxima preparación utiliza la moneda del cierre anterior para los saldos ya ajustados y documenta los orígenes de las variaciones nuevas.

## Conservación y recuperación

Se conservan responsable de sesión, referencia, fundamento, cuentas, repartos, exposición, redondeo, fuentes anteriores, revisión y asientos. Se comprueban partida doble por sucursal, resultado global y saldo final de cada medición y componente patrimonial. La restauración rechaza fuentes o asientos alterados, períodos duplicados, cuentas incompatibles y movimientos posteriores sobre el ejercicio ajustado. No se admite revertir estos asientos por el circuito de diario manual.

Las nuevas constancias guardan identidades reales del balance posterior (`ledgerVersion: 2`), comprobadas contra el diario. Las primeras constancias de ensayo que conservaron identidades de vista previa siguen siendo legibles: se valida exactamente su proyección y los asientos reales se identifican por separado. Esto no cambia importes, revisión, fuentes o asientos históricos.

PDF y XLSX incluyen los cuatro estados y notas del antecedente, índices/orígenes, proceso secuencial, asientos reales del ajuste, reparto por sucursal, saldos antes/después y exposición monetaria por unidad. El diario fuente corresponde a la preparación anterior al ajuste; los asientos INT-AI se muestran en una sección separada. El libro conserva importes numéricos en ARS e identidades reales de asientos.

## Alcance y trabajo restante

La mecánica utiliza la preparación documentada en [moneda-cierre.md](moneda-cierre.md), orientada por los §§176–200 del [texto ordenado RT 54 / RT 59 y modificaciones](https://www.consejo.org.ar/storage/attachments/Resolucion%20Tecnica%20N%2054%20%28TO%20RT%2059%20y%20modi-7TbUsld18i.pdf). No acredita adopción jurisdiccional, mediciones completas ni emisión profesional.

Inventario y bienes de uso conservan sus operaciones e importes de origen; INT-AI agrega la capa de reexpresión al mayor. Faltan conciliación y anexos de esa capa por SKU/depósito/bien, demás mediciones y revelaciones, ajustes intermedios contabilizados, correcciones y reapertura controlada del ejercicio ajustado, impuesto a las ganancias/diferido, inflación impositiva, consolidación, modelos específicos y certificación profesional. Las correcciones de un ejercicio ya ajustado necesitan un circuito propio: no se habilita una carga tardía que invalide su preparación. El objetivo integral del PPTX sigue abierto.

## Evidencia reproducible

Pasaron 394 pruebas: 305 de dominio, 20 de archivos, 47 HTTP y 22 fiscales. Los nuevos casos incluyen registración exacta, cuentas/repartos, dos sucursales, redondeo monetario agregado, permisos, revisión, reintentos, restauración, cierre/apertura y un segundo período que utiliza la apertura ajustada sin duplicar el anterior. Una comprobación HTTP adicional valida identidades reales del balance posterior. Pasaron lint y compilaciones local, compartida y de servidor.

El navegador preparó cuentas y repartos, registró INT-AI-00000001 y lo recuperó después de recargar. Debe y Haber: $2.001,37. Resultado ajustado: $197,72; RECPAM: −$681,82; otro resultado por redondeo: −$0,01. El cierre INT-CR canceló los resultados por $197,72 y la apertura INT-AE activó 12/10/2026–31/12/2026. El ensayo usa un ejercicio configurado que termina el 11/10/2026 para comprobar el recorrido completo; no representa un cierre calendario real ni una serie oficial.

Se conservaron los once asientos originales. Se agregaron uno de ajuste y uno de cierre; la apertura no duplicó saldos. Costo de bienes de uso inicial siguiente $3.000, depreciación acumulada $75, mercadería $409,09, capital nominal $3.200, ajuste de capital $1.572,73, reserva $120 y resultado no asignado negativo $58,64. Los movimientos operativos de inventario, documentos y tesorería permanecen conservados.

El [informe de verificación](../output/verification-inflation-posting-2026-10-11.json) comprueba veintiuna bases con validación completa, recorrido JSON, integridad SQLite y HMAC. Incluye [captura del ajuste](../output/inflation-posting-2026-10-11.jpg), [captura de apertura](../output/inflation-opening-2026-10-11.jpg) y [recorrido textual](../output/inflation-posting-browser-2026-10-11.txt). Se generaron el [XLSX de veintiuna hojas](../output/ajuste-anual-2026-10-11.xlsx) y el [PDF de veinticuatro páginas](../output/pdf/ajuste-anual-2026-10-11.pdf) desde la constancia registrada en pantalla, con lectura de importes y revisión visual completa. Los datos e índices son exclusivamente sintéticos.

Con Node 24, `scripts/preview-inflation-posting-ui.mjs` conserva la base de ensayo y `scripts/verify-inflation-posting-ui.mjs` comprueba y exporta el registro guardado desde la pantalla.

## Integración posterior de moneda de cierre

La [conciliación por bien INT-CB](conciliacion-bienes-moneda-cierre.md) enlaza el ajuste anual ya contabilizado con costo, depreciación, deterioro y estimaciones del subregistro. Las operaciones posteriores requieren esa base y conservan sus referencias; las constancias anteriores mantienen su revisión. El recuperable y las nuevas estimaciones requieren evidencia en una base monetaria homogénea. La conciliación por SKU/depósito y otras ampliaciones siguen pendientes.
