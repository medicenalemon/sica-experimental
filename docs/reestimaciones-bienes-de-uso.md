# Nueva vida útil y valor residual de bienes de uso

Disponible en **Contabilidad → Bienes de uso y depreciaciones → Reestimar vida y residual** para un bien lineal diario con puesta en marcha registrada. Conserva el alta, las estimaciones anteriores y los cargos ya contabilizados. No modifica la factura, su IVA o deuda, ni el costo del bien.

## Fundamento y alcance

Se verificó el párrafo 345 del [texto ordenado de RT 54 con modificaciones](https://www.consejo.org.ar/storage/attachments/Resolucion%20Tecnica%20N%2054%20%28TO%20RT%2059%20y%20modi-7TbUsld18i.pdf) el 11/10/2026: las nuevas estimaciones fundamentadas del consumo o valor final afectan las depreciaciones posteriores desde la nueva evidencia. Este circuito registra esa información y su efecto hacia adelante. No corrige errores de períodos anteriores ni acredita adopción, vigencia o cumplimiento contable integral para una entidad o jurisdicción.

## Recorrido

1. Contabilizar la depreciación del bien hasta el día anterior al cambio. Si existe cargo pendiente, la revisión lo informa y se debe registrar primero el corte global correspondiente. No exige otro cargo si la depreciación hasta entonces ya es cero.
2. Seleccionar **Reestimar vida y residual** en el registro del bien. Indicar fecha de nueva información, referencia, evidencia y fundamento, primer día posterior a la nueva vida útil y nuevo residual en ARS.
3. Revisar la estimación anterior, costo, depreciación conservada, valor neto, nueva base y días restantes. La nueva vida empieza el día del cambio y termina el día anterior a la fecha final indicada.
4. Registrar **INT-RE**. La constancia conserva responsable de sesión, fecha, motivo, parámetros, alta, puesta en marcha, cargos y antecedente del cambio. No genera un asiento inmediato ni duplica el costo.
5. Preparar el siguiente corte de depreciación. Su cálculo conserva la depreciación previa y distribuye sólo la nueva base: `máximo(0, neto anterior − nuevo residual)`. El cargo nuevo es la diferencia entre el acumulado calculado y el contabilizado.

El cálculo usa días y centavos enteros, con redondeo acumulado y tope de la nueva base. Un residual igual o superior al neto deja el cargo posterior en cero sin revertir gastos anteriores ni incrementar el valor del activo. El nuevo residual puede superar el costo original, siempre que sea no negativo y representable en centavos seguros. Una nueva evidencia posterior puede volver a modificar esas estimaciones; cada cambio parte del saldo neto entonces existente.

Se exige un cambio real de fecha final o residual, fechas abiertas dentro del ejercicio, puesta en marcha disponible y fecha posterior al último corte global y al cambio previo del mismo bien. No se admiten dos cambios del mismo bien en un día ni una fecha final igual o anterior al cambio. La vida restante admite hasta cien años. Si el alta o la puesta en marcha se registró el mismo día del cambio con uso iniciado antes, se impide omitir esos cargos: primero se contabiliza hasta ese día y la revisión se aplica desde un día posterior. Resolver cambios simultáneos que deban aplicarse a la misma fecha de esa carga tardía requiere ampliar el circuito diario. Terrenos no depreciables, compras con notas pendientes y ventas pendientes de baja requieren sus circuitos específicos.

La fecha no es una selección libre para recalcular ejercicios anteriores: representa la nueva información registrada. Un cambio respecto de parámetros erróneos previos requiere el tratamiento de errores pendiente, en lugar de este circuito de nuevas estimaciones. La aplicación conserva el fundamento declarado; el respaldo real y el juicio profesional corresponden al responsable de la información.

## Historial, cierres y permisos

El panel **Cambios de estimaciones conservados** permite consultar y exportar las constancias. Los cargos posteriores identifican la constancia y conservan su revisión, base, acumulado previo y valor neto. Las consultas anteriores al cambio recuperan la estimación que correspondía a esa fecha.

Un cierre posterior incluye las nuevas estimaciones entre sus fuentes; un cierre anterior sigue conservando su propia información. La apertura del siguiente ejercicio mantiene los parámetros y saldos, sin otro asiento de costo. Un nuevo cambio en el ejercicio abierto usa la depreciación y neto conservados al final del anterior.

Los perfiles con permiso para bienes de uso pueden revisar y registrar. El servidor exige revisión idéntica y versión vigente, obtiene el responsable de sesión, registra en una transacción y admite reintentos del mismo identificador sin duplicar. Un perfil exclusivo del módulo recibe las fuentes necesarias para reproducir la misma revisión que el servidor. Stock no recibe las constancias. Consulta de cierres puede leer las fuentes y constancias, sin permiso para reestimar.

Al recuperar una copia, SICA valida secuencia, antecedente, fuentes, acumulado, neto, base restante, parámetros y vínculos de cargos. Rechaza constancias alteradas, listas inválidas, cargos inconsistentes, un asiento impropio en INT-RE o una estimación faltante utilizada por un cargo o cierre conservado. Una copia anterior válida sin cambios sigue admitida; los respaldos y la restauración son administrados, no un historial externo inalterable.

## Verificación del 11/10/2026

La base sintética separada partió de un equipo de **$1.000**, residual **$100** y cargo cerrado de **$300** al 10/10. En el navegador se registró nueva evidencia al **11/10**, vida remanente de **60 días**, hasta el 09/12 inclusive: neto conservado **$700**, base nueva **$600**. El corte del **20/10** añadió **$100**; quedaron depreciación acumulada **$400** y valor neto **$600**. La duración de ensayo no define una tasa fiscal.

Después de recargar y reiniciar la vista, INT-RE-00000001 y los dos cargos se recuperaron desde SQLite en versión 3. El cierre del 10/10 conservó costo, cargo de $300 y estimación inicial; no incluyó la evidencia posterior. La factura mantuvo IVA **$210** y deuda **$1.210**. No se agregaron movimientos de stock o tesorería. Los cuatro asientos sumaron **$2.610** en debe y haber.

Pasaron **322 pruebas**: 246 de dominio, 13 de archivos/QR, 41 HTTP y 22 fiscales, además de lint y compilaciones local, compartida y servidor. Incluyen cambios sucesivos, puesta en marcha posterior, residual superior al costo, centavo fraccionario, conservación de cierres, nuevo ejercicio, permisos, reintentos y recuperación. Dieciséis bases pasaron validación completa tras el recorrido JSON, integridad SQLite y auditoría HMAC.

Evidencia: [saldo y cargos](../output/asset-reestimate-2026-10-11.png), [constancia recuperada](../output/asset-reestimate-detail-2026-10-11.png), [transcripción](../output/asset-reestimate-browser-2026-10-11.txt) e [informe](../output/verification-asset-reestimate-2026-10-11.json). El recorrido usa `scripts/preview-asset-reestimate-ui.mjs` y `scripts/verify-asset-reestimate-ui.mjs`, con Node 24 y compilación compartida/servidor. Sus credenciales son sólo de prueba.

## Trabajo pendiente

Faltan cambios simultáneos con uso anterior informado por un alta/puesta en marcha cargada ese mismo día, corrección de errores anteriores, cambios de método y función del cargo, cambios de clase, componentes/mejoras, notas de costo, anulaciones, saldos iniciales, adquisiciones sin factura, bajas parciales o diferidas, deterioro de otros tipos de activos, revaluación, inflación y anexos completos. No hay amortización fiscal automática ni emisión de estados contables normativos. Este avance conserva el alcance pendiente documentado en [bienes-de-uso.md](bienes-de-uso.md) y [requisitos-y-alcance.md](requisitos-y-alcance.md).

Las estimaciones posteriores a INT-VR usan el neto reducido y conservan la medición como fuente. El tope de reversión mantiene un cálculo paralelo con las mismas estimaciones sin pérdidas anteriores. Véase [valor-recuperable-bienes-de-uso.md](valor-recuperable-bienes-de-uso.md).

## Integración posterior de moneda de cierre

La [conciliación por bien INT-CB](conciliacion-bienes-moneda-cierre.md) enlaza el ajuste anual ya contabilizado con costo, depreciación, deterioro y estimaciones del subregistro. Las operaciones posteriores requieren esa base y conservan sus referencias; las constancias anteriores mantienen su revisión. El recuperable y las nuevas estimaciones requieren evidencia en una base monetaria homogénea. La conciliación por SKU/depósito y otras ampliaciones siguen pendientes.
